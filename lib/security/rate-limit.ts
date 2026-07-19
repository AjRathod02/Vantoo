import { getRedisCommand, redisKey } from "@/lib/redis/client";

type Bucket = { count: number; resetAt: number };
type RateLimitResult =
  | { ok: true; remaining: number }
  | {
      ok: false;
      retryAfterSec: number;
      reason: "limited" | "unavailable";
    };

const buckets = new Map<string, Bucket>();

const FIXED_WINDOW_LUA = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return {count, ttl}
`;

function memoryRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(input.key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(input.key, { count: 1, resetAt: now + input.windowMs });
    return { ok: true, remaining: Math.max(input.limit - 1, 0) };
  }
  if (existing.count >= input.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      reason: "limited",
    };
  }
  existing.count += 1;
  buckets.set(input.key, existing);
  return { ok: true, remaining: Math.max(input.limit - existing.count, 0) };
}

export async function rateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const redis = getRedisCommand();
  if (!redis) {
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.RATE_LIMIT_MEMORY_FALLBACK === "true"
    ) {
      return memoryRateLimit(input);
    }
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil(input.windowMs / 1000)),
      reason: "unavailable",
    };
  }

  try {
    const key = redisKey("rate-limit", input.key);
    const [count, ttl] = (await redis.eval(
      FIXED_WINDOW_LUA,
      1,
      key,
      String(input.windowMs)
    )) as [number, number];
    if (Number(count) > input.limit) {
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil(Number(ttl) / 1000)),
        reason: "limited",
      };
    }
    return {
      ok: true,
      remaining: Math.max(input.limit - Number(count), 0),
    };
  } catch (error) {
    console.error("Redis rate limiter unavailable:", error);
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.RATE_LIMIT_MEMORY_FALLBACK === "true"
    ) {
      return memoryRateLimit(input);
    }
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil(input.windowMs / 1000)),
      reason: "unavailable",
    };
  }
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
