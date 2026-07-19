import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
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

const keyId = process.env.RAZORPAY_KEY_ID ?? "";
const redisUrl = process.env.REDIS_URL ?? "";
const checks = {
  supabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseSecret: Boolean(
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  ),
  stagingDatabaseUrl: Boolean(
    process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL
  ),
  razorpayKeyId: Boolean(keyId),
  razorpayKeySecret: Boolean(process.env.RAZORPAY_KEY_SECRET),
  razorpayWebhookSecret: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  razorpayMode: keyId.startsWith("rzp_test_")
    ? "test"
    : keyId.startsWith("rzp_live_")
      ? "live"
      : "missing-or-unknown",
  redisUrl: Boolean(redisUrl),
  redisTls: redisUrl.startsWith("rediss://"),
  platformDisabled: process.env.PLATFORM_ENABLED !== "true",
};

console.log(JSON.stringify(checks, null, 2));
if (
  !checks.supabaseUrl ||
  !checks.supabaseSecret ||
  checks.razorpayMode !== "test" ||
  !checks.razorpayKeySecret ||
  !checks.razorpayWebhookSecret ||
  !checks.redisUrl
) {
  process.exitCode = 2;
}
