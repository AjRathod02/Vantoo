# Vantoo Supabase launch readiness report

- **Date:** 2026-07-19
- **Target:** linked Supabase staging project
- **Production changes:** none
**Verdict:** not approved for production or several-thousand-user readiness

## Completed hardening

- Removed recursive mobile root dependencies and generated nested dependency
  trees. Customer, vendor, and rider Expo SDK 57 projects each pass TypeScript
  and all 20 Expo Doctor checks.
- Reconciled Supabase CLI history with the legacy migration table. Versions
  `001` through `009` and the existing restaurant import now match locally and
  remotely.
- Preflight found zero duplicate non-empty Razorpay payment IDs; the unique
  index was already present.
- Applied the verified hardening migrations to staging:
  - durable sequence-generated text order IDs;
  - required per-user idempotency keys and request hashes;
  - service-role-only order/payment/cancel/transition/refund/webhook RPCs;
  - payment attempts, refund attempts, webhook deduplication, status history,
    inventory reservations, and durable tracking events;
  - owner-only order/tracking reads and removal of direct customer writes;
  - profile/location role-escalation controls;
  - catalog search/composite indexes and assigned-rider enforcement.
- Removed production use of the in-memory order store and platform write
  fallbacks. Durable write errors now fail the request.
- Moved catalog filtering/sorting/pagination into bounded Supabase queries.
  Public catalog reads use short Next.js cache tags; product writes invalidate
  the catalog tag.
- Replaced checkout N+1 product reads with one fail-closed batch query and cart
  limits.
- Added provider-neutral `ioredis` clients, atomic Lua rate limits, and one
  pattern subscriber per instance for tracking fanout. Supabase tracking is
  persisted before Redis publish.
- Online checkout now creates the Vantoo order/payment attempt before the
  Razorpay order. Verify/status are bound to the authenticated attempt and
  exact stored amount.
- Razorpay webhooks persist `x-razorpay-event-id`, deduplicate replays, retain
  unmatched events, and reconcile captured, failed, refund-processed, and
  refund-failed states. Gateway acceptance leaves refunds processing until a
  verified webhook completes them.

## Automated evidence

- Root unit tests: 5 passed.
- Staging database tests: 2 passed.
  - authenticated cannot execute the order RPC; service role can;
  - identical idempotency key/hash replays the same order;
  - same key/different hash conflicts;
  - two concurrent last-stock orders produce exactly one winner.
- Root TypeScript: passed.
- Root lint: passed with one existing `ProductReviews` hook dependency warning.
- Next.js production build: passed. Build still reports existing Edge Runtime
  compatibility warnings and a dynamic-cookie diagnostic for an admin route.
- Platform build: passed for all workspaces while disabled for launch.
- Platform tests: 16 passed; several services currently have no tests.
- Three mobile TypeScript checks: passed.
- Three Expo Doctor runs: 20/20 each.
- All new staging migrations passed transaction/rollback verification before
  push. Supabase CLI reports staging history aligned.

## Evidence not yet available

### Managed Redis

`scripts/redis-health.mjs` could not run because `REDIS_URL` is not available in
the local operator environment. App Hosting now references the `REDIS_URL`
secret, but TLS connectivity, shared counters, and cross-instance Pub/Sub have
not been observed against the managed service.

### Razorpay

Local configuration has Razorpay test key ID and secret, but
`RAZORPAY_WEBHOOK_SECRET` is missing. The following test-mode matrix has not
been executed against a deployed staging URL:

- UPI, card, and netbanking success/failure;
- checkout dismissal and retry;
- amount/order/signature tampering and payment reuse;
- duplicate and out-of-order captured/failed/refund webhooks;
- partial, full, duplicate, and failed refunds;
- cross-user verify/status ownership checks.

### Load and browser/device testing

The staged k6 profile exists at `tests/load/staging.js`, but no HTTPS staging
base URL and managed Redis connection were available for this run. The 100,
500, 1,000, and several-thousand-VU profiles were not executed. No p95/p99,
error-rate, database, or Redis saturation evidence exists yet.

Firebase project `vantoo-dd30e` is not on the Blaze plan. Firebase CLI cannot
enable `firebaseapphosting.googleapis.com` or inspect/deploy the configured
`vantoo` App Hosting backend until the billing-plan upgrade is completed.

iOS, Android, Safari, Firefox, and full admin/vendor/rider UI journeys were not
run in a device/browser lab.

### Local Supabase reset

Docker Desktop is not running on this workstation, so local `supabase db reset`
could not run. Migration SQL was instead checked inside rollback transactions
against the confirmed staging database before staging push.

## Remaining release blockers

1. Upgrade Firebase project `vantoo-dd30e` to Blaze so App Hosting can be
   enabled and a staging build deployed.
2. Create/grant the App Hosting `REDIS_URL` secret and pass
   `npm run redis:health` against managed TLS Redis.
3. Set `RAZORPAY_WEBHOOK_SECRET`, configure staging webhook events, and record
   the complete Razorpay test-mode matrix.
4. Deploy the staging build and run k6 at 100, 500, 1,000, then agreed
   several-thousand VUs without Razorpay mutation load.
5. Record agreed p95/p99 latency, error-rate, Postgres, Redis, and App Hosting
   saturation thresholds.
6. Run Supabase security/performance advisors and review all findings.
7. Complete browser/device and vendor/rider/admin acceptance testing.
8. Review the staging evidence and rollback procedure before any production
   migration.

## Current conclusion

The order system is materially safer and its core transactional concurrency
behavior is proven on staging. That does not prove smooth operation for
thousands of simultaneous customers. Production approval remains blocked until
Redis, Razorpay webhook/UI, staged load, advisor, and device/browser evidence
are complete.
