"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Copy,
  FileText,
  Shield,
  Trash2,
  Loader2,
  History,
  Download,
  Upload,
} from "lucide-react"
import { type EventSettings } from "./types"

interface AdvancedSectionProps {
  eventId: string
  event: EventSettings | null | undefined
  formData: Partial<EventSettings>
  setFormData: React.Dispatch<React.SetStateAction<Partial<EventSettings>>>
  changelog: any[] | undefined
  onClone: (data: { name: string; start_date: string; end_date: string }) => Promise<void>
  cloning: boolean
  onExport: () => void
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function AdvancedSection({
  event,
  formData,
  changelog,
  onClone,
  cloning,
  onExport,
  onImport,
}: AdvancedSectionProps) {
  const [deleteInput, setDeleteInput] = useState("")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCloneDialog, setShowCloneDialog] = useState(false)
  const [cloneData, setCloneData] = useState({ name: "", start_date: "", end_date: "" })

  return (
    <div className="space-y-6">
      {/* Clone Event */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Copy className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold">Clone Event</h3>
            <p className="text-sm text-muted-foreground">Create a copy with all settings but no registrations or financial data</p>
          </div>
        </div>

        {!showCloneDialog ? (
          <Button variant="outline" onClick={() => {
            setCloneData({
              name: `${event?.name || ""} (Copy)`,
              start_date: "",
              end_date: "",
            })
            setShowCloneDialog(true)
          }}>
            <Copy className="h-4 w-4 mr-2" />
            Clone This Event
          </Button>
        ) : (
          <div className="space-y-4 p-4 bg-secondary/30 rounded-xl border border-border">
            <div>
              <label className="text-sm font-medium">New Event Name</label>
              <Input
                value={cloneData.name}
                onChange={(e) => setCloneData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={cloneData.start_date}
                  onChange={(e) => setCloneData(prev => ({ ...prev, start_date: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={cloneData.end_date}
                  onChange={(e) => setCloneData(prev => ({ ...prev, end_date: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => onClone(cloneData)} disabled={cloning || !cloneData.name} className="gap-2">
                {cloning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                {cloning ? "Cloning..." : "Create Clone"}
              </Button>
              <Button variant="outline" onClick={() => setShowCloneDialog(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      {/* Export / Import Settings */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h3 className="font-semibold">Export / Import Settings</h3>
            <p className="text-sm text-muted-foreground">Download or apply settings as JSON</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export Settings
          </Button>
          <div className="relative">
            <Button variant="outline" className="gap-2" onClick={() => document.getElementById('import-settings')?.click()}>
              <Upload className="h-4 w-4" />
              Import Settings
            </Button>
            <input
              id="import-settings"
              type="file"
              accept=".json"
              onChange={onImport}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Settings Changelog */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <History className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold">Settings Changelog</h3>
            <p className="text-sm text-muted-foreground">Recent changes to event settings</p>
          </div>
        </div>

        {changelog && changelog.length > 0 ? (
          <div className="space-y-2">
            {changelog.map((entry: any) => (
              <div key={entry.id} className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg text-sm">
                <History className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{entry.summary}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {entry.section} section &middot; {new Date(entry.changed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No settings changes recorded yet.</p>
        )}
      </div>

      {/* Danger Zone - Delete Event */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold">Danger Zone</h3>
            <p className="text-sm text-muted-foreground">Irreversible actions</p>
          </div>
        </div>

        <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-xl space-y-4">
          <div>
            <h4 className="font-medium text-destructive">Delete Event</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Permanently delete this event and all associated data. This action cannot be undone.
            </p>
          </div>
          {!showDeleteDialog ? (
            <Button variant="destructive" size="sm" className="gap-2" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4" />
              Delete Event
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">Type <strong>&quot;{event?.name}&quot;</strong> to confirm:</p>
              <Input
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder={event?.name || ""}
                className="border-destructive/50"
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteInput !== event?.name}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Permanently Delete
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setShowDeleteDialog(false); setDeleteInput("") }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
