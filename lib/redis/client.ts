import Redis from "ioredis";

type RedisGlobals = {
  vantooRedisCommand?: Redis;
  vantooRedisPublisher?: Redis;
  vantooRedisSubscriber?: Redis;
};

const globals = globalThis as unknown as RedisGlobals;

function createClient(role: string) {
  const url = process.env.REDIS_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("REDIS_URL is required in production");
    }
    return null;
  }
  return new Redis(url, {
    connectionName: `vantoo-${role}`,
    lazyConnect: true,
    maxRetriesPerRequest: role === "subscriber" ? null : 1,
    enableReadyCheck: true,
    retryStrategy: (attempt) => Math.min(attempt * 100, 2_000),
  });
}

function singleton(
  key: keyof RedisGlobals,
  role: "command" | "publisher" | "subscriber"
) {
  if (!globals[key]) {
    const client = createClient(role);
    if (!client) return null;
    globals[key] = client;
  }
  return globals[key] ?? null;
}

export function getRedisCommand() {
  return singleton("vantooRedisCommand", "command");
}

export function getRedisPublisher() {
  return singleton("vantooRedisPublisher", "publisher");
}

export function getRedisSubscriber() {
  return singleton("vantooRedisSubscriber", "subscriber");
}

export function redisKey(...parts: Array<string | number>) {
  const prefix = process.env.REDIS_KEY_PREFIX?.trim() || "vantoo";
  return [prefix, ...parts].map(String).join(":");
}
