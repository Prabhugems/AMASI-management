"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Download,
  Loader2,
  FileSpreadsheet,
  FileText,
  CheckSquare,
} from "lucide-react"
import { toast } from "sonner"

const EXPORT_FIELDS = [
  { id: "registration_number", label: "Registration Number", default: true },
  { id: "attendee_name", label: "Name", default: true },
  { id: "attendee_email", label: "Email", default: true },
  { id: "attendee_phone", label: "Phone", default: true },
  { id: "attendee_institution", label: "Institution", default: true },
  { id: "attendee_designation", label: "Designation", default: true },
  { id: "ticket_type", label: "Ticket Type", default: true },
  { id: "status", label: "Status", default: true },
  { id: "payment_status", label: "Payment Status", default: false },
  { id: "total_amount", label: "Amount", default: false },
  { id: "checked_in", label: "Checked In", default: false },
  { id: "checked_in_at", label: "Checked In At", default: false },
  { id: "badge_printed", label: "Badge Printed", default: false },
  { id: "created_at", label: "Registration Date", default: false },
  { id: "confirmed_at", label: "Confirmed Date", default: false },
  { id: "updated_at", label: "Last Updated", default: false },
]

export default function ExportRegistrationsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(EXPORT_FIELDS.filter(f => f.default).map(f => f.id))
  )
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [format, setFormat] = useState<"csv" | "json">("csv")
  const [exporting, setExporting] = useState(false)

  // Fetch registrations count
  const { data: registrations } = useQuery({
    queryKey: ["export-registrations", eventId, statusFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from("registrations")
        .select("*")
        .eq("event_id", eventId)

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      const { data } = await query
      return data || []
    },
  })

  const toggleField = (fieldId: string) => {
    const newSelection = new Set(selectedFields)
    if (newSelection.has(fieldId)) {
      newSelection.delete(fieldId)
    } else {
      newSelection.add(fieldId)
    }
    setSelectedFields(newSelection)
  }

  const selectAll = () => {
    setSelectedFields(new Set(EXPORT_FIELDS.map(f => f.id)))
  }

  const selectNone = () => {
    setSelectedFields(new Set())
  }

  const exportData = async () => {
    if (selectedFields.size === 0) {
      toast.error("Select at least one field")
      return
    }

    setExporting(true)
    try {
      const fields = Array.from(selectedFields)

      if (format === "csv") {
        const headers = fields.map(f => EXPORT_FIELDS.find(ef => ef.id === f)?.label || f)
        const rows = registrations.map((r: any) =>
          fields.map(f => {
            const value = r[f]
            if (typeof value === "boolean") return value ? "Yes" : "No"
            if (value === null || value === undefined) return ""
            return String(value)
          })
        )

        const csv = [
          headers.join(","),
          ...rows.map((row: string[]) => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
        ].join("\n")

        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `registrations-${new Date().toISOString().split("T")[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const data = registrations.map((r: any) => {
          const obj: Record<string, any> = {}
          fields.forEach(f => {
            obj[f] = r[f]
          })
          return obj
        })

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `registrations-${new Date().toISOString().split("T")[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
      }

      toast.success(`Exported ${registrations.length} registrations`)
    } catch (_error) {
      toast.error("Export failed")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Export Registrations</h1>
        <p className="text-muted-foreground">Download registration data in various formats</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Fields Selection */}
        <div className="md:col-span-2 bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Select Fields</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
              <Button variant="outline" size="sm" onClick={selectNone}>Clear</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {EXPORT_FIELDS.map(field => (
              <div
                key={field.id}
                className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                onClick={() => toggleField(field.id)}
              >
                <Checkbox checked={selectedFields.has(field.id)} />
                <Label className="cursor-pointer">{field.label}</Label>
              </div>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="space-y-4">
          <div className="bg-card rounded-lg border p-4">
            <h3 className="font-semibold mb-4">Options</h3>

            <div className="space-y-4">
              <div>
                <Label>Status Filter</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="confirmed">Confirmed Only</SelectItem>
                    <SelectItem value="pending">Pending Only</SelectItem>
                    <SelectItem value="cancelled">Cancelled Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Format</Label>
                <Select value={format} onValueChange={(v: "csv" | "json") => setFormat(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        CSV (Excel)
                      </div>
                    </SelectItem>
                    <SelectItem value="json">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        JSON
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckSquare className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Export Summary</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registrations</span>
                <span className="font-medium">{registrations?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fields</span>
                <span className="font-medium">{selectedFields.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Format</span>
                <span className="font-medium uppercase">{format}</span>
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={exportData}
            disabled={exporting || selectedFields.size === 0}
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {registrations?.length || 0} Registrations
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
