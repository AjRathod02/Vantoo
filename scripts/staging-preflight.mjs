import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const root = join(import.meta.dirname, "..");
const { Client } = pg;

function loadEnv(filename) {
  try {
    for (const line of readFileSync(join(root, filename), "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equals = trimmed.indexOf("=");
      if (equals < 1) continue;
      const key = trimmed.slice(0, equals).trim();
      let value = trimmed.slice(equals + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Optional when variables are already supplied by the environment.
  }
}

loadEnv(".env");
loadEnv(".env.local");

const projectRef = readFileSync(
  join(root, "supabase", ".temp", "project-ref"),
  "utf8"
).trim();
const connectionString =
  process.env.STAGING_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Set STAGING_DATABASE_URL (preferred) or DATABASE_URL for the linked staging project."
  );
}

const parsed = new URL(connectionString);
const connectionIdentity = `${parsed.hostname}:${parsed.username}`.toLowerCase();
if (!connectionIdentity.includes(projectRef.toLowerCase())) {
  throw new Error(
    "Refusing database access: connection URL does not match the linked staging project."
  );
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function queryOne(text) {
  const result = await client.query(text);
  return result.rows[0];
}

try {
  await client.connect();

  const identity = await queryOne(`
    select current_database() as database_name,
           current_user as database_user,
           current_setting('server_version') as server_version
  `);

  const history = await client.query(`
    select version
    from supabase_migrations.schema_migrations
    order by version
  `);

  const legacyHistoryExists = await queryOne(`
    select to_regclass('public.schema_migrations') is not null as exists
  `);
  const legacyHistory = legacyHistoryExists.exists
    ? await client.query(`
        select to_jsonb(m) as record
        from public.schema_migrations m
      `)
    : { rows: [] };

  const duplicatePayments = await client.query(`
    select razorpay_payment_id, count(*)::integer as uses
    from public.orders
    where razorpay_payment_id is not null
      and razorpay_payment_id <> ''
    group by razorpay_payment_id
    having count(*) > 1
    order by uses desc, razorpay_payment_id
  `);

  const schemaState = await queryOne(`
    select
      to_regclass('public.orders') is not null as has_orders,
      to_regclass('public.products') is not null as has_products,
      to_regclass('public.admin_users') is not null as has_admin_users,
      exists (
        select 1
        from pg_indexes
        where schemaname = 'public'
          and indexname = 'orders_razorpay_payment_id_uidx'
      ) as has_payment_unique_index
  `);
  const orderColumns = await client.query(`
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
    order by ordinal_position
  `);
  const productColumns = await client.query(`
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'products'
    order by ordinal_position
  `);
  const orderConstraints = await client.query(`
    select conname as name, pg_get_constraintdef(oid) as definition
    from pg_constraint
    where conrelid = 'public.orders'::regclass
    order by conname
  `);
  const sensitivePolicies = await client.query(`
    select tablename, policyname, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'addresses', 'user_locations', 'orders')
    order by tablename, policyname
  `);

  console.log(
    JSON.stringify(
      {
        linkedProjectRef: projectRef,
        database: identity,
        cliMigrationVersions: history.rows.map((row) => row.version),
        legacyMigrationRecords: legacyHistory.rows.map((row) => row.record),
        duplicateRazorpayPaymentIds: duplicatePayments.rows.length,
        schemaState,
        orderColumns: orderColumns.rows,
        productColumns: productColumns.rows,
        orderConstraints: orderConstraints.rows,
        sensitivePolicies: sensitivePolicies.rows,
      },
      null,
      2
    )
  );

  if (duplicatePayments.rows.length > 0) {
    process.exitCode = 2;
  }
} finally {
  await client.end();
}
