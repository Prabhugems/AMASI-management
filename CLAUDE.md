# AMASI Faculty Management - Claude Code Guide

## Stack
Next.js 16 + React 19 + Supabase + TanStack Query + Shadcn UI + TypeScript + Tailwind CSS 3

## Commands
```bash
npm run dev       # Start dev server
npm run build     # db:check + next build
npm run lint      # ESLint
```

## Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── api/                # 150+ API routes
│   ├── login/              # Auth pages
│   ├── events/             # Event management (protected)
│   ├── faculty/            # Faculty management (protected)
│   ├── delegates/          # Delegates (protected)
│   ├── forms/              # Form builder (protected)
│   ├── register/           # Public event registration
│   ├── membership/         # Public membership application
│   ├── speaker/            # Speaker portal (token-based, public)
│   ├── respond/            # Faculty response portal (token-based)
│   ├── check-in/           # Check-in app (token-based)
│   ├── print-station/      # Badge printing kiosk
│   └── travel-agent/       # Travel agent portal (token-based)
├── components/
│   ├── ui/                 # Shadcn + custom UI components
│   ├── layout/             # Dashboard layout, sidebar, navbar
│   ├── providers/          # Theme, QueryClient, ConfirmDialog
│   ├── dashboard/          # Dashboard widgets
│   ├── forms/              # Form builder components
│   └── [feature]/          # Feature-specific components
├── lib/
│   ├── supabase/
│   │   ├── client.ts       # Browser Supabase client (anon key, RLS)
│   │   ├── server.ts       # Server client + admin client (service role, bypasses RLS)
│   │   └── database.types.ts  # Auto-generated DB types
│   ├── auth/api-auth.ts    # getApiUser(), requireAdmin(), requireSuperAdmin()
│   ├── services/           # razorpay, sms, whatsapp, webhook, auto-send
│   ├── email.ts            # Email sending (Resend/Blastable)
│   ├── email-templates.ts  # Template rendering with {{variables}}
│   ├── gallabox.ts         # WhatsApp via Gallabox API
│   ├── env.ts              # isFeatureEnabled('razorpay'|'email'|'gallabox')
│   └── utils.ts            # cn(), formatDate, general utils
├── hooks/                  # 26 custom hooks (use-auth, use-permissions, etc.)
└── middleware.ts           # Route protection (auth required for dashboard pages)
```

## Key Patterns

### API Route Pattern
```typescript
// 1. Auth check
const user = await requireAdmin()  // or getApiUser()
// 2. Create admin client (bypasses RLS)
const supabase = await createAdminClient()
// 3. Query/mutate
const { data, error } = await supabase.from('table').select('*')
// 4. Return response
return NextResponse.json({ data })
```

### Path Alias
`@/*` maps to `./src/*` (e.g., `@/lib/supabase/server`)

### Auth & Roles
- Roles: `super_admin` > `admin` > `event_admin` > `staff` > `faculty` > `member`
- New users auto-get `event_admin` role
- RLS on most tables; API routes use admin client to bypass
- Token-based access for public portals (speaker, travel-agent, check-in)

## Known Gotchas

1. **Env var `.trim()`**: Always `.trim()` env vars - Vercel can add newlines. The `SUPABASE_SERVICE_ROLE_KEY` had this bug.
2. **Admin client not centralized**: Many API routes create their own admin client directly with `process.env` instead of using `createAdminClient()`. Check both when fixing env-related issues.
3. **RLS bypass required**: Events table RLS only allows `super_admin`/`admin` for inserts. Must use admin client for creates.
4. **Email providers**: Blastable (primary) or Resend (fallback). Check `isEmailEnabled()` before sending.
5. **WhatsApp**: Gallabox integration. Template messages require pre-approved templates in Gallabox dashboard.
6. **Razorpay**: Payment processing with webhook verification.

## Check-in Model (Tito model — captured 2026-07-13)

**Repeat entry is NOT a check-in concern.** `checkin_records` has `UNIQUE(checkin_list_id, registration_id)` by design: one check-in per list, ever. Hall re-entry, session attendance, and any other "same person, multiple times" tracking do **not** belong on this table — that's a separate RFID/gate-scan table (or, until that exists, a separate `checkin_list` per occurrence: Day 2 = a new list, Lunch = a new list, Session = a new list).

`checkin_lists.allow_multiple_checkins` is a **dead/neutralized column** (as of the PR that added this note): it used to be a no-op on `/api/verify/[token]` (the unique constraint meant a "second check-in" never inserted a new row or updated the timestamp regardless of the flag) and actively harmful on `/api/kiosk/checkin` (skipped the existing-record guard, then hit an unhandled `23505` unique-violation → hard HTTP 500 on a genuine repeat scan). Both endpoints now ignore the column entirely and always treat a repeat as `already_checked_in` (never an error). The list-management UI toggle for it has been removed. The column is left in the schema for now and will be dropped post-AMASICON (September).

A repeat scan of an already-checked-in delegate is **always a success**, never an error: `success:true`, HTTP 200, the confirmation sound, and a `checkin_audit_log` row with `success:true`. A prod data audit (2026-07-13) found 2,205 `checkin_audit_log` rows across 9 checkin_lists where the pre-fix `/api/verify/[token]` had logged a legitimate repeat scan as `success:false` — i.e. that many times a volunteer's device buzzed and the audit trail recorded a false rejection for a real, paid, registered delegate.

## Key External Services
- **Supabase**: Database + Auth + Storage
- **Vercel**: Hosting
- **Razorpay**: Payments
- **Resend/Blastable**: Email
- **Gallabox**: WhatsApp Business API
- **Linkila**: URL shortening
- **OCR.space**: Ticket OCR
- **Anthropic**: AI features

## Database (Main Tables)
`users`, `events`, `faculty`, `members`, `registrations`, `sessions`, `faculty_assignments`, `forms`, `form_fields`, `form_submissions`, `badges`, `badge_templates`, `certificates`, `certificate_templates`, `abstracts`, `abstract_reviews`, `email_templates`, `email_logs`, `orders`, `payments`, `tickets`, `team_members`, `travel_bookings`, `flights`, `hotels`, `communications_settings`, `activity_logs`

## Live Site
collegeofmas.org.in (Vercel)

## White-Label Tenant Deployments

Several Vercel projects (`essurg-2026`, `cos-2026`, retired `technosurg`) deploy this same repo to separate domains for other organizations, tenant-scoped via `NEXT_PUBLIC_TENANT` (`src/lib/tenant.ts`). Each is its own Vercel project with its own env vars; Production Branch should be `main` on all of them.

**Never run `vercel deploy --prod` / `vercel --prod` by hand against a tenant project**, especially from a dirty/uncommitted working tree. That command force-promotes whatever's on disk straight to that tenant's live production, bypassing the Git integration entirely — regardless of branch or committed state. Confirmed root cause of a 2026-07-27 incident on `cos-2026` (Coimbatore Orthopaedic Society): a prior session pushed uncommitted `feat/kiosk-offline-first-stage1` state to production via CLI. Let git pushes to `main` (through each project's own Git integration) drive tenant production deploys instead.

## Migration Pipeline — Known Debt (captured 2026-06-24, post-AMASICON project)

**Root cause (don't try to fix this during conference week, parked until after AMASICON Aug 30):**

Supabase DB `jmdwxymbgxwdsmcwbahp` is **shared by two repos**:
- `amasi-faculty-management` (this repo) — events, abstracts, registrations, check-in
- `amasi-membership` (sibling repo) — members, credentials, electoral, zones, skill-courses

**Neither repo has a working migration CI today.**
- This repo's `.github/workflows/migrations.yml` runs `supabase db push` on main, but FAILS on a 63-version drift error (remote `schema_migrations` has 63 versions whose files this repo doesn't carry — they belong to amasi-membership).
- `amasi-membership` has NO migration workflow at all. Its `test.yml` only runs typecheck/lint/test/build. It keeps 30+ DDL files in a `sql/` directory (e.g. `sql/022_email_campaigns.sql`, `sql/028_ocr_score.sql`), OUTSIDE the Supabase CLI's `supabase/migrations/` path. Those files have been **hand-applied via SQL editor and back-recorded in `schema_migrations`** with synthetic timestamps.

**Net consequence:** every migration on this DB, both repos, all year, was applied **out-of-band**. That's the source of every "merged but not live" / "applied but no file" / "the file lies / the table lies" issue we've found this week — including the 5 legacy `20260117_*.sql` files we moved to `legacy/` on 2026-06-24, the access-token expiry backfill that never ran, and the podium UNIQUE constraint that's now committed-but-unapplied.

**Post-AMASICON fix (NOT now):**
1. Choose one owner repo (or a new dedicated migrations repo) for the shared DB.
2. Normalize all migrations into Supabase CLI format under `supabase/migrations/` with full timestamp versions matching `schema_migrations`.
3. Get `supabase db push` running green against the DB in **isolation** first.
4. Then consolidate the second repo's migrations onto the owner.

**Standing instruction (until the pipeline project is done):**
- No migrations applied via Supabase MCP or SQL editor without explicit user go.
- The exception slot has been exercised once (see access-token expiry below). Future requests for additional MCP applies should be treated with the same scepticism even with explicit go — they expand the precedent.

**Migration application history (out-of-band, recorded so it isn't invisible):**
- `20260623_access_token_expiry.sql` — Phase 3 staff access-token expiry backfill. **APPLIED 2026-06-24 via Supabase MCP** as the documented one-off exception. Pre-flight: 13 NULL rows; 0 mid-event; 0 with NULL `events.end_date`; 0 with 24h check-in activity. UPDATE returned 13 rows. Recorded in `supabase_migrations.schema_migrations` under synthetic version `20260624030000 / access_token_expiry_backfill`.
- `20260629_help_requests_priority_assigned_to.sql` — adds `priority TEXT NOT NULL DEFAULT 'medium'` and `assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL` to `help_requests` (table was created out-of-band without them, so the admin delegate-portal help-requests page 500'd on every priority change / assignment). **APPLIED 2026-06-29 via Supabase MCP** on explicit user go. Additive only (`ADD COLUMN IF NOT EXISTS`, nullable FK, default); 46 existing rows backfilled to `priority='medium'`, `assigned_to=NULL`. Indexes added: `idx_help_requests_assigned_to`, `idx_help_requests_event_status`.
- `20260629_registrations_lowercase_email.sql` — fixes a case-mismatch bug: `registrations.attendee_email` was stored mixed-case for some delegates (e.g. `Drbhardwajsaket@gmail.com`), but every lookup queries the lowercased email (`.eq("attendee_email", x.toLowerCase())` in feedback check-in gate, certificate release/download, badge, etc.), so a case-sensitive `.eq` never matched → "No registration found", blocking feedback submission + certificate download for those delegates even though registered + checked in. **APPLIED 2026-06-29 via Supabase MCP** on explicit user go. (1) Backfilled 16 mixed-case rows to lowercase (no UNIQUE constraint on attendee_email, so safe); (2) added `BEFORE INSERT OR UPDATE OF attendee_email` trigger `trg_lowercase_attendee_email` → fn `lowercase_attendee_email()` so storage stays canonical across all ~28 registration-creation paths. No app code changed.
- `20260713_checkin_lists_list_purpose.sql` — adds `checkin_lists.list_purpose TEXT NOT NULL CHECK (IN 'entry','collection')`. Drives the volunteer scanner's amber repeat-scan card: `entry` → "LET THEM IN"; `collection` → "DO NOT ISSUE AGAIN" (distinct copy, icon, and sound). **APPLIED 2026-07-13 via Supabase MCP** on explicit user go ("do it"), backfilling all 18 existing rows to `collection` per the user's own fail-safe rule (none had been manually classified yet — wrongly showing "already collected" on an entry list is far less harmful than wrongly showing "let them in" on a collection list). Required on creation going forward, no application-level default.
- `20260714_ticket_types_gst_inclusive_rate.sql` — adds `ticket_types.gst_inclusive_rate NUMERIC(5,2)`, nullable, no default. Display-only rate for back-calculating base/GST breakdown on invoices from a GST-inclusive total, without changing what's charged. Written and applied to the isolated ESSURG Supabase project during the ESSURG white-label build (2026-07-14), but the receipt/invoice code that reads it (`src/app/api/registrations/[id]/receipt`, `/final-receipt`, `src/app/api/orders/[id]/receipt`) shipped to the shared repo the same day — which also deploys to AMASI/College — without the column existing on production. Result: every receipt/invoice generation on `collegeofmas.org.in` errored (`42703: column "gst_inclusive_rate" does not exist`) from that deploy until this was caught and fixed. **APPLIED to production 2026-07-15 via Supabase MCP** on explicit user go. Additive only; all existing AMASI/College ticket rows get `NULL`, and the receipt code already falls back to its original `tax_percentage`-based calculation when the column is null — verified zero behavior change for those tenants. `src/lib/supabase/database.types.ts` was also regenerated from production the same day — it had drifted independently in three ways: missing `user_platform_role`'s `admin`/`staff`/`member` values (added by an earlier out-of-band migration), missing `checkin_lists.list_purpose` and `users.logged_out_at` (both real, already-applied columns), and *containing* `gst_inclusive_rate` before this fix — i.e. the checked-in types file had apparently last been generated against the ESSURG project's DB rather than production's.

- `20260727_events_tenant_check_add_essurg_cos.sql` — widens `events_tenant_check` from `('amasi','college','technosurg')` to also allow `'essurg'` and `'cos'`, matching `ALLOWED_TENANTS` in `src/lib/tenant.ts` (which already permitted both at the app level). **APPLIED 2026-07-27 via Supabase MCP** on explicit user go, discovered while creating the first COS/TAMILCON 2026 event — the insert would have failed the constraint outright. Additive only; no existing rows affected.
- `20260727_checkin_records_station_id.sql` — Kiosk Stage 3 (real station identity, PR #122). Adds `checkin_records.station_id UUID REFERENCES kiosk_stations(id) ON DELETE SET NULL`, nullable, no default. Attributes a check-in to the admin-provisioned `kiosk_stations` row that performed it, replacing the client-only `getOrCreateDeviceId()` placeholder that never reached the server. **APPLIED 2026-07-28 via Supabase MCP** on explicit user go ("apply the migration, go ahead"). Pre-flight confirmed the column didn't yet exist and both `checkin_records`/`kiosk_stations` were present; post-apply confirmed column type (`uuid`, nullable) and FK (`checkin_records_station_id_fkey` → `kiosk_stations(id)`, `ON DELETE SET NULL`). Additive only, zero existing rows affected (all get `NULL`). The check-in insert code (`/api/kiosk/checkin`) already spreads `station_id` conditionally (`...(stationId && { station_id: stationId })`), so it was already safe even before this apply — this closes that gap for real.
- `20260728_kiosk_stations_print_badge_mode.sql` — Kiosk "Check-in + Print Badge" mode (extends Stage 3's `kiosk_stations`, not yet merged as of this entry). Widens `kiosk_stations_mode_check` from `('checkin','print')` to also allow `'checkin_and_print'`, and adds `kiosk_stations.auto_print_badge BOOLEAN NOT NULL DEFAULT false`. Lets one admin-provisioned kiosk station both check a delegate in and print their badge over a directly-connected USB printer, linked to an existing Print Station's printer config rather than duplicating printer setup. **APPLIED 2026-07-29 via Supabase MCP** on explicit user go ("keep going", following an explicit ask), sequenced deliberately BEFORE merge on the final whole-branch review's own finding — the review caught that 4 code paths (the admin CRUD routes and `/kiosk-station/[token]`) select/insert `auto_print_badge` unconditionally with no safe degradation if the column were still missing, the same class of migration-ordering defect as the `checkin_records.station_id` incident above. Pre-flight confirmed both the column and the widened constraint didn't yet exist; post-apply confirmed column type (`boolean`, not null, default `false`) and constraint definition, and confirmed the one existing `kiosk_stations` row (`mode: checkin`) was completely unaffected by the widen (still `checkin`, `auto_print_badge` defaulted to `false`, `print_station_id` still `null`).
- `20260729_kiosk_shared_stations_scheduled_lists.sql` — Kiosk shared stations, multi-list menu, scheduled windows (see `docs/superpowers/specs/2026-07-29-kiosk-shared-stations-scheduled-lists-design.md`). Adds `checkin_lists.kiosk_opens_at`/`kiosk_closes_at` (timestamptz, nullable) and `kiosk_force_state` (text, nullable, check `IN ('open','closed')`) — a completely separate, hard-gating schedule system from the pre-existing `starts_at`/`ends_at` soft-warning-only fields. Adds a new join table `kiosk_station_lists (station_id, checkin_list_id)`, replacing `kiosk_stations.list_id` as the source of truth for which lists a station serves (many-to-many instead of one) — `list_id` itself is deprecated, not dropped, and stays on the table until a later, separate migration. Lets one physical tablet hold a menu of several check-in lists (e.g. a "Food Area" desk serving Breakfast/Lunch/Dinner) instead of needing a separate provisioned link per list, with per-list open/closed scheduling preventing a shared tablet from accepting a scan against the wrong list. **APPLIED 2026-07-29 via Supabase MCP** on explicit user go ("Yes, apply it"). Pre-flight: 2 `kiosk_stations` rows, both with a non-null `list_id`; 0 `checkin_lists` rows with any kiosk schedule field set (trivially true — columns didn't exist yet). Post-apply: `kiosk_station_lists` backfilled to exactly 2 rows (matching pre-flight), 0 `checkin_lists` rows have any kiosk schedule field set (all three columns null on every existing list — zero behavior change, confirmed). `src/lib/supabase/database.types.ts` regenerated the same pass. While implementing this feature, also fixed a pre-existing bug (not part of this migration) in `/api/kiosk/delegates` and `/api/kiosk/checkin`: both routes' `station_token` path gated on `station.mode === "checkin"` exactly, incorrectly rejecting/silently-unattributing `checkin_and_print` stations (added in the `20260728` migration above) — both now accept `checkin` or `checkin_and_print`.

- `20260729_kiosk_stations_attended.sql` — adds `kiosk_stations.attended BOOLEAN NOT NULL DEFAULT false`. The entry-only self-check-in rule (`checkin_lists.list_purpose === "collection"` always blocked on the kiosk path) was written for an unattended, self-service device — nobody stopping a delegate tapping twice and taking two kits. At AMASICON every kiosk station is staff-attended: a volunteer holds the tablet at all times and enforces the duplicate warning themselves, same as the existing staff scanner (`/api/verify/[token]`). This column lets an ATTENDED station serve collection-purpose lists (Breakfast, Lunch, Dinner, Registration Kit) while an unattended station — or the direct-URL `/kiosk/[eventId]/[listId]` path, which never reads `kiosk_stations` at all — stays entry-only, permanently. **APPLIED 2026-07-29 via Supabase MCP** on explicit user go-ahead, given in advance for this specific migration ("Apply the migration — it's additive and defaults to false, so no behaviour changes on its own"). Pre-flight: 2 `kiosk_stations` rows, no `attended` column. Post-apply: both rows correctly defaulted to `attended: false` — confirmed neither existing station (`Front Desk 1`, `Badge Print station 1`) was flipped to attended by this migration or by any code in this pass, per explicit boundary from the user ("do NOT turn attended on for any existing station... I'll flip them myself after review"). `src/lib/supabase/database.types.ts` regenerated the same pass. The gating logic built alongside this migration (`/api/kiosk/delegates`, `/api/kiosk/checkin`) is written to fail closed on any station-resolution failure or ambiguity — a collection-list scan is only ever allowed when a station resolves fully and unambiguously AND `attended = true`; see the implementation report for the full design. **Not yet complete end-to-end**: the kiosk client's actual "duplicate scan" warning screen for collection lists is intentionally unbuilt pending two open decisions — (1) whether the local-first optimistic check-in flow needs to become synchronous for this one case, since only the server has real-time cross-device duplicate state, and (2) whether the warning screen's look should match the existing staff scanner's amber card exactly (small, amber, no location shown) or the originally-requested full-screen red with a location — the two differ in ways that need a real decision, not a guess.

- `20260730_event_settings_kiosk_stations_module.sql` — adds `event_settings.enable_kiosk_stations BOOLEAN DEFAULT true`, giving Kiosk Stations its own Event Modules toggle (previously it piggybacked on `enable_checkin`'s flag with no independent on/off). Migration was written and committed the same day the feature's code merged to `main` and deployed — but, per this repo's standing rule, was deliberately NOT applied at that time pending explicit go-ahead. The gap surfaced as a real production break within hours: the Event Modules settings page's "Save Modules" button writes every module key in one batched POST, so PostgREST rejected the *entire* save (`Could not find the 'enable_kiosk_stations' column of 'event_settings' in the schema cache`) whenever ANY module toggle was changed on ANY event on collegeofmas.org.in — not just ones touching Kiosk Stations. Same root-cause class as the `gst_inclusive_rate`/`checkin_records.station_id` incidents above (code live before migration applied), surfaced faster and more broadly here because this column sits in a shared batch-write path. **APPLIED 2026-07-30 via Supabase MCP** on explicit user go ("pls do it correctly"), after the user reported the exact save-failure toast. Pre-flight: column didn't exist, 15 existing `event_settings` rows. Post-apply: column confirmed `boolean`, default `true`; all 15 existing rows backfilled to `true` (0 null, 0 false) — zero behavior change, since every module in Kiosk Stations' category (Check-in, Badges, Print Station) already defaults on too.

- `20260730_checkin_lists_prints_badge.sql` — adds `checkin_lists.prints_badge BOOLEAN NOT NULL DEFAULT false`. Fixes a real bug found live on Tablet 4 (a shared, multi-list `checkin_and_print` station): badge-print UI (Connect Printer / Print Badge / auto-print) is gated on `kiosk_stations.mode`, which is station-wide, so every list a print-enabled station serves showed print controls — including Lunch and Kit Collection, which have nothing to do with printing. Printing is now a property of the LIST: `KioskStationShell` computes an effective per-list mode (`mode === "checkin_and_print" && activeList.prints_badge ? "checkin_and_print" : "checkin"`) instead of forwarding the station's raw mode, so `KioskCheckinScreen`'s existing print gates (all already keyed off its `mode` prop) now only fire for lists explicitly flagged. **APPLIED 2026-07-31 via Supabase MCP** on explicit user go ("Apply the migration"), after the user hit the exact bug live and asked for it by name. Pre-flight: 21 `checkin_lists` rows, column didn't exist, 4 lists already assigned to a `checkin_and_print`-mode station (the true "already printing today" set). Backfilled `prints_badge = true` for exactly those 4 lists (preserving current behavior for every existing print-enabled station at the moment the migration landed, including 2 collection-purpose lists — "Lunch" and "Kit Collection" on Tablet 1/2/4 — that were printing under the bug and needed one manual admin step afterward to actually turn off, which was done live for Tablet 4's Lunch/Kit Collection immediately after apply). Post-apply: column confirmed `boolean not null default false`; 4 rows `true` / 17 `false`, matching pre-flight exactly; of the 15 collection-purpose lists in the DB, only the 2 already-printing ones landed on `true`, the other 13 correctly defaulted `false`. `src/app/api/checkin-lists` (`POST`/`PUT`) and the check-in list editor UI (`checkin/lists/page.tsx`) got a matching "Prints badge" toggle so this is admin-editable going forward. **Found and fixed the same class of code-before-migration risk this repo has hit repeatedly** (`gst_inclusive_rate`, `checkin_records.station_id`, `enable_kiosk_stations`): the admin list-editor form sends `prints_badge` on every single check-in list save (not just ones touching the new field), so this branch reaching production before the migration applied would have broken every check-in list edit with a generic 500 — caught during final review and held until the migration landed, never actually deployed in that state. Also fixed live: the SSR `kiosk-station/[token]/page.tsx` was silently swallowing a genuine `checkin_lists` query error and rendering the misleading "list removed" screen instead of a real error state — now correctly distinguishes the two, matching the existing pattern used for the station-lookup query in the same file. `src/lib/supabase/database.types.ts` regenerated the same pass.

- `20260730_agenda_builder_halls.sql`, `20260730_agenda_builder_tracks.sql`, `20260730_agenda_builder_settings.sql`, `20260730_agenda_builder_session_checkin.sql`, `20260730_agenda_builder_approval_log.sql` — Agenda Builder Phase 1 (data model & architecture, see `docs/superpowers/specs/2026-07-30-agenda-builder-data-model-design.md` and `docs/superpowers/plans/2026-07-30-agenda-builder-phase1-data-model.md`). Five additive migrations built via subagent-driven-development (16 implementation tasks + final whole-branch review, all clean, merged to `main` 2026-07-31): new `halls` table (+`sessions.hall_id`/`hall_coordinators.hall_id`), `sessions.track_id` reconciling the free-text `specialty_track`, new `agenda_settings` table (8 per-event capability toggles, all default `false`), `sessions.checkin_enabled` + `checkin_lists.session_id` (+ a partial unique index + widening `checkin_lists_list_purpose_check` to add `'session'` alongside `'entry'`/`'collection'`), and a new append-only `agenda_approval_log` table. All three new tables (`halls`, `agenda_settings`, `agenda_approval_log`) have RLS enabled with no policies (default-deny, admin-client-only), matching `kiosk_stations`' posture — added during final review after the reviewer caught all three shipping without it in the original pass. **APPLIED 2026-07-31 via Supabase MCP** on explicit user go ("apply the migrations"), one at a time in dependency order (halls → tracks → settings → session_checkin → approval_log) with a pre-flight/post-apply check on each. Pre-flight (shared baseline before any of the five): 0 of the 8 new tables/columns existed; 21 `events`, 2490 `sessions`, 19 `hall_coordinators`, 21 `checkin_lists`; `checkin_lists_list_purpose_check` confirmed allowing exactly `'entry'`/`'collection'`. Post-apply, confirmed per migration: `halls` created empty with RLS on, both new FK columns added and null on all 2490 sessions/19 coordinators; `sessions.track_id` added, null on all 2490; `agenda_settings` created empty with RLS on, all 8 boolean columns present; `sessions.checkin_enabled` defaulted `false` on all 2490 rows (0 `true`), `checkin_lists.session_id` null on all 21 existing lists, the widened constraint still allows `'entry'`/`'collection'` (confirmed neither dropped) plus the new `'session'` value, unique index confirmed present; `agenda_approval_log` created empty with RLS on, action CHECK confirmed exactly the 4 expected values. Zero existing rows affected by any of the five — confirmed at every step. `src/lib/supabase/database.types.ts` regenerated the same pass; full test suite (269/269) and `tsc --noEmit` re-ran clean against the real (no-longer-`any`-cast) types afterward. The `halls`/`tracks` backfill scripts (`scripts/agenda-backfill-halls.mjs`, `scripts/agenda-backfill-tracks.mjs`) are now runnable but have NOT been run yet — halls/tracks tables are live but empty pending that separate step.

**Migrations currently committed-but-unapplied (waiting on the pipeline project):**
- `20260624020000_abstract_presenter_checkins_unique_abstract.sql` — Podium UNIQUE(abstract_id). CAS in the podium route guards races at app layer until the constraint lands.
