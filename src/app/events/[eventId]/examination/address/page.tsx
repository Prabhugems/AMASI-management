"use client"

import { useState, useRef } from "react"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  MapPin,
  Search,
  Download,
  Loader2,
  Edit,
  Save,
  Users,
  CheckCircle2,
  AlertCircle,
  Mail,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  AnimatedStatCard,
  HighlightText,
  EmptyState,
  KbdHint,
  useExportProgress,
} from "@/components/examination/exam-ui"

type ConvocationAddress = {
  address_line1: string
  address_line2: string
  city: string
  state: string
  pincode: string
  country: string
}

type Registration = {
  id: string
  registration_id: string
  name: string
  email: string
  phone: string | null
  convocation_number: string | null
  convocation_address: ConvocationAddress | null
  ticket_type_name: string | null
}

const emptyAddress: ConvocationAddress = {
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
}

export default function AddressPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [editingReg, setEditingReg] = useState<Registration | null>(null)
  const [editAddress, setEditAddress] = useState<ConvocationAddress>(emptyAddress)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [filterStatus, setFilterStatus] = useState<"all" | "collected" | "pending">("all")

  const searchInputRef = useRef<HTMLInputElement>(null)
  const { startExport, endExport, ExportOverlay } = useExportProgress()

  useKeyboardShortcut("k", () => {
    searchInputRef.current?.focus()
  }, { meta: true })

  useKeyboardShortcut("Escape", () => {
    if (editingReg) setEditingReg(null)
  }, { enabled: !!editingReg })

  const sendReminder = async () => {
    if (!confirm(`Send urgent reminder email to ${withoutAddress} candidates who haven't filled the address form?`)) return
    setSendingReminder(true)
    try {
      const res = await fetch("/api/examination/send-address-reminder", {
        method: "POST",
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      alert(`Reminder sent!\n\nSent: ${result.sent}\nFailed: ${result.failed}\nTotal pending: ${result.total}`)
    } catch (error: any) {
      alert("Failed: " + error.message)
    }
    setSendingReminder(false)
  }

  const syncAddresses = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/examination/sync-addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      alert(`Synced from Fillout!\n\nNew addresses: ${result.synced}\nAlready had: ${result.alreadyHas}\nNot filled: ${result.notFilled}`)
      await queryClient.invalidateQueries({ queryKey: ["exam-address", eventId] })
    } catch (error: any) {
      alert("Sync failed: " + error.message)
    }
    setSyncing(false)
  }

  const { data: registrations, isLoading } = useQuery({
    queryKey: ["exam-address", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/examination/registrations?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch registrations")
      const data = await res.json()
      return (data || [])
        .filter((r: any) => r.exam_result === "pass")
        .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))
        .map((r: any) => ({
          ...r,
          ticket_type_name: r.ticket_type_name || null,
        })) as Registration[]
    },
    enabled: !!eventId,
    staleTime: 30_000,
  })

  const filtered = (registrations || []).filter((r) => {
    // Status filter
    if (filterStatus === "collected" && !r.convocation_address) return false
    if (filterStatus === "pending" && r.convocation_address) return false
    // Search
    if (!search) return true
    const s = search.toLowerCase()
    return r.name?.toLowerCase().includes(s) || r.email?.toLowerCase().includes(s) || r.convocation_number?.toLowerCase().includes(s)
  })

  const withAddress = registrations?.filter(r => r.convocation_address).length || 0
  const withoutAddress = (registrations?.length || 0) - withAddress
  const collectionRate = (registrations?.length || 0) > 0 ? Math.round((withAddress / (registrations?.length || 1)) * 100) : 0

  const openEdit = (reg: Registration) => {
    setEditingReg(reg)
    setEditAddress(reg.convocation_address || { ...emptyAddress })
  }

  const saveAddress = async () => {
    if (!editingReg) return
    setSaving(true)
    try {
      const res = await fetch("/api/examination/registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingReg.id, convocation_address: editAddress }),
      })
      if (!res.ok) throw new Error("Failed to save address")
      await queryClient.invalidateQueries({ queryKey: ["exam-address", eventId] })
      setEditingReg(null)
    } catch (error) {
      console.error("Failed to save address:", error)
    }
    setSaving(false)
  }

  const downloadCSV = () => {
    if (!filtered.length) return
    startExport("Generating CSV...")

    setTimeout(() => {
      const headers = ["Convocation No.", "Name", "Email", "Phone", "Address Line 1", "Address Line 2", "City", "State", "Pincode", "Country"]
      const rows = filtered.map(r => [
        r.convocation_number || "",
        r.name,
        r.email,
        r.phone || "",
        r.convocation_address?.address_line1 || "",
        r.convocation_address?.address_line2 || "",
        r.convocation_address?.city || "",
        r.convocation_address?.state || "",
        r.convocation_address?.pincode || "",
        r.convocation_address?.country || "",
      ])
      const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `convocation-addresses-${eventId}.csv`
      a.click()
      URL.revokeObjectURL(url)
      endExport()
    }, 100)
  }

  return (
    <div className="p-6 space-y-6">
      <ExportOverlay />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Address Collection
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Collect postal addresses for dispatching convocation certificates
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Button onClick={sendReminder} variant="default" className="gap-2" disabled={sendingReminder || withoutAddress === 0}>
            {sendingReminder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Send Reminder ({withoutAddress})
          </Button>
          <Button onClick={syncAddresses} variant="outline" className="gap-2" disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            Sync from Fillout
          </Button>
          <Button onClick={downloadCSV} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download Addresses
          </Button>
        </div>
      </div>

      {/* Stats - Animated */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AnimatedStatCard
          label="Total Passed"
          value={registrations?.length || 0}
          onClick={() => setFilterStatus("all")}
          active={filterStatus === "all"}
        />
        <AnimatedStatCard
          label="Address Collected"
          value={withAddress}
          color="text-green-600"
          onClick={() => setFilterStatus(filterStatus === "collected" ? "all" : "collected")}
          active={filterStatus === "collected"}
        />
        <AnimatedStatCard
          label="Pending"
          value={withoutAddress}
          color="text-orange-600"
          onClick={() => setFilterStatus(filterStatus === "pending" ? "all" : "pending")}
          active={filterStatus === "pending"}
        />
        <div className="bg-card border rounded-xl p-4 text-left stagger-item">
          <p className="text-sm text-muted-foreground">Collection Rate</p>
          <p className={cn(
            "text-2xl font-bold tabular-nums",
            collectionRate >= 80 ? "text-green-600" : collectionRate >= 50 ? "text-yellow-600" : "text-red-600"
          )}>
            {collectionRate}%
          </p>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out",
                collectionRate >= 80 ? "bg-green-500" : collectionRate >= 50 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${collectionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Auto-schedule info */}
      {withoutAddress > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2 animate-in fade-in duration-500">
          <Clock className="h-4 w-4" />
          <span>Auto-reminder scheduled every 3 days to {withoutAddress} candidates who haven&apos;t filled the form.</span>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm no-print">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          placeholder="Search candidates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-16"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          <KbdHint>Cmd+K</KbdHint>
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12 mx-auto" />}
          title={filterStatus === "collected" ? "No addresses collected yet" : filterStatus === "pending" ? "All addresses collected!" : "No passed candidates found"}
          description={search ? `No results for "${search}".` : filterStatus === "collected" ? "Sync from Fillout or add addresses manually." : filterStatus === "pending" ? "All passed candidates have submitted their addresses." : "No candidates have passed the examination yet."}
        />
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Convocation No.</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="no-print">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((reg, i) => (
                <TableRow
                  key={reg.id}
                  className={cn(
                    "transition-colors duration-150 hover:bg-muted/50",
                    reg.convocation_address && "bg-green-50/30 dark:bg-green-950/10"
                  )}
                >
                  <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">
                      <HighlightText text={reg.name} search={search} />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <HighlightText text={reg.email} search={search} />
                    </p>
                    {reg.phone && <p className="text-xs text-muted-foreground">{reg.phone}</p>}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-mono">
                      {reg.convocation_number ? (
                        <HighlightText text={reg.convocation_number} search={search} />
                      ) : "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {reg.convocation_address ? (
                      <div className="text-xs text-muted-foreground max-w-xs">
                        <p>{reg.convocation_address.address_line1}</p>
                        {reg.convocation_address.address_line2 && <p>{reg.convocation_address.address_line2}</p>}
                        <p>{reg.convocation_address.city}, {reg.convocation_address.state} - {reg.convocation_address.pincode}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Not provided</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {reg.convocation_address ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="h-3 w-3" />Collected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2.5 py-1 rounded-full">
                        <AlertCircle className="h-3 w-3" />Pending
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="no-print">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openEdit(reg)}>
                      <Edit className="h-3 w-3" />
                      {reg.convocation_address ? "Edit" : "Add Address"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Address Dialog */}
      <Dialog open={!!editingReg} onOpenChange={(open) => !open && setEditingReg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingReg?.convocation_address ? "Edit" : "Add"} Address - {editingReg?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Address Line 1 *</label>
              <Input
                value={editAddress.address_line1}
                onChange={(e) => setEditAddress(prev => ({ ...prev, address_line1: e.target.value }))}
                placeholder="House/Flat No., Street"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Address Line 2</label>
              <Input
                value={editAddress.address_line2}
                onChange={(e) => setEditAddress(prev => ({ ...prev, address_line2: e.target.value }))}
                placeholder="Landmark, Area"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">City *</label>
                <Input
                  value={editAddress.city}
                  onChange={(e) => setEditAddress(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">State *</label>
                <Input
                  value={editAddress.state}
                  onChange={(e) => setEditAddress(prev => ({ ...prev, state: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Pincode *</label>
                <Input
                  value={editAddress.pincode}
                  onChange={(e) => setEditAddress(prev => ({ ...prev, pincode: e.target.value }))}
                  maxLength={6}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Country</label>
                <Input
                  value={editAddress.country}
                  onChange={(e) => setEditAddress(prev => ({ ...prev, country: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" onClick={() => setEditingReg(null)}>
                Cancel <KbdHint>Esc</KbdHint>
              </Button>
              <Button
                onClick={saveAddress}
                disabled={saving || !editAddress.address_line1 || !editAddress.city || !editAddress.state || !editAddress.pincode}
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Address
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
