# Kiosk Printer Volunteer-Experience Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close four remaining volunteer-facing gaps from `docs/superpowers/specs/2026-07-31-badge-printing-admin-configured-design.md` §4-6 that don't require any new schema or the Path B (browser-print) rendering pipeline: a true two-state printer status indicator, the admin's phone number on the printer setup screen, a distinct "badge did not print" recovery screen that never reads as a check-in failure, and a persistent reprint action on the idle/ready screen.

**Architecture:** All four changes are additive UI/state changes inside the existing `src/components/kiosk/KioskCheckinScreen.tsx` (plus one new prop threaded through `KioskStationShell.tsx` and the SSR page `src/app/kiosk-station/[token]/page.tsx`). No new tables, no new API routes, no change to the print-trigger pipeline (`printBadge`, `usb-printer.ts`, `escpos-printer.ts`) beyond one new state-setter call. Path B (the `window.print()` browser-fallback pipeline) and the legacy `/print/[token]` volunteer page are explicitly out of scope — separate, later work.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript — same as the rest of this codebase.

## Global Constraints

- Do not touch `/print/[token]/page.tsx` — explicitly out of scope per the project owner ("leave it alone for now").
- Do not touch Path B / any `window.print()` rendering work, `printBadge`'s canvas-render body, `usb-printer.ts`, or `escpos-printer.ts` — this plan only adds new UI states around the existing print trigger, never changes how a badge is actually rendered or sent.
- Do not change the existing warn-before-reprint `confirm()` inside `handlePrintButtonClick` — that guard exists because the "Print Badge" button is ambiguous (could be a first print or a reprint) and stays exactly as-is. The NEW "Reprint badge for {name}" action added in Task 4 is unambiguous by its own label and deliberately skips that confirm — this is intentional, not an oversight; do not add a second confirm to it.
- The printer status indicator is two states only, ever: "Printer ready" or "Printer problem — call for help". Do not add a third color/state (e.g. an amber "connecting" state) to the footer chip — the spec is explicit that the volunteer cannot diagnose, so nothing in-between should be surfaced there.
- `npx tsc --noEmit` and `npx vitest run` must stay clean after every task.

---

### Task 1: Two-state printer status in the idle scan-screen footer

**Files:**
- Modify: `src/components/kiosk/KioskCheckinScreen.tsx`

**Interfaces:**
- Consumes: existing `printerConnected` and `printerVerified` state (both already declared, already updated by the existing printer-setup/reconnect/disconnect effects — no new state needed for this task).
- Produces: nothing new consumed elsewhere.

The idle/ready self-service scan screen (used by every `checkin_and_print` station once the volunteer has passed the printer setup screen) already has a persistent footer status-chip row. Its printer chip today only reflects `printerConnected`, so a printer that's plugged in but was never test-printed (or failed its test) shows the same "Printer connected" text as a genuinely verified one — silently violating the spec's "two states only" rule and hiding exactly the failure mode this whole feature exists to catch (a LaserJet that accepts bytes and prints nothing).

- [ ] **Step 1: Fix the footer chip's condition and copy**

Find this block (around line 2335-2340):

```tsx
          {mode === "checkin_and_print" && usbSupported && (
            <span className={`inline-flex items-center gap-1 ${printerConnected ? "text-emerald-400" : "text-gray-500"}`}>
              <span className={`size-1.5 rounded-full ${printerConnected ? "bg-emerald-400" : "bg-gray-500"}`} />
              {printerConnected ? "Printer connected" : "Printer not connected"}
            </span>
          )}
```

Replace it with:

```tsx
          {mode === "checkin_and_print" && usbSupported && (
            <span className={`inline-flex items-center gap-1 ${printerConnected && printerVerified ? "text-emerald-400" : "text-red-400"}`}>
              <span className={`size-1.5 rounded-full ${printerConnected && printerVerified ? "bg-emerald-400" : "bg-red-400"}`} />
              {printerConnected && printerVerified ? "Printer ready" : "Printer problem — call for help"}
            </span>
          )}
```

This is the only change in this task. `printerConnected` already flips back to `false` via the existing `onUsbDisconnect` callback (around line 702-705) when the printer is unplugged mid-shift, so this chip already updates live on disconnect — it just wasn't accounting for `printerVerified` or using the spec's exact two-state copy.

- [ ] **Step 2: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Manually confirm (dev server, mocking `printerConnected`/`printerVerified` via React DevTools or a temporary log) that the chip reads "Printer ready" only when both are true, and "Printer problem — call for help" in every other combination (not connected; connected but not verified).

- [ ] **Step 3: Commit**

```bash
git add src/components/kiosk/KioskCheckinScreen.tsx
git commit -m "fix(kiosk): make idle-screen printer footer reflect verified, not just connected"
```

---

### Task 2: Admin's phone number on the printer setup screen

**Files:**
- Modify: `src/app/kiosk-station/[token]/page.tsx`
- Modify: `src/components/kiosk/KioskStationShell.tsx`
- Modify: `src/components/kiosk/KioskCheckinScreen.tsx`

**Interfaces:**
- Consumes: `events.contact_phone` (existing column, already used elsewhere in the codebase e.g. `src/app/register/[eventSlug]/page.tsx` — no migration needed).
- Produces: a new `contactPhone?: string | null` prop threaded `page.tsx` → `KioskStationShell` → `KioskCheckinScreen` → `PrinterSetupScreen`. Follows the exact same "static SSR-fetched prop" pattern already used for `mode`, `attended`, `autoPrintBadge`, `printStationId`, `badgeTemplate`, `printSettings`, `printMode` on this same chain — NOT added to `/api/kiosk/station-manifest` or `kiosk-offline-store.ts`, since none of those sibling static config fields are refreshed through the manifest poll either (confirmed: `KioskStationShell`'s `refreshManifest` only ever calls `setAssignedLists`, never touches `mode`/`attended`/etc.). A phone number changes rarely enough that SSR-once is the right fit, matching precedent exactly.

- [ ] **Step 1: Fetch `contact_phone` in the SSR page**

In `src/app/kiosk-station/[token]/page.tsx`, after the station-not-found guard (after the block ending at line 54: `if (!station || station.revoked_at || ...) { return <StationNotFound /> }`) and before the `joinRows` fetch, add:

```ts
  // Best-effort only -- a missing/failed phone lookup must never block the
  // station from rendering. Shown on the printer setup screen so a
  // volunteer who can't fix a printer problem knows who to call (spec
  // §4: "the volunteer cannot fix a wrong setting and needs to know who to
  // call").
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: eventRow } = await (supabase as any)
    .from("events")
    .select("contact_phone")
    .eq("id", station.event_id)
    .maybeSingle()
```

Then add `contactPhone={eventRow?.contact_phone || null}` as a new prop on the `<KioskStationShell ... />` call at the bottom of the function (around line 111-125), alongside the existing `initialLists={lists}` line.

- [ ] **Step 2: Thread the prop through `KioskStationShell`**

In `src/components/kiosk/KioskStationShell.tsx`:

Add to `KioskStationShellProps` (after the existing `initialLists: AssignedList[]` line):

```ts
  contactPhone?: string | null
```

Add `contactPhone` to the function's destructured parameter list (alongside `initialLists`), and add `contactPhone={contactPhone}` to the `<KioskCheckinScreen ... />` JSX (around line 317-333), alongside the existing `printMode={printMode}` line.

- [ ] **Step 3: Accept and forward the prop in `KioskCheckinScreen`**

In `src/components/kiosk/KioskCheckinScreen.tsx`:

Add to `KioskCheckinScreenProps` (after the existing `listClosesAt?: string | null` field, around line 143):

```ts
  contactPhone?: string | null
```

Add `contactPhone` to the destructured function parameters (around line 161, alongside `listClosesAt`).

Add `contactPhone={contactPhone}` to the `<PrinterSetupScreen ... />` invocation (around line 1654-1670, alongside the existing `testPrintStatus={testPrintStatus}` line).

Add to `PrinterSetupScreenProps` (after the existing `isOnline: boolean` field, around line 2399):

```ts
  contactPhone?: string | null
```

Add `contactPhone` to `PrinterSetupScreen`'s destructured parameters (around line 2424, alongside `isOnline`).

Inside `PrinterSetupScreen`'s JSX, right after the "Skip — Start Scanning" / "Start Scanning" continue button (around line 2529-2531) and before that `<div>`'s closing tag (line 2532), add:

```tsx
          {contactPhone && (
            <p className="mt-4 text-center text-xs text-gray-500">
              Printer trouble? Call {contactPhone}
            </p>
          )}
```

- [ ] **Step 4: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Manually confirm on an event with `contact_phone` set: the printer setup screen shows "Printer trouble? Call {number}" below the Start Scanning button. Confirm an event with `contact_phone` null renders the screen identically to today (no empty line, no `null` text).

- [ ] **Step 5: Commit**

```bash
git add src/app/kiosk-station/\[token\]/page.tsx src/components/kiosk/KioskStationShell.tsx src/components/kiosk/KioskCheckinScreen.tsx
git commit -m "feat(kiosk): show admin contact phone on the printer setup screen"
```

---

### Task 3: Print-failure recovery banner ("Checked in — badge did not print")

**Files:**
- Modify: `src/components/kiosk/KioskCheckinScreen.tsx`

**Interfaces:**
- Consumes: existing `printStatus` state (already set by `printBadge` on both success and failure), existing `handlePrintButtonClick` and `resetKiosk` callbacks — no new functions needed.
- Produces: nothing new consumed elsewhere.

Per spec §5: a failed print must never make the screen read like the check-in itself failed. Today, a failed print only shows a small red line in the success screen's bottom footer (`printStatus.message`), with no distinct "here's what to do" affordance beyond the same generic "Print Badge" retry button used for a first attempt. This task adds the spec's explicit recovery copy and two-button choice, without touching the success headline, checkmark, or any of the check-in details above it — the check-in still visibly succeeded.

- [ ] **Step 1: Add the failure banner**

Find the closing of the "Details" card in the success branch (around line 1857-1859):

```tsx
                  </ul>
                </div>

                {/* Actions */}
```

Insert a new block between the details card's closing `</div>` and the `{/* Actions */}` comment:

```tsx
                  </ul>
                </div>

                {mode === "checkin_and_print" && printStatus && !printStatus.success && (
                  <div className="mb-8 rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 sm:p-6 text-left">
                    <p className="text-lg sm:text-xl font-bold text-amber-300 mb-1">
                      Checked in — badge did not print
                    </p>
                    <p className="text-sm text-amber-200/80 mb-4">
                      Check the printer: labels loaded, cable connected, lid closed.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        size="lg"
                        className="h-12 px-6 text-sm"
                        onClick={handlePrintButtonClick}
                        disabled={printing}
                      >
                        {printing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Print again
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-12 px-6 text-sm bg-transparent border-white/15 text-white hover:bg-white/10 hover:text-white"
                        onClick={resetKiosk}
                      >
                        Skip and continue
                      </Button>
                    </div>
                  </div>
                )}

                {/* Actions */}
```

`handlePrintButtonClick` re-checks `getLastPrintForRegistration` before printing; since the last attempt's `status` was `"failed"` (not `"success"`), its existing warn-before-reprint `confirm()` does NOT fire on this path — "Print again" prints immediately, with no dialog. This is existing behavior in `handlePrintButtonClick`, unchanged by this task.

- [ ] **Step 2: Suppress the redundant inline print button while the banner is showing**

Find the existing print-button block in the Actions row (around line 1919-1940):

```tsx
                  {mode === "checkin_and_print" && usbSupported && (
                    !printerConnected ? (
```

Change the condition to also require that the new failure banner is NOT currently showing (so the volunteer sees exactly one printer-recovery affordance at a time, not two):

```tsx
                  {mode === "checkin_and_print" && usbSupported && !(printStatus && !printStatus.success) && (
                    !printerConnected ? (
```

- [ ] **Step 3: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Manually confirm: on a `checkin_and_print` station, force a print failure (e.g. disconnect the printer mid-print, or simulate `printStatus = { success: false, message: "..." }`). Confirm the amber "Checked in — badge did not print" banner appears with both buttons, the green "Welcome, {name}!" success header is unchanged above it, and the inline Connect Printer/Print Badge button is NOT also shown at the same time. Confirm "Skip and continue" returns to the idle screen (same as "Done"), and "Print again" retries without a confirm dialog.

- [ ] **Step 4: Commit**

```bash
git add src/components/kiosk/KioskCheckinScreen.tsx
git commit -m "feat(kiosk): add distinct badge-did-not-print recovery banner, never read as check-in failure"
```

---

### Task 4: Persistent "Reprint last badge" on the idle/ready screen

**Files:**
- Modify: `src/components/kiosk/KioskCheckinScreen.tsx`

**Interfaces:**
- Consumes: `CheckinResult["registration"]` type (existing).
- Produces: new state `lastPrintedRegistration`, consumed only within this file.

Per spec §6: "a persistent Reprint last badge action on the success AND ready screens". The success screen's existing "Print Badge" button already covers reprint for the delegate currently on screen — this task only adds the genuinely missing case: the idle/ready screen (shown once the volunteer has moved on to the next scan) has zero reprint capability today, so a jam discovered a few seconds too late has no recovery short of finding the delegate again and asking them to re-scan (which the Tito check-in model already treats as a safe no-op, but doesn't reprint anything).

- [ ] **Step 1: Add `lastPrintedRegistration` state**

Near the other printer-related state declarations (after `const [awaitingPrintConfirm, setAwaitingPrintConfirm] = useState(false)`, around line 211), add:

```ts
  // Set on every print attempt (success or failure) so the idle/ready
  // screen's "Reprint last badge" action always has a target -- most useful
  // exactly when the last attempt failed and the volunteer has already
  // moved on to the next delegate before noticing. Deliberately NOT cleared
  // by resetKiosk (see spec §6 -- this must survive across resets).
  const [lastPrintedRegistration, setLastPrintedRegistration] = useState<NonNullable<CheckinResult["registration"]> | null>(null)
```

- [ ] **Step 2: Record it inside `printBadge`**

Find the start of `printBadge` (around line 766-768):

```ts
  const printBadge = useCallback(async (registration: NonNullable<CheckinResult["registration"]>) => {
    setPrinting(true)
    setPrintStatus(null)
```

Add `setLastPrintedRegistration(registration)` as the first line inside the callback:

```ts
  const printBadge = useCallback(async (registration: NonNullable<CheckinResult["registration"]>) => {
    setLastPrintedRegistration(registration)
    setPrinting(true)
    setPrintStatus(null)
```

- [ ] **Step 3: Add the reprint link to the idle screen's footer**

Find the idle/ready screen's footer (the self-service scan screen used by `checkin_and_print` stations, NOT `CollectionReadyScreen`), specifically the "Need help?" block (around line 2342-2355):

```tsx
        <p className="text-xs sm:text-sm text-gray-400">
          Need help? Please contact the registration desk
        </p>
        {helpRequestId ? (
          <p className="text-xs text-emerald-400 mt-1">Help requested — an admin has been notified.</p>
        ) : (
          <button
            onClick={handleRequestHelp}
            disabled={requestingHelp}
            className="text-xs text-indigo-300 underline hover:text-indigo-200 mt-1 disabled:opacity-50"
          >
            {requestingHelp ? "Sending…" : "Tap here to notify an admin"}
          </button>
        )}
        {cacheError && (
```

Insert a new conditional block between the closing `)}` of the help-request button and the `{cacheError && (` line:

```tsx
        {mode === "checkin_and_print" && lastPrintedRegistration && (
          <button
            onClick={() => printBadge(lastPrintedRegistration)}
            disabled={printing}
            className="text-xs text-indigo-300 underline hover:text-indigo-200 mt-1 disabled:opacity-50"
          >
            {printing ? "Reprinting…" : `Reprint badge for ${lastPrintedRegistration.attendee_name}`}
          </button>
        )}
        {cacheError && (
```

This deliberately calls `printBadge` directly, not `handlePrintButtonClick` — the button's own label ("Reprint badge for {name}") already states exactly what will happen, so the extra `confirm()` guard that the ambiguous "Print Badge" button needs would be redundant here (per this plan's Global Constraints).

- [ ] **Step 4: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Manually confirm: after a successful (or failed) print at a `checkin_and_print` station, return to the idle screen (via "Done"/"Skip and continue"/auto-reset countdown) and confirm a small "Reprint badge for {name}" link appears in the footer, reprints the same badge with no confirm dialog when tapped, and disappears/relabels to "Reprinting…" while in flight. Confirm the link is absent before any print has ever been attempted this session.

- [ ] **Step 5: Commit**

```bash
git add src/components/kiosk/KioskCheckinScreen.tsx
git commit -m "feat(kiosk): add persistent reprint-last-badge action to the idle scan screen"
```

---

### Task 5: Final review + live verify + deploy

- [ ] Dispatch a final whole-branch review of all four tasks together (they all touch the same file and interact — e.g. Task 3's banner and Task 1's footer chip both key off `printStatus`/`printerVerified` — a combined review catches cross-task interactions a per-task review would miss).
- [ ] Fix any findings; re-review the fix diff only.
- [ ] Live-verify on collegeofmas.org.in with a real `checkin_and_print` station (Tablet 4 or equivalent): confirm all four behaviors end-to-end in one pass — printer footer reads "Printer ready"/"Printer problem — call for help" correctly through connect → verify → (simulated) disconnect; printer setup screen shows the admin phone number; a forced print failure shows the amber recovery banner with working Print again / Skip and continue; the idle screen's reprint link appears and works after a print attempt.
- [ ] Merge, push, confirm the Vercel production deploy succeeds.
