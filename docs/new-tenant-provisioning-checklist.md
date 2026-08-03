# New White-Label Tenant Provisioning Checklist

For spinning up a **brand-new isolated tenant deployment** of this repo (a new
Vercel project + its own dedicated Supabase project) for a new organization —
the same pattern as `essurg-2026` and `cos-2026`. This is NOT for adding a new
*event* to an existing tenant (that's just the admin UI, no infra work needed).

Written after the 2026-08 TAMILCON/`cos-2026` incident: that project was
missing 9 storage buckets other tenants had, and had schema drift (RLS enabled
on `event_settings` where the tracked migrations don't enable it) — evidence
it was bootstrapped by copying/dumping another project's DB by hand rather
than by applying this repo's tracked migrations. That gap sat undetected for
a week and broke badge generation for every delegate on a live conference.
Follow this checklist instead of a manual copy, and run the verification
section **before** the first real registration, not after.

## 1. Supabase project

- [ ] Create a new Supabase project (its own project, not a branch of an
      existing one — each tenant needs a fully separate DB).
- [ ] Link this repo to it and run every tracked migration cleanly:
      `supabase link --project-ref <new-ref>` then `supabase db push`.
      Do **not** bootstrap by `pg_dump`/copying another project's schema —
      that's exactly how `cos-2026` ended up diverged and missing pieces.
- [ ] Confirm `supabase migration list` shows all ~114 files in
      `supabase/migrations/` as applied, with no drift.
- [ ] Add the new tenant slug to the `events_tenant_check` constraint (see
      `supabase/migrations/20260727_events_tenant_check_add_essurg_cos.sql`
      for the pattern) — a new migration, applied per this repo's standing
      "no migration via MCP without explicit go" rule.

## 2. Storage buckets

Create all 9 buckets below — every tenant needs the full set even if a given
org doesn't use every feature at launch (abstracts, speaker portal, etc. are
often enabled later, and a missing bucket fails silently until someone hits it).

| Bucket | Public | File size limit | Allowed MIME types |
|---|---|---|---|
| `uploads` | Yes | — | — |
| `badges` | Yes | 10 MB | `application/pdf` |
| `event-assets` | Yes | 10 MB | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`, `application/pdf` |
| `form-uploads` | Yes | 50 MB | `image/*`, `application/pdf`, `application/msword`, `.docx` |
| `downloads` | Yes | — | — |
| `speaker-headshots` | Yes | 10 MB | `image/jpeg`, `image/png`, `image/webp`, `image/avif` |
| `speaker-content` | Yes | 100 MB | pdf, ppt/pptx, doc/docx, mp4, mov, webm, jpeg, png, webp, zip |
| `abstract-files` | No | — | — |
| `speaker-disclosures` | No | 10 MB | `application/pdf`, `image/jpeg`, `image/png` |

- [ ] All 9 buckets created with the exact `public` flag, size limit, and MIME
      allowlist above (mismatches here fail silently at upload time, not at
      bucket-creation time).
- [ ] Add `storage.objects` RLS policies for the buckets that need
      non-admin access (badge/abstract/disclosure/downloads/form-upload access
      is server-only via the admin client, which bypasses RLS — no object
      policy needed for those):
  - `uploads`: `authenticated` can INSERT; `service_role` full access.
  - `event-assets`: public can INSERT and read; `service_role` full access.
  - `speaker-content`, `speaker-headshots`: public read access.

## 3. Vercel project

- [ ] Create a new Vercel project linked to this repo.
- [ ] **Production Branch = `main`** (so `git push` to `main` auto-deploys
      this tenant — never hand-run `vercel deploy --prod` against it, see
      the standing warning in `CLAUDE.md`).
- [ ] Set env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
    `SUPABASE_SERVICE_ROLE_KEY` — from the Supabase project created in §1.
    Double-check no trailing newline/whitespace got pasted in (a repeat
    offender in this codebase's history).
  - `NEXT_PUBLIC_TENANT` — the new tenant slug. Must also be added to the
    `Tenant` type and `ALLOWED_TENANTS` array in `src/lib/tenant.ts`
    (code change, ships via the normal PR flow, not a per-tenant runtime config).
  - `NEXT_PUBLIC_APP_URL` — the tenant's real domain.
  - Org-specific business config: `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/
    `RAZORPAY_WEBHOOK_SECRET` (this org's own Razorpay account — never reuse
    another tenant's), `BLASTABLE_API_KEY`/`BLASTABLE_FROM_EMAIL` or
    `RESEND_API_KEY`/`RESEND_FROM_EMAIL` (this org's own sending domain,
    verified with the provider — an unverified domain silently fails every
    send), and `GALLABOX_*`/`QIKCHAT_*` only if this org uses WhatsApp.
  - Leave `NEXT_PUBLIC_COOKIE_DOMAIN` unset unless this tenant needs
    cross-subdomain session sharing (see the comment in
    `src/lib/supabase/server.ts`).
- [ ] Attach and verify the custom domain.

## 4. Verification — do this before the first real registration

Every one of these was a real, silent production failure found on `cos-2026`
that went a full week undetected. Re-check each one explicitly rather than
assuming "it deployed, so it works":

- [ ] Submit one real test registration on a $0/test ticket. Confirm:
  - The registration number matches whatever format is configured in that
    event's settings (default random format is fine too — the point is
    confirming it's not silently falling back when a custom format IS set).
  - Badge generation succeeds end-to-end (this is the bug that hit
    `cos-2026` — a missing `badges` bucket 404'd silently for a week).
  - An activity log row is written for the registration (check
    `activity_logs` in the DB directly — RLS misconfiguration here fails
    silently and won't show up in the UI).
- [ ] If abstracts/speaker features are enabled: upload one test abstract
      file and one test speaker headshot, confirm both land in storage.
- [ ] Send one test email and, if enabled, one test WhatsApp message.
- [ ] Check `get_advisors` (Supabase MCP, `type: "security"`) on the new
      project for any missing-RLS warnings before go-live.

## 5. Keep this checklist current

If a new tenant provisioning turns up a gap this checklist didn't catch, add
it here — that's the whole point of writing this down instead of re-deriving
it from scratch (and re-debugging it live) next time.
