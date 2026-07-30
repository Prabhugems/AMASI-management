# Kiosk Stations Admin Redesign — Phase 2 (Add Station Wizard)

## Context

Phase 1 (list view compaction, per-station detail page, auto-naming) shipped and is live on collegeofmas.org.in, fully verified. The full design mockup also specified a 4-step guided "Add Station" wizard (name+mode → who holds it → jobs → printer), explicitly deferred out of Phase 1's scope.

Scoped with the project owner: Phase 2 covers **only the wizard**. The table/card view toggle, live throughput sparkline, confirmation-dialog copy rewrite (beyond what's needed by the wizard itself), and any "Station" → "Tablet" terminology change remain parked for a later phase.

## Current State (verified against the live codebase)

Today, `src/app/events/[eventId]/kiosk-stations/page.tsx` has a single, long `Dialog` (`showCreate` state) with every field visible at once: name, check-in lists, mode (checkin / checkin_and_print), attended toggle, and (conditionally) printer + auto-print. All the underlying state and logic already exist and already work correctly — this phase does not touch any of it, only restructures how it's presented:

- State: `newName`, `newListIds`, `newMode`, `newPrintStationId`, `newAutoPrint`, `newAttended` (all already in `page.tsx:97-103`)
- `newName` is already auto-filled with the next `Tablet N` default when the dialog opens (Phase 1's Task 7, `page.tsx`'s `setShowCreate(true)` call sites)
- `handleCreate` (`page.tsx:259-...`) already does the actual `POST /api/kiosk-stations` with all fields and already validates: name non-empty, at least one list selected, printer selected if `checkin_and_print`
- Turning the create-dialog's Attended switch ON already routes through the shared `attendedConfirmTarget` state (`kind: "create"`) and `confirmAttendedOn`/`handleCreateAttendedSwitch` (`page.tsx:154-183`, `445-475`) — turning it OFF is immediate, no confirmation, matching every other Attended switch in the app
- After a successful create, the existing `handoff` state opens the existing "here's your QR code and link" dialog — this is reused as-is; the wizard's only job is to get to a successful `handleCreate` call

**One piece of tech debt directly relevant here**: the final Phase 1 review flagged that the Attended-ON confirmation dialog's copy is duplicated word-for-word across the list page and the detail page, and recommended extracting it before more copies get added. The wizard needs this exact same dialog for its own Step 2 — building it as a third inline copy would be the exact mistake the review warned against. This phase extracts it once, shared by all three call sites.

## Design

### 1. New component: `src/components/kiosk-admin/add-station-wizard.tsx`

A self-contained `AddStationWizard` component, replacing the current inline `Dialog` in `page.tsx`. Props: `open`, `onOpenChange`, `eventId`, `stations` (for computing the next default name), `lists`, `usbPrintStations`, `onCreated: (station: { name: string; access_token: string }) => void` (the parent uses this to set its existing `handoff` state and refresh the list — no new logic needed there).

The wizard owns all its own internal state (name, listIds, mode, printStationId, autoPrint, attended, current step, the attended-confirm-dialog's own open/busy state) and performs the `POST /api/kiosk-stations` call itself on the final step, calling `onCreated` on success. `page.tsx` deletes its own `newName`/`newListIds`/`newMode`/`newPrintStationId`/`newAutoPrint`/`newAttended`/`handleCreate`/`handleCreateAttendedSwitch`/the `"create"` branch of `attendedConfirmTarget`/`confirmAttendedOn`/`focusCreateAttendedSwitch`/`newAttendedSwitchRef` — all of it moves into the wizard, since none of it is used anywhere else once the wizard owns creation.

`resetForm()` (name via the existing `nextDefaultStationName(stations)` helper, empty lists, mode `checkin`, no printer, auto-print off, attended off, step 1) runs both when the dialog is cancelled and after a successful create, so reopening always starts clean.

### 2. Shared component: extract `AttendedOnConfirmDialog`

Add to `src/components/kiosk-admin/station-controls.tsx` (already the home for shared, reusable pieces of this feature):

```tsx
export function AttendedOnConfirmDialog({
  open,
  busy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Turn on attended mode?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block">
              This lets the tablet serve collection lists — meals, kits, anything a delegate physically picks up.
            </span>
            <span className="mt-2 block">
              Only turn this on if a volunteer is holding the tablet at all times. On an unattended tablet, a
              delegate could scan twice and take two.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button disabled={busy} onClick={onConfirm}>
            {busy ? "Turning on…" : "Turn on"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

Three call sites switch to this: `page.tsx`'s per-row usage, `[stationId]/page.tsx`'s usage, and the new wizard's Step 2 — each keeps its own `open`/`busy` state and `onConfirm` handler (turning attended on for a specific existing station vs. setting the wizard's local `attended` state), only the dialog's copy/markup is shared. This is a pure extraction with zero behavior change to the two existing call sites — same exact copy, same exact trigger conditions.

### 3. The four steps

- **Step 1 — Name & Mode**: the existing name `Input` (pre-filled via `nextDefaultStationName`) and the existing `Check-in only` / `Check-in + Print` radio choice. "Next" disabled until the trimmed name is non-empty (same rule `handleCreate` already enforces).
- **Step 2 — Who holds it**: the existing Attended `Switch` + `attendedHelpText` copy, now given its own full step instead of being buried at the bottom of the old form. Turning it on routes through the shared `AttendedOnConfirmDialog` exactly as today. "Next" has no validation gate (attended can stay off).
- **Step 3 — Jobs**: the existing check-in list checkboxes, computed from `assignableLists(attended)` (unchanged helper, already correctly filters out collection-purpose lists when `attended` is false). Because attended is now decided on the *previous* step, the old inline "hidden collection lists — turn on Attended" escape hatch no longer applies here the same way; replace it with a plain "← Back" link to Step 2 for a volunteer who wants to change their answer, rather than a focus-jump to a switch that isn't on this screen. Label reads "Next" if mode is `checkin_and_print`, or "Finish" if mode is `checkin` (skipping Step 4 entirely, calling the same submit logic Step 4's Finish would). Disabled until at least one list is selected (same rule `handleCreate` already enforces).
- **Step 4 — Printer** (only rendered when mode is `checkin_and_print`): the existing printer `Select` (from `usbPrintStations`) and auto-print `Switch` + `autoPrintHelpText`. "Finish" disabled until a printer is selected (same rule `handleCreate` already enforces).

A small step indicator at the top of the dialog (e.g. "1 · Name   2 · Who holds it   3 · Jobs" plus "  4 · Printer" only when mode is `checkin_and_print`), current step visually distinct from the others — text only, no new dependency.

"Back" on steps 2–4 returns to the previous step without losing any entered data (all state lives at the wizard's top level, steps only control what's rendered). "Cancel" (available on every step) closes the dialog and calls `resetForm()`.

"Finish" (Step 3 for checkin-only, Step 4 for checkin_and_print) performs the exact same `POST /api/kiosk-stations` call `handleCreate` makes today, with the exact same request body shape. On success: call `onCreated({ name: data.name, access_token: data.access_token })`, close the dialog, `resetForm()`.

### 4. `page.tsx` changes

Both existing `setShowCreate(true)` call sites become `setAddWizardOpen(true)` (or equivalent). `page.tsx` renders `<AddStationWizard open={...} onOpenChange={...} eventId={eventId} stations={stations} lists={lists} usbPrintStations={usbPrintStations} onCreated={(station) => { setHandoff({ name: station.name, token: station.access_token }); loadStations() }} />` in place of the old inline `Dialog`. The existing `handoff` dialog itself is untouched — it already renders whenever `handoff` is non-null, regardless of what set it.

## Testing

- No new API routes or database changes in this phase — `POST /api/kiosk-stations` is unchanged, so no new route tests are needed.
- `AttendedOnConfirmDialog`'s extraction is a pure presentational move with no logic — verified by `tsc`/`vitest` staying clean and by confirming both existing call sites render identical copy after the change.
- The wizard itself, like the Phase 1 detail page, has no established precedent in this codebase for automated full-component tests — verification is `tsc`/`vitest` clean plus a live manual click-through (name/mode → attended (with confirm) → jobs → printer → finish → handoff dialog appears → new station shows up in the list), for both `checkin` and `checkin_and_print` modes, and confirming Back/Cancel correctly preserve/discard state.
