# AMASI Management

**AMASI Faculty & Conference Operations Management**

A production system used by the Association of Minimal Access Surgeons of India (AMASI) office to run skill courses and conferences end-to-end — managing faculty, scheduling sessions, designing and printing badges, scanning attendees in at the venue, and tracking delegates through every stage of an event.

## What this system does

This is the back-office and on-site operations app for AMASI events. In one place it handles:

- **Faculty management** — speaker invitations, response tracking, travel and accommodation, communication via email and WhatsApp.
- **Session scheduling** — building the program for an event (sessions, halls, timings), with an AI-assisted check that flags AM/PM mistakes, overlapping sessions, and unusual break placements.
- **Badge designer and generation** — a drag-and-drop visual editor where staff can lay out badges with text, QR codes, barcodes, photos and logos. Badges are rendered to PDF for distribution and to label-printer formats for on-site printing kiosks.
- **QR scanning at events** — the check-in and presenter check-in apps use the device camera to scan delegate QR codes and mark attendance in real time.
- **Delegate tracking** — registration, payment, check-in, session attendance, certificate eligibility, and a self-service delegate portal where attendees look themselves up by email or phone.
- **Forms** — a custom form builder for registration, abstract submission, membership applications and event-specific data capture, with conditional logic and multi-step flows.
- **Certificates** — template-based generation of attendance and faculty certificates with public verification links.
- **Payments** — Razorpay integration for paid registrations and membership renewals, with webhook verification and a daily reconciliation cron.
- **Bulk import / export** — CSV and Excel import for delegates, faculty, marks, etc.
- **AI-assisted features** — uses Anthropic's Claude API for two specific things today: (1) OCR-ing scanned exam mark sheets into structured data, and (2) sanity-checking program schedules for likely scheduling errors before publishing.

## Who uses it

- **AMASI office staff** — for the day-to-day setup of events, faculty coordination, registrations, finance and reporting.
- **Course and event organisers** — local hosts and conveners who configure their event, manage their faculty list and watch live registration numbers.
- **On-site volunteers** — at the venue, for check-in, badge printing kiosks, hall coordination and presenter management.
- **Delegates and faculty** — through public/token-based portals (registration page, speaker portal, travel agent portal, certificate verification, delegate self-lookup).

## Current real-world usage

Used in production for AMASI **skill courses** — hands-on training programmes run periodically across the country under the College of Minimal Access Surgery, AMASI's training arm.

## Tech stack

- **Framework**: Next.js 16 (App Router) on React 19, TypeScript
- **UI**: Tailwind CSS 3, Radix UI primitives via shadcn/ui, Lucide icons, Framer Motion, Sonner toasts
- **Data**: Supabase (PostgreSQL + Auth + Storage), TanStack Query, TanStack Table
- **Forms & validation**: React Hook Form + Zod
- **Drag-and-drop**: `@dnd-kit` (form builder), `react-rnd` (badge/certificate designer)
- **PDF & printing**: `pdf-lib`, `jspdf`, `jspdf-autotable`, `html2canvas`, `qrcode`, `jsbarcode`
- **QR scanning**: `html5-qrcode`
- **Spreadsheets**: `csv-parse`, `papaparse`, `xlsx`
- **Charts**: Recharts
- **AI**: `@anthropic-ai/sdk`

> Note: `three`, `@react-three/fiber` and `@react-three/drei` are present in `package.json` but not imported. They will be removed in a future cleanup commit.

## External services it connects to

- **Supabase** — the database, authentication and file storage. **Shared with the `amasi-membership` project** (see below).
- **Razorpay** — payments and webhooks.
- **Resend** — transactional email (primary path via Resend; the codebase also references a Blastable provider as an alternative).
- **Gallabox** — WhatsApp Business messaging (speaker invitations, reminders, etc.). The codebase also references QikChat as a second WhatsApp provider.
- **Anthropic API** — Claude, used for exam-sheet OCR and program-schedule validation.
- **Airtable** — used for parts of the convocation workflow.
- **Linkila** — short-link generation.
- **OCR.space** — ticket / document OCR (separate from the Anthropic OCR path).
- **AirLabs / AviationStack** — flight lookup for the travel module.
- **Fillout** — form integration.
- **Boostspace** — outbound webhook destination.
- **Vercel** — hosting and cron jobs.

## The shared Supabase relationship

This app (`AMASI-management`) and the sibling project `amasi-membership` connect to the **same Supabase project** — same database, same `members` table, same auth users.

- `AMASI-management` is the staff-facing operations app (this repo).
- `amasi-membership` is the member-facing portal (membership applications, renewals, member self-service).

Practical implications:

- **Schema changes are cross-cutting.** A migration that renames or drops a column in shared tables can break the other app. Coordinate any schema change across both repos before applying it.
- **RLS policies are shared.** Row-level security rules apply uniformly. If one app needs a new policy, check it doesn't loosen access for the other.
- **Auth users are shared.** A user logging in is the same user in both apps.
- **Migrations live in one place.** Currently in this repo at `supabase/migrations/`. Treat it as the source of truth and apply changes via migrations rather than ad-hoc SQL. Don't let two repos write conflicting migrations.

## Local development setup

Requirements: Node.js 20+, access to the Supabase project (URL + service role key), and an `.env.local` file populated from `.env.example`.

```bash
# Install dependencies
npm install

# Verify the database schema is in place (runs against the Supabase project
# in your env file — does NOT create tables, only checks they exist)
npm run db:setup

# Start the dev server
npm run dev
```

Open <http://localhost:3000>.

`npm run build` runs the same `db:check` step before `next build`, so deployments will fail fast if a required table or column is missing. If `db:setup` reports missing items, apply the schema migrations in the `supabase/migrations/` folder via the Supabase SQL editor.

## Required environment variables

Names only — no values are committed. The full canonical list lives in `.env.example`. The most important groups:

**Core (required):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

**Email:**
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`
- `EMAIL_FROM`, `ADMIN_ALERT_EMAIL`

**Payments:**
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`

**AI / OCR:**
- `ANTHROPIC_API_KEY`
- `OCR_SPACE_API_KEY`

**Cron / infra:**
- `CRON_SECRET`

Additional environment variables for WhatsApp messaging, third-party integrations, and feature flags are documented in `.env.example`. See that file for the canonical list.

## Key features

- **Faculty management** — invitations, token-based response pages, speaker portal, hall-coordinator portal.
- **Event management** — full event lifecycle: settings, sessions, halls, sponsors, badges, certificates, examinations, convocation, communications.
- **Session / program scheduling** — program builder, public program page, and an AI validation endpoint that flags likely scheduling errors before publishing.
- **Badge designer** — drag-and-drop layout editor for badges.
- **Certificate designer** — same pattern for certificates, with public verification links for issued certificates.
- **Badge / certificate PDF generation** — PDF rendering plus QR and barcode generation.
- **QR check-in** — camera-based QR scanning at the venue and at presenter stations.
- **Print station / kiosk** — dedicated routes for badge-printing kiosks at the venue.
- **Delegate portal** — public, email/phone-based self-service for attendees.
- **Form builder** — drag-and-drop form authoring with conditional logic, used for registration, abstracts, membership.
- **Abstract submission and review** — token-based reviewer access, automated reminders, reassignment via cron.
- **Examinations** — examiner portal, OCR for paper mark sheets via Anthropic Claude, address-collection workflow for printed certificates.
- **Travel module** — separate token-based portals for travel, flight, train and cab agents, with flight lookups via AirLabs/AviationStack.
- **Convocation** — public convocation portal with external address-sync integration.
- **Payments** — Razorpay create-order, verify, webhook, refunds, and a 6-hourly reconciliation cron.
- **Communications** — email via Resend (with a Blastable alternative), WhatsApp via Gallabox (with a QikChat alternative), with templates and logs.
- **AI-assisted content / validation** — exam OCR and program-schedule validation via Claude.

## Production deployment

Hosted on **Vercel**. The live site is **<https://collegeofmas.org.in>**.

Cron jobs run on the Vercel side and are declared in `vercel.json` (auto-complete events, reviewer reminders, exam reminders, daily exam sync, payment reconciliation, event reminders, reviewer reassignment).

## Related repositories

- **`amasi-membership`** — the **member-facing portal**. Members apply, renew, and manage their AMASI membership through that app. It connects to the **same Supabase project** as this repo, so the two apps share the database, auth users and most core tables.

## Maintenance notes

- **Database changes affect two apps.** Any migration touching shared tables must be tested against `amasi-membership` as well as this app.
- **Trim env vars.** Vercel's env editor can introduce trailing newlines. Code in this repo `.trim()`s sensitive values; follow the same pattern when adding new ones.
- **`npm run build` runs `db:check` first.** A schema mismatch will fail the build before Next.js compiles. Apply migrations via the Supabase dashboard rather than inventing parallel migration tooling.
- **Public/token-based routes are extensive.** Check the auth middleware before adding a new public-facing portal so it gets exempted correctly.
- **Some kiosk routes have a relaxed Content Security Policy** to support local-network printer integration. Don't extend this scope to other routes; see internal notes for the rationale.
- **Feature flags via env.** Several modules can be hidden via `NEXT_PUBLIC_ENABLE_*` flags — useful when a deployment doesn't need (e.g.) the examination or travel modules.
- **Verification is currently primarily manual.** Treat the build (which runs the schema check) and a smoke test of the dashboard plus a public registration flow as the minimum bar before deploying.
