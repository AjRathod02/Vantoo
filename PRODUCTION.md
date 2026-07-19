# Vantoo launch runbook

The launch architecture is Next.js plus Supabase, managed Redis, and Razorpay.
Keep `PLATFORM_ENABLED=false`; the Fastify platform services are not in the
launch request path.

## Required runtime configuration

Configure these as staging App Hosting variables/secrets before deployment:

- Firebase project `vantoo-dd30e` must be upgraded to Blaze before App Hosting
  and `firebaseapphosting.googleapis.com` can be enabled.
- Supabase: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`, and the matching public variables.
- Database operations: `STAGING_DATABASE_URL` for operator scripts. Do not put
  this connection string in client-visible variables.
- Redis: TLS `REDIS_URL` (`rediss://...`) and `REDIS_KEY_PREFIX`.
- Razorpay test mode: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
  `NEXT_PUBLIC_RAZORPAY_KEY_ID`, and `RAZORPAY_WEBHOOK_SECRET`.
- Runtime: `PLATFORM_ENABLED=false`,
  `RATE_LIMIT_MEMORY_FALLBACK=false`, and
  `TRACKING_MEMORY_FALLBACK=false`.

Check local operator configuration without printing secrets:

```bash
npm run launch:config
npm run redis:health
```

## Migration workflow

Use the pinned Supabase CLI. Do not use `/api/setup/migrate`,
`scripts/migrate.mjs`, or `scripts/migrate-all.mjs`.

```bash
npx supabase migration list --linked
node scripts/staging-preflight.mjs
npx supabase db push --linked --dry-run
npx supabase db push --linked
npx supabase migration list --linked
```

New migrations can be syntax/semantic checked against staging and rolled back:

```bash
node scripts/verify-staging-migration.mjs \
  supabase/migrations/<timestamp>_<name>.sql
```

For local reset/apply, Docker Desktop must be running:

```bash
npx supabase start
npx supabase db reset
```

`supabase/seed.sql` contains test fixtures only. Never use `--include-seed`
when pushing to production.

## Razorpay staging

The webhook URL is:

```text
https://<staging-host>/api/payments/razorpay/webhook
```

Enable payment captured, payment failed, refund processed, and refund failed
events. Every delivery must include `x-razorpay-event-id`. The endpoint stores
and deduplicates the event before reconciliation.

Before production approval, record evidence for test UPI/card/netbanking
success and failure, dismissal/retry, payload tampering, signature/payment
reuse, duplicate and out-of-order webhooks, partial/full/duplicate refunds,
and cross-user status access.

## Verification

```bash
npm run test
npm run typecheck
npm run lint
npm run build
npm run test:db
npm run build --prefix platform
npm run test --prefix platform

npm run mobile:install
npm run typecheck --prefix apps/customer-mobile
npm run typecheck --prefix apps/vendor-mobile
npm run typecheck --prefix apps/rider-mobile
```

Run staging database tests only against the confirmed linked project:

```bash
STAGING_DB_TESTS=1 npm run test:db
```

Run load tests in steps. Razorpay mutation routes are intentionally excluded:

```bash
STAGING_BASE_URL=https://<staging-host> TARGET_VUS=100 npm run load:staging
STAGING_BASE_URL=https://<staging-host> TARGET_VUS=500 npm run load:staging
STAGING_BASE_URL=https://<staging-host> TARGET_VUS=1000 npm run load:staging
```

## Release gate

Do not migrate production or claim high-concurrency readiness until all are
recorded:

- zero lost or duplicate orders in concurrency/load tests;
- zero unauthorized order/tracking subscriptions;
- Redis TLS health and cross-instance Pub/Sub evidence;
- Razorpay test-mode and replay matrix evidence;
- agreed p95/p99 latency, error-rate, Postgres, and Redis thresholds;
- clean migration/advisor review and a rollback plan.
