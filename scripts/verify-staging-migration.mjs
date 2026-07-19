import { readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
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

const requestedPath = process.argv[2];
if (!requestedPath) {
  throw new Error("Usage: node scripts/verify-staging-migration.mjs <migration.sql>");
}

const migrationPath = resolve(root, requestedPath);
const migrationsRoot = resolve(root, "supabase", "migrations");
if (!migrationPath.startsWith(`${migrationsRoot}\\`)) {
  throw new Error("Migration must be under supabase/migrations.");
}

const projectRef = readFileSync(
  join(root, "supabase", ".temp", "project-ref"),
  "utf8"
).trim();
const connectionString =
  process.env.STAGING_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Set STAGING_DATABASE_URL for the linked staging project.");
}

const parsed = new URL(connectionString);
if (
  !`${parsed.hostname}:${parsed.username}`
    .toLowerCase()
    .includes(projectRef.toLowerCase())
) {
  throw new Error(
    "Refusing database access: connection URL does not match linked staging."
  );
}

const sql = readFileSync(migrationPath, "utf8");
if (/^\s*(commit|rollback)\b/im.test(sql)) {
  throw new Error("Migration contains transaction control and cannot be rollback-verified.");
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query("begin");
  await client.query("set local lock_timeout = '5s'");
  await client.query("set local statement_timeout = '60s'");
  await client.query(sql);
  await client.query("rollback");
  console.log(`Verified and rolled back ${basename(migrationPath)} on staging.`);
} catch (error) {
  try {
    await client.query("rollback");
  } catch {
    // Preserve the original migration error.
  }
  throw error;
} finally {
  await client.end();
}
