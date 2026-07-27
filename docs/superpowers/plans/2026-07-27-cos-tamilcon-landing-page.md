# TAMILCON 2026 Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public, unauthenticated `/landing` page for the `cos` tenant (TAMILCON 2026 / 4th TNOA Tamil Orthopaedic Conference) without changing TechnoSurg's existing `/landing` behavior for any other tenant.

**Architecture:** `/landing` is a single shared Next.js route already occupied by TechnoSurg's fully client-side (`"use client"`) landing page. Since the new `cos` content needs to be a Server Component (to fetch live ticket prices), TechnoSurg's existing component moves — unchanged — into its own file, and `page.tsx` becomes a thin async Server Component dispatcher on `getTenant()`.

**Tech Stack:** Next.js App Router (Server + Client Components), Tailwind CSS, `@/lib/tenant` (`getTenant`, `selectEventsForTenant`), `@/lib/supabase/server` (`createAdminClient`), the existing `requireTenantIn` / `BRANDS.cos` color system from `src/components/policies/policy-page.tsx`.

## Global Constraints

- Do not change TechnoSurg's rendered output for any tenant other than `cos` — same component, same (lack of) props, still the fallback for every tenant except `cos`.
- `ticket_types` must be read via `createAdminClient()` (RLS on that table only grants `authenticated`, per CLAUDE.md's "RLS bypass required" gotcha) — never the plain RLS-respecting client for this query.
- No sponsorship/trade-exhibition section.
- No automated tests for this page — matches existing convention (neither TechnoSurg's `/landing` nor the policy pages have test files). Verification is manual dev-server checks across tenants, per Task 6.
- Visual system: background `#FAFAF7`, text `#1C1917`, accent `#3B0764`, Playfair Display (headlines) + DM Sans (body) — same as `BRANDS.cos` already in `policy-page.tsx`.
- Source brochure: `~/Downloads/Tamilcon trade brochure (1).pdf`.

---

### Task 1: Extract TechnoSurg's landing page into its own file, unchanged

**Files:**
- Create: `src/app/landing/technosurg-landing.tsx`
- Modify: `src/app/landing/page.tsx`

**Interfaces:**
- Produces: `TechnoSurgLandingPage` — a zero-prop default-exportable function component, `"use client"`, in `src/app/landing/technosurg-landing.tsx`.

- [ ] **Step 1: Copy the entire current contents of `src/app/landing/page.tsx` into a new file `src/app/landing/technosurg-landing.tsx`**

Read the current file first (`src/app/landing/page.tsx`, 1180 lines) and write it verbatim to the new path, with two changes only:
- Keep the `"use client"` directive as the first line (unchanged).
- Change `export default function LandingPage()` to `export function TechnoSurgLandingPage()` (named export, no `default`).

Everything else — `ParticleField`, `LazyVideo`, `ScrambleText`, `MagneticButton`, `GlowCard`, `Reveal` (the local one already defined in this file — leave it here, it's TechnoSurg-only and separate from the new shared one in Task 2), `Counter`, `Countdown`, `FloatingElements`, `FloatingOrb`, `Marquee`, `PromoVideoSection`, and the full JSX body of the component — copied byte-for-byte.

- [ ] **Step 2: Replace `src/app/landing/page.tsx` with a one-line re-export, byte-identical behavior**

```tsx
export { TechnoSurgLandingPage as default } from "./technosurg-landing"
```

This preserves today's rendering exactly, for every tenant, with zero risk — Task 4 replaces this with the real tenant dispatch once `TamilconLandingPage` exists.

- [ ] **Step 3: Verify TechnoSurg is unaffected (and confirm today's cross-tenant fallback, which Task 4 will change only for `cos`)**

Run:
```bash
NEXT_PUBLIC_TENANT=technosurg npm run dev -- -p 3921 &
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3921/landing
curl -s http://localhost:3921/landing | grep -o "GEM TechnoSurg" | head -1
kill %1
sleep 1
NEXT_PUBLIC_TENANT=college npm run dev -- -p 3922 &
sleep 8
curl -s http://localhost:3922/landing | grep -o "GEM TechnoSurg" | head -1
kill %1
```
Expected: both print `200` / `GEM TechnoSurg` — identical to production today.

- [ ] **Step 4: Commit**

```bash
git add src/app/landing/technosurg-landing.tsx src/app/landing/page.tsx
git commit -m "refactor(landing): extract TechnoSurg's landing page into its own file

Unblocks adding a Server Component /landing variant for the cos tenant —
'use client' is a whole-file directive, so the new tenant's content can't
share a file with TechnoSurg's client-side page. Content is unchanged."
```

---

### Task 2: Add a shared scroll-reveal client component

**Files:**
- Create: `src/components/reveal.tsx`

**Interfaces:**
- Produces: `Reveal` — `{ children: React.ReactNode; className?: string; delay?: number }`, a named export, `"use client"`.
- Consumed by: Task 3/4's `TamilconLandingPage` (a Server Component importing this Client Component leaf).

- [ ] **Step 1: Write the component**

```tsx
"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay)
          obs.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [delay])

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "reveal.tsx"`
Expected: no output (no type errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/reveal.tsx
git commit -m "feat(landing): add shared Reveal scroll-fade client component"
```

---

### Task 3: Build TamilconLandingPage — shell, hero, highlights, why-attend

**Files:**
- Create: `src/app/landing/tamilcon-landing.tsx`

**Interfaces:**
- Consumes: `Reveal` from `@/components/reveal` (Task 2).
- Produces: `TamilconLandingPage` — `{ tickets: { id: string; name: string; price: string }[] }`, a named export, Server Component (no `"use client"`), default-exportable-by-name (imported by `page.tsx` in Task 4). `price` is typed `string`, not `number` — Postgres `numeric` columns come back from supabase-js as strings (verified directly: `"price":"3000.00"`), to avoid float precision loss.

- [ ] **Step 1: Write the component (part 1 of 2 — this task covers nav, hero, highlights, why-attend; Task 4 appends the rest and closes the JSX)**

```tsx
import { Reveal } from "@/components/reveal"

const REGISTER_URL = "/register/tamilcon-2026"
const BROCHURE_URL = "/tamilcon-2026-brochure.pdf"

const HIGHLIGHTS = [
  "Scientific sessions on Trauma, Joint Replacement, Arthroscopy, Spine, Paediatrics, and Sports Medicine",
  "reLive surgical demonstrations",
  "Keynote addresses by national and international faculty",
  "Free paper presentations, e-posters, and award sessions",
  "Industry exhibition showcasing the latest implants, instruments, and technologies",
  "Cultural evening & networking dinner",
]

const WHY_ATTEND = [
  "Earn CME credit hours",
  "Update your knowledge with evidence-based practices",
  "Connect with 500+ orthopaedic surgeons, residents, and academicians",
  "Explore emerging trends in robotic surgery, biologics, and AI in orthopaedics",
]

export function TamilconLandingPage({ tickets }: { tickets: { id: string; name: string; price: string }[] }) {
  return (
    <div className="bg-[#FAFAF7] text-[#1C1917]" style={{ fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap"
        rel="stylesheet"
      />

      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-[#FAFAF7]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold tracking-tight text-[#3B0764]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            TAMILCON 2026
          </span>
          <a
            href={REGISTER_URL}
            className="inline-flex items-center h-10 px-5 rounded-full bg-[#3B0764] text-white text-sm font-semibold hover:bg-[#2A0548] transition-colors"
          >
            Register
          </a>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(59,7,100,0.08) 0%, transparent 70%)" }} />
        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-5">
              4th TNOA Tamil Orthopaedic Conference &middot; Hosted by Coimbatore Orthopaedic Society
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              TAMILCON 2026
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-lg sm:text-xl text-[#57534E] italic mb-8">
              &ldquo;Innovate Collaborate, Elevate Patient Care&rdquo;
            </p>
          </Reveal>
          <Reveal delay={300}>
            <p className="text-base sm:text-lg text-[#44403C] mb-10">
              3&ndash;4 October 2026 &middot; Hotel Merlis, Coimbatore, Tamil Nadu
            </p>
          </Reveal>
          <Reveal delay={400}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={REGISTER_URL}
                className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-[#3B0764] text-white font-semibold hover:bg-[#2A0548] transition-colors w-full sm:w-auto"
              >
                Register Now
              </a>
              <a
                href={BROCHURE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-[#3B0764]/30 text-[#3B0764] font-semibold hover:bg-[#3B0764]/5 transition-colors w-full sm:w-auto"
              >
                Download Brochure
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── HIGHLIGHTS ── */}
      <section className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Reveal>
              <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-4">Key Highlights</p>
            </Reveal>
            <Reveal delay={100}>
              <ul className="space-y-3">
                {HIGHLIGHTS.map((item) => (
                  <li key={item} className="flex gap-3 text-[#44403C] leading-relaxed">
                    <span className="text-[#3B0764] mt-1">&#8226;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <Reveal delay={150}>
            <div className="rounded-2xl overflow-hidden bg-[#3B0764]/5 aspect-[4/3]">
              <img src="/landing/tamilcon-audience.jpg" alt="Delegates at a TNOA session" className="w-full h-full object-cover" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── WHY ATTEND ── */}
      <section className="bg-[#3B0764]/[0.04] py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-4 text-center">Why Attend?</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-6 mt-8">
            {WHY_ATTEND.map((item, i) => (
              <Reveal key={item} delay={i * 100}>
                <div className="bg-white rounded-2xl border border-black/5 p-6 h-full">
                  <p className="text-[#1C1917] leading-relaxed">{item}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
```

Note: this JSX is intentionally left with the outer `<div>` unclosed in spirit — Task 4 appends the remaining sections (Programme, Fees, Committee, Venue, Footer) before the closing `</div>` and the function's closing brace. Task 4's step 1 replaces this file's tail (from the `{/* ── WHY ATTEND ── */}` section's closing `</section>` onward) with the fuller version that includes the new sections — write it as one continuous file at that point, not a literal append, since JSX must stay well-formed. This task's own verification step below checks this partial version renders correctly before Task 4 extends it.

- [ ] **Step 2: Verify it compiles and is unused-but-valid**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "tamilcon-landing.tsx"`
Expected: no output.

(This file isn't wired into `page.tsx` yet — that happens in Task 4 once the content is complete. No dev-server check yet.)

- [ ] **Step 3: Commit**

```bash
git add src/app/landing/tamilcon-landing.tsx
git commit -m "feat(landing): add TAMILCON hero, highlights, and why-attend sections"
```

---

### Task 4: Complete TamilconLandingPage (programme, fees, committee, venue, footer) and wire up page.tsx

**Files:**
- Modify: `src/app/landing/tamilcon-landing.tsx` (append remaining sections)
- Modify: `src/app/landing/page.tsx` (fetch tickets, render `TamilconLandingPage`)

**Interfaces:**
- Consumes: `TamilconLandingPage` from Task 3 (`{ tickets }` prop, `{ id, name, price }[]`), `selectEventsForTenant` from `@/lib/tenant`, `createAdminClient` from `@/lib/supabase/server`.
- Produces: complete `/landing` route behavior for the `cos` tenant.

- [ ] **Step 1: Replace the `{/* ── WHY ATTEND ── */}` section's closing through the end of the file in `tamilcon-landing.tsx` with the full remaining content**

Find this exact block (the tail of Task 3's file):
```tsx
      {/* ── WHY ATTEND ── */}
      <section className="bg-[#3B0764]/[0.04] py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-4 text-center">Why Attend?</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-6 mt-8">
            {WHY_ATTEND.map((item, i) => (
              <Reveal key={item} delay={i * 100}>
                <div className="bg-white rounded-2xl border border-black/5 p-6 h-full">
                  <p className="text-[#1C1917] leading-relaxed">{item}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
```

Replace it with:
```tsx
      {/* ── WHY ATTEND ── */}
      <section className="bg-[#3B0764]/[0.04] py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-4 text-center">Why Attend?</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-6 mt-8">
            {WHY_ATTEND.map((item, i) => (
              <Reveal key={item} delay={i * 100}>
                <div className="bg-white rounded-2xl border border-black/5 p-6 h-full">
                  <p className="text-[#1C1917] leading-relaxed">{item}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROGRAMME ── */}
      <section className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-4 text-center">Programme at a Glance</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 gap-6 mt-8">
          <Reveal delay={100}>
            <div className="border border-black/5 rounded-2xl p-6 h-full">
              <p className="font-bold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>3 October &middot; 6&ndash;8pm</p>
              <p className="text-[#57534E]">Cultural programme</p>
              <p className="text-[#57534E] mt-2">8pm onwards: Fellowship and dinner</p>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className="border border-black/5 rounded-2xl p-6 h-full">
              <p className="font-bold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>4 October &middot; 8am&ndash;6pm</p>
              <p className="text-[#57534E]">PG free paper sessions, keynote lectures, debates, workshop</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEES ── */}
      <section className="bg-[#3B0764]/[0.04] py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-6">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-4 text-center">Registration & Fees</p>
          </Reveal>
          <Reveal delay={100}>
            {tickets.length > 0 ? (
              <div className="bg-white rounded-2xl border border-black/5 overflow-hidden mt-8">
                {tickets.map((ticket, i) => (
                  <div
                    key={ticket.id}
                    className={`flex items-center justify-between px-6 py-4 ${i > 0 ? "border-t border-black/5" : ""}`}
                  >
                    <span className="text-[#1C1917]">{ticket.name}</span>
                    <span className="font-bold text-[#3B0764]">&#8377;{Number(ticket.price).toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-[#57534E] mt-8">
                Registration opens soon &mdash; contact us at{" "}
                <a href="mailto:cbetamilcon2026@gmail.com" className="text-[#3B0764] underline">cbetamilcon2026@gmail.com</a>.
              </p>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── COMMITTEE ── */}
      <section className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-8 text-center">Organizing Committee</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 gap-x-12 gap-y-4 max-w-2xl mx-auto">
          {[
            ["Organizing Chairman", "Dr. B.R.J. Satish Kumar"],
            ["Organizing Secretary", "Dr. M. Karthik Selvaraj"],
            ["COS President", "Dr. R. Jayakumar"],
            ["COS Secretary", "Dr. A.S. Thennavan"],
            ["COS Treasurer", "Dr. Arun Raja"],
            ["TNOA President", "Dr. S.R. Sundararajan"],
            ["TNOA President Elect", "Dr. C. Rex"],
            ["TNOA Secretary", "Dr. S. Marimuthu"],
          ].map(([role, name]) => (
            <Reveal key={role}>
              <div className="flex justify-between border-b border-black/5 pb-2">
                <span className="text-[#57534E] text-sm">{role}</span>
                <span className="font-semibold text-[#1C1917] text-sm">{name}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── VENUE ── */}
      <section className="bg-[#3B0764]/[0.04] py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-4">Venue</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Hotel Merlis, Coimbatore
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-[#44403C] leading-relaxed max-w-xl mx-auto">
              Coimbatore &mdash; the Manchester of South India and a hub of medical excellence. Known for its
              textile industry, pleasant climate, and world-class healthcare facilities, with scenic spots like
              Ooty a short drive away and excellent connectivity by air, rail, and road.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-black/5">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm justify-center">
            <a href="/register/tamilcon-2026" className="text-[#57534E] hover:text-[#3B0764] transition-colors">Registration & Fees</a>
            <a href="/terms" className="text-[#57534E] hover:text-[#3B0764] transition-colors">Terms & Conditions</a>
            <a href="/privacy" className="text-[#57534E] hover:text-[#3B0764] transition-colors">Privacy Policy</a>
            <a href="/refund-policy" className="text-[#57534E] hover:text-[#3B0764] transition-colors">Cancellation & Refund</a>
            <a href="/shipping-policy" className="text-[#57534E] hover:text-[#3B0764] transition-colors">Shipping Policy</a>
            <a href="/contact" className="text-[#57534E] hover:text-[#3B0764] transition-colors">Contact Us</a>
          </div>
          <p className="text-center text-xs text-[#A8A29E] mt-6">
            cbetamilcon2026@gmail.com &middot; 94426 33111, 97902 10633
          </p>
          <p className="text-center text-xs mt-3">
            <a href="/login" className="text-[#A8A29E] hover:text-[#3B0764] transition-colors">Admin Login</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Wire the data fetch into `page.tsx`**

Replace the one-line re-export written in Task 1, Step 2 with the real tenant dispatch:

```tsx
import { getTenant, selectEventsForTenant } from "@/lib/tenant"
import { createAdminClient } from "@/lib/supabase/server"
import { TechnoSurgLandingPage } from "./technosurg-landing"
import { TamilconLandingPage } from "./tamilcon-landing"

async function getTamilconTickets() {
  const supabase = await createAdminClient()
  const { data: event } = await selectEventsForTenant(supabase, "id").limit(1).single()
  if (!event) return []
  const { data: tickets } = await (supabase as any)
    .from("ticket_types")
    .select("id, name, price")
    .eq("event_id", event.id)
    .eq("status", "active")
    .order("price", { ascending: true })
  return tickets || []
}

export default async function LandingPage() {
  const tenant = getTenant()
  if (tenant === "cos") {
    const tickets = await getTamilconTickets()
    return <TamilconLandingPage tickets={tickets} />
  }
  return <TechnoSurgLandingPage />
}
```

- [ ] **Step 3: Verify the full `cos` page renders with live data**

Run:
```bash
NEXT_PUBLIC_TENANT=cos npm run dev -- -p 3923 &
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3923/landing
curl -s http://localhost:3923/landing | grep -o "TAMILCON 2026" | head -1
curl -s http://localhost:3923/landing | grep -o "Hotel Merlis" | head -1
kill %1
```
Expected: `200`, `TAMILCON 2026`, `Hotel Merlis` all print.

Note: this dev run uses whatever `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are set in the local `.env.local` (the shared `jmdwxymbgxwdsmcwbahp` project by default) — it will NOT have the `cos`-tenant event/tickets, so the fee table will correctly show the "Registration opens soon" fallback in local dev. That's expected and confirms the fallback path works; the live-ticket path is verified against the real `cos-2026` deployment after merge (see Task 6).

- [ ] **Step 4: Commit**

```bash
git add src/app/landing/tamilcon-landing.tsx src/app/landing/page.tsx
git commit -m "feat(landing): complete TAMILCON page content and wire live ticket fetch

Programme, fees (live from ticket_types via createAdminClient), organizing
committee, venue, and footer sections. page.tsx now dispatches on tenant
and fetches tickets server-side for the cos variant."
```

---

### Task 5: Add layout metadata and brochure/photo assets

**Files:**
- Modify: `src/app/landing/layout.tsx`
- Create: `public/tamilcon-2026-brochure.pdf`
- Create: `public/landing/tamilcon-audience.jpg`

**Interfaces:**
- Produces: tenant-aware `generateMetadata()` export from `layout.tsx`.

- [ ] **Step 1: Copy the brochure PDF and extract the audience photo**

```bash
cp "$HOME/Downloads/Tamilcon trade brochure (1).pdf" "public/tamilcon-2026-brochure.pdf"
```

Extract the page-1 audience photo (the panel-session image behind the brochure's title text) as a cropped JPEG at `public/landing/tamilcon-audience.jpg`. Use a PDF rendering tool already available in this environment (e.g. `pdftoppm` or a small PyMuPDF/Pillow script, matching the exact approach used for the ESSURG letterhead assets — see `docs/superpowers/specs/2026-07-25-essurg-letterhead-branding-design.md`'s "Assets" section for the reproducible crop pattern) to render page 1 at ~200 DPI and crop to just the photo region (excluding the title text overlay and background gradient). Save as JPEG, quality 85, targeting under 300KB.

- [ ] **Step 2: Replace the static `metadata` export in `layout.tsx` with a tenant-aware `generateMetadata()`**

Read the current file first. Rename the existing static `export const metadata: Metadata = {...}` object to a local constant `technosurgMetadata`, add a `tamilconMetadata` object, and export `generateMetadata`:

```tsx
import type { Metadata } from "next"
import { getTenant } from "@/lib/tenant"

const technosurgMetadata: Metadata = {
  title: "TechnoSurg 2026 | AI, Robotics & Fluorescence in Surgery",
  description: "India's premier surgical technology summit. 500+ surgeons, 50+ expert faculty, 30+ live surgeries. June 19-20, 2026 at ITC Grand Chola, Chennai. Register now.",
  keywords: ["TechnoSurg", "surgical conference", "robotic surgery", "AI surgery", "fluorescence imaging", "ICG surgery", "GEM Hospital", "Chennai", "2026"],
  openGraph: {
    title: "TechnoSurg 2026 | AI, Robotics & Fluorescence in Surgery",
    description: "India's premier surgical technology summit. 500+ surgeons, 50+ expert faculty, 30+ live surgeries. June 19-20, 2026 at ITC Grand Chola, Chennai.",
    type: "website",
    url: "https://technosurg.gemhospitals.com",
    siteName: "TechnoSurg 2026",
    images: [
      {
        url: "/landing/hero-poster.jpg",
        width: 1200,
        height: 630,
        alt: "TechnoSurg 2026 - AI, Robotics & Fluorescence in Surgery",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TechnoSurg 2026 | AI, Robotics & Fluorescence in Surgery",
    description: "India's premier surgical technology summit. June 19-20, 2026 at ITC Grand Chola, Chennai.",
    images: ["/landing/hero-poster.jpg"],
  },
}

const tamilconMetadata: Metadata = {
  title: "TAMILCON 2026 | 4th TNOA Tamil Orthopaedic Conference",
  description: "State-level Tamil Orthopaedic Conference, hosted by Coimbatore Orthopaedic Society. 3-4 October 2026 at Hotel Merlis, Coimbatore. Register now.",
  keywords: ["TAMILCON", "TNOA", "Tamil Orthopaedic Conference", "Coimbatore Orthopaedic Society", "orthopaedic conference", "Coimbatore", "2026"],
  openGraph: {
    title: "TAMILCON 2026 | 4th TNOA Tamil Orthopaedic Conference",
    description: "State-level Tamil Orthopaedic Conference, hosted by Coimbatore Orthopaedic Society. 3-4 October 2026 at Hotel Merlis, Coimbatore.",
    type: "website",
    siteName: "TAMILCON 2026",
  },
  twitter: {
    card: "summary_large_image",
    title: "TAMILCON 2026 | 4th TNOA Tamil Orthopaedic Conference",
    description: "3-4 October 2026 at Hotel Merlis, Coimbatore.",
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return getTenant() === "cos" ? tamilconMetadata : technosurgMetadata
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children
}
```

- [ ] **Step 3: Verify metadata renders per tenant**

Run:
```bash
NEXT_PUBLIC_TENANT=cos npm run dev -- -p 3924 &
sleep 8
curl -s http://localhost:3924/landing | grep -o "<title>[^<]*</title>"
kill %1
NEXT_PUBLIC_TENANT=technosurg npm run dev -- -p 3925 &
sleep 8
curl -s http://localhost:3925/landing | grep -o "<title>[^<]*</title>"
kill %1
```
Expected: first prints a title containing "TAMILCON 2026", second prints a title containing "TechnoSurg 2026".

- [ ] **Step 4: Commit**

```bash
git add src/app/landing/layout.tsx public/tamilcon-2026-brochure.pdf public/landing/tamilcon-audience.jpg
git commit -m "feat(landing): add tenant-aware metadata and TAMILCON brochure/photo assets"
```

---

### Task 6: Full cross-tenant verification pass

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the whole changed surface**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "landing|reveal.tsx"`
Expected: no output.

- [ ] **Step 2: Verify all three tenant scenarios in one pass**

```bash
for tenant in cos technosurg college essurg; do
  NEXT_PUBLIC_TENANT=$tenant npm run dev -- -p 3930 > /tmp/landing-$tenant.log 2>&1 &
  PID=$!
  sleep 8
  echo "=== $tenant ==="
  curl -s -o /dev/null -w "status: %{http_code}\n" http://localhost:3930/landing
  curl -s http://localhost:3930/landing | grep -o "TAMILCON 2026\|GEM TechnoSurg" | head -1
  kill $PID 2>/dev/null
  sleep 1
done
```
Expected:
- `cos` → `status: 200`, `TAMILCON 2026`
- `technosurg` → `status: 200`, `GEM TechnoSurg`
- `college` → `status: 200`, `GEM TechnoSurg` (unchanged fallback)
- `essurg` → `status: 200`, `GEM TechnoSurg` (unchanged fallback)

- [ ] **Step 3: After merge/deploy to `cos-2026`, verify the live ticket data path**

Once this lands on `main` and `cos-2026`'s git-integration deploy picks it up, check `https://cos.tnortho.org/landing` directly (e.g. via `mcp__plugin_vercel_vercel__web_fetch_vercel_url`) and confirm the six seeded ticket tiers (PG/TNOA-Local/Non-Member × Early Bird/Regular) render with correct prices, not the "Registration opens soon" fallback.

- [ ] **Step 4: No commit for this task** — it's verification only; if any step fails, fix the relevant earlier task's code and re-run this task's checks before proceeding.
