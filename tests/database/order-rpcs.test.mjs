import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import pg from "pg";

const root = join(import.meta.dirname, "..", "..");
for (const filename of [".env", ".env.local"]) {
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
    // Optional environment file.
  }
}

const stagingEnabled = process.env.STAGING_DB_TESTS === "1";
const localEnabled = process.env.SUPABASE_LOCAL_DB_TESTS === "1";
const enabled = stagingEnabled || localEnabled;
const connectionString =
  process.env.STAGING_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const projectRef = stagingEnabled
  ? readFileSync(join(root, "supabase", ".temp", "project-ref"), "utf8").trim()
  : "";
if (
  stagingEnabled &&
  !`${new URL(connectionString).hostname}:${new URL(connectionString).username}`
    .toLowerCase()
    .includes(projectRef.toLowerCase())
) {
  throw new Error("Database tests refuse to run outside linked staging.");
}

function client() {
  return new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
}

async function fixture(db) {
  const user = await db.query("select id from public.profiles order by created_at limit 1");
  const product = await db.query(
    "select id, service from public.products where in_stock = true order by id limit 1"
  );
  assert.ok(user.rows[0]?.id, "staging needs one test profile");
  assert.ok(product.rows[0]?.id, "staging needs one in-stock product");
  return {
    userId: user.rows[0].id,
    productId: product.rows[0].id,
    service: product.rows[0].service,
  };
}

function prepareArgs(f, key, hash) {
  return [
    f.userId,
    key,
    hash,
    JSON.stringify([{ productId: f.productId, quantity: 1 }]),
    "cod",
    JSON.stringify({
      id: "staging-test",
      label: "Test",
      line1: "1 Test Street",
      line2: "",
      city: "Test",
      pincode: "000000",
    }),
    f.service,
  ];
}

test("RPC privileges and idempotency semantics", { skip: !enabled }, async () => {
  const db = client();
  await db.connect();
  try {
    await db.query("begin");
    const f = await fixture(db);
    const nonce = crypto.randomUUID();
    const key = `db-test-${nonce}`;
    const hash = "a".repeat(64);

    const privilege = await db.query(`
      select
        has_function_privilege(
          'authenticated',
          'public.prepare_order(uuid,text,text,jsonb,text,jsonb,text)',
          'execute'
        ) as authenticated_can_execute,
        has_function_privilege(
          'service_role',
          'public.prepare_order(uuid,text,text,jsonb,text,jsonb,text)',
          'execute'
        ) as service_can_execute
    `);
    assert.equal(privilege.rows[0].authenticated_can_execute, false);
    assert.equal(privilege.rows[0].service_can_execute, true);

    const first = await db.query(
      "select public.prepare_order($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7) as result",
      prepareArgs(f, key, hash)
    );
    const replay = await db.query(
      "select public.prepare_order($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7) as result",
      prepareArgs(f, key, hash)
    );
    assert.equal(first.rows[0].result.replayed, false);
    assert.equal(replay.rows[0].result.replayed, true);
    assert.equal(
      first.rows[0].result.order.id,
      replay.rows[0].result.order.id
    );

    await assert.rejects(
      db.query(
        "select public.prepare_order($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7)",
        prepareArgs(f, key, "b".repeat(64))
      ),
      /IDEMPOTENCY_CONFLICT/
    );

    await db.query("rollback");
  } finally {
    await db.end();
  }
});

test("concurrent last-stock order allows one winner", { skip: !enabled }, async () => {
  const setup = client();
  const first = client();
  const second = client();
  await Promise.all([setup.connect(), first.connect(), second.connect()]);
  let previous;
  let f;
  const keys = [`stock-a-${crypto.randomUUID()}`, `stock-b-${crypto.randomUUID()}`];
  try {
    f = await fixture(setup);
    previous = await setup.query(
      "select * from public.product_inventory where product_id = $1",
      [f.productId]
    );
    await setup.query(
      `insert into public.product_inventory
         (product_id, available_quantity, reserved_quantity, version)
       values ($1, 1, 0, 0)
       on conflict (product_id) do update
       set available_quantity = 1, reserved_quantity = 0, version = product_inventory.version + 1`,
      [f.productId]
    );

    const results = await Promise.allSettled([
      first.query(
        "select public.prepare_order($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7)",
        prepareArgs(f, keys[0], "c".repeat(64))
      ),
      second.query(
        "select public.prepare_order($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7)",
        prepareArgs(f, keys[1], "d".repeat(64))
      ),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.match(
      String(results.find((result) => result.status === "rejected").reason),
      /INSUFFICIENT_STOCK/
    );
  } finally {
    if (f) {
      await setup.query(
        "delete from public.orders where user_id = $1 and idempotency_key = any($2::text[])",
        [f.userId, keys]
      );
      if (previous?.rows[0]) {
        const row = previous.rows[0];
        await setup.query(
          `update public.product_inventory
           set available_quantity = $2, reserved_quantity = $3,
               version = $4, updated_at = $5
           where product_id = $1`,
          [
            f.productId,
            row.available_quantity,
            row.reserved_quantity,
            row.version,
            row.updated_at,
          ]
        );
      } else {
        await setup.query(
          "delete from public.product_inventory where product_id = $1",
          [f.productId]
        );
      }
    }
    await Promise.all([setup.end(), first.end(), second.end()]);
  }
});
