"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, UserPlus, FileUp } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CSVImport } from "@/components/ui/csv-import"
import { LEAD_SOURCES } from "./leads-types"

interface AddLeadDialogProps {
  eventId: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddLeadDialog({ eventId, open, onClose, onSuccess }: AddLeadDialogProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [source, setSource] = useState("manual")
  const [notes, setNotes] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const resetForm = () => {
    setName("")
    setEmail("")
    setPhone("")
    setSource("manual")
    setNotes("")
    setFormError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  // Create lead mutation
  const createLead = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || null,
          phone: phone.trim() || null,
          source,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create lead")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Lead added successfully")
      resetForm()
      onSuccess()
      onClose()
    },
    onError: (err: Error) => {
      setFormError(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!email.trim()) {
      setFormError("Email is required")
      return
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError("Please enter a valid email address")
      return
    }

    createLead.mutate()
  }

  // CSV import handler
  const handleImport = async (data: Record<string, any>[]) => {
    const leads = data.map((row) => ({
      email: row.email || "",
      name: row.name || undefined,
      phone: row.phone || undefined,
      source: row.source || "import",
      notes: row.notes || undefined,
    }))

    const res = await fetch(`/api/events/${eventId}/leads/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leads }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || "Import failed")
    }

    const result = await res.json()

    // Call onSuccess to refresh leads list
    onSuccess()

    return {
      success: result.imported || 0,
      failed: result.skipped || 0,
      errors: (result.errors || []).map((err: any, i: number) => ({
        row: i + 1,
        error: typeof err === "string" ? err : err.message || "Unknown error",
      })),
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Leads</DialogTitle>
          <DialogDescription>
            Add a single lead manually or import multiple leads from a CSV file.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manual" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="manual" className="flex-1 gap-2">
              <UserPlus className="h-4 w-4" />
              Add Manually
            </TabsTrigger>
            <TabsTrigger value="import" className="flex-1 gap-2">
              <FileUp className="h-4 w-4" />
              Import CSV
            </TabsTrigger>
          </TabsList>

          {/* Manual Add Tab */}
          <TabsContent value="manual">
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lead-name">Name</Label>
                  <Input
                    id="lead-name"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lead-email"
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setFormError(null)
                    }}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lead-phone">Phone</Label>
                  <Input
                    id="lead-phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-source">Source</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger id="lead-source">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-notes">Notes</Label>
                <Textarea
                  id="lead-notes"
                  placeholder="Any additional notes about this lead..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {formError && (
                <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createLead.isPending}>
                  {createLead.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Lead
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Import CSV Tab */}
          <TabsContent value="import">
            <div className="pt-4">
              <CSVImport
                title="Import Leads"
                description="Upload a CSV file with lead information to import them in bulk."
                templateFileName="leads_import_template.csv"
                templateColumns={[
                  { name: "Email", description: "Lead email address", required: true, example: "john@example.com" },
                  { name: "Name", description: "Full name", example: "John Doe" },
                  { name: "Phone", description: "Phone number", example: "+919876543210" },
                  { name: "Source", description: "Lead source", example: "referral" },
                  { name: "Notes", description: "Additional notes", example: "Interested in workshop" },
                ]}
                columnMappings={[
                  { csvColumn: "Email", dbColumn: "email", required: true },
                  { csvColumn: "Name", dbColumn: "name" },
                  { csvColumn: "Phone", dbColumn: "phone" },
                  { csvColumn: "Source", dbColumn: "source" },
                  { csvColumn: "Notes", dbColumn: "notes" },
                ]}
                onImport={handleImport}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
