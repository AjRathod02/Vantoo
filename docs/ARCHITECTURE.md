# Launch architecture

```text
Web and Expo clients
        |
        v
Next.js BFF
  |-- Supabase Auth
  |-- Supabase Postgres (catalog, orders, payments, durable tracking)
  |-- Managed Redis/TLS (rate limits, tracking cache, Pub/Sub)
  `-- Razorpay test mode
```

`PLATFORM_ENABLED=false` is mandatory for launch. The services in `platform/`
remain build-tested for a later phase and are not an order, catalog, or
tracking fallback.

## Durable order boundary

All order/payment/refund mutations use service-role-only Postgres RPCs.
Customers have owner reads but no direct order writes. The database assigns
compatible text IDs, enforces `(user_id, idempotency_key)`, compares request
hashes, reserves managed inventory under row locks, and records status history.

Online payment order:

1. Batch and database pricing validate the cart.
2. `prepare_order` creates a pending Vantoo order and payment attempt.
3. Razorpay creates a gateway order for the stored amount.
4. Verify/status fetch the authenticated stored attempt and exact captured
   amount.
5. `finalize_order_payment` atomically records payment and confirms the order.

## Tracking boundary

Rider/admin coordinates are persisted through `persist_order_tracking`.
Only assigned riders can write rider-originated events. After the transaction
succeeds, the BFF caches the latest state and publishes through Redis. Each
application instance owns one pattern subscriber and multiplexes messages to
authenticated SSE clients. Polling the durable order remains the degraded read
path.

## Catalog boundary

Supabase applies filters, deterministic sorting, exact counts, and bounded
page ranges. Public reads use 30-second tagged Next.js caching. Admin/vendor
writes invalidate `catalog`; checkout pricing, auth, orders, and private vendor
data are not cached.
