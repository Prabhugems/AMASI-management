# Hardware lane setup — 2026-07-15

**Nothing in this document is verified.** PR-1 and PR-2 below are code changes I made, typechecked and linted clean — that is not the same as tested on real hardware. I did not run a webcam, a USB scanner, a printer, or venue wifi. The checklist at the end is what actually verifies this; it's yours to run.

## What shipped (PR-1, PR-2 — code-read/typecheck-verified only)

**PR-1 — fetch timeout.** `src/lib/fetch-with-timeout.ts` (new): wraps `fetch` with a 3s `AbortController` timeout, composing with any caller-supplied signal rather than depending on `AbortSignal.any` (not universally supported on older Android WebViews). Wired into all three places that could hang on bad venue wifi:
- `processScan`'s `/api/verify/[token]` call (`src/app/checkin/access/[accessToken]/page.tsx`)
- `fetchListAttendees`'s roster fetch (same file) — on timeout, distinguished from an intentional debounce-cancel by checking `signal?.aborted` first, so a genuine hang shows "Request timed out" instead of being silently swallowed
- `flushQueue`'s per-scan fetch (`src/lib/offline-scan-queue.ts`)

`isNetworkFailure()` (`offline-scan-queue.ts`, now exported) covers both `TypeError` (offline/DNS/TLS) and a timeout's `DOMException("AbortError")` — a hang now behaves exactly like an outage: queued, not lost, feed/counter already advanced before the request even started (unchanged from before).

**PR-2 — focus recovery.** A `useEffect` scoped to `scanMode === "manual"` (`page.tsx`, near the other cleanup effects) that:
- Reclaims focus to the scan input whenever anything else in the document loses focus (`focusout`, which bubbles — catches the "Check In" button vanishing mid-click, since that button only renders while `inputValue` is truthy and unmounts the instant it's cleared)
- Reclaims focus on any click whose target isn't an actual interactive control (`INPUT`/`BUTTON`/`A`/`SELECT`/`TEXTAREA`) — catches stray taps on feed cards, background, whitespace
- Does nothing while on the Camera or List tabs, and doesn't fight a real interaction with another control (tab switcher, sound toggle) while it's happening

The wedge/manual path shares `processScan` completely with the camera path — same dedup map, same session counter, same feed. Confirmed by re-reading `processScan`'s call sites: nothing was changed that would make Manual Entry counter-blind the way the List tab was before item 10.

## Printer — no rebuild, network requirements only (PR-3 documentation ask)

The Zebra print path (`src/lib/zebra-printer.ts:21-26`) is a plain browser `fetch()` POST of raw ZPL to the printer's own built-in HTTP endpoint: `http://${printerIp}/pstprnt`. Not WebUSB, not a raw TCP socket. This means:

**1. Same-network reachability is the whole requirement.** Whatever device triggers the print (laptop or the Mi tablet) must be able to reach `printerIp` directly — same LAN/subnet/VLAN, no client isolation on the venue wifi blocking device-to-device traffic (many venue/guest wifi networks enable AP/client isolation specifically to stop this kind of thing — worth asking the venue directly, not just assuming). If the ZD230 is only USB-tethered to a specific laptop with no network interface at all, that unit is only reachable from that one laptop — printing from the tablet would need either a network-capable print server or a different code path (not something to build now, per your instruction — just flagging the boundary).

**2. The mixed-content caveat — this is the one most likely to silently bite the tablet.** The app is served over HTTPS (`collegeofmas.org.in`). A fetch from an HTTPS page to a plain `http://` URL is "active mixed content," which Chrome/Edge/Firefox block by default — and `mode: "no-cors"` in the fetch call does **not** bypass this; mixed-content blocking happens before CORS mode is even considered. If printing currently works from the laptops, the most likely explanation is that **someone already granted an "Allow insecure content" exception for this origin in that specific browser profile** (Chrome: site padlock → Site settings → Insecure content → Allow) — a setting that lives in the browser, not the app, and does **not** carry over to a new device automatically. I can't confirm this is actually why it works on the laptops — I can't inspect browser profile settings from here — but if the tablet print test fails, **check this before assuming it's a network or driver problem**: on Android Chrome, the equivalent is under site settings for that page (may also be hidden behind `chrome://flags` or blocked entirely by policy on newer Chrome versions — Google has been tightening this over time, so a fresh Chrome install on the tablet may not offer the toggle at all, in which case the printer would need to be reached over HTTPS, or the whole app over plain HTTP on that device, or some other workaround — a real risk to know about *before* the night before AMASICON).

**3. Report the tablet print test as a hard yes/no, nothing softer** (see checklist below) — if it's a no, check items 1 and 2 above in that order before concluding it's unfixable.

## The physical test checklist — yours to run

### 1. Zebra USB scanner: configure the Enter/CR terminator

Zebra handheld/USB scanners (the DS/LI series commonly bundled as "Zebra USB scanners") ship with a suffix/terminator setting that must be explicitly enabled — out of the box some models send no terminator at all. Standard config paths (verify against the exact model's manual, since specifics vary by firmware):
- **123Scan** (Zebra's free config utility, Windows): connect the scanner via USB, open 123Scan, select the scanner profile, find "Suffix" / "Data Formatting" settings, set Suffix = "Enter" (or hex `0D` / carriage return), push the config to the scanner.
- **Config barcode sheet** (no software needed): most Zebra scanner manuals include a page of special "programming barcodes" — scanning a specific "Enable Suffix: CR" barcode from that sheet reconfigures the scanner directly. Check the exact manual for your model (the sheet differs across DS2200/DS4600/LI series etc.).
- **Verify it took**: open any plain text field (Notes app, a browser address bar) and scan a badge — you should see the code appear followed immediately by a newline/Enter keypress (cursor moves to a new line, or the field submits if it's a single-line input with a form).

### 2. One-laptop burst test

Setup: one Zebra USB scanner plugged into one confirmed laptop, browser open to the check-in access link, **Manual Entry tab selected** (not Camera — the wedge input lives there).

Procedure: scan 20 different badges as fast as you physically can move them under the scanner.

**Expect:**
- 20 check-ins recorded (verify against the admin dashboard or DB, not just the on-screen feed)
- 20 feed lines in the running feed, no gaps
- Session counter reads exactly 20
- Cursor/focus visibly still in the scan field after each scan — no need to click back into it between scans

**Anything less is a fail** — same acceptance bar as the original 20-card camera burst test. If the counter reads less than 20 or the feed has gaps, PR-1's timeout logic is the first place to check (was a request silently retried, or did a scan get lost). If scans stop registering partway through, PR-2's focus recovery is the first place to check — inspect whether focus visibly left the field (e.g., did a "Check In" button appear and get clicked/tapped by accident, or the browser window lose focus).

### 3. Mi tablet OTG test

Setup: Zebra USB scanner connected via a USB-C OTG adapter/cable to the Mi tablet, browser open, tap into the Manual Entry field.

**Test:** scan one badge.

**Report strictly yes/no:** does the decoded code appear typed into the field? (Some Android OTG configurations don't pass through USB-HID keyboard devices correctly, or require an OS-level permission prompt the first time a new USB device is connected — if nothing types, check for a permission dialog that may have appeared and been dismissed, and check Android's OTG/USB settings before concluding the scanner itself is the problem.)

### 4. Mi tablet print test

Setup: pull up a delegate's badge on the Mi tablet (via whichever page currently exposes the print action for a confirmed registration), trigger the print action.

**Report strictly yes/no on two separate questions:**
- Does a Zebra printer appear as an available target at all (relevant only if this is the OS-print-dialog "browser" printer type — the ZD230/ZPL path doesn't use a printer picker, it just fires the network request; if nothing visibly happens either way, that's consistent with the ZPL path either succeeding silently or being blocked by mixed content per the caveat above — check the browser's dev console via remote debugging if you can, for a mixed-content or network error)
- Does a correct physical badge print out?

This decides tablet-vs-laptop for print lanes specifically — if no on either, laptops carry printing for AMASICON regardless of what else works on the tablet.

### 5. Kiosk hardening (all lane devices, laptop and tablet)

- **Full-screen / kiosk-mode browser**: Chrome's `--kiosk` launch flag (Windows: a shortcut with `chrome.exe --kiosk https://collegeofmas.org.in/checkin/access/<token>`) removes the address bar/tabs entirely, preventing accidental navigation away. On Android, Chrome doesn't support a true kiosk flag without MDM, but "Add to Home Screen" launches as a standalone PWA-style window with no visible browser chrome — close enough for a volunteer lane.
- **Disable sleep/screensaver**: Windows — Settings → System → Power & sleep → set both "Screen" and "Sleep" to Never while plugged in. Android/Mi tablet — Settings → Display → Sleep → set to the maximum value (or Developer Options → "Stay awake while charging" if available, which is more reliable for a device that's power-tethered all day).
- **Power**: every lane device on mains power for the full event day, not battery — confirm cable routing and surge protection at each physical desk position before doors open, not the morning of.
