# Backlog

## Pre-launch checklist — AMASI events.amasi.org deployment

- [ ] **Razorpay webhook URLs** — confirm both Razorpay merchant dashboards have the correct webhook URLs pointing at the correct deployments before AMASICON 2026 goes live:
  - College of MAS Razorpay account → `https://collegeofmas.org.in/api/payments/razorpay/webhook`
  - AMASI Razorpay account → `https://events.amasi.org/api/payments/razorpay/webhook`

  A misconfigured webhook fails closed (the deployment receiving the wrong-account event rejects the signature), but from a delegate's perspective the payment confirmation email never lands and registration looks stuck. Verify by triggering a test-mode payment on each tenant after DNS goes live.

## Follow-ups from PR #35 (tenant scope)

- Five unit tests for `src/lib/tenant.ts` — `getTenant` throws on missing/invalid env, `withTenant` adds and rejects pre-set tenant, `getRequiredAppUrl` strips trailing slash. Small separate PR right after #35 merges.
- Long-tail migration: ~150 admin sub-page event reads still inline `.from("events").select(...)`. Migrate to `selectEventsForTenant()` over time so a single `grep selectEventsForTenant` lists every tenant-scoped read. Not blocking — admin sub-pages are scoped by `eventId` in the URL, so cross-tenant leakage requires an admin to guess another tenant's UUID.
- Drop the `tenant DEFAULT 'college'` from the schema once both deployments are confirmed setting tenant explicitly on every insert. Currently a useful guardrail during rollout; useful as defense-in-depth even after.
