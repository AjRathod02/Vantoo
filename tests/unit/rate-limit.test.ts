import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis/client", () => ({
  getRedisCommand: () => null,
  redisKey: (...parts: string[]) => parts.join(":"),
}));

import { rateLimit } from "@/lib/security/rate-limit";

describe("rateLimit development fallback", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RATE_LIMIT_MEMORY_FALLBACK", "true");
  });

  it("enforces the configured limit", async () => {
    const key = `unit-${crypto.randomUUID()}`;
    expect(
      await rateLimit({ key, limit: 2, windowMs: 60_000 })
    ).toMatchObject({ ok: true, remaining: 1 });
    expect(
      await rateLimit({ key, limit: 2, windowMs: 60_000 })
    ).toMatchObject({ ok: true, remaining: 0 });
    expect(
      await rateLimit({ key, limit: 2, windowMs: 60_000 })
    ).toMatchObject({ ok: false, reason: "limited" });
  });

  it("fails closed when fallback is not explicitly enabled", async () => {
    vi.stubEnv("RATE_LIMIT_MEMORY_FALLBACK", "false");
    expect(
      await rateLimit({
        key: `closed-${crypto.randomUUID()}`,
        limit: 1,
        windowMs: 1_000,
      })
    ).toEqual({
      ok: false,
      retryAfterSec: 1,
      reason: "unavailable",
    });
  });
});
