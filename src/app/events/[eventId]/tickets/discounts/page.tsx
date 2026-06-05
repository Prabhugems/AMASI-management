"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useConfirm } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Plus,
  Tag,
  Edit2,
  Trash2,
  Loader2,
  Percent,
  IndianRupee,
  Info,
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

type DiscountType = "percentage" | "fixed"

interface DiscountCode {
  id: string
  event_id: string
  code: string
  description: string | null
  discount_type: DiscountType
  discount_value: number
  max_uses: number | null
  current_uses: number
  min_order_amount: number | null
  max_discount_amount: number | null
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  applies_to_ticket_ids: string[] | null
  created_at: string
}

interface TicketTypeLite {
  id: string
  name: string
  price: number
}

interface FormState {
  code: string
  description: string
  discount_type: DiscountType
  discount_value: string
  max_uses: string
  min_order_amount: string
  max_discount_amount: string
  valid_until: string
  is_active: boolean
  applies_to_ticket_ids: string[]
}

const emptyForm: FormState = {
  code: "",
  description: "",
  discount_type: "fixed",
  discount_value: "",
  max_uses: "",
  min_order_amount: "",
  max_discount_amount: "",
  valid_until: "",
  is_active: true,
  applies_to_ticket_ids: [],
}

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalDatetimeInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export default function DiscountsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()
  const confirm = useConfirm()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DiscountCode | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const { data: event } = useQuery({
    queryKey: ["event-discount-flag", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, discount_enabled")
        .eq("id", eventId)
        .maybeSingle()
      return data as { id: string; discount_enabled: boolean | null } | null
    },
    enabled: !!eventId,
  })

  const { data: tickets } = useQuery<TicketTypeLite[]>({
    queryKey: ["event-ticket-types-lite", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_types")
        .select("id, name, price")
        .eq("event_id", eventId)
        .order("sort_order")
      return (data as TicketTypeLite[]) || []
    },
    enabled: !!eventId,
  })

  const { data: codes, isLoading } = useQuery<DiscountCode[]>({
    queryKey: ["discount-codes", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/discounts?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      return (json.data || []) as DiscountCode[]
    },
    enabled: !!eventId,
  })

  const toggleEnabled = useMutation({
    mutationFn: async (next: boolean) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("events")
        .update({ discount_enabled: next })
        .eq("id", eventId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-discount-flag", eventId] })
      toast.success("Updated")
    },
    onError: () => toast.error("Failed to update"),
  })

  const toggleActive = useMutation({
    mutationFn: async (vars: { id: string; is_active: boolean }) => {
      const res = await fetch(`/api/discounts/${vars.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: vars.is_active }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-codes", eventId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteCode = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/discounts/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-codes", eventId] })
      toast.success("Discount code deleted")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (code: DiscountCode) => {
    setEditing(code)
    setForm({
      code: code.code,
      description: code.description || "",
      discount_type: code.discount_type,
      discount_value: String(code.discount_value),
      max_uses: code.max_uses != null ? String(code.max_uses) : "",
      min_order_amount: code.min_order_amount != null ? String(code.min_order_amount) : "",
      max_discount_amount: code.max_discount_amount != null ? String(code.max_discount_amount) : "",
      valid_until: toLocalDatetimeInput(code.valid_until),
      is_active: code.is_active,
      applies_to_ticket_ids: code.applies_to_ticket_ids || [],
    })
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.code.trim()) {
      toast.error("Code is required")
      return
    }
    if (!form.discount_value || Number(form.discount_value) <= 0) {
      toast.error("Discount value must be greater than 0")
      return
    }
    if (form.discount_type === "percentage" && Number(form.discount_value) > 100) {
      toast.error("Percentage cannot exceed 100")
      return
    }

    const payload = {
      event_id: eventId,
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      min_order_amount: form.min_order_amount ? Number(form.min_order_amount) : null,
      max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
      valid_until: fromLocalDatetimeInput(form.valid_until),
      is_active: form.is_active,
      applies_to_ticket_ids: form.applies_to_ticket_ids.length > 0 ? form.applies_to_ticket_ids : null,
    }

    setSaving(true)
    try {
      const url = editing ? `/api/discounts/${editing.id}` : "/api/discounts"
      const method = editing ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed")
      toast.success(editing ? "Code updated" : "Code created")
      setDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["discount-codes", eventId] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (code: DiscountCode) => {
    const ok = await confirm({
      title: `Delete ${code.code}?`,
      description: "This will permanently remove the code. Past registrations that used it are not affected.",
      variant: "destructive",
      confirmText: "Delete",
    })
    if (ok) deleteCode.mutate(code.id)
  }

  const ticketName = (id: string) => tickets?.find(t => t.id === id)?.name || "Unknown"

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tag className="h-6 w-6" />
            Discount Codes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create promo codes that attendees can apply at checkout.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Code
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-muted/30">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium">Show discount input on checkout</p>
            <p className="text-xs text-muted-foreground">
              When off, the &quot;Discount code&quot; field is hidden from public checkout — codes won&apos;t work even if active.
            </p>
          </div>
        </div>
        <Switch
          checked={!!event?.discount_enabled}
          onCheckedChange={(v) => toggleEnabled.mutate(v)}
          disabled={toggleEnabled.isPending}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !codes || codes.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <Tag className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="mt-3 font-medium">No discount codes yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first code to offer attendees a discount at checkout.
          </p>
          <Button onClick={openCreate} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Create Discount Code
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map((code) => {
            const expired = code.valid_until && new Date(code.valid_until) < new Date()
            const exhausted = code.max_uses != null && code.current_uses >= code.max_uses
            return (
              <div
                key={code.id}
                className={cn(
                  "border rounded-lg p-4 flex flex-wrap items-start justify-between gap-4 transition-colors",
                  !code.is_active && "bg-muted/30 opacity-75"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="font-mono text-base font-bold">{code.code}</code>
                    {code.discount_type === "percentage" ? (
                      <Badge variant="secondary" className="gap-1">
                        <Percent className="h-3 w-3" />
                        {code.discount_value}% off
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <IndianRupee className="h-3 w-3" />
                        {Number(code.discount_value).toLocaleString("en-IN", { maximumFractionDigits: 0 })} off
                      </Badge>
                    )}
                    {!code.is_active && <Badge variant="outline">Inactive</Badge>}
                    {expired && <Badge variant="destructive">Expired</Badge>}
                    {exhausted && <Badge variant="destructive">Max uses reached</Badge>}
                  </div>
                  {code.description && (
                    <p className="text-sm text-muted-foreground mt-1">{code.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                    <span>
                      Used: <span className="font-medium text-foreground">{code.current_uses}</span>
                      {code.max_uses != null && <> / {code.max_uses}</>}
                    </span>
                    {code.valid_until && (
                      <span>Until {format(new Date(code.valid_until), "d MMM yyyy, h:mm a")}</span>
                    )}
                    {code.min_order_amount != null && (
                      <span>Min order: ₹{Number(code.min_order_amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                    )}
                    {code.applies_to_ticket_ids && code.applies_to_ticket_ids.length > 0 && (
                      <span>
                        Tickets: {code.applies_to_ticket_ids.map(ticketName).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={code.is_active}
                    onCheckedChange={(v) => toggleActive.mutate({ id: code.id, is_active: v })}
                    disabled={toggleActive.isPending}
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(code)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(code)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Discount Code" : "New Discount Code"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the code's settings." : "Create a code attendees can enter at checkout."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Code <span className="text-destructive">*</span></label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. EARLYBIRD2026"
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Internal note about this code"
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={form.discount_type}
                  onValueChange={(v) => setForm({ ...form, discount_type: v as DiscountType })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed amount (₹)</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  Value <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step={form.discount_type === "percentage" ? "1" : "0.01"}
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  placeholder={form.discount_type === "percentage" ? "10" : "1000"}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Max uses</label>
                <Input
                  type="number"
                  min="0"
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  placeholder="Unlimited"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Valid until</label>
                <Input
                  type="datetime-local"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Min order amount (₹)</label>
                <Input
                  type="number"
                  min="0"
                  value={form.min_order_amount}
                  onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                  placeholder="No minimum"
                  className="mt-1"
                />
              </div>
              {form.discount_type === "percentage" && (
                <div>
                  <label className="text-sm font-medium">Max discount (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    value={form.max_discount_amount}
                    onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })}
                    placeholder="No cap"
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Restrict to specific tickets</label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Leave all unchecked to allow the code on any ticket.
              </p>
              <div className="mt-2 space-y-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                {!tickets || tickets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No ticket types yet</p>
                ) : (
                  tickets.map((t) => {
                    const checked = form.applies_to_ticket_ids.includes(t.id)
                    return (
                      <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setForm((f) => ({
                              ...f,
                              applies_to_ticket_ids: v
                                ? [...f.applies_to_ticket_ids, t.id]
                                : f.applies_to_ticket_ids.filter((x) => x !== t.id),
                            }))
                          }}
                        />
                        <span className="text-sm">
                          {t.name}{" "}
                          <span className="text-xs text-muted-foreground">
                            (₹{Number(t.price).toLocaleString("en-IN", { maximumFractionDigits: 0 })})
                          </span>
                        </span>
                      </label>
                    )
                  })
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-md">
              <label htmlFor="active-toggle" className="text-sm font-medium cursor-pointer">
                Active
              </label>
              <Switch
                id="active-toggle"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Create Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
