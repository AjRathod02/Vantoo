import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";

const unexpectedResponses = new Counter("unexpected_responses");
const orderFailures = new Rate("order_failures");
const baseUrl = __ENV.STAGING_BASE_URL;

export const options = {
  scenarios: {
    browse: {
      executor: "ramping-vus",
      stages: [
        { duration: "1m", target: Number(__ENV.TARGET_VUS || 100) },
        { duration: "3m", target: Number(__ENV.TARGET_VUS || 100) },
        { duration: "1m", target: 0 },
      ],
      exec: "browse",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750", "p(99)<1500"],
    unexpected_responses: ["count==0"],
    order_failures: ["rate<0.01"],
  },
};

export function setup() {
  if (!baseUrl || !baseUrl.startsWith("https://")) {
    throw new Error("Set STAGING_BASE_URL to the HTTPS staging deployment.");
  }
  return { baseUrl };
}

export function browse(data) {
  const page = Math.floor(Math.random() * 5) + 1;
  const response = http.get(
    `${data.baseUrl}/api/products?service=grocery&page=${page}&limit=24`
  );
  const ok = check(response, {
    "catalog returned 200": (value) => value.status === 200,
    "catalog is bounded": (value) => {
      try {
        const body = value.json();
        return body.products.length <= 24 && typeof body.hasMore === "boolean";
      } catch {
        return false;
      }
    },
  });
  if (!ok) unexpectedResponses.add(1);
  sleep(Math.random() * 2 + 0.5);
}

// Invoke explicitly with: k6 run --exec codOrder tests/load/staging.js
// This never calls Razorpay mutation endpoints.
export function codOrder(data) {
  if (__ENV.RUN_ORDER_FLOW !== "true") return;
  const login = http.post(
    `${data.baseUrl}/api/auth/mobile/login`,
    JSON.stringify({
      email: __ENV.MOBILE_SMOKE_EMAIL,
      password: __ENV.MOBILE_SMOKE_PASSWORD,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
  if (login.status !== 200) {
    orderFailures.add(true);
    return;
  }
  const token = login.json("session.accessToken");
  const catalog = http.get(`${data.baseUrl}/api/products?limit=1`);
  const product = catalog.json("products.0");
  if (!product) {
    orderFailures.add(true);
    return;
  }
  const idempotencyKey = `k6-${__VU}-${__ITER}-${Date.now()}`;
  const order = http.post(
    `${data.baseUrl}/api/orders`,
    JSON.stringify({
      items: [{ productId: product.id, quantity: 1 }],
      paymentMethod: "cod",
      service: product.service,
      idempotencyKey,
      address: {
        id: "k6",
        label: "Load test",
        line1: "Staging only",
        line2: "",
        city: "Test",
        pincode: "000000",
      },
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  orderFailures.add(order.status !== 201 && order.status !== 200);
  sleep(1);
}
