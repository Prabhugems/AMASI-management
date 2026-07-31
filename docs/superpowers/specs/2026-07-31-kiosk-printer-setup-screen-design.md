# Printer setup screen before scanning starts

## Problem

Today, on a check-in list flagged `prints_badge` (e.g. Registration Check-in), the only place a volunteer discovers whether the printer is connected is the success card *after the first delegate is already checked in*. If the printer was never paired, or died since the last shift, that's the exact wrong moment to find out — a real person is standing there waiting for a badge.

## Design

When `KioskCheckinScreen` mounts for a list with `mode === "checkin_and_print"`, it now shows a printer setup screen **before** the scan/entry screen, gating scanning (and the camera, which otherwise starts immediately) until the volunteer explicitly continues.

- **Status**: reuses the existing WebUSB feature-detect/reconnect effect (already runs on mount for `checkin_and_print`) — shows "Checking…" while that resolves, then "Connected" (with printer name) or "Not connected".
- **Connect button**: same `connectUsbPrinter()` call already used on the success screen's "Connect Printer" button, extracted into one shared handler.
- **Test Print button**: calls the already-existing `testUsbPrinter()` from `src/lib/usb-printer.ts` (sends a real ESC/POS test page — this function already exists, unused until now). Disabled until connected.
- **Continue button**: always available regardless of connection state — labeled "Start Scanning" once connected, "Skip — Start Scanning" while not connected, so the skip path is explicit rather than silent. Proceeding without a printer behaves exactly as it already does today: the success screen's own Connect Printer / Print Badge flow is unchanged and still there as a fallback.
- Shown once per mount (i.e. once each time the volunteer enters this job from the menu — `KioskCheckinScreen` already remounts on `key={activeList.id}` in `KioskStationShell`), not once per scan. Re-entering the job re-checks the printer, cheap when already connected, essential when it's died mid-shift.
- Lists with `mode === "checkin"` (the vast majority, after the per-list `prints_badge` fix) never see this screen — same as today.

## Also in scope

- **Menu tile icon**: the "Registration Check-in" tile (or whichever list has `prints_badge = true`) gets a small printer icon on its menu tile, so the menu itself signals which job prints, before the volunteer even taps in.
- **Footer printer status on the scan screen**: already implemented (`KioskCheckinScreen.tsx`'s existing footer, driven by the same `printerConnected` state, live-updated via the existing `onUsbDisconnect` listener) — confirmed working, no new code needed for this part.

## Out of scope

No change to the actual print trigger on the success screen, no change to auto-print behavior, no change to the direct-URL single-list path (still never sets `mode`, unaffected), no change to non-printing lists' flow at all.
