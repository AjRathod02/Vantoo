# Vantoo

Vantoo is a multi-client commerce and delivery platform for food, grocery,
medicine, and e-commerce.

## Launch architecture

- Next.js 14 App Router BFF and customer/admin web applications
- Supabase Auth and Postgres as the system of record
- Managed Redis over TLS for shared rate limits and tracking Pub/Sub
- Razorpay for online payments and refunds
- Three native Expo/React Native apps: customer, vendor, and rider

The Fastify services under `platform/` remain build-tested but are disabled for
the Supabase-only launch with `PLATFORM_ENABLED=false`.

## Setup

Use Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open:

- Customer web: `http://localhost:3000`
- Admin portal: `http://localhost:3000/admin`

See `PRODUCTION.md` for migration, secrets, staging, payment, and release-gate
instructions.

## Mobile applications

```bash
npm run mobile:install
npm run mobile:customer
npm run mobile:vendor
npm run mobile:rider
```

Each app is a native Expo/React Native project and uses bearer-token mobile
authentication. Set `EXPO_PUBLIC_API_URL` in each mobile app's local `.env`.
See `apps/README.md`.

## Quality gates

```bash
npm run test
npm run typecheck
npm run lint
npm run build

STAGING_DB_TESTS=1 npm run test:db
npm run redis:health
npm run mobile:smoke

npm run build --prefix platform
npm run test --prefix platform
```

The database suite covers RPC privileges, idempotency replay/conflicts, and a
concurrent last-stock race. Staging load profiles are in
`tests/load/staging.js`; they do not call Razorpay mutation endpoints.

## Repository layout

```text
app/                    Next.js pages and API routes
apps/customer-mobile/   Customer Expo app
apps/vendor-mobile/     Vendor Expo app
apps/rider-mobile/      Rider Expo app
lib/                    Commerce, auth, Redis, payment, and server services
supabase/migrations/    Ordered Supabase CLI migrations
tests/                  Unit, database, and staged load tests
platform/               Disabled-for-launch Fastify services
```

## Current release status

Production is not approved yet. The transactional order/catalog/database
changes are applied to staging and automated database/build gates pass.
Managed Redis connectivity, the complete Razorpay webhook/UI matrix, staged
load results, and browser/device QA still require recorded evidence before
production migration.
