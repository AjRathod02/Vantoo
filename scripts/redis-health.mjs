import { readFileSync } from "node:fs";
import { join } from "node:path";
import Redis from "ioredis";

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

if (!process.env.REDIS_URL) {
  console.error("REDIS_URL is not configured; Redis health check skipped.");
  process.exit(2);
}

const prefix = process.env.REDIS_KEY_PREFIX || "vantoo:health";
const command = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
const publisher = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
const subscriber = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const counterKey = `${prefix}:health:counter:${nonce}`;
const channel = `${prefix}:health:fanout:${nonce}`;

try {
  const pong = await command.ping();
  const counts = await Promise.all([
    command.incr(counterKey),
    publisher.incr(counterKey),
  ]);
  await command.expire(counterKey, 30);

  const received = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Pub/Sub timeout")), 5_000);
    subscriber.once("message", (receivedChannel, message) => {
      clearTimeout(timeout);
      resolve({ receivedChannel, message });
    });
  });
  await subscriber.subscribe(channel);
  await publisher.publish(channel, nonce);
  const message = await received;

  console.log(
    JSON.stringify({
      ping: pong,
      sharedCounter: counts[1] === counts[0] + 1,
      fanout:
        message.receivedChannel === channel && message.message === nonce,
    })
  );
} finally {
  await command.del(counterKey).catch(() => undefined);
  await Promise.all([
    command.quit(),
    publisher.quit(),
    subscriber.quit(),
  ]);
}
