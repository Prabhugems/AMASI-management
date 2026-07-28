# Kiosk Stations — "Check-in + Print Badge" Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third `kiosk_stations` mode, `checkin_and_print`, so one Android kiosk device can check a delegate in and print their badge over a directly-connected USB printer — entirely offline-capable at print time, reusing the existing Print Station's printer identity and badge-rendering pipeline rather than rebuilding either.

**Architecture:** Extract the existing, working HTML/CSS badge-template renderer (`generatePrintContent`/`renderElementToHtml`/`replacePlaceholders`/`getPaperDimensions`, currently private closures inside `src/app/print/[token]/page.tsx`) into a shared module so both the standalone Print Station page and the new kiosk flow use identical rendering. Extend the kiosk's existing IndexedDB offline store with a print-template cache (fetched once, online) and a local print-log (for the reprint-warning check); extend the existing sync-worker pattern to push print outcomes to `print_jobs` opportunistically. Reuse `src/lib/usb-printer.ts`'s WebUSB helpers as-is.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase admin client, `html2canvas` (already installed) for canvas rasterization, `qrcode` (already installed) for QR pre-generation, WebUSB (`navigator.usb`), Vitest.

## Global Constraints

- No new npm packages. `html2canvas` (`package.json:55`) and `qrcode` (`package.json:68`) are already installed and already used for exactly this purpose in `src/app/print/[token]/page.tsx` — reuse them, don't reimplement or add alternatives.
- No empty `catch` blocks. Anything caught and not re-thrown must call `Sentry.captureException(error)` with a `tags`/`extra` context object.
- **USB direct printing only, no other printer types for this mode.** A `checkin_and_print` station must link to a Print Station whose `print_settings.printer_type === 'usb'`. Reject creation/reassignment otherwise.
- **Feature-detect `navigator.usb` (via `isWebUSBSupported()` from `src/lib/usb-printer.ts`) at runtime on the device.** If absent, the kiosk behaves exactly like `mode: 'checkin'` for that session — no print button, no "Connect Printer" prompt, no error state implying something is broken.
- **The print path must be network-free at print time.** Badge template data and every element's `imageUrl` asset must be fetched and cached during the kiosk's normal online bootstrap (alongside the existing delegate-roster fetch), never fetched at the moment "Print Badge" is tapped or auto-print fires.
- **Auto-print is a per-station boolean** (`auto_print_badge`). The "Print Badge" button always renders on `checkin_and_print` stations regardless of this setting — it's the manual (re)print trigger either way.
- **Reprinting always shows a warning confirm** ("Already printed at HH:MM — print again?") before re-sending, never silently reprints and never hard-blocks. This check is local-only (no server round-trip).
- The migration (`supabase/migrations/20260728_kiosk_stations_print_badge_mode.sql`) must be committed only, never applied without explicit user go-ahead, per this project's standing rule.
- Do not modify the standalone `/print/[token]` page's user-facing behavior. Task 2's extraction must be a byte-for-byte behavior-preserving refactor — the same rigor as Stage 3's Task 5 (`docs/superpowers/plans/2026-07-27-kiosk-stage3-station-identity.md`), which the final reviewer independently verified via `diff -u0` against the pre-move file.
- Full design rationale: `docs/superpowers/specs/2026-07-28-kiosk-stations-print-badge-mode-design.md`.

---

### Task 1: Migration — widen `mode`, add `auto_print_badge`

**Files:**
- Create: `supabase/migrations/20260728_kiosk_stations_print_badge_mode.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: the widened `mode` CHECK and the `auto_print_badge` column every later task's code assumes exists (though, per the standing rule, not actually applied to production until Task 10 gets explicit go-ahead).

- [ ] **Step 1: Write the migration**

The current constraint (confirmed via direct introspection of production) is named `kiosk_stations_mode_check`, defined as `CHECK ((mode = ANY (ARRAY['checkin'::text, 'print'::text])))`.

```sql
-- supabase/migrations/20260728_kiosk_stations_print_badge_mode.sql

-- Kiosk "Check-in + Print Badge" mode: a station can now check a delegate
-- in AND print their badge, linked to an existing Print Station's printer
-- config (print_station_id, already present since Stage 1) rather than
-- duplicating printer setup. auto_print_badge controls whether the badge
-- prints automatically on a successful check-in, or only via the manual
-- "Print Badge" button (which always renders on this mode either way).
alter table kiosk_stations drop constraint if exists kiosk_stations_mode_check;
alter table kiosk_stations add constraint kiosk_stations_mode_check
  check (mode in ('checkin', 'print', 'checkin_and_print'));

alter table kiosk_stations add column if not exists auto_print_badge boolean not null default false;
```

- [ ] **Step 2: Commit — do NOT apply**

```bash
git add supabase/migrations/20260728_kiosk_stations_print_badge_mode.sql
git commit -m "docs(kiosk): add migration for checkin_and_print mode + auto_print_badge (not applied)"
```

Flag clearly when this task is reported complete: this migration must not be applied via Supabase MCP or the SQL editor without the user's explicit go-ahead.

---

### Task 2: Extract the badge-render module (pure refactor)

**Files:**
- Create: `src/lib/badge-render.ts`
- Modify: `src/app/print/[token]/page.tsx`

**Interfaces:**
- Consumes: nothing from other tasks in this plan.
- Produces: `export function replacePlaceholders(text: string, registration: any, eventName: string): string`, `export function renderElementToHtml(element: any, registration: any): string`, `export function getPaperDimensions(paperSize: string, orientation: string): { width: string; height: string }`, `export function generatePrintContent(data: { registration: any; printSettings: any; printMode: string; badgeTemplate: any; eventName: string }): string` — Task 7 imports all four. The exact types (`any` for `element`/`registration`/`badgeTemplate`) match this codebase's existing convention in this exact code (it's already untyped `any` in the source) — do not introduce new interfaces for these as part of a "pure" refactor; that's scope creep beyond what this task asks.

**This is a pure extraction, not a rewrite — matching the rigor of Stage 3's Task 5.** Read `src/app/print/[token]/page.tsx` in full before touching it (it has drifted before; confirm the functions below still match what you find at their current line numbers — as of this plan's research they are at lines 1294 (`replacePlaceholders`), 1310 (`renderElementToHtml`), 1446 (`generatePrintContent`), 1592 (`getPaperDimensions`)). If line numbers or content have shifted, follow the live file, not this plan's line numbers.

**The one non-mechanical change required:** these four functions currently close over outer component variables instead of taking them as parameters — `replacePlaceholders` reads `station?.events?.name` from the enclosing component's `station` state, and `generatePrintContent` destructures `data` as `{ registration, station: stationInfo, badge_template }` (note: `stationInfo` here refers to the destructured `data.station`, a Print Station-shaped object with `print_settings`/`print_mode`, NOT the outer `station` closure — but the function ALSO separately reads the outer `station?.events?.name` closure variable at its very end, in the fallback-no-template branch). Since a shared module has no such closure, this task makes these explicit parameters:

- [ ] **Step 1: Read `src/app/print/[token]/page.tsx` in full**

Confirm the exact current content and line ranges of `replacePlaceholders`, `renderElementToHtml`, `generatePrintContent`, and `getPaperDimensions` before proceeding.

- [ ] **Step 2: Create `src/lib/badge-render.ts`**

Copy `replacePlaceholders`, `renderElementToHtml`, `generatePrintContent`, `getPaperDimensions` verbatim into this new file, with these exact signature changes and nothing else:

```typescript
// src/lib/badge-render.ts
//
// Badge-template HTML/CSS rendering, extracted verbatim from
// src/app/print/[token]/page.tsx (the standalone Print Station device page)
// so the kiosk "Check-in + Print Badge" mode (Stage 4) can render the exact
// same badge layout without duplicating this logic. Renders template_data
// (an ordered list of positioned text/shape/image/photo/line/qr_code/
// barcode elements) to an HTML string; the caller rasterizes it (e.g. via
// html2canvas) and sends the result to a printer -- this module has no
// printer-specific code and no network calls of its own.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function replacePlaceholders(text: string, reg: any, eventName: string): string {
  if (!text) return ""
  let result = text
  result = result.replace(/\{\{name\}\}/g, reg?.attendee_name || "")
  result = result.replace(/\{\{registration_number\}\}/g, reg?.registration_number || "")
  result = result.replace(/\{\{ticket_type\}\}/g, reg?.ticket_type || reg?.ticket_types?.name || "")
  result = result.replace(/\{\{email\}\}/g, reg?.attendee_email || "")
  result = result.replace(/\{\{phone\}\}/g, reg?.attendee_phone || "")
  result = result.replace(/\{\{institution\}\}/g, reg?.attendee_institution || "")
  result = result.replace(/\{\{designation\}\}/g, reg?.attendee_designation || "")
  result = result.replace(/\{\{event_name\}\}/g, eventName || "")
  result = result.replace(/\{\{event_date\}\}/g, "")
  return result
}

// Render a single badge element to HTML
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function renderElementToHtml(element: any, registration: any, eventName: string): string {
  const content = replacePlaceholders(element.content || "", registration, eventName)
  // ... [copy the rest of renderElementToHtml's body VERBATIM from the source
  // file's current lines 1311-1444 -- every branch (shape/image/photo/line/
  // qr_code/barcode/text/singleLine/lineClamp) unchanged, only the call to
  // replacePlaceholders above gains the new eventName argument] ...
}

export function getPaperDimensions(paperSize: string, orientation: string): { width: string; height: string } {
  // ... copy verbatim from the source file's current lines 1592-1608 ...
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generatePrintContent(data: {
  registration: any
  printSettings: any
  printMode: string
  badgeTemplate: any
  eventName: string
}): string {
  const { registration, printSettings, printMode, badgeTemplate, eventName } = data
  const settings = printSettings || {}
  const dimensions = getPaperDimensions(settings.paper_size, settings.orientation)
  const isOverlayMode = printMode === "overlay"
  const rotation = settings.rotation ?? (isOverlayMode ? 0 : 180)

  // ... copy the rest of generatePrintContent's body VERBATIM from the source
  // file's current lines 1456-1589, with these substitutions applied
  // throughout wherever the original read them:
  //   - `badge_template` -> `badgeTemplate`
  //   - `stationInfo.print_mode` -> `printMode` (already destructured above)
  //   - every `renderElementToHtml(el, registration)` call -> `renderElementToHtml(el, registration, eventName)`
  //   - the fallback branch's `station?.events?.name || stationInfo?.events?.name || "Event"` -> just `eventName || "Event"`
  // ...
}
```

Do not copy `_renderBadgeTemplate` (the source file's dead, unused, underscore-prefixed function at its current line ~1611) — it is not called anywhere and is not part of what this task extracts.

- [ ] **Step 3: Refactor `src/app/print/[token]/page.tsx` to import from the new module**

Remove the four function definitions from this file. Add the import:

```typescript
import { replacePlaceholders, renderElementToHtml, generatePrintContent, getPaperDimensions } from "@/lib/badge-render"
```

Update every call site in this file to pass the newly-required arguments, preserving identical behavior:
- Every `replacePlaceholders(x, y)` call becomes `replacePlaceholders(x, y, station?.events?.name || "")`.
- Every `renderElementToHtml(el, registration)` call becomes `renderElementToHtml(el, registration, station?.events?.name || "")`.
- The `generatePrintContent(data)` call site(s): change how `data` is constructed so it matches the new parameter shape — `{ registration: data.registration, printSettings: (data.station || station)?.print_settings, printMode: (data.station || station)?.print_mode, badgeTemplate: data.badge_template || station?.badge_templates, eventName: station?.events?.name || data?.station?.events?.name || "" }`. Read the actual current call site(s) carefully (there may be more than one, e.g. inside both the thermal-print and USB-print branches) and adapt this shape to what each site actually has in scope — the goal is identical rendered output to before, not a specific object-construction style.

- [ ] **Step 4: Verify byte-identical rendering**

There is no existing automated test for this page (matches this codebase's established convention for the kiosk/print device pages — no DOM/IndexedDB shim in this repo's Vitest config). Verify manually: run the dev server, open `/print/[token]` for a real, existing print station token in this environment, scan/search a real registration, and confirm the rendered badge (on-screen preview and/or a test print if hardware is available) is pixel-identical to before this refactor. If you cannot access real hardware/data in this environment, at minimum confirm `generatePrintContent(...)` and `renderElementToHtml(...)` produce identical HTML string output for a hand-constructed sample input before vs. after the refactor (e.g. via a throwaway local script or the browser console), and report this verification explicitly in your report — do not simply assert "it compiles."

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/lib/badge-render.ts "src/app/print/[token]/page.tsx"`
Expected: no new errors.

- [ ] **Step 6: Self-review**

Diff the new `src/lib/badge-render.ts` against the four functions' original bodies in `src/app/print/[token]/page.tsx` (via `git show HEAD:"src/app/print/[token]/page.tsx"` for the pre-refactor version) and confirm the ONLY differences are the parameter additions and their corresponding read-sites, enumerated above — not a single unrelated line of logic. Report this diff comparison explicitly, the same way Stage 3's Task 5 did.

- [ ] **Step 7: Commit**

```bash
git add src/lib/badge-render.ts "src/app/print/[token]/page.tsx"
git commit -m "refactor(print): extract badge-render module for reuse by kiosk print-badge mode"
```

---

### Task 3: `kiosk_stations` API — `print_station_id` + `auto_print_badge`

**Files:**
- Modify: `src/app/api/kiosk-stations/route.ts`
- Modify: `src/app/api/kiosk-stations/[id]/route.ts`
- Modify: `src/app/api/kiosk-stations/route.test.ts`
- Modify: `src/app/api/kiosk-stations/[id]/route.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `POST /api/kiosk-stations` accepts `mode?: "checkin" | "checkin_and_print"` (default `"checkin"`), `print_station_id?: string`, `auto_print_badge?: boolean` — required together when `mode === "checkin_and_print"`. `PATCH /api/kiosk-stations/[id]` accepts `print_station_id?`/`auto_print_badge?` updates. Both validate `print_station_id` belongs to the same event AND has `print_settings.printer_type === "usb"`. Task 4 (admin UI) and Task 9 (`/kiosk-station/[token]`) consume the widened response shape (`mode`, `print_station_id`, `auto_print_badge` now included in every `SELECT`).

- [ ] **Step 1: Write the failing tests**

Read the current `src/app/api/kiosk-stations/route.test.ts` and `src/app/api/kiosk-stations/[id]/route.test.ts` in full first (they have been through fix rounds since Stage 3 — confirm current helper names/shapes before writing additions). Add these cases (do not restructure any existing test):

```typescript
// additions to src/app/api/kiosk-stations/route.test.ts

const USB_PRINT_STATION_ID = "99999999-9999-9999-9999-999999999999"

describe("POST /api/kiosk-stations -- checkin_and_print mode", () => {
  it("creates a checkin_and_print station when print_station_id resolves to a usb-type Print Station in the same event", async () => {
    mock.queueResponse("checkin_lists", { data: { id: LIST_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("print_stations", {
      data: { id: USB_PRINT_STATION_ID, event_id: EVENT_ID, print_settings: { printer_type: "usb" } },
      error: null,
    })
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, name: "Front Desk", mode: "checkin_and_print", list_id: LIST_ID, print_station_id: USB_PRINT_STATION_ID, auto_print_badge: true, created_at: "2026-07-28T00:00:00Z" },
      error: null,
    })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", {
      method: "POST",
      body: { event_id: EVENT_ID, list_id: LIST_ID, name: "Front Desk", mode: "checkin_and_print", print_station_id: USB_PRINT_STATION_ID, auto_print_badge: true },
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.mode).toBe("checkin_and_print")
    const insertCall = mock.calls.find((c) => c.table === "kiosk_stations" && c.method === "insert")
    expect((insertCall!.args[0] as any).mode).toBe("checkin_and_print")
    expect((insertCall!.args[0] as any).print_station_id).toBe(USB_PRINT_STATION_ID)
    expect((insertCall!.args[0] as any).auto_print_badge).toBe(true)
  })

  it("400s when mode is checkin_and_print but print_station_id is missing", async () => {
    mock.queueResponse("checkin_lists", { data: { id: LIST_ID, event_id: EVENT_ID }, error: null })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", {
      method: "POST",
      body: { event_id: EVENT_ID, list_id: LIST_ID, name: "Front Desk", mode: "checkin_and_print" },
    }))
    expect(res.status).toBe(400)
  })

  it("404s when print_station_id belongs to a different event", async () => {
    mock.queueResponse("checkin_lists", { data: { id: LIST_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("print_stations", {
      data: { id: USB_PRINT_STATION_ID, event_id: "88888888-8888-8888-8888-888888888888", print_settings: { printer_type: "usb" } },
      error: null,
    })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", {
      method: "POST",
      body: { event_id: EVENT_ID, list_id: LIST_ID, name: "Front Desk", mode: "checkin_and_print", print_station_id: USB_PRINT_STATION_ID },
    }))
    expect(res.status).toBe(404)
  })

  it("400s when the linked Print Station isn't printer_type usb", async () => {
    mock.queueResponse("checkin_lists", { data: { id: LIST_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("print_stations", {
      data: { id: USB_PRINT_STATION_ID, event_id: EVENT_ID, print_settings: { printer_type: "zebra" } },
      error: null,
    })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", {
      method: "POST",
      body: { event_id: EVENT_ID, list_id: LIST_ID, name: "Front Desk", mode: "checkin_and_print", print_station_id: USB_PRINT_STATION_ID },
    }))
    expect(res.status).toBe(400)
  })
})
```

```typescript
// additions to src/app/api/kiosk-stations/[id]/route.test.ts

describe("PATCH /api/kiosk-stations/[id] -- print_station_id / auto_print_badge", () => {
  it("updates print_station_id when it resolves to a usb-type Print Station in the station's event", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("print_stations", {
      data: { id: "ps-1", event_id: EVENT_ID, print_settings: { printer_type: "usb" } },
      error: null,
    })
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, print_station_id: "ps-1" }, error: null })
    const { PATCH } = await import("./route")
    const res = await PATCH(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`, { method: "PATCH", body: { print_station_id: "ps-1" } }), params())
    expect(res.status).toBe(200)
  })

  it("400s when the new print_station_id isn't printer_type usb", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("print_stations", {
      data: { id: "ps-1", event_id: EVENT_ID, print_settings: { printer_type: "thermal" } },
      error: null,
    })
    const { PATCH } = await import("./route")
    const res = await PATCH(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`, { method: "PATCH", body: { print_station_id: "ps-1" } }), params())
    expect(res.status).toBe(400)
  })

  it("updates auto_print_badge", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, auto_print_badge: true }, error: null })
    const { PATCH } = await import("./route")
    const res = await PATCH(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`, { method: "PATCH", body: { auto_print_badge: true } }), params())
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/kiosk-stations/route.test.ts "src/app/api/kiosk-stations/[id]/route.test.ts"`
Expected: existing tests PASS; the 7 new ones FAIL.

- [ ] **Step 3: Implement the route changes**

In `src/app/api/kiosk-stations/route.ts`, replace the `GET` handler's `.select(...)` string to include the new columns:

```typescript
    .select("id, event_id, name, mode, list_id, print_station_id, auto_print_badge, last_seen_at, revoked_at, created_at")
```

Replace the `POST` handler's body-parsing and validation section (after the existing `listId` validation, before the `requireEventAndPermission` call) with:

```typescript
  const mode = (body.mode as string | undefined) === "checkin_and_print" ? "checkin_and_print" : "checkin"
  const printStationId = body.print_station_id as string | undefined
  const autoPrintBadge = body.auto_print_badge === true

  if (mode === "checkin_and_print" && (!printStationId || !isValidUUID(printStationId))) {
    return NextResponse.json({ error: "A Print Station must be selected for check-in + print mode." }, { status: 400 })
  }
```

After the existing `checkin_lists` cross-event check (still required for `list_id` regardless of mode), add the Print Station validation, only when `mode === "checkin_and_print"`:

```typescript
  if (mode === "checkin_and_print") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: printStation } = await (supabase as any)
      .from("print_stations")
      .select("id, event_id, print_settings")
      .eq("id", printStationId)
      .maybeSingle()

    if (!printStation || printStation.event_id !== eventId) {
      return NextResponse.json({ error: "Print Station not found for this event." }, { status: 404 })
    }
    if (printStation.print_settings?.printer_type !== "usb") {
      return NextResponse.json({ error: "Check-in + Print Badge stations require a USB-type Print Station." }, { status: 400 })
    }
  }
```

Update the `.insert({...})` call to include the new fields, and the trailing `.select(...)`:

```typescript
    .insert({
      event_id: eventId,
      name,
      mode,
      list_id: listId,
      print_station_id: mode === "checkin_and_print" ? printStationId : null,
      auto_print_badge: mode === "checkin_and_print" ? autoPrintBadge : false,
      access_token_hash: hashStationToken(access_token),
    })
    .select("id, event_id, name, mode, list_id, print_station_id, auto_print_badge, created_at")
    .single()
```

Update the module comment at the top (currently says "mode is hardcoded 'checkin' -- this stage never creates a 'print'-mode station") to reflect that `checkin_and_print` is now a real, validated option, while `mode: 'print'` (print-only, no check-in) remains unbuilt/unsupported by this route.

In `src/app/api/kiosk-stations/[id]/route.ts`'s `PATCH` handler, after the existing `list_id` handling block, add:

```typescript
  if (typeof body.print_station_id === "string") {
    if (!isValidUUID(body.print_station_id)) {
      return NextResponse.json({ error: "Invalid print station." }, { status: 400 })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: printStation } = await (supabase as any)
      .from("print_stations")
      .select("id, event_id, print_settings")
      .eq("id", body.print_station_id)
      .maybeSingle()
    if (!printStation || printStation.event_id !== station.event_id) {
      return NextResponse.json({ error: "Print Station not found for this event." }, { status: 404 })
    }
    if (printStation.print_settings?.printer_type !== "usb") {
      return NextResponse.json({ error: "Check-in + Print Badge stations require a USB-type Print Station." }, { status: 400 })
    }
    updates.print_station_id = body.print_station_id
  }
  if (typeof body.auto_print_badge === "boolean") {
    updates.auto_print_badge = body.auto_print_badge
  }
```

Update the `.select(...)` in this handler's final query to also return `print_station_id, auto_print_badge`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/api/kiosk-stations/route.test.ts "src/app/api/kiosk-stations/[id]/route.test.ts"`
Expected: PASS, all tests (existing + 7 new).

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/app/api/kiosk-stations/route.ts "src/app/api/kiosk-stations/[id]/route.ts"`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/kiosk-stations/route.ts "src/app/api/kiosk-stations/[id]/route.ts" src/app/api/kiosk-stations/route.test.ts "src/app/api/kiosk-stations/[id]/route.test.ts"
git commit -m "feat(kiosk): add checkin_and_print mode + print_station_id/auto_print_badge to kiosk-stations API"
```

---

### Task 4: Admin UI — mode selector, Print Station picker, auto-print toggle

**Files:**
- Modify: `src/app/events/[eventId]/kiosk-stations/page.tsx`

**Interfaces:**
- Consumes: `POST`/`PATCH /api/kiosk-stations` (Task 3), `GET /api/print-stations?event_id=` (existing endpoint, returns a bare array with each station's `print_settings` per its current implementation — confirm this shape is unchanged before relying on it).
- Produces: no exports consumed elsewhere — leaf admin page, same as Stage 3's Task 4.

No automated test for this file (matches Stage 3's Task 4 precedent for this exact page).

- [ ] **Step 1: Read the current file in full**

Read `src/app/events/[eventId]/kiosk-stations/page.tsx` completely — it has been through Stage 3's fix wave and may differ from any earlier excerpt.

- [ ] **Step 2: Add state and data fetching for Print Stations**

Add a `printStations` state (list of `{ id: string; name: string; print_settings?: { printer_type?: string } }`), fetched alongside `lists` in the existing `useEffect`'s `Promise.all`:

```typescript
    fetch(`/api/print-stations?event_id=${eventId}`)
      .then((r) => r.json())
      .then((d) => setPrintStations(Array.isArray(d) ? d : []))
```

Filter to USB-only for the picker: `const usbPrintStations = printStations.filter((p) => p?.print_settings?.printer_type === "usb")`.

- [ ] **Step 3: Add mode/print-station/auto-print state**

Add `newMode` (`"checkin" | "checkin_and_print"`, default `"checkin"`), `newPrintStationId` (string), `newAutoPrint` (boolean, default `false`) alongside the existing `newName`/`newListId` state.

- [ ] **Step 4: Update the create dialog**

Add, inside the create `Dialog`'s form, after the existing Check-in list `Select`:

```tsx
            <div>
              <label className="text-sm font-medium">Mode</label>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={newMode === "checkin"} onChange={() => setNewMode("checkin")} />
                  Check-in only
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={newMode === "checkin_and_print"} onChange={() => setNewMode("checkin_and_print")} />
                  Check-in + Print Badge
                </label>
              </div>
            </div>
            {newMode === "checkin_and_print" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Print Station</label>
                  {usbPrintStations.length === 0 ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      No USB-type Print Station found for this event. Create one on the Print Station page first.
                    </p>
                  ) : (
                    <Select value={newPrintStationId} onValueChange={setNewPrintStationId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a print station" />
                      </SelectTrigger>
                      <SelectContent>
                        {usbPrintStations.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={newAutoPrint} onChange={(e) => setNewAutoPrint(e.target.checked)} />
                  Auto-print badge on check-in
                </label>
                <p className="text-xs text-muted-foreground">
                  Requires an Android device with a directly-connected USB printer. Other devices will show check-in only, even if this station is configured for printing.
                </p>
              </div>
            )}
```

- [ ] **Step 5: Update `handleCreate` and the create button's `disabled` condition**

```typescript
  const handleCreate = async () => {
    if (!newName.trim() || !newListId) return
    if (newMode === "checkin_and_print" && !newPrintStationId) return
    setCreating(true)
    try {
      const res = await fetch("/api/kiosk-stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          name: newName.trim(),
          list_id: newListId,
          mode: newMode,
          ...(newMode === "checkin_and_print" && { print_station_id: newPrintStationId, auto_print_badge: newAutoPrint }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to create station")
        return
      }
      setShowCreate(false)
      setNewName("")
      setNewListId("")
      setNewMode("checkin")
      setNewPrintStationId("")
      setNewAutoPrint(false)
      setHandoff({ name: data.name, token: data.access_token })
      await loadStations()
    } finally {
      setCreating(false)
    }
  }
```

Update the "Create Station" button's `disabled`: `disabled={creating || !newName.trim() || !newListId || (newMode === "checkin_and_print" && !newPrintStationId)}`.

- [ ] **Step 6: Add a "Change print station" control to each `checkin_and_print` row**

Mirroring the existing "Change list" `Select` in the station row, add a parallel one shown only when `station.mode === "checkin_and_print"`, calling a new `handleReassignPrintStation(station, printStationId)` that `PATCH`es `print_station_id`, following the exact same pattern as `handleReassignList`.

- [ ] **Step 7: Update the `KioskStation` type and row display**

```typescript
type KioskStation = {
  id: string
  event_id: string
  name: string
  mode: "checkin" | "print" | "checkin_and_print"
  list_id: string | null
  print_station_id: string | null
  auto_print_badge: boolean
  last_seen_at: string | null
  revoked_at: string | null
  created_at: string
}
```

Add a small badge/label to each row showing "Check-in + Print" (with the linked print station's name and auto-print on/off) vs. plain "Check-in", alongside the existing list-name line.

- [ ] **Step 8: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint "src/app/events/[eventId]/kiosk-stations/page.tsx"`
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add "src/app/events/[eventId]/kiosk-stations/page.tsx"
git commit -m "feat(kiosk): add check-in + print badge mode to the kiosk stations admin UI"
```

---

### Task 5: Offline store — print-template cache and local print-log

**Files:**
- Modify: `src/lib/kiosk-offline-store.ts`
- Modify: `src/lib/kiosk-offline-store.test.ts` (create if it doesn't already exist — check first)

**Interfaces:**
- Consumes: nothing new.
- Produces: `export async function cachePrintTemplate(listId: string, template: CachedPrintTemplate): Promise<void>`, `export async function getPrintTemplate(listId: string): Promise<CachedPrintTemplate | null>`, `export async function recordPrintOutcome(entry: Omit<PrintLogEntry, "status">, status: "success" | "failed"): Promise<void>`, `export async function getLastPrintForRegistration(listId: string, registrationId: string): Promise<PrintLogEntry | null>`, `export async function getPendingPrintSyncs(listId: string): Promise<PrintLogEntry[]>`, `export async function markPrintSynced(printId: string): Promise<void>` — Task 6 (bootstrap caching), Task 7 (print trigger + reprint check), and Task 8 (sync to `print_jobs`) all consume these.

- [ ] **Step 1: Check for an existing test file**

Run `ls src/lib/kiosk-offline-store.test.ts 2>/dev/null` — if it exists, read it in full first and add to it; if not, create it fresh following the same `idb`-backed testing approach as the rest of this store (check whether this specific file has any existing tests at all — if this store has never been unit-tested due to the "no DOM/IndexedDB shim" constraint noted at the top of `kiosk-sync-worker.ts`, do not attempt to add DOM-dependent tests here either; if genuinely untestable in this environment, skip to Step 3 and note this explicitly in your report, matching the established precedent).

- [ ] **Step 2: Write failing tests (if testable in this environment)**

```typescript
// additions to src/lib/kiosk-offline-store.test.ts, if IndexedDB is testable here
import { describe, it, expect, beforeEach } from "vitest"
import "fake-indexeddb/auto" // only if this dependency already exists in the repo -- check package.json first; if absent, this file is untestable here and Step 1 applies instead
import { cachePrintTemplate, getPrintTemplate, recordPrintOutcome, getLastPrintForRegistration, getPendingPrintSyncs, markPrintSynced } from "./kiosk-offline-store"

describe("print template cache", () => {
  it("stores and retrieves a template by list_id", async () => {
    await cachePrintTemplate("list-1", { badgeTemplate: { elements: [] }, printSettings: { paper_size: "4x6" }, printStationId: "ps-1", cachedAt: Date.now() })
    const result = await getPrintTemplate("list-1")
    expect(result?.printStationId).toBe("ps-1")
  })

  it("returns null when nothing is cached for that list", async () => {
    expect(await getPrintTemplate("no-such-list")).toBeNull()
  })
})

describe("print log", () => {
  it("records a print outcome and retrieves the last one for a registration", async () => {
    await recordPrintOutcome({ print_id: "p-1", list_id: "list-1", registration_id: "reg-1", printed_at: Date.now() }, "success")
    const last = await getLastPrintForRegistration("list-1", "reg-1")
    expect(last?.print_id).toBe("p-1")
    expect(last?.status).toBe("success")
  })

  it("lists pending (unsynced) print outcomes for a list", async () => {
    await recordPrintOutcome({ print_id: "p-2", list_id: "list-1", registration_id: "reg-2", printed_at: Date.now() }, "success")
    const pending = await getPendingPrintSyncs("list-1")
    expect(pending.some((p) => p.print_id === "p-2")).toBe(true)
  })

  it("marks a print synced so it drops out of pending", async () => {
    await recordPrintOutcome({ print_id: "p-3", list_id: "list-1", registration_id: "reg-3", printed_at: Date.now() }, "success")
    await markPrintSynced("p-3")
    const pending = await getPendingPrintSyncs("list-1")
    expect(pending.some((p) => p.print_id === "p-3")).toBe(false)
  })
})
```

If `fake-indexeddb` is not already a dependency, do NOT add it (no new packages) — instead report this store's new functions as untestable in this environment in your report, matching this file's existing, established lack of unit tests, and proceed straight to implementation.

- [ ] **Step 3: Implement the new store additions**

Add to `src/lib/kiosk-offline-store.ts`:

```typescript
const PRINT_TEMPLATE_STORE = "print_template_cache"
const PRINT_LOG_STORE = "print_log"

export interface CachedPrintTemplate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  badgeTemplate: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  printSettings: any
  printStationId: string
  // Every element with an imageUrl in badgeTemplate.elements has that URL
  // pre-fetched and inlined as a data: URL in this map (imageUrl -> data URL)
  // before caching, so rendering at print time has zero network dependency.
  imageDataUrls: Record<string, string>
  cachedAt: number
}

export interface PrintLogEntry {
  print_id: string
  list_id: string
  registration_id: string
  printed_at: number
  status: "success" | "failed"
  synced: boolean
}
```

Bump `VERSION` to `2` and add the two new object stores in the `upgrade` callback (existing stores are untouched -- `idb`'s upgrade callback receives `oldVersion`, but since these are pure additions, an unconditional `if (!db.objectStoreNames.contains(...))` guard, matching this file's existing style, is sufficient without needing version-gated migration logic):

```typescript
        if (!db.objectStoreNames.contains(PRINT_TEMPLATE_STORE)) {
          db.createObjectStore(PRINT_TEMPLATE_STORE, { keyPath: "list_id" })
        }
        if (!db.objectStoreNames.contains(PRINT_LOG_STORE)) {
          const store = db.createObjectStore(PRINT_LOG_STORE, { keyPath: "print_id" })
          store.createIndex("by_list", "list_id")
          store.createIndex("by_registration", ["list_id", "registration_id"])
        }
```

Add the functions:

```typescript
// --- Print template cache -------------------------------------------------

export async function cachePrintTemplate(listId: string, template: CachedPrintTemplate): Promise<void> {
  const db = await getDb()
  await db.put(PRINT_TEMPLATE_STORE, { list_id: listId, ...template })
}

export async function getPrintTemplate(listId: string): Promise<CachedPrintTemplate | null> {
  const db = await getDb()
  const row = await db.get(PRINT_TEMPLATE_STORE, listId)
  if (!row) return null
  const { list_id: _listId, ...template } = row
  return template as CachedPrintTemplate
}

// --- Print log (local reprint-check + eventual print_jobs sync) ----------

export async function recordPrintOutcome(
  entry: Omit<PrintLogEntry, "status" | "synced">,
  status: "success" | "failed"
): Promise<void> {
  const db = await getDb()
  await db.put(PRINT_LOG_STORE, { ...entry, status, synced: false } satisfies PrintLogEntry)
}

export async function getLastPrintForRegistration(listId: string, registrationId: string): Promise<PrintLogEntry | null> {
  const db = await getDb()
  const rows = (await db.getAllFromIndex(PRINT_LOG_STORE, "by_registration", [listId, registrationId])) as PrintLogEntry[]
  if (rows.length === 0) return null
  return rows.reduce((latest, row) => (row.printed_at > latest.printed_at ? row : latest))
}

export async function getPendingPrintSyncs(listId: string): Promise<PrintLogEntry[]> {
  const db = await getDb()
  const rows = (await db.getAllFromIndex(PRINT_LOG_STORE, "by_list", listId)) as PrintLogEntry[]
  return rows.filter((r) => !r.synced)
}

export async function markPrintSynced(printId: string): Promise<void> {
  const db = await getDb()
  const entry = (await db.get(PRINT_LOG_STORE, printId)) as PrintLogEntry | undefined
  if (!entry) return
  await db.put(PRINT_LOG_STORE, { ...entry, synced: true })
}
```

- [ ] **Step 4: Run tests (if applicable) and typecheck**

Run: `npx vitest run src/lib/kiosk-offline-store.test.ts 2>/dev/null || echo "no test file for this store, per established precedent"`
Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/lib/kiosk-offline-store.ts`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kiosk-offline-store.ts
git commit -m "feat(kiosk): add print-template cache and local print-log to the offline store"
```

---

### Task 6: Cache the badge template during online bootstrap

**Files:**
- Modify: `src/components/kiosk/KioskCheckinScreen.tsx`

**Interfaces:**
- Consumes: `cachePrintTemplate` (Task 5), the resolved print station's `print_settings`/`badge_template_id`/`printStationId` and `autoPrintBadge`/`mode` (new props from Task 9).
- Produces: the cached `CachedPrintTemplate` that Task 7's print trigger reads via `getPrintTemplate`.

- [ ] **Step 1: Read the current file in full**

Read `src/components/kiosk/KioskCheckinScreen.tsx` completely (it was extracted in Stage 3 and is the file every subsequent kiosk change touches — confirm current line numbers before editing).

- [ ] **Step 2: Extend the props interface**

```typescript
interface KioskCheckinScreenProps {
  eventId: string
  listId: string
  token?: string
  stationToken?: string
  // Stage 4 (check-in + print badge). mode is "checkin" for every existing
  // caller (Stage 1-3 direct-URL and station flows) -- print-related props
  // are only ever populated when mode === "checkin_and_print".
  mode?: "checkin" | "checkin_and_print"
  autoPrintBadge?: boolean
  printStationId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  badgeTemplate?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  printSettings?: any
}

export function KioskCheckinScreen({
  eventId,
  listId,
  token = "",
  stationToken,
  mode = "checkin",
  autoPrintBadge = false,
  printStationId,
  badgeTemplate,
  printSettings,
}: KioskCheckinScreenProps) {
```

- [ ] **Step 3: Add the template-caching bootstrap effect**

Add a new `useEffect`, separate from the existing delegate-roster bootstrap (do not merge into `refreshFromServer` -- this is a distinct, print-specific concern with its own failure mode that must never block or degrade the check-in bootstrap):

```typescript
  // Stage 4: cache the badge template (and every element's remote image as
  // a local data URL) once, while online, so printing later has zero
  // network dependency. Runs once per mount when this station is in
  // checkin_and_print mode; re-fetches are not needed within a session --
  // an admin changing the linked Print Station's template mid-event is rare
  // enough that a reload (which remounts this component) is an acceptable
  // way to pick up a change, matching this codebase's existing tolerance
  // for similar edge cases elsewhere in the kiosk.
  useEffect(() => {
    if (mode !== "checkin_and_print" || !printStationId || !badgeTemplate) return
    if (typeof navigator !== "undefined" && !navigator.onLine) return

    let cancelled = false

    async function cacheTemplate() {
      try {
        const elements = badgeTemplate?.template_data?.elements || []
        const imageDataUrls: Record<string, string> = {}

        for (const el of elements) {
          if ((el.type === "image" || el.type === "photo") && el.imageUrl && !imageDataUrls[el.imageUrl]) {
            try {
              const res = await fetch(el.imageUrl)
              const blob = await res.blob()
              const dataUrl: string = await new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.onerror = reject
                reader.readAsDataURL(blob)
              })
              imageDataUrls[el.imageUrl] = dataUrl
            } catch (err) {
              // One unreachable image asset must not prevent caching the
              // rest of the template -- that element just won't render at
              // print time (matching this file's existing "missing QR"
              // placeholder pattern), not block check-in/print entirely.
              Sentry.captureException(err, { tags: { module: "kiosk-print-cache" }, extra: { eventId, listId, imageUrl: el.imageUrl } })
            }
          }
        }

        if (cancelled) return
        await cachePrintTemplate(listId, {
          badgeTemplate,
          printSettings,
          printStationId,
          imageDataUrls,
          cachedAt: Date.now(),
        })
      } catch (err) {
        Sentry.captureException(err, { tags: { module: "kiosk-print-cache" }, extra: { eventId, listId } })
      }
    }

    cacheTemplate()
    return () => {
      cancelled = true
    }
  }, [mode, printStationId, badgeTemplate, printSettings, eventId, listId])
```

Add `cachePrintTemplate` to the existing `import { ... } from "@/lib/kiosk-offline-store"` line.

- [ ] **Step 4: Run existing tests and typecheck**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/kiosk/KioskCheckinScreen.tsx`
Expected: no new errors. No automated test exists for this component (established precedent) -- this task adds behavior only reachable when `mode === "checkin_and_print"`, so the existing `mode="checkin"` behavior (every current caller) must be provably unaffected: confirm by reading the diff that nothing outside the new effect changed.

- [ ] **Step 5: Commit**

```bash
git add src/components/kiosk/KioskCheckinScreen.tsx
git commit -m "feat(kiosk): cache badge template + images during online bootstrap for local-first printing"
```

---

### Task 7: Print trigger — feature detection, canvas render, WebUSB send, reprint warning

**Files:**
- Modify: `src/components/kiosk/KioskCheckinScreen.tsx`

**Interfaces:**
- Consumes: `getPrintTemplate`, `recordPrintOutcome`, `getLastPrintForRegistration` (Task 5); `generatePrintContent` (Task 2); `isWebUSBSupported`, `reconnectUsbPrinter`, `connectUsbPrinter`, `isUsbPrinterConnected`, `getUsbPrinterName`, `printBadgeViaUsb` (existing `src/lib/usb-printer.ts`, unchanged); `html2canvas` (existing dependency); `QRCode` from `qrcode` (existing dependency, already imported elsewhere in this codebase's print flow).
- Produces: no new exports -- this is the terminal consumer of every prior task in this plan.

- [ ] **Step 1: Add print-related state**

Alongside the existing state declarations in `KioskCheckinScreen`:

```typescript
  const [usbSupported, setUsbSupported] = useState(false)
  const [printerConnected, setPrinterConnected] = useState(false)
  const [printerName, setPrinterName] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [printStatus, setPrintStatus] = useState<{ success: boolean; message: string } | null>(null)
```

- [ ] **Step 2: Feature-detect and auto-reconnect on mount**

```typescript
  useEffect(() => {
    if (mode !== "checkin_and_print") return
    let cancelled = false
    ;(async () => {
      const { isWebUSBSupported, reconnectUsbPrinter, getUsbPrinterName } = await import("@/lib/usb-printer")
      if (!isWebUSBSupported()) return
      if (cancelled) return
      setUsbSupported(true)
      const result = await reconnectUsbPrinter()
      if (cancelled) return
      if (result.success) {
        setPrinterConnected(true)
        setPrinterName(result.name || getUsbPrinterName())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode])
```

- [ ] **Step 3: The print function**

```typescript
  const printBadge = useCallback(async (registration: NonNullable<CheckinResult["registration"]>) => {
    setPrinting(true)
    setPrintStatus(null)
    try {
      const template = await getPrintTemplate(listId)
      if (!template) {
        setPrintStatus({ success: false, message: "Badge template not ready yet. Try again in a moment." })
        return
      }

      const badgeTemplate = template.badgeTemplate
      const elements = badgeTemplate?.template_data?.elements || []
      // Substitute cached data URLs for remote imageUrls, and pre-generate
      // QR codes -- both must happen before rendering, since neither can
      // hit the network at this point (matches the existing /print/[token]
      // pattern for QR pre-generation).
      const resolvedElements = await Promise.all(
        elements.map(async (el: any) => {
          if ((el.type === "image" || el.type === "photo") && el.imageUrl && template.imageDataUrls[el.imageUrl]) {
            return { ...el, imageUrl: template.imageDataUrls[el.imageUrl] }
          }
          if (el.type === "qr_code") {
            const { replacePlaceholders } = await import("@/lib/badge-render")
            const qrValue = replacePlaceholders(el.content || "", registration, event?.name || "")
            if (qrValue) {
              try {
                const QRCode = (await import("qrcode")).default
                const dataUrl = await QRCode.toDataURL(qrValue, {
                  width: Math.min(el.width, el.height) * 2,
                  margin: 1,
                  errorCorrectionLevel: "M",
                })
                return { ...el, _qrDataUrl: dataUrl }
              } catch {
                return el
              }
            }
          }
          return el
        })
      )

      const { generatePrintContent, getPaperDimensions } = await import("@/lib/badge-render")
      const printContent = generatePrintContent({
        registration,
        printSettings: template.printSettings,
        printMode: "full",
        badgeTemplate: { ...badgeTemplate, template_data: { ...badgeTemplate.template_data, elements: resolvedElements } },
        eventName: event?.name || "",
      })

      const dim = getPaperDimensions(template.printSettings?.paper_size || "4x6", template.printSettings?.orientation || "portrait")
      const container = document.createElement("div")
      container.id = `print-render-kiosk-${Date.now()}`
      container.style.position = "absolute"
      container.style.left = "-9999px"
      container.style.top = "0"
      container.style.width = dim.width
      container.style.height = dim.height
      const bodyMatch = printContent.match(/<body[^>]*>([\s\S]*)<\/body>/)
      container.innerHTML = bodyMatch ? bodyMatch[1] : printContent
      document.body.appendChild(container)
      await new Promise((resolve) => setTimeout(resolve, 400))

      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false })
      document.body.removeChild(container)

      const { printBadgeViaUsb } = await import("@/lib/usb-printer")
      const result = await printBadgeViaUsb(canvas, template.printSettings?.paper_size || "4x6")

      await recordPrintOutcome(
        { print_id: newId(), list_id: listId, registration_id: registration.id, printed_at: Date.now() },
        result.success ? "success" : "failed"
      )

      setPrintStatus(
        result.success
          ? { success: true, message: "Badge printed!" }
          : { success: false, message: result.error || "Print failed" }
      )
    } catch (err) {
      Sentry.captureException(err, { tags: { module: "kiosk-print" }, extra: { eventId, listId } })
      setPrintStatus({ success: false, message: "Something went wrong printing this badge." })
    } finally {
      setPrinting(false)
    }
  }, [listId, eventId, event?.name])
```

- [ ] **Step 4: Auto-print effect and the manual button's reprint-check handler**

```typescript
  useEffect(() => {
    if (mode !== "checkin_and_print" || !autoPrintBadge || !result?.success || !result.registration) return
    void printBadge(result.registration)
    // Intentionally does not depend on printBadge's identity changing --
    // this must fire exactly once per successful check-in result, not
    // re-fire if printBadge's useCallback deps happen to change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  const handlePrintButtonClick = async () => {
    if (!result?.registration) return
    const last = await getLastPrintForRegistration(listId, result.registration.id)
    if (last && last.status === "success") {
      const when = new Date(last.printed_at).toLocaleTimeString()
      if (!confirm(`Already printed at ${when} — print again?`)) return
    }
    void printBadge(result.registration)
  }
```

Add `getPrintTemplate, recordPrintOutcome, getLastPrintForRegistration` to the existing `kiosk-offline-store` import, and `newId` (already imported).

- [ ] **Step 5: Render the print UI on the success screen**

Inside the success-screen JSX (`if (result) { ... }` branch, in the "Actions" button row), add, only when `mode === "checkin_and_print" && usbSupported`:

```tsx
                  {mode === "checkin_and_print" && usbSupported && (
                    !printerConnected ? (
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-14 sm:h-16 px-6 sm:px-8 text-base bg-transparent border-white/15 text-white hover:bg-white/10 hover:text-white"
                        onClick={async () => {
                          const { connectUsbPrinter } = await import("@/lib/usb-printer")
                          const res = await connectUsbPrinter()
                          if (res.success) {
                            setPrinterConnected(true)
                            setPrinterName(res.name || null)
                          } else {
                            setPrintStatus({ success: false, message: res.error || "Connection failed" })
                          }
                        }}
                      >
                        Connect Printer
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        className="h-14 sm:h-16 px-6 sm:px-8 text-base"
                        onClick={handlePrintButtonClick}
                        disabled={printing}
                      >
                        {printing ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : null}
                        Print Badge
                      </Button>
                    )
                  )}
```

Add a small status line near the footer, only when `printStatus` is set: `{printStatus && <p className={printStatus.success ? "text-xs text-emerald-400 mt-1" : "text-xs text-red-400 mt-1"}>{printStatus.message}</p>}`.

- [ ] **Step 6: Verify manually (no automated test for this component)**

No automated test exists for this file (established precedent, no DOM shim). This task must be verified manually per Task 10's expanded hardware-verification checklist below -- confirm in the diff that every new code path is gated behind `mode === "checkin_and_print"` and cannot execute for any existing `mode: "checkin"` caller.

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/kiosk/KioskCheckinScreen.tsx`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/kiosk/KioskCheckinScreen.tsx
git commit -m "feat(kiosk): add local-first badge printing (USB, auto-print, reprint warning)"
```

---

### Task 8: Sync print outcomes to `print_jobs`

**Files:**
- Create: `src/app/api/kiosk/print-sync/route.ts`
- Create: `src/app/api/kiosk/print-sync/route.test.ts`
- Modify: `src/components/kiosk/KioskCheckinScreen.tsx`

**Interfaces:**
- Consumes: `getPendingPrintSyncs`, `markPrintSynced` (Task 5).
- Produces: `POST /api/kiosk/print-sync` -- accepts `{ print_station_id, registration_id, printed_at, status }`, inserts a row into `print_jobs`. No caller outside this plan.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/api/kiosk/print-sync/route.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const PRINT_STATION_ID = "99999999-9999-9999-9999-999999999999"
const REG_ID = "33333333-3333-3333-3333-333333333333"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

describe("POST /api/kiosk/print-sync", () => {
  it("400s on a missing print_station_id", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk/print-sync", { method: "POST", body: { registration_id: REG_ID, printed_at: Date.now(), status: "success" } }))
    expect(res.status).toBe(400)
  })

  it("inserts a print_jobs row for a successful print", async () => {
    mock.queueResponse("print_jobs", { data: { id: "pj-1" }, error: null })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk/print-sync", {
      method: "POST",
      body: { print_station_id: PRINT_STATION_ID, registration_id: REG_ID, printed_at: Date.now(), status: "success" },
    }))
    expect(res.status).toBe(200)
    const insertCall = mock.calls.find((c) => c.table === "print_jobs" && c.method === "insert")
    expect((insertCall!.args[0] as any).print_station_id).toBe(PRINT_STATION_ID)
    expect((insertCall!.args[0] as any).registration_id).toBe(REG_ID)
    expect((insertCall!.args[0] as any).status).toBe("success")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/kiosk/print-sync/route.test.ts`
Expected: FAIL -- module doesn't exist.

- [ ] **Step 3: Implement the route**

```typescript
// src/app/api/kiosk/print-sync/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// POST /api/kiosk/print-sync -- opportunistic, best-effort sync of a badge
// print that already happened locally (WebUSB, offline-capable -- see
// KioskCheckinScreen's printBadge) into print_jobs, so the standalone Print
// Station admin view's audit trail includes kiosk-triggered prints. This
// never gates or blocks the print itself, which has already completed by
// the time this is called -- same bare "unguessable UUID pair" trust model
// as /api/kiosk/checkin (this route is not the authorization boundary; the
// print already happened offline, possibly minutes or hours earlier).
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`kiosk-print-sync:${clientIp}`, "public")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  const body = await request.json().catch(() => ({}))
  const printStationId = body.print_station_id as string | undefined
  const registrationId = body.registration_id as string | undefined
  const printedAt = body.printed_at as number | undefined
  const status = body.status as string | undefined

  if (!printStationId || !isValidUUID(printStationId)) {
    return NextResponse.json({ error: "Invalid print station." }, { status: 400 })
  }
  if (!registrationId || !isValidUUID(registrationId)) {
    return NextResponse.json({ error: "Invalid registration." }, { status: 400 })
  }
  if (!printedAt || (status !== "success" && status !== "failed")) {
    return NextResponse.json({ error: "Invalid print outcome." }, { status: 400 })
  }

  const supabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("print_jobs").insert({
    print_station_id: printStationId,
    registration_id: registrationId,
    status,
    printed_at: status === "success" ? new Date(printedAt).toISOString() : null,
    device_info: { source: "kiosk" },
  })

  if (error) {
    return NextResponse.json({ error: "Failed to sync print job." }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/api/kiosk/print-sync/route.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Wire the sync call into `KioskCheckinScreen`**

Add a `syncPrintLog` function, following the exact same shape/triggers as the existing `syncNow` (online listener, 20s interval poll, in-flight guard):

```typescript
  const printSyncInFlightRef = useRef<boolean>(false)

  const syncPrintLog = useCallback(async () => {
    if (mode !== "checkin_and_print") return
    if (typeof navigator !== "undefined" && !navigator.onLine) return
    if (printSyncInFlightRef.current) return
    printSyncInFlightRef.current = true
    try {
      const pending = await getPendingPrintSyncs(listId)
      for (const entry of pending) {
        try {
          const res = await fetch("/api/kiosk/print-sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              print_station_id: printStationId,
              registration_id: entry.registration_id,
              printed_at: entry.printed_at,
              status: entry.status,
            }),
          })
          if (res.ok) await markPrintSynced(entry.print_id)
        } catch {
          // Routine offline/transient failure -- this entry stays pending
          // and is retried on the next poll, same tolerance as syncNow.
          break
        }
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { module: "kiosk-print-sync" }, extra: { eventId, listId } })
    } finally {
      printSyncInFlightRef.current = false
    }
  }, [mode, listId, printStationId, eventId])

  useEffect(() => {
    if (mode !== "checkin_and_print") return
    if (typeof navigator !== "undefined" && navigator.onLine) void syncPrintLog()
    window.addEventListener("online", syncPrintLog)
    const pollId = setInterval(syncPrintLog, 20000)
    return () => {
      window.removeEventListener("online", syncPrintLog)
      clearInterval(pollId)
    }
  }, [syncPrintLog, mode])
```

Add `getPendingPrintSyncs, markPrintSynced` to the existing `kiosk-offline-store` import.

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/app/api/kiosk/print-sync/route.ts src/components/kiosk/KioskCheckinScreen.tsx`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/kiosk/print-sync/route.ts src/app/api/kiosk/print-sync/route.test.ts src/components/kiosk/KioskCheckinScreen.tsx
git commit -m "feat(kiosk): sync local print outcomes to print_jobs when back online"
```

---

### Task 9: `/kiosk-station/[token]` — resolve and pass print-mode props

**Files:**
- Modify: `src/app/kiosk-station/[token]/page.tsx`

**Interfaces:**
- Consumes: `KioskCheckinScreen`'s new props (Tasks 6/7).
- Produces: no exports consumed elsewhere -- leaf route.

- [ ] **Step 1: Read the current file in full**

Confirm it still matches the content shown in this plan's research (the `station` select, the three error-state components) before editing.

- [ ] **Step 2: Widen the `kiosk_stations` select and resolve the linked Print Station**

Replace:

```typescript
  const { data: station, error } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id, mode, list_id, revoked_at")
    .eq("access_token_hash", hashStationToken(token))
    .maybeSingle()
```

with:

```typescript
  const { data: station, error } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id, mode, list_id, print_station_id, auto_print_badge, revoked_at")
    .eq("access_token_hash", hashStationToken(token))
    .maybeSingle()
```

Update the not-found guard (`station.mode !== "checkin"`) to accept both valid modes:

```typescript
  if (!station || station.revoked_at || (station.mode !== "checkin" && station.mode !== "checkin_and_print")) {
    return <StationNotFound />
  }
```

After the existing `list_id` null-check and before the `last_seen_at` update, resolve the Print Station and badge template when this station is `checkin_and_print`:

```typescript
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let printSettings: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let badgeTemplate: any = null

  if (station.mode === "checkin_and_print" && station.print_station_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: printStation } = await (supabase as any)
      .from("print_stations")
      .select("print_settings, badge_templates (id, name, template_data)")
      .eq("id", station.print_station_id)
      .maybeSingle()
    printSettings = printStation?.print_settings || null
    badgeTemplate = printStation?.badge_templates || null
  }
```

Update the final render:

```typescript
  return (
    <KioskCheckinScreen
      eventId={station.event_id}
      listId={station.list_id}
      stationToken={token}
      mode={station.mode}
      autoPrintBadge={station.auto_print_badge}
      printStationId={station.print_station_id || undefined}
      badgeTemplate={badgeTemplate || undefined}
      printSettings={printSettings || undefined}
    />
  )
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint "src/app/kiosk-station/[token]/page.tsx"`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/kiosk-station/[token]/page.tsx"
git commit -m "feat(kiosk): resolve print-mode props on /kiosk-station/[token]"
```

---

### Task 10: Manual hardware verification

No code changes -- exercises Tasks 1-9 end to end, extending Stage 3's own Task 10 protocol.

- [ ] **Step 1: Apply the migration**

Get explicit user go-ahead, then apply `supabase/migrations/20260728_kiosk_stations_print_badge_mode.sql`. Confirm `kiosk_stations.mode` accepts `'checkin_and_print'` and `auto_print_badge` exists, defaulting `false`.

- [ ] **Step 2: Provision a combined station**

On a real event with a USB-type Print Station already configured (a real badge template with at least one text and one image/photo element, to exercise both the text and image-caching paths), create a Kiosk Station in "Check-in + Print Badge" mode, linked to that Print Station, with auto-print off. Confirm the hand-off flow is unchanged from Stage 3.

- [ ] **Step 3: Open on real Android hardware**

Open the station link on an actual Android tablet with a USB printer connected. Confirm `usbSupported` is true and the printer auto-reconnects if it was previously paired via `/print/[token]` on this same device, or shows "Connect Printer" if not.

- [ ] **Step 4: Confirm local-first printing**

Check a real delegate in. Confirm the "Print Badge" button appears. Open DevTools' Network tab, tap "Print Badge", and confirm **zero network requests fire** during the render+print (only the earlier bootstrap fetch, well before this tap, should show any network activity). Confirm the printed badge matches what the same registration would produce via the standalone `/print/[token]` page for the same Print Station.

- [ ] **Step 5: Confirm reprint warning**

Tap "Print Badge" again for the same delegate. Confirm the "Already printed at HH:MM — print again?" confirm appears, and that confirming prints again while cancelling does not.

- [ ] **Step 6: Confirm auto-print**

Toggle "Auto-print badge on check-in" on for this station (or a second one), check in a different delegate, and confirm the badge prints automatically with no tap, and the "Print Badge" button is still present afterward (for a manual reprint).

- [ ] **Step 7: Confirm feature-detection on an unsupported device**

Open the same station link on an iPad (or any browser without `navigator.usb`). Confirm check-in works exactly as `mode: "checkin"` would, with no print button, no "Connect Printer" prompt, and no error message.

- [ ] **Step 8: Confirm print_jobs sync**

After the prints above, check the `print_jobs` table (or the standalone Print Station admin page's stats) and confirm rows appear for the kiosk-triggered prints, with `device_info.source: "kiosk"`.

- [ ] **Step 9: Record results**

Note the outcome of Steps 2-8 (pass/fail, any anomalies) alongside Stage 3's own Task 10 results when this branch is opened for review.

---

## Self-Review Notes

- **Spec coverage:** Design doc §1 (schema) → Task 1 & Task 3. §2 (admin UI) → Task 4. §3 (device UI, bootstrap, printing, reprint warning, print_jobs sync) → Tasks 5-8. §4 (platform/feature-detection) → Task 7 Step 2. The badge-rendering technical correction (reuse `generatePrintContent`/`html2canvas`, not a hand-rolled canvas API) → Task 2.
- **Out of scope, confirmed not touched:** `mode: 'print'` (print-only stations) untouched by any task. Zebra/thermal/browser-print paths for `checkin_and_print` untouched -- Task 3's validation explicitly rejects non-`usb` `print_station_id`s. The standalone `/print/[token]` and `/events/[eventId]/print-stations` pages' own behavior is unchanged except for Task 2's behavior-preserving extraction (verified via the same diff-based rigor as Stage 3's Task 5). `src/lib/usb-printer.ts` is imported, never modified.
- **Type/name consistency check:** `CachedPrintTemplate`/`PrintLogEntry` (Task 5) are the exact types Task 6 (`cachePrintTemplate`), Task 7 (`getPrintTemplate`, `recordPrintOutcome`, `getLastPrintForRegistration`), and Task 8 (`getPendingPrintSyncs`, `markPrintSynced`) all import and use identically. `mode`/`autoPrintBadge`/`printStationId`/`badgeTemplate`/`printSettings` prop names on `KioskCheckinScreen` are consistent between Task 6/7 (consumers) and Task 9 (the only producer/caller). `checkin_and_print` (the exact string literal) is consistent across the DB CHECK constraint (Task 1), the API validation (Task 3), the admin UI (Task 4), and every device-side gate (Tasks 6, 7, 8, 9) -- no task uses a different spelling or a boolean flag instead.
- **Migration sequencing:** Task 1's migration must exist (committed) before Task 3's code is written, since Task 3 assumes `print_station_id`/`auto_print_badge` will exist once applied -- but per Global Constraints, it is not actually applied until Task 10 gets explicit go-ahead, mirroring Stage 3's `station_id` precedent exactly (including that stage's final-review finding that the insert must degrade safely if the column isn't live yet -- Task 8's `print_jobs` insert here has no such risk since `print_jobs` and its columns already exist in production today).
