# Vantoo client applications

Four separate clients share one Next.js BFF backed by Supabase.

| App | Location | How to run | API namespace |
|-----|----------|------------|--------------|
| **Customer Web** (PWA) | Repository root `app/` | `npm run dev` → :3000 | `/api/*` |
| **Customer Mobile** | `apps/customer-mobile/` | `npm run mobile:customer` | `/api/auth/mobile/*`, `/api/products`, `/api/orders` |
| **Vendor Mobile** | `apps/vendor-mobile/` | `npm run mobile:vendor` | `/api/auth/mobile/*`, `/api/vendor/*` |
| **Rider Mobile** | `apps/rider-mobile/` | `npm run mobile:rider` | `/api/auth/mobile/*`, `/api/rider/*` |
| **Admin Web** | Root `/admin` (primary) + `apps/admin-web` (:3001) | `npm run dev` / `npm run dev:admin` | `/api/admin/*` |

## Connectivity model

```
Customer / Vendor / Rider Expo apps
        │  Authorization: Bearer <supabase_access_token>
        ▼
Next.js BFF (port 3000)
        ├── Supabase Auth + DB (customer identity)
        ├── Razorpay (payments)
        └── managed Redis (rate limits + tracking fanout)
```

Mobile login returns access + refresh tokens from `/api/auth/mobile/login`.
Protected routes accept either browser cookies (web) or Bearer tokens (native).

## First-time mobile setup

```bash
# Terminal 1 — API
npm run dev

# Terminal 2 — install + run one app
npm run mobile:customer:install   # or vendor / rider
npm run mobile:customer
```

On a physical phone, set `EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000` in each app `.env`.
Node.js 22.13+ is required by Expo SDK 57.

## Smoke test

```bash
node scripts/mobile-smoke.mjs
# optional authenticated check:
# MOBILE_SMOKE_EMAIL=you@example.com MOBILE_SMOKE_PASSWORD=secret node scripts/mobile-smoke.mjs
```

## Status

- Customer mobile: catalog, auth, cart, COD checkout, orders/tracking screens.
- Vendor / Rider mobile: auth, dashboard, apply, orders/deliveries. Launch
  reads and tracking use Supabase; several vendor/rider management screens are
  still partial and require device QA.
- Admin: use primary portal at `http://localhost:3000/admin` (full RBAC). `apps/admin-web` proxies to the same API on :3001.
- All three Expo projects pass TypeScript and Expo Doctor checks.
