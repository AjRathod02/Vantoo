# Supabase launch status

**Last updated:** 2026-07-19  
**Production:** untouched  
**Decision:** no-go pending external staging evidence

Completed:

- clean Expo package boundaries and validation for all three mobile apps;
- reconciled and applied staging migration history;
- transactional, idempotent orders/payments/refunds and hardened RLS/RPCs;
- bounded cached catalog and batched authoritative pricing;
- Redis-based shared limits and cross-instance tracking implementation;
- durable replay-safe Razorpay webhook/refund implementation;
- root CI, unit/database concurrency tests, and staged k6 profiles;
- deployment runbook and architecture/readiness documentation.

Awaiting operator/deployed-service evidence:

- Firebase Blaze upgrade to enable the configured App Hosting backend;
- managed Redis TLS health and cross-instance fanout;
- Razorpay staging webhook secret and complete test-mode matrix;
- 100/500/1,000/several-thousand-VU staged load profiles;
- agreed latency/error/saturation thresholds and Supabase advisor review;
- browser and physical iOS/Android acceptance passes.

See `docs/QA_E2E_REPORT.md` for exact evidence and blockers, and
`PRODUCTION.md` for commands.
