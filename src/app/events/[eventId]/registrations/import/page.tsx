"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useParams } from "next/navigation"
import { CSVImportDynamic, type PreviewExtra } from "@/components/ui/csv-import-dynamic"
import Link from "next/link"
import { ArrowLeft, Settings2, Trash2, AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface TicketType {
  id: string
  name: string
  price: number
}

export default function ImportRegistrationsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const [registrationPrefix, setRegistrationPrefix] = useState("")
  const [_eventShortName, setEventShortName] = useState("")
  const [fixedAmount, setFixedAmount] = useState("")
  const [showSettings, setShowSettings] = useState(true)
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  // Per-row ticket overrides: rowIndex -> ticketId
  const [rowTickets, setRowTickets] = useState<Record<number, string>>({})
  // Selected rows for bulk-assign
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

  // Delete imported registrations
  const handleDeleteImported = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/import/registrations/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`Deleted ${data.deleted} imported registrations`)
        setShowDeleteConfirm(false)
        setImportedCount(0)
      } else {
        const error = await res.json()
        toast.error(error.error || "Failed to delete")
      }
    } catch (_err) {
      toast.error("Failed to delete imported registrations")
    } finally {
      setIsDeleting(false)
    }
  }

  // Fetch event, ticket types, and imported count
  useEffect(() => {
    const fetchData = async () => {
      // Fetch event
      const eventRes = await fetch(`/api/events/${eventId}`)
      if (eventRes.ok) {
        const data = await eventRes.json()
        setEventShortName(data.short_name || "")
        setRegistrationPrefix(data.short_name || "REG")
      }

      // Fetch ticket types
      const ticketsRes = await fetch(`/api/events/${eventId}/tickets`)
      if (ticketsRes.ok) {
        const tickets = await ticketsRes.json()
        setTicketTypes(tickets)
        // Auto-select first ticket if available
        if (tickets.length > 0) {
          setSelectedTicketId(tickets[0].id)
          setFixedAmount(tickets[0].price.toString())
        }
      }

      // Fetch imported registrations count
      const countRes = await fetch(`/api/import/registrations/count?event_id=${eventId}`)
      if (countRes.ok) {
        const countData = await countRes.json()
        setImportedCount(countData.count || 0)
      }
    }
    fetchData()
  }, [eventId])

  // Update amount when ticket selection changes
  const handleTicketChange = (ticketId: string) => {
    setSelectedTicketId(ticketId)
    const ticket = ticketTypes.find(t => t.id === ticketId)
    if (ticket) {
      setFixedAmount(ticket.price.toString())
    }
  }

  const standardFields = [
    { key: "name", label: "Name", required: true, description: "Attendee full name" },
    { key: "email", label: "Email", required: true, description: "Email address" },
    { key: "phone", label: "Phone/Mobile", description: "Contact number" },
    { key: "status", label: "Status", description: "Registration status (confirmed, pending, etc.)" },
    { key: "ticket_name", label: "Ticket Name", description: "Matches to ticket type by name" },
    { key: "registered_on", label: "Registration Date", description: "Date of registration" },
    { key: "total_amount", label: "Amount Paid", description: "Payment amount received" },
  ]

  const handleImport = async (data: Record<string, any>[]) => {
    const response = await fetch("/api/import/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: eventId,
        ticket_type_id: selectedTicketId || null,
        rows: data,
        registration_prefix: registrationPrefix,
        fixed_amount: fixedAmount ? parseFloat(fixedAmount) : null,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Import failed")
    }

    return response.json()
  }

  // Toggle a single row's selection
  const toggleRow = useCallback((index: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  // Bulk-assign ticket to all selected rows
  const bulkAssignTicket = useCallback((ticketId: string) => {
    setRowTickets(prev => {
      const next = { ...prev }
      selectedRows.forEach(i => { next[i] = ticketId })
      return next
    })
    setSelectedRows(new Set())
  }, [selectedRows])

  // Build previewExtra: checkbox + per-row ticket dropdown
  const previewExtra: PreviewExtra = useMemo(() => ({
    header: (
      <span className="whitespace-nowrap">Ticket Type</span>
    ),
    cell: (rowIndex: number) => {
      const override = rowTickets[rowIndex]
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectedRows.has(rowIndex)}
            onChange={() => toggleRow(rowIndex)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <select
            value={override || ""}
            onChange={(e) => {
              setRowTickets(prev => ({ ...prev, [rowIndex]: e.target.value }))
            }}
            className="px-2 py-1 border rounded text-xs bg-background min-w-[140px]"
          >
            <option value="">Auto (from CSV)</option>
            {ticketTypes.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )
    },
    getRowData: (rowIndex: number) => ({
      ticket_type_id: rowTickets[rowIndex] || undefined,
    }),
  }), [rowTickets, selectedTicketId, selectedRows, ticketTypes, toggleRow])

  // Build previewToolbar: bulk-assign bar when rows are selected
  const previewToolbar = useMemo(() => {
    if (selectedRows.size === 0) return null
    return (
      <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
        <span className="text-sm font-medium">{selectedRows.size} row{selectedRows.size > 1 ? "s" : ""} selected</span>
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) bulkAssignTicket(e.target.value)
          }}
          className="px-2 py-1 border rounded text-sm bg-background"
        >
          <option value="" disabled>Assign ticket...</option>
          {ticketTypes.map(t => (
            <option key={t.id} value={t.id}>
              {t.name} - ₹{t.price.toLocaleString()}
            </option>
          ))}
        </select>
        <button
          onClick={() => setSelectedRows(new Set())}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      </div>
    )
  }, [selectedRows, ticketTypes, bulkAssignTicket])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/events/${eventId}/registrations`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Registrations
          </Link>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" />
          Import Settings
        </button>
      </div>

      {/* Import Settings */}
      {showSettings && (
        <div className="bg-secondary/30 border border-border rounded-xl p-4">
          <h4 className="font-medium text-sm mb-3">Import Settings</h4>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Ticket Type
              </label>
              <select
                value={selectedTicketId}
                onChange={(e) => handleTicketChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
              >
                <option value="">Select ticket type</option>
                {ticketTypes.map(ticket => (
                  <option key={ticket.id} value={ticket.id}>
                    {ticket.name} - ₹{ticket.price.toLocaleString()}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Ticket type for imported registrations
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Amount (₹)
              </label>
              <input
                type="number"
                value={fixedAmount}
                onChange={(e) => setFixedAmount(e.target.value)}
                placeholder="e.g., 5000"
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto-filled from ticket, or enter custom
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Registration Prefix
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={registrationPrefix}
                  onChange={(e) => setRegistrationPrefix(e.target.value.toUpperCase())}
                  placeholder="e.g., 121"
                  className="px-3 py-2 border rounded-lg text-sm w-20 bg-background"
                  maxLength={10}
                />
                <span className="text-xs text-muted-foreground">
                  → {registrationPrefix}A1001...
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Imported - only show if there are imported registrations */}
      {importedCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  {importedCount} imported registrations found
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Delete these to re-import with correct settings
                </p>
              </div>
            </div>
            {!showDeleteConfirm ? (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete & Re-import
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-amber-700">Are you sure?</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteImported}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Yes, Delete All"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Component */}
      <div className="bg-card border border-border rounded-xl p-6">
        <CSVImportDynamic
          title="Import Attendees"
          description="Import registrations from any CSV file. Map your columns to standard fields - everything else becomes custom fields."
          standardFields={standardFields}
          onImport={handleImport}
          templateFileName="attendees_import_template.csv"
          previewExtra={previewExtra}
          previewToolbar={previewToolbar}
          showAllRowsInPreview={true}
        />
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100 mb-2">
          How Custom Fields Work
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• <strong>Standard fields</strong> (Name, Email, Phone, Status) are stored in main columns</li>
          <li>• <strong>Custom fields</strong> (AMASI Membership, Food Preference, etc.) are stored in form_responses</li>
          <li>• <strong>Registration numbers</strong> are auto-generated as {registrationPrefix || "PREFIX"}A1001, {registrationPrefix || "PREFIX"}A1002, ...</li>
          <li>• <strong>Duplicates</strong> are skipped (based on email)</li>
        </ul>
      </div>
    </div>
  )
}
