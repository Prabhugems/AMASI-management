# Kiosk Stations Admin Redesign — Phase 2 Implementation Plan (Add Station Wizard)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single long "Add Kiosk Station" form with a 4-step guided wizard (name+mode → who holds it → jobs → printer), reusing all existing state shape, validation, and the create API call unchanged.

**Architecture:** Extract the Attended-ON confirmation dialog (currently duplicated between the list page and the detail page) into one shared component first, since the new wizard needs the exact same dialog for its own step. Then build the wizard as a new, self-contained component that owns all its own step/form state and the actual `POST /api/kiosk-stations` call, and swap it in for the old inline dialog in the list page — deleting all the old create-form state/handlers that move into the wizard.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind, Shadcn UI — same as the rest of this codebase, no new dependencies.

## Global Constraints

- No database schema or API contract changes in this phase — `POST /api/kiosk-stations` is called with the exact same request body shape it already accepts today.
- The two existing call sites of the Attended-ON confirm dialog (list page per-row, detail page) must render identically after Task 1 — same copy, same trigger conditions, zero behavior change.
- `npx tsc --noEmit` and `npx vitest run` must both stay clean after every task.
- No "Station" → "Tablet" rename anywhere beyond what already exists (the auto-name default value) — this phase doesn't touch terminology.
- Table/card view toggle, live throughput sparkline, and any confirmation-dialog copy rewrite beyond what the wizard itself needs are explicitly out of scope for this phase.

---

### Task 1: Extract `AttendedOnConfirmDialog` into a shared component

**Files:**
- Modify: `src/components/kiosk-admin/station-controls.tsx` (add one new exported component)
- Modify: `src/app/events/[eventId]/kiosk-stations/page.tsx:1475-1505` (swap the existing inline `AlertDialog` for the shared component)
- Modify: `src/app/events/[eventId]/kiosk-stations/[stationId]/page.tsx:512-534` (swap the existing inline `AlertDialog` for the shared component)

**Interfaces:**
- Produces: `AttendedOnConfirmDialog({ open, busy, onOpenChange, onConfirm }): JSX.Element`, exported from `station-controls.tsx`.
- Consumes: nothing new — both call sites already have `open`/`busy` state and an `onConfirm` handler; only the dialog markup moves.

This is a pure refactor (matches Task 1 of the Phase 1 plan) — no natural TDD cycle. Verification is `tsc`/`vitest` clean plus confirming both call sites render identically.

- [ ] **Step 1: Add the shared component**

In `src/components/kiosk-admin/station-controls.tsx`, add (near the other exported components; needs `AlertDialog`/`AlertDialogContent`/`AlertDialogHeader`/`AlertDialogTitle`/`AlertDialogDescription`/`AlertDialogFooter`/`AlertDialogCancel` imported from `"@/components/ui/alert-dialog"` and `Button` from `"@/components/ui/button"` — add these imports if not already present in this file):

```tsx
// Shared "turn on attended mode" confirmation -- turning OFF applies
// immediately everywhere in this app; only turning ON ever asks for
// confirmation, since it unlocks self-service scanning of collection-purpose
// lists (meals, kits) on a tablet nobody may actually be watching. Used by
// the list page's per-row switch, the detail page's switch, and the Add
// Station wizard's own switch -- identical copy in all three places.
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

- [ ] **Step 2: Swap the list page's call site**

In `src/app/events/[eventId]/kiosk-stations/page.tsx`, add `AttendedOnConfirmDialog` to the existing import block from `@/components/kiosk-admin/station-controls`. Replace lines 1475–1505 (the `{/* Attended-ON confirmation ... */}` comment through the closing `</AlertDialog>`) with:

```tsx
      <AttendedOnConfirmDialog
        open={!!attendedConfirmTarget}
        busy={attendedConfirmBusy}
        onOpenChange={(open) => {
          if (!open) setAttendedConfirmTarget(null)
        }}
        onConfirm={confirmAttendedOn}
      />
```

Do not change `attendedConfirmTarget`'s type or `confirmAttendedOn`'s implementation in this task — both still need to handle the `{kind: "create"}` case until Task 2 removes it.

- [ ] **Step 3: Swap the detail page's call site**

In `src/app/events/[eventId]/kiosk-stations/[stationId]/page.tsx`, add `AttendedOnConfirmDialog` to its existing import from `@/components/kiosk-admin/station-controls`. Replace lines 512–534 (the `{/* Attended-ON confirm ... */}` comment through the closing `</AlertDialog>`) with:

```tsx
      <AttendedOnConfirmDialog
        open={attendedConfirmOpen}
        busy={attendedConfirmBusy}
        onOpenChange={setAttendedConfirmOpen}
        onConfirm={confirmAttendedOn}
      />
```

- [ ] **Step 4: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Start the dev server: confirm turning Attended ON for an existing station (both from the list page's per-row switch and from a station's detail page) still shows the exact same confirmation dialog and still works, and that turning it OFF is still immediate with no dialog.

- [ ] **Step 5: Commit**

```bash
git add src/components/kiosk-admin/station-controls.tsx "src/app/events/[eventId]/kiosk-stations/page.tsx" "src/app/events/[eventId]/kiosk-stations/[stationId]/page.tsx"
git commit -m "refactor(kiosk): extract shared Attended-ON confirm dialog"
```

---

### Task 2: Build the Add Station wizard and wire it in

**Files:**
- Create: `src/components/kiosk-admin/add-station-wizard.tsx`
- Modify: `src/app/events/[eventId]/kiosk-stations/page.tsx` (remove the old create-dialog state/handlers/JSX/now-unused imports; render the new wizard instead)

**Interfaces:**
- Consumes: `AttendedOnConfirmDialog`, `attendedHelpText`, `autoPrintHelpText`, `PRINTER_USB_HELP_TEXT`, `type CheckinList`, `type PrintStation`, `type KioskStation` (all already exported from `@/components/kiosk-admin/station-controls`, from Task 1 and Phase 1).
- Produces: `AddStationWizard({ open, onOpenChange, eventId, stations, lists, usbPrintStations, onCreated }): JSX.Element`, exported from the new file. `onCreated` is called with `{ name, access_token }` on a successful create — the parent page uses this to populate its existing `handoff` state and refresh the station list, exactly as `handleCreate` does today.

No natural TDD cycle for this UI component (matches Phase 1's detail-page precedent) — verification is `tsc`/`vitest` clean plus a full manual click-through covering both modes.

- [ ] **Step 1: Create the wizard component**

Create `src/components/kiosk-admin/add-station-wizard.tsx`:

```tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  attendedHelpText,
  autoPrintHelpText,
  PRINTER_USB_HELP_TEXT,
  AttendedOnConfirmDialog,
  type CheckinList,
  type PrintStation,
  type KioskStation,
} from "@/components/kiosk-admin/station-controls"

// Same logic as Phase 1's nextDefaultStationName, moved here since the
// wizard is now the only place a station's default name is ever computed.
function nextDefaultStationName(stations: KioskStation[]): string {
  let highest = 0
  for (const s of stations) {
    const match = /^Tablet (\d+)$/.exec(s.name.trim())
    if (match) highest = Math.max(highest, parseInt(match[1], 10))
  }
  return `Tablet ${highest + 1}`
}

interface AddStationWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  stations: KioskStation[]
  lists: CheckinList[]
  usbPrintStations: PrintStation[]
  onCreated: (station: { name: string; access_token: string }) => void
}

export function AddStationWizard({
  open,
  onOpenChange,
  eventId,
  stations,
  lists,
  usbPrintStations,
  onCreated,
}: AddStationWizardProps) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState("")
  const [listIds, setListIds] = useState<string[]>([])
  const [mode, setMode] = useState<"checkin" | "checkin_and_print">("checkin")
  const [printStationId, setPrintStationId] = useState("")
  const [autoPrint, setAutoPrint] = useState(false)
  const [attended, setAttended] = useState(false)
  const [creating, setCreating] = useState(false)
  const [attendedConfirmOpen, setAttendedConfirmOpen] = useState(false)

  // Reset to a fresh step 1 every time the wizard opens -- recomputes the
  // default name from the CURRENT station list at open time (not once on
  // mount), so it's still correct if stations were added/renamed since the
  // wizard last opened.
  useEffect(() => {
    if (!open) return
    setStep(1)
    setName(nextDefaultStationName(stations))
    setListIds([])
    setMode("checkin")
    setPrintStationId("")
    setAutoPrint(false)
    setAttended(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const hasCollectionLists = lists.some((l) => l.is_active === true && l.list_purpose === "collection")
  const assignableLists = lists.filter((l) => l.is_active === true && (attended || l.list_purpose !== "collection"))
  const totalSteps = mode === "checkin_and_print" ? 4 : 3

  const handleAttendedSwitch = (checked: boolean) => {
    if (!checked) {
      setAttended(false)
      return
    }
    setAttendedConfirmOpen(true)
  }
  // No API call here (unlike every other Attended-ON confirm in this app) --
  // there is no station yet to PATCH, this is still purely local wizard
  // state until Finish. `busy` on the shared dialog is always false here for
  // that same reason.
  const confirmAttendedOn = () => {
    setAttended(true)
    setAttendedConfirmOpen(false)
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await fetch("/api/kiosk-stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          name: name.trim(),
          list_ids: listIds,
          mode,
          attended,
          ...(mode === "checkin_and_print" && { print_station_id: printStationId, auto_print_badge: autoPrint }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to create station")
        return
      }
      onCreated({ name: data.name, access_token: data.access_token })
      onOpenChange(false)
    } finally {
      setCreating(false)
    }
  }

  const stepLabel = (n: number) => (n === 1 ? "Name" : n === 2 ? "Who holds it" : n === 3 ? "Jobs" : "Printer")

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Kiosk Station</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => (
              <span
                key={n}
                className={cn("rounded-full px-2 py-1", n === step && "bg-primary/10 font-semibold text-primary")}
              >
                {n} · {stepLabel(n)}
              </span>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Station name
                </label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tablet 3" />
                <p className="text-xs text-muted-foreground">
                  Shown on the tablet so the volunteer knows which desk they&apos;re on.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mode</label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={mode === "checkin"} onChange={() => setMode("checkin")} />
                    Check-in only
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={mode === "checkin_and_print"}
                      onChange={() => setMode("checkin_and_print")}
                    />
                    Check-in + Print Badge
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="divide-y rounded-lg border">
              <label className="flex items-center gap-3 p-3 cursor-pointer">
                <Switch checked={attended} onCheckedChange={handleAttendedSwitch} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Attended by a volunteer</span>
                  <span className="block text-xs text-muted-foreground">{attendedHelpText(attended)}</span>
                </span>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Check-in lists
                </label>
                <span className="text-xs text-muted-foreground">{listIds.length} selected</span>
              </div>
              <div className="space-y-0.5 rounded-lg border p-1.5 max-h-64 overflow-y-auto">
                {assignableLists.map((list) => (
                  <label
                    key={list.id}
                    className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={listIds.includes(list.id)}
                      onCheckedChange={(checked) =>
                        setListIds(checked ? [...listIds, list.id] : listIds.filter((id) => id !== list.id))
                      }
                    />
                    <span className="flex-1">{list.name}</span>
                  </label>
                ))}
              </div>
              {!attended && hasCollectionLists && (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Collection lists (meals, kits) are hidden because this station is not attended.{" "}
                  <button
                    type="button"
                    className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                    onClick={() => setStep(2)}
                  >
                    ← Back to change that
                  </button>
                </p>
              )}
            </div>
          )}

          {step === 4 && mode === "checkin_and_print" && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Print Station
                </label>
                {usbPrintStations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No USB-type Print Station found for this event. Create one on the Print Station page first.
                  </p>
                ) : (
                  <>
                    <Select value={printStationId} onValueChange={setPrintStationId}>
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
                    <p className="text-xs text-muted-foreground">{PRINTER_USB_HELP_TEXT}</p>
                  </>
                )}
              </div>
              <label
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3",
                  !printStationId ? "opacity-60" : "cursor-pointer"
                )}
              >
                <Switch checked={autoPrint} disabled={!printStationId} onCheckedChange={setAutoPrint} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Print automatically</span>
                  <span className="block text-xs text-muted-foreground">{autoPrintHelpText(autoPrint)}</span>
                </span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            ) : (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            )}
            {step === 1 && (
              <Button disabled={!name.trim()} onClick={() => setStep(2)}>
                Next
              </Button>
            )}
            {step === 2 && <Button onClick={() => setStep(3)}>Next</Button>}
            {step === 3 && mode === "checkin_and_print" && (
              <Button disabled={listIds.length === 0} onClick={() => setStep(4)}>
                Next
              </Button>
            )}
            {step === 3 && mode === "checkin" && (
              <Button disabled={listIds.length === 0 || creating} onClick={handleCreate}>
                {creating ? "Creating…" : "Finish"}
              </Button>
            )}
            {step === 4 && (
              <Button disabled={!printStationId || creating} onClick={handleCreate}>
                {creating ? "Creating…" : "Finish"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AttendedOnConfirmDialog
        open={attendedConfirmOpen}
        busy={false}
        onOpenChange={setAttendedConfirmOpen}
        onConfirm={confirmAttendedOn}
      />
    </>
  )
}
```

- [ ] **Step 2: Wire it into `page.tsx`, removing the old create dialog**

In `src/app/events/[eventId]/kiosk-stations/page.tsx`:

1. Add `import { AddStationWizard } from "@/components/kiosk-admin/add-station-wizard"`.
2. Delete the `nextDefaultStationName` function (page.tsx:71-78) — it now lives only in `add-station-wizard.tsx`.
3. Delete these now-wizard-owned state declarations: `showCreate`, `newName`, `newListIds`, `newMode`, `newPrintStationId`, `newAutoPrint`, `newAttended`, `creating` (search for each `useState` call — keep any that are still used elsewhere in the file for something unrelated; based on the current file, all of these are create-dialog-only).
4. Delete `hasCollectionLists` (page.tsx:666) — after removing the old dialog, this becomes unused (confirm with a search before deleting: it must have zero remaining references).
5. Delete `handleCreate`, `handleCreateAttendedSwitch`, `focusCreateAttendedSwitch`, `newAttendedSwitchRef` entirely.
6. In `confirmAttendedOn`, remove the `if (attendedConfirmTarget.kind === "create") { ... return }` branch (page.tsx:467-470ish) — after this task, `attendedConfirmTarget` only ever represents an existing station, never the create flow. Simplify its type from the `{kind:"station", station} | {kind:"create"}` union down to `KioskStation | null`, and update `handleAttendedSwitch`'s `setAttendedConfirmTarget({kind:"station", station})` call to just `setAttendedConfirmTarget(station)`, and `confirmAttendedOn`'s remaining body to read `attendedConfirmTarget` directly as the station (no more `.station` property access).
7. Add a new `const [addWizardOpen, setAddWizardOpen] = useState(false)` state.
8. Both existing "Add Station" button `onClick` handlers (page.tsx:681-689 and 701-709) simplify to just `() => setAddWizardOpen(true)` — the wizard now computes its own default name internally when it opens, so `setNewName(nextDefaultStationName(stations))` is no longer needed here.
9. Delete the entire old `<Dialog open={showCreate} ...>...</Dialog>` block (page.tsx:1195-1318, the one this plan quoted in the spec's "Current State" section).
10. In its place, render:
    ```tsx
    <AddStationWizard
      open={addWizardOpen}
      onOpenChange={setAddWizardOpen}
      eventId={eventId}
      stations={stations}
      lists={lists}
      usbPrintStations={usbPrintStations}
      onCreated={(station) => {
        setHandoff({ name: station.name, token: station.access_token })
        loadStations()
      }}
    />
    ```
11. Remove now-unused imports: `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` (confirm with a search first — these were only used in the old create dialog's printer picker; `Checkbox` stays, it's used elsewhere in this file for bulk-select and the list picker).

- [ ] **Step 3: Verify**

- [ ] Run: `npx tsc --noEmit` — expect no errors.
- [ ] Run: `npx vitest run` — expect no regressions.
- [ ] Start the dev server and manually click through the full wizard twice:
  - **Check-in only path**: Add Station → confirm name is pre-filled "Tablet N" → pick "Check-in only" → Next → toggle Attended on (confirm dialog appears, matches Task 1's dialog exactly) → Next → tick at least one list → Finish → confirm the handoff (QR/link) dialog appears exactly as it did before this phase, and the new station shows up in the list with the right name/lists/attended state.
  - **Check-in + Print path**: same, but pick "Check-in + Print Badge" on step 1, confirm step 4 (printer + auto-print) appears before Finish, confirm the created station has the right `mode`/`print_station_id`/`auto_print_badge`.
  - Confirm "Back" at every step returns to the previous step without losing anything already entered.
  - Confirm "Cancel" at step 1 closes the dialog, and reopening "Add Station" starts fresh at step 1 with a freshly-recomputed default name (not the previous attempt's leftover values).

- [ ] **Step 4: Commit**

```bash
git add src/components/kiosk-admin/add-station-wizard.tsx "src/app/events/[eventId]/kiosk-stations/page.tsx"
git commit -m "feat(kiosk): replace the Add Station form with a 4-step guided wizard"
```
