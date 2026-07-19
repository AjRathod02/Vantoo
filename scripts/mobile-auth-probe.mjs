const email = `smoke${Date.now()}@gmail.com`;
const password = "SmokeTest123!";

const signup = await fetch("http://localhost:3000/api/auth/signup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Mobile Smoke",
    email,
    password,
    phone: "9999999999",
  }),
});
console.log("signup", signup.status, await signup.text());

const login = await fetch("http://localhost:3000/api/auth/mobile/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, app: "customer" }),
});
const loginBody = await login.json();
const accessLen = loginBody.session?.accessToken?.length ?? 0;
const refreshLen = loginBody.session?.refreshToken?.length ?? 0;
console.log("login", login.status, {
  hasAccessToken: accessLen > 20,
  hasRefreshToken: refreshLen > 20,
  error: loginBody.error,
  user: loginBody.user?.email,
});

if (!loginBody.session?.accessToken) process.exit(1);

const token = loginBody.session.accessToken;
for (const path of [
  "/api/auth/me",
  "/api/customer/orders",
  "/api/vendor/me",
  "/api/rider/me",
]) {
  const res = await fetch(`http://localhost:3000${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(path, res.status, (await res.text()).slice(0, 220));
}

if (refreshLen > 20) {
  const refresh = await fetch("http://localhost:3000/api/auth/mobile/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: loginBody.session.refreshToken }),
  });
  const refreshBody = await refresh.json();
  console.log("refresh", refresh.status, {
    hasAccessToken: Boolean(refreshBody.session?.accessToken),
    error: refreshBody.error,
  });
} else {
  console.log("refresh skipped — login response had no refresh token");
}
