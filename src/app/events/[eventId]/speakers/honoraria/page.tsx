"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, BadgeCheck, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { HonorariumPipeline, type HonorariumStatus } from "@/components/speaker/honorarium-pipeline"

const STATUS_TABS: { value: "all" | HonorariumStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
]

const PAYMENT_METHODS = [
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "waived", label: "Waived" },
] as const

const CURRENCIES = ["INR", "USD", "GBP", "EUR"] as const

type FacultyMini = {
  id: string
  name: string | null
  email: string | null
  designation: string | null
  institution: string | null
  phone: string | null
}

type HonorariumRow = {
  id: string
  event_id: string
  faculty_id: string
  honorarium_applicable: boolean | null
  honorarium_amount: number | null
  honorarium_currency: string | null
  honorarium_status: HonorariumStatus | null
  honorarium_paid_date: string | null
  honorarium_reference: string | null
  payment_method: string | null
  tds_deducted: number | null
  total_sessions: number | null
  accepted_sessions: number | null
  faculty: FacultyMini | null
}

function formatCurrency(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—"
  const c = (currency || "INR").toUpperCase()
  try {
    return amount.toLocaleString("en-IN", { style: "currency", currency: c })
  } catch {
    return `${c} ${amount.toLocaleString("en-IN")}`
  }
}

function statusBadge(status: HonorariumStatus | null | undefined) {
  const s = status ?? "pending"
  const map: Record<HonorariumStatus, { className: string; label: string }> = {
    not_eligible: { className: "bg-slate-100 text-slate-700 border-slate-200", label: "Not eligible" },
    pending: { className: "bg-amber-100 text-amber-800 border-amber-200", label: "Pending" },
    approved: { className: "bg-blue-100 text-blue-800 border-blue-200", label: "Approved" },
    processing: { className: "bg-purple-100 text-purple-800 border-purple-200", label: "Processing" },
    paid: { className: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Paid" },
    rejected: { className: "bg-red-100 text-red-700 border-red-200", label: "Rejected" },
  }
  const entry = map[s]
  return (
    <Badge variant="outline" className={entry.className}>
      {entry.label}
    </Badge>
  )
}

export default function HonorariaPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<(typeof STATUS_TABS)[number]["value"]>("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Per-row editable amount/currency overrides for pending rows
  const [editDrafts, setEditDrafts] = useState<Record<string, { amount?: string; currency?: string }>>({})

  // Mark-paid dialog state
  const [paidDialogOpen, setPaidDialogOpen] = useState(false)
  const [paidDialogIds, setPaidDialogIds] = useState<string[]>([])
  const [paidForm, setPaidForm] = useState<{
    payment_method: string
    honorarium_reference: string
    honorarium_paid_date: string
    tds_deducted: string
  }>({
    payment_method: "bank",
    honorarium_reference: "",
    honorarium_paid_date: new Date().toISOString().slice(0, 10),
    tds_deducted: "",
  })

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string
    description: string
    onConfirm: () => void
  } | null>(null)

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["event-honoraria", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/honoraria`, { cache: "no-store" })
      if (!res.ok) {
        const t = await res.text().catch(() => "")
        throw new Error(t || "Failed to load honoraria")
      }
      const json = (await res.json()) as { data: HonorariumRow[] }
      return json.data ?? []
    },
  })

  // Filter rows for current tab
  const filteredRows = useMemo(() => {
    if (activeTab === "all") return rows
    return rows.filter((r) => (r.honorarium_status ?? "pending") === activeTab)
  }, [rows, activeTab])

  // Pending amount total
  const totalPending = useMemo(() => {
    const byCurrency: Record<string, number> = {}
    for (const r of rows) {
      if ((r.honorarium_status ?? "pending") === "pending") {
        const amt = Number(r.honorarium_amount ?? 0)
        if (!Number.isNaN(amt)) {
          const c = (r.honorarium_currency || "INR").toUpperCase()
          byCurrency[c] = (byCurrency[c] ?? 0) + amt
        }
      }
    }
    return byCurrency
  }, [rows])

  // PATCH single row (amount/currency edits)
  const patchMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/events/${eventId}/honoraria/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => "")
        throw new Error(t || "Update failed")
      }
      return (await res.json()) as { data: HonorariumRow }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-honoraria", eventId] })
      toast.success("Honorarium updated")
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Update failed")
    },
  })

  // Bulk action
  const bulkMutation = useMutation({
    mutationFn: async (body: {
      ids: string[]
      action: "approve" | "mark_paid"
      payload?: Record<string, unknown>
    }) => {
      const res = await fetch(`/api/events/${eventId}/honoraria`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => "")
        throw new Error(t || "Bulk action failed")
      }
      return (await res.json()) as { data: HonorariumRow[]; updated_count: number }
    },
    onSuccess: (resp, vars) => {
      queryClient.invalidateQueries({ queryKey: ["event-honoraria", eventId] })
      setSelectedIds(new Set())
      const verb = vars.action === "approve" ? "approved" : "marked paid"
      toast.success(`${resp.updated_count} honorar${resp.updated_count === 1 ? "ium" : "ia"} ${verb}`)
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Bulk action failed")
    },
  })

  const visibleIds = filteredRows.map((r) => r.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someSelected = visibleIds.some((id) => selectedIds.has(id))

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        for (const id of visibleIds) next.delete(id)
      } else {
        for (const id of visibleIds) next.add(id)
      }
      return next
    })
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function askConfirm(title: string, description: string, onConfirm: () => void) {
    setConfirmConfig({ title, description, onConfirm })
    setConfirmOpen(true)
  }

  function handleBulkApprove() {
    const ids = Array.from(selectedIds).filter((id) => {
      const r = rows.find((x) => x.id === id)
      return r && (r.honorarium_status ?? "pending") === "pending"
    })
    if (ids.length === 0) {
      toast.error("No pending rows selected")
      return
    }
    askConfirm(
      "Approve selected honoraria?",
      `${ids.length} pending honorar${ids.length === 1 ? "ium" : "ia"} will be approved.`,
      () => bulkMutation.mutate({ ids, action: "approve" })
    )
  }

  function openMarkPaidDialog(ids: string[]) {
    const eligible = ids.filter((id) => {
      const r = rows.find((x) => x.id === id)
      const s = r?.honorarium_status ?? "pending"
      return s === "approved" || s === "processing"
    })
    if (eligible.length === 0) {
      toast.error("Select approved or processing rows to mark paid")
      return
    }
    setPaidDialogIds(eligible)
    setPaidForm({
      payment_method: "bank",
      honorarium_reference: "",
      honorarium_paid_date: new Date().toISOString().slice(0, 10),
      tds_deducted: "",
    })
    setPaidDialogOpen(true)
  }

  function handleConfirmMarkPaid() {
    const payload: Record<string, unknown> = {
      payment_method: paidForm.payment_method,
    }
    if (paidForm.honorarium_reference.trim()) {
      payload.honorarium_reference = paidForm.honorarium_reference.trim()
    }
    if (paidForm.honorarium_paid_date) {
      payload.honorarium_paid_date = paidForm.honorarium_paid_date
    }
    if (paidForm.tds_deducted !== "") {
      const n = Number(paidForm.tds_deducted)
      if (!Number.isNaN(n)) payload.tds_deducted = n
    }

    askConfirm(
      "Mark selected as paid?",
      `${paidDialogIds.length} honorar${paidDialogIds.length === 1 ? "ium" : "ia"} will be marked paid. This action is recorded in the audit trail.`,
      () => {
        bulkMutation.mutate(
          { ids: paidDialogIds, action: "mark_paid", payload },
          {
            onSuccess: () => {
              setPaidDialogOpen(false)
              setPaidDialogIds([])
            },
          }
        )
      }
    )
  }

  function commitAmountEdit(row: HonorariumRow) {
    const draft = editDrafts[row.id]
    if (!draft) return
    const body: Record<string, unknown> = {}
    if (draft.amount !== undefined) {
      const n = Number(draft.amount)
      if (Number.isNaN(n)) {
        toast.error("Amount must be numeric")
        return
      }
      body.honorarium_amount = n
    }
    if (draft.currency !== undefined) {
      body.honorarium_currency = draft.currency
    }
    if (Object.keys(body).length === 0) return
    patchMutation.mutate({ id: row.id, body })
    setEditDrafts((prev) => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Honoraria</h1>
          <p className="text-sm text-muted-foreground">
            Approve and pay speaker honoraria for this event.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(totalPending).length === 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              No pending amount
            </span>
          ) : (
            Object.entries(totalPending).map(([currency, amt]) => (
              <span
                key={currency}
                className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
              >
                <Wallet className="h-3.5 w-3.5" />
                Pending: {formatCurrency(amt, currency)}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Tabs + table */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setSelectedIds(new Set()) }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {STATUS_TABS.map((t) => {
              const count = t.value === "all"
                ? rows.length
                : rows.filter((r) => (r.honorarium_status ?? "pending") === t.value).length
              return (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                  <span className="ml-1.5 text-xs text-muted-foreground">({count})</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {/* Bulk action bar */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={selectedIds.size === 0 || bulkMutation.isPending}
              onClick={handleBulkApprove}
            >
              <BadgeCheck className="h-4 w-4 mr-1.5" />
              Approve selected
            </Button>
            <Button
              size="sm"
              disabled={selectedIds.size === 0 || bulkMutation.isPending}
              onClick={() => openMarkPaidDialog(Array.from(selectedIds))}
            >
              <Wallet className="h-4 w-4 mr-1.5" />
              Mark paid selected
            </Button>
          </div>
        </div>

        {STATUS_TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4">
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[36px]">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Speaker</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment method</TableHead>
                    <TableHead>Paid date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                        Loading honoraria…
                      </TableCell>
                    </TableRow>
                  ) : isError ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-red-600">
                        Failed to load honoraria.
                      </TableCell>
                    </TableRow>
                  ) : filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                        No rows.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((row) => {
                      const status = (row.honorarium_status ?? "pending") as HonorariumStatus
                      const isPending = status === "pending"
                      const isPaid = status === "paid"
                      const canMarkPaid = status === "approved" || status === "processing"
                      const draft = editDrafts[row.id]
                      const amountValue = draft?.amount ?? (row.honorarium_amount?.toString() ?? "")
                      const currencyValue = draft?.currency ?? (row.honorarium_currency ?? "INR")
                      return (
                        <TableRow key={row.id} data-state={selectedIds.has(row.id) ? "selected" : undefined}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(row.id)}
                              onCheckedChange={() => toggleOne(row.id)}
                              aria-label={`Select ${row.faculty?.name ?? row.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{row.faculty?.name ?? "—"}</span>
                              <span className="text-xs text-muted-foreground">
                                {row.faculty?.designation ?? row.faculty?.email ?? ""}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.total_sessions ?? 0}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {isPending ? (
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                value={amountValue}
                                onChange={(e) =>
                                  setEditDrafts((prev) => ({
                                    ...prev,
                                    [row.id]: { ...prev[row.id], amount: e.target.value },
                                  }))
                                }
                                onBlur={() => commitAmountEdit(row)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur()
                                  }
                                }}
                                className="h-8 w-28 text-right ml-auto"
                              />
                            ) : (
                              <span>{formatCurrency(row.honorarium_amount, row.honorarium_currency)}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isPending ? (
                              <Select
                                value={currencyValue}
                                onValueChange={(v) => {
                                  setEditDrafts((prev) => ({
                                    ...prev,
                                    [row.id]: { ...prev[row.id], currency: v },
                                  }))
                                  // commit immediately for currency
                                  patchMutation.mutate({ id: row.id, body: { honorarium_currency: v } })
                                  setEditDrafts((prev) => {
                                    const next = { ...prev }
                                    if (next[row.id]) delete next[row.id].currency
                                    return next
                                  })
                                }}
                              >
                                <SelectTrigger className="h-8 w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CURRENCIES.map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {(row.honorarium_currency ?? "INR").toUpperCase()}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5">
                              {statusBadge(status)}
                              {status !== "rejected" && status !== "not_eligible" && (
                                <div className="hidden xl:block">
                                  <HonorariumPipeline status={status} />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {isPaid ? (row.payment_method ?? "—") : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {isPaid ? (row.honorarium_paid_date ?? "—") : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {isPending && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  askConfirm(
                                    "Approve honorarium?",
                                    `${row.faculty?.name ?? "This speaker"}'s honorarium will be approved.`,
                                    () => bulkMutation.mutate({ ids: [row.id], action: "approve" })
                                  )
                                }
                              >
                                Approve
                              </Button>
                            )}
                            {canMarkPaid && (
                              <Button
                                size="sm"
                                onClick={() => openMarkPaidDialog([row.id])}
                              >
                                Mark paid
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Mark-paid dialog */}
      <Dialog open={paidDialogOpen} onOpenChange={setPaidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark honoraria as paid</DialogTitle>
            <DialogDescription>
              Recording payment for {paidDialogIds.length} honorar{paidDialogIds.length === 1 ? "ium" : "ia"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="payment_method">Payment method</Label>
              <Select
                value={paidForm.payment_method}
                onValueChange={(v) => setPaidForm((s) => ({ ...s, payment_method: v }))}
              >
                <SelectTrigger id="payment_method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="honorarium_reference">Transaction reference</Label>
              <Input
                id="honorarium_reference"
                placeholder="UTR / cheque # / receipt"
                value={paidForm.honorarium_reference}
                onChange={(e) => setPaidForm((s) => ({ ...s, honorarium_reference: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="honorarium_paid_date">Paid date</Label>
              <Input
                id="honorarium_paid_date"
                type="date"
                value={paidForm.honorarium_paid_date}
                onChange={(e) => setPaidForm((s) => ({ ...s, honorarium_paid_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tds_deducted">TDS deducted</Label>
              <Input
                id="tds_deducted"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={paidForm.tds_deducted}
                onChange={(e) => setPaidForm((s) => ({ ...s, tds_deducted: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmMarkPaid} disabled={bulkMutation.isPending}>
              {bulkMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Confirm payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generic confirm */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmConfig?.title ?? "Confirm"}</AlertDialogTitle>
            <AlertDialogDescription>{confirmConfig?.description ?? ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmConfig?.onConfirm()
                setConfirmOpen(false)
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
