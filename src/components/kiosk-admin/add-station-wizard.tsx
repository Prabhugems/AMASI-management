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
