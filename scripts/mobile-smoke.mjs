/**
 * Smoke-test mobile connectivity against the Next.js API.
 * Usage: node scripts/mobile-smoke.mjs [baseUrl]
 */
const BASE = (process.argv[2] || process.env.API_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);

const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
}

async function json(path, init) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

await check("public products", async () => {
  const { status, body } = await json("/api/customer/products");
  if (status !== 200) throw new Error(`status ${status}`);
  const count = body?.products?.length ?? 0;
  return `${count} products`;
});

await check("mobile login validation", async () => {
  const { status, body } = await json("/api/auth/mobile/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "x" }),
  });
  if (status !== 400) throw new Error(`expected 400, got ${status}`);
  return body?.error || "400 ok";
});

await check("mobile login bad credentials", async () => {
  const { status } = await json("/api/auth/mobile/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "mobile-smoke-missing@example.com",
      password: "wrong-password",
      app: "customer",
    }),
  });
  if (status !== 400 && status !== 503) {
    throw new Error(`expected 400/503, got ${status}`);
  }
  return `status ${status}`;
});

await check("bearer auth rejection", async () => {
  const { status } = await json("/api/customer/orders", {
    headers: { Authorization: "Bearer invalid-token-xxxxxxxxxxxxxxxxxxxx" },
  });
  if (status !== 401) throw new Error(`expected 401, got ${status}`);
  return "401 without valid token";
});

await check("vendor me unauthenticated", async () => {
  const { status } = await json("/api/vendor/me");
  if (status !== 401) throw new Error(`expected 401, got ${status}`);
  return "401";
});

await check("rider me unauthenticated", async () => {
  const { status } = await json("/api/rider/me");
  if (status !== 401) throw new Error(`expected 401, got ${status}`);
  return "401";
});

await check("admin orders unauthenticated", async () => {
  const { status } = await json("/api/admin/orders");
  if (status !== 401 && status !== 403) {
    throw new Error(`expected 401/403, got ${status}`);
  }
  return `status ${status}`;
});

const email = process.env.MOBILE_SMOKE_EMAIL;
const password = process.env.MOBILE_SMOKE_PASSWORD;

if (email && password) {
  await check("authenticated mobile session", async () => {
    const login = await json("/api/auth/mobile/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, app: "customer" }),
    });
    if (login.status !== 200 || !login.body?.session?.accessToken) {
      throw new Error(login.body?.error || `login status ${login.status}`);
    }
    const token = login.body.session.accessToken;
    const me = await json("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (me.status !== 200 || !me.body?.user?.id) {
      throw new Error("bearer /api/auth/me failed");
    }
    const orders = await json("/api/customer/orders", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (orders.status !== 200) throw new Error(`orders ${orders.status}`);
    const refresh = await json("/api/auth/mobile/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: login.body.session.refreshToken }),
    });
    if (refresh.status !== 200 || !refresh.body?.session?.accessToken) {
      throw new Error("refresh failed");
    }
    return `user ${me.body.user.email || me.body.user.id}`;
  });
} else {
  results.push({
    name: "authenticated mobile session",
    ok: true,
    detail: "skipped (set MOBILE_SMOKE_EMAIL / MOBILE_SMOKE_PASSWORD)",
  });
}

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ base: BASE, results, failed: failed.length }, null, 2));
process.exit(failed.length ? 1 : 0);
