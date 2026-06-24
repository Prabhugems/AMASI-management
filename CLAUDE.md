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

**Migrations currently committed-but-unapplied (waiting on the pipeline project):**
- `20260624020000_abstract_presenter_checkins_unique_abstract.sql` — Podium UNIQUE(abstract_id). CAS in the podium route guards races at app layer until the constraint lands.
