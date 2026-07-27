# TAMILCON 2026 Public Landing Page

## Problem

The `cos` tenant (Coimbatore Orthopaedic Society, deployed at `cos.tnortho.org`)
has no public marketing page. The root `/` route is the authenticated admin
dashboard and redirects unauthenticated visitors to `/login` — there is
nothing to show a prospective delegate who lands on the domain looking for
event info. TechnoSurg has its own bespoke marketing page at `/landing`, but
it is a fully hardcoded, ungated component (renders regardless of tenant) with
no equivalent for `cos`.

The event details (TAMILCON 2026 — 4th TNOA Tamil Orthopaedic Conference,
3–4 Oct 2026, Hotel Merlis Coimbatore) are already seeded in the `cos-2026`
Supabase project's `events` and `ticket_types` tables.

## Goal

A public, unauthenticated `/landing` page for the `cos` tenant that presents
TAMILCON 2026 to prospective delegates and drives them to register, matching
the route convention TechnoSurg already established.

## Non-goals

- No sponsorship/trade-exhibition section (4 tiers from the brochure) — that
  audience is B2B and handled by phone/email, not a self-serve web section.
- No video backgrounds, particle canvas, or scroll-scrubbed hero like
  TechnoSurg's `/landing` — there is no video/photo package for this event,
  only the brochure PDF (one audience photo) and brochure text.
- No change to TechnoSurg's `/landing`, the root dashboard `/`, or any other
  tenant's routes.
- Not a general "any event gets an auto-generated landing page" feature —
  this is a one-off build for the `cos` tenant, following the same
  one-off-per-tenant precedent already established for `/landing`
  (TechnoSurg) and the policy pages (ESSURG + COS branches in
  `policy-page.tsx`).

## Design

### Routing and gating

**Correction from initial draft:** `src/app/landing/page.tsx` and
`layout.tsx` already exist — they are TechnoSurg's landing page (1180 lines,
fully hardcoded, exported as `LandingPage`/default, with static `metadata` in
`layout.tsx`). `/landing` is a single shared route, so this is a *modify*,
not a *new file*, following the exact same tenant-branch pattern already used
for the policy pages (`terms/page.tsx` etc. branching on `getTenant()` between
an `Essurg...` and `Cos...` component).

**File split (required by the `"use client"` boundary):** today's
`page.tsx` starts with `"use client"`, which is a whole-file directive — it
can't apply to only part of a file. `TamilconLandingPage` needs to be a
Server Component (to do a plain server-side Supabase fetch for the fee
table), so it cannot live in a `"use client"` file alongside TechnoSurg's
hooks/`framer-motion`/canvas code. The fix is to move TechnoSurg's existing
component, unchanged, into its own file that keeps `"use client"`, and make
`page.tsx` itself a lean Server Component dispatcher:

- `src/app/landing/technosurg-landing.tsx` *(new)* — `"use client"` at the
  top (unchanged from today), containing the entire existing 1180-line
  component body verbatim, exported as `TechnoSurgLandingPage`.
- `src/app/landing/tamilcon-landing.tsx` *(new)* — no `"use client"`
  (Server Component), the new TAMILCON page content, taking the fetched
  ticket rows as a prop.
- `src/app/landing/page.tsx` *(modified, no `"use client"`)* — becomes:

  ```tsx
  export default async function LandingPage() {
    const tenant = getTenant()
    if (tenant === "cos") {
      const tickets = await fetchTamilconTicketTypes()
      return <TamilconLandingPage tickets={tickets} />
    }
    return <TechnoSurgLandingPage />
  }
  ```

  This preserves TechnoSurg's behavior exactly — same component, same props
  (none), rendered for every tenant except `cos`, matching today's
  unconditional fallback. Only `cos` gets new, gated content; no other
  tenant's rendering path changes.
- Any scroll-reveal animation `TamilconLandingPage` wants is a small,
  separate `"use client"` leaf component (e.g. `src/components/reveal.tsx`,
  a minimal intersection-observer fade-up wrapper) imported into the
  Server Component — Next.js allows a Server Component to render Client
  Component children; only that leaf file needs `"use client"`.

`layout.tsx` currently exports a static `metadata` object (TechnoSurg's
title/OG tags). Static `metadata` can't vary by tenant, so this becomes a
`generateMetadata()` async function that reads `getTenant()` and returns
TechnoSurg's existing metadata object unchanged for every tenant except
`cos`, and TAMILCON's own title/description/OG tags for `cos`.

### Data flow

Two reads at request time, using the server Supabase client (public read,
RLS-safe — no admin client needed since event/ticket info is public):

1. Resolve the `cos` tenant's event via the existing `selectEventsForTenant`
   helper (`src/lib/tenant.ts`) — this tenant has exactly one event, so
   `.limit(1).single()` is sufficient, no slug or ID hardcoded in the page.
2. `select id, name, price, currency, status from ticket_types where
   event_id = <event.id from step 1> and status = 'active' order by price`.

Rendered into a simple table (tier name, price). If either query returns no
rows, the section falls back to a static "Registration opens soon — contact
us" line rather than rendering an empty table or erroring the page.

Everything else on the page (about/highlights, programme, committee, venue)
is static JSX content transcribed from the brochure — it's one-time narrative
copy for a single event, not data that changes after launch, so a DB fetch for
it would add complexity (loading/error states) without benefit.

### Assets

Source: `~/Downloads/Tamilcon trade brochure (1).pdf` (the same brochure
already used to seed the event/ticket data and the policy pages).

- `public/tamilcon-2026-brochure.pdf` — the brochure PDF, copied in as-is,
  linked from the hero's "Download Brochure" CTA.
- `public/landing/tamilcon-audience.jpg` — the page-1 cover photo (delegates
  seated at the panel session), cropped/exported from the PDF, used once in
  the Highlights section.

### Content sections (top to bottom)

1. **Nav** — TAMILCON wordmark (text, no logo file available), sticky,
   minimal — no mobile hamburger animation. One "Register" button linking to
   `/register/tamilcon-2026`.
2. **Hero** — "4th TNOA Tamil Orthopaedic Conference 2026", tagline
   "Innovate Collaborate, Elevate Patient Care", "3–4 October 2026 · Hotel
   Merlis, Coimbatore". Two CTAs: **Register Now** → `/register/tamilcon-2026`,
   **Download Brochure** → `/tamilcon-2026-brochure.pdf` (the brochure PDF
   copied into `public/`).
3. **Highlights** — brochure's bullet list: scientific sessions (Trauma,
   Joint Replacement, Arthroscopy, Spine, Paediatrics, Sports Medicine),
   reLive surgical demonstrations, keynote addresses, free paper/e-poster/
   award sessions, industry exhibition, cultural evening & networking
   dinner. Includes the one audience photo from the brochure cover.
4. **Why Attend** — CME credit hours, evidence-based practice updates,
   networking with 500+ surgeons/residents/academicians, emerging trends
   (robotic surgery, biologics, AI in orthopaedics).
5. **Programme at a Glance** — Day 1 (3 Oct, 6–8pm cultural program, 8pm+
   fellowship & dinner), Day 2 (4 Oct, 8am–6pm PG free paper sessions,
   keynote lectures, debates, workshop).
6. **Registration & Fees** — live table from `ticket_types` (see Data flow).
7. **Organizing Committee** — names/roles only, no photos: Organizing
   Chairman (Dr. B.R.J. Satish Kumar), Organizing Secretary (Dr. M. Karthik
   Selvaraj), COS President/Secretary/Treasurer, TNOA President/Secretary.
8. **Venue** — Hotel Merlis Coimbatore + the brochure's "Coimbatore – A
   Perfect Host City" blurb.
9. **Footer** — email (`cbetamilcon2026@gmail.com`), phone numbers, links to
   Terms/Privacy/Refund/Shipping/Contact (reusing the `navLinks` already
   defined for the `cos` brand in `policy-page.tsx`), and an "Admin Login"
   link to `/login`.

### Visual system

Reuses the brand already established for the `cos` policy pages (visual
consistency across the tenant's whole public site, not a new design
language):

- Background `#FAFAF7`, text `#1C1917`, accent `#3B0764` (the `cos` brand's
  `accentColor`/`headerBg` already in `BRANDS.cos` in `policy-page.tsx`,
  matching the brochure's purple branding).
- Typography: Playfair Display (headlines) + DM Sans (body) — same pairing
  already loaded by `PolicyPage`.
- Motion: a single lightweight `Reveal` client component (fade-up on
  intersection, no scroll-scrubbing) reused across sections. A couple of
  soft purple gradient blobs for visual interest in place of photography.
  No video, no particle canvas, no animated counters/countdown.

### Testing

- Manual verification (matching how the policy pages were verified): run
  `next dev` with `NEXT_PUBLIC_TENANT=cos`, confirm `/landing` renders with
  the live fee table; confirm `NEXT_PUBLIC_TENANT=essurg` and
  `NEXT_PUBLIC_TENANT=college` both 404 on `/landing`.
- No new automated tests — this page has no business logic beyond the one
  read query and a documented fallback; existing patterns in this codebase
  don't unit-test static marketing pages (TechnoSurg's `/landing` has none).
