"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  Mail,
  Phone,
  Calendar,
  IndianRupee,
  Receipt,
  User,
  Ticket,
  MoreHorizontal,
  Eye,
  Send,
  Trash2,
  AlertTriangle,
  Package,
  HelpCircle,
  ShieldCheck,
  Loader2,
  CheckCircle,
  Info,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SlideOver, SlideOverSection, SlideOverFooter } from "@/components/ui/slide-over"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface OrderAddon {
  id: string
  addon_name: string
  variant_name?: string
  quantity: number
  unit_price: number
  total_price: number
}

interface Order {
  id: string
  payment_number: string
  payer_name: string
  payer_email: string
  payer_phone?: string
  amount: number
  currency: string
  tax_amount: number
  discount_amount: number
  net_amount: number
  status: string
  payment_method: string
  razorpay_payment_id?: string
  razorpay_order_id?: string
  completed_at?: string
  created_at: string
  registrations?: {
    id: string
    registration_number: string
    first_name: string
    last_name: string
    email: string
    ticket_type?: {
      name: string
      price: number
    }
  }[]
  addons?: OrderAddon[]
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  completed: { label: "Paid", color: "bg-success/10 text-success", icon: CheckCircle2 },
  pending: { label: "Pending", color: "bg-warning/10 text-warning", icon: Clock },
  failed: { label: "Failed", color: "bg-destructive/10 text-destructive", icon: XCircle },
  refunded: { label: "Refunded", color: "bg-info/10 text-info", icon: RefreshCw },
}

export default function OrdersPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null)

  // Payment verification
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false)
  const [verifyOrder, setVerifyOrder] = useState<Order | null>(null)
  const [verifyPaymentId, setVerifyPaymentId] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<any>(null)

  // Delete order function - uses API to bypass RLS
  const handleDeleteOrder = async (orderId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()

    if (!confirm("Are you sure you want to delete this order? This will also delete any associated registrations.")) {
      return
    }

    setDeletingOrderId(orderId)
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete order")
      }

      toast.success("Order deleted successfully")
      refetch()
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null)
      }
    } catch (error: any) {
      console.error("Error deleting order:", error)
      toast.error(error.message || "Failed to delete order")
    } finally {
      setDeletingOrderId(null)
    }
  }

  // Open verify dialog
  const openVerifyDialog = (order: Order, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setVerifyOrder(order)
    setVerifyPaymentId(order.razorpay_payment_id || "")
    setVerifyResult(null)
    setVerifyDialogOpen(true)
  }

  // Verify payment with Razorpay
  const handleVerifyPayment = async () => {
    if (!verifyOrder) return

    setIsVerifying(true)
    setVerifyResult(null)
    try {
      const res = await fetch(`/api/payments/${verifyOrder.id}/verify-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_payment_id: verifyPaymentId.trim() || undefined,
        }),
      })

      const result = await res.json()
      setVerifyResult(result)

      if (result.verified) {
        toast.success("Payment verified and marked as completed!")
        refetch()
      } else if (result.status === "already_completed") {
        toast.info("Payment is already completed")
      } else if (result.status === "not_found_on_gateway") {
        toast.error("Payment not found on Razorpay")
      } else {
        toast.warning(result.message || "Verification completed")
      }
    } catch (error: any) {
      toast.error(error.message || "Verification failed")
    } finally {
      setIsVerifying(false)
    }
  }

  // Fetch orders (payments) for this event
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["event-orders", eventId, search, statusFilter],
    queryFn: async () => {
      // First try to fetch payments with event_id
      let query = supabase
        .from("payments")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      if (search) {
        query = query.or(`payer_name.ilike.%${search}%,payer_email.ilike.%${search}%,payment_number.ilike.%${search}%`)
      }

      const { data: paymentsData, error: paymentsError } = await query

      if (paymentsError) {
        console.error("Error fetching payments:", paymentsError)
        return []
      }

      if (!paymentsData || paymentsData.length === 0) {
        return []
      }

      // Fetch associated registrations for these payments
      const paymentIds = paymentsData.map((p: any) => p.id)
      const { data: regsData } = await supabase
        .from("registrations")
        .select(`
          id,
          payment_id,
          registration_number,
          attendee_name,
          attendee_email,
          ticket_type:ticket_types (
            name,
            price
          )
        `)
        .in("payment_id", paymentIds)

      // Get registration IDs to fetch addons
      const registrationIds = regsData?.map((r: any) => r.id) || []

      // For addon purchases, get registration IDs from payment metadata
      const addonPurchaseRegIds: string[] = []
      paymentsData.forEach((p: any) => {
        if (p.payment_type === "addon_purchase" && p.metadata?.registration_id) {
          addonPurchaseRegIds.push(p.metadata.registration_id)
        }
      })

      // Combine all registration IDs
      const allRegistrationIds = [...new Set([...registrationIds, ...addonPurchaseRegIds])]

      // Fetch addons for these registrations
      const { data: addonsData } = await supabase
        .from("registration_addons")
        .select(`
          id,
          registration_id,
          quantity,
          unit_price,
          total_price,
          addon:addons(name, price)
        `)
        .in("registration_id", allRegistrationIds.length > 0 ? allRegistrationIds : ['none'])

      // Map addons by registration_id for quick lookup
      const addonsByRegistration: Record<string, any[]> = {}
      if (addonsData) {
        addonsData.forEach((addon: any) => {
          if (!addonsByRegistration[addon.registration_id]) {
            addonsByRegistration[addon.registration_id] = []
          }
          const qty = addon.quantity || 1
          const addonPrice = addon.addon?.price || 0
          const unitPrice = addon.unit_price || addonPrice
          const totalPrice = addon.total_price || (addonPrice * qty)
          addonsByRegistration[addon.registration_id].push({
            id: addon.id,
            addon_name: addon.addon?.name || "Add-on",
            variant_name: null,
            quantity: qty,
            unit_price: unitPrice,
            total_price: totalPrice,
          })
        })
      }

      // Fetch registrations for addon purchases (to show linked registration info)
      let addonPurchaseRegs: any[] = []
      if (addonPurchaseRegIds.length > 0) {
        const { data: addonRegs } = await supabase
          .from("registrations")
          .select(`
            id,
            registration_number,
            attendee_name,
            attendee_email,
            ticket_type:ticket_types (name, price)
          `)
          .in("id", addonPurchaseRegIds)
        addonPurchaseRegs = addonRegs || []
      }

      // Merge registrations and addons with payments
      const ordersWithRegs = paymentsData.map((payment: any) => {
        let regs: any[] = regsData?.filter((r: any) => r.payment_id === payment.id) || []
        let allAddons: OrderAddon[] = []

        // For addon purchases, link to the existing registration
        if (payment.payment_type === "addon_purchase" && payment.metadata?.registration_id) {
          const linkedReg = addonPurchaseRegs.find((r: any) => r.id === payment.metadata.registration_id)
          if (linkedReg) {
            regs = [linkedReg]
          }
          // Get addons purchased in this payment (from metadata)
          const purchasedAddonIds = payment.metadata?.addons_selection?.map((a: any) => a.addonId) || []
          const regAddons = addonsByRegistration[payment.metadata.registration_id] || []
          // Filter to only show addons from this payment
          allAddons = regAddons.filter((a: any) => {
            // If we have addon selection info, use it. Otherwise show all.
            if (purchasedAddonIds.length > 0) {
              return true // Show all since we can't easily match by addon_id here
            }
            return true
          })
        } else {
          // Collect all addons for this payment's registrations
          regs.forEach((reg: any) => {
            const regAddons = addonsByRegistration[reg.id] || []
            allAddons.push(...regAddons)
          })
        }

        return {
          ...payment,
          registrations: regs.map((r: any) => ({
            id: r.id,
            registration_number: r.registration_number,
            first_name: r.attendee_name?.split(" ")[0] || "",
            last_name: r.attendee_name?.split(" ").slice(1).join(" ") || "",
            email: r.attendee_email,
            ticket_type: r.ticket_type
          })),
          addons: allAddons
        }
      })

      return ordersWithRegs as Order[]
    },
  })

  // Stats
  const stats = {
    total: orders?.length || 0,
    completed: orders?.filter((o) => o.status === "completed").length || 0,
    pending: orders?.filter((o) => o.status === "pending").length || 0,
    revenue: orders?.filter((o) => o.status === "completed").reduce((sum, o) => sum + o.net_amount, 0) || 0,
  }

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending
    const Icon = config.icon
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", config.color)}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground">
            View and manage ticket purchases and payments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/events/${eventId}/orders/instructions`}>
            <Button variant="ghost" size="sm">
              <HelpCircle className="w-4 h-4 mr-2" />
              Guide
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="paper-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Orders</p>
            </div>
          </div>
        </div>
        <div className="paper-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Paid Orders</p>
            </div>
          </div>
        </div>
        <div className="paper-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
        </div>
        <div className="paper-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <IndianRupee className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{stats.revenue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or order #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      <div className="paper-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">Loading orders...</p>
          </div>
        ) : orders && orders.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Order</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Customer</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Tickets</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Amount</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Date</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className={cn(
                    "border-b hover:bg-muted/30 cursor-pointer transition-colors",
                    selectedOrder?.id === order.id && "bg-primary/5"
                  )}
                  onClick={() => setSelectedOrder(order)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono text-sm">{order.payment_number}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-sm">{order.payer_name}</p>
                      <p className="text-xs text-muted-foreground">{order.payer_email}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm">
                      {(order as any).payment_type === "addon_purchase"
                        ? <span className="text-info">Addon Purchase</span>
                        : `${order.registrations?.length || 0} ticket(s)`
                      }
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold">₹{order.net_amount.toLocaleString()}</span>
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(order.status)}</td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(order.created_at), "dd MMM yyyy")}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Send className="w-4 h-4 mr-2" />
                          Send Receipt
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="w-4 h-4 mr-2" />
                          Download Invoice
                        </DropdownMenuItem>
                        {(order.status === "failed" || order.status === "pending") && (
                          <DropdownMenuItem onClick={(e) => openVerifyDialog(order, e)}>
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            Verify Payment
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={(e) => handleDeleteOrder(order.id, e)}
                          className="text-destructive focus:text-destructive"
                          disabled={deletingOrderId === order.id}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {deletingOrderId === order.id ? "Deleting..." : "Delete Order"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center">
            <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-medium text-foreground">No orders yet</h3>
            <p className="text-sm text-muted-foreground">
              Orders will appear here when attendees purchase tickets
            </p>
          </div>
        )}
      </div>

      {/* Order Details Slide Over */}
      <SlideOver
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={`Order ${selectedOrder?.payment_number || ""}`}
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              {getStatusBadge(selectedOrder.status)}
              <span className="text-sm text-muted-foreground">
                {format(new Date(selectedOrder.created_at), "dd MMM yyyy, h:mm a")}
              </span>
            </div>

            {/* Customer Info */}
            <SlideOverSection title="Customer" icon={User}>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-semibold">
                      {selectedOrder.payer_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{selectedOrder.payer_name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <a href={`mailto:${selectedOrder.payer_email}`} className="hover:text-primary">
                      {selectedOrder.payer_email}
                    </a>
                  </div>
                  {selectedOrder.payer_phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <a href={`tel:${selectedOrder.payer_phone}`} className="hover:text-primary">
                        {selectedOrder.payer_phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </SlideOverSection>

            {/* Tickets/Registrations - Different display for addon purchases */}
            {(selectedOrder as any).payment_type === "addon_purchase" ? (
              <SlideOverSection title="Linked Registration" icon={Ticket}>
                {selectedOrder.registrations && selectedOrder.registrations.length > 0 ? (
                  <div className="space-y-3">
                    {selectedOrder.registrations.map((reg) => (
                      <div
                        key={reg.id}
                        className="p-3 rounded-lg bg-muted/30"
                      >
                        <p className="font-medium text-sm">
                          {reg.first_name} {reg.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {reg.ticket_type?.name || "Standard Ticket"}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {reg.registration_number}
                        </p>
                        <p className="text-xs text-info mt-1">
                          Add-on purchase for existing registration
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Registration details not found</p>
                )}
              </SlideOverSection>
            ) : (
              <SlideOverSection title="Tickets" icon={Ticket}>
                {selectedOrder.registrations && selectedOrder.registrations.length > 0 ? (
                  <div className="space-y-3">
                    {selectedOrder.registrations.map((reg) => (
                      <div
                        key={reg.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {reg.first_name} {reg.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {reg.ticket_type?.name || "Standard Ticket"}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {reg.registration_number}
                          </p>
                        </div>
                        <p className="font-semibold">
                          ₹{reg.ticket_type?.price?.toLocaleString() || "0"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No tickets found</p>
                )}
              </SlideOverSection>
            )}

            {/* Add-ons */}
            {selectedOrder.addons && selectedOrder.addons.length > 0 && (
              <SlideOverSection title="Add-ons" icon={Package}>
                <div className="space-y-3">
                  {selectedOrder.addons.map((addon) => (
                    <div
                      key={addon.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {addon.addon_name}
                          {addon.variant_name && (
                            <span className="text-muted-foreground ml-1">
                              ({addon.variant_name})
                            </span>
                          )}
                        </p>
                        {addon.quantity > 1 && (
                          <p className="text-xs text-muted-foreground">
                            Qty: {addon.quantity} × ₹{addon.unit_price.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <p className="font-semibold">
                        ₹{addon.total_price.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </SlideOverSection>
            )}

            {/* Payment Summary */}
            <SlideOverSection title="Payment Summary" icon={Receipt}>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{selectedOrder.amount.toLocaleString()}</span>
                </div>
                {selectedOrder.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax (GST)</span>
                    <span>₹{selectedOrder.tax_amount.toLocaleString()}</span>
                  </div>
                )}
                {selectedOrder.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-success">-₹{selectedOrder.discount_amount.toLocaleString()}</span>
                  </div>
                )}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total Paid</span>
                    <span className="text-primary">₹{selectedOrder.net_amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </SlideOverSection>

            {/* Payment Details */}
            <SlideOverSection title="Payment Details" icon={CreditCard}>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="capitalize">{selectedOrder.payment_method}</span>
                </div>
                {selectedOrder.razorpay_payment_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Razorpay ID</span>
                    <span className="font-mono text-xs">{selectedOrder.razorpay_payment_id}</span>
                  </div>
                )}
                {selectedOrder.completed_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid On</span>
                    <span>{format(new Date(selectedOrder.completed_at), "dd MMM yyyy, h:mm a")}</span>
                  </div>
                )}
              </div>
            </SlideOverSection>

            {/* Actions */}
            <SlideOverFooter>
              {(selectedOrder?.status === "failed" || selectedOrder?.status === "pending") && (
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (selectedOrder) {
                      setSelectedOrder(null)
                      openVerifyDialog(selectedOrder)
                    }
                  }}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Verify Payment
                </Button>
              )}
              <Button variant="outline" className="flex-1">
                <Send className="w-4 h-4 mr-2" />
                Send Receipt
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (selectedOrder) {
                    window.open(`/api/orders/${selectedOrder.id}/receipt`, "_blank")
                  }
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Receipt
              </Button>
            </SlideOverFooter>
          </div>
        )}
      </SlideOver>

      {/* Payment Verify Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Verify Payment
            </DialogTitle>
          </DialogHeader>

          {verifyOrder && (
            <div className="space-y-4">
              {/* Order Info */}
              <div className="bg-muted rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order</span>
                  <span className="font-medium">{verifyOrder.payment_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Customer</span>
                  <span>{verifyOrder.payer_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span>{verifyOrder.payer_email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">₹{verifyOrder.net_amount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium",
                    statusConfig[verifyOrder.status]?.color
                  )}>
                    {statusConfig[verifyOrder.status]?.label || verifyOrder.status}
                  </span>
                </div>
                {verifyOrder.razorpay_order_id && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Razorpay Order</span>
                    <span className="font-mono text-xs">{verifyOrder.razorpay_order_id}</span>
                  </div>
                )}
              </div>

              {/* Payment ID Input */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Razorpay Payment ID
                </label>
                <Input
                  value={verifyPaymentId}
                  onChange={(e) => setVerifyPaymentId(e.target.value)}
                  placeholder="pay_XXXXXXXXXXXXXX"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {verifyOrder.razorpay_payment_id
                    ? "Auto-filled from our records. You can change it if needed."
                    : "Enter the Razorpay Payment ID from the dashboard or customer."}
                </p>
              </div>

              {/* Verification Result */}
              {verifyResult && (
                <div className={cn(
                  "rounded-lg p-3 space-y-2",
                  verifyResult.verified ? "bg-emerald-50 border border-emerald-200" :
                  verifyResult.status === "already_completed" ? "bg-blue-50 border border-blue-200" :
                  "bg-red-50 border border-red-200"
                )}>
                  <div className="flex items-start gap-2">
                    {verifyResult.verified ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    ) : verifyResult.status === "already_completed" ? (
                      <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={cn(
                        "text-sm font-medium",
                        verifyResult.verified ? "text-emerald-700" :
                        verifyResult.status === "already_completed" ? "text-blue-700" :
                        "text-red-700"
                      )}>
                        {verifyResult.message}
                      </p>
                    </div>
                  </div>

                  {/* Gateway Details */}
                  {verifyResult.razorpay_payment_id && (
                    <div className="mt-2 pt-2 border-t border-current/10 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gateway Status</span>
                        <span className={cn(
                          "font-medium",
                          verifyResult.status === "captured" ? "text-emerald-600" :
                          verifyResult.status === "failed" ? "text-red-600" :
                          "text-amber-600"
                        )}>
                          {verifyResult.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gateway Amount</span>
                        <span>₹{verifyResult.amount?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment Method</span>
                        <span>{verifyResult.method || "--"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment ID</span>
                        <span className="font-mono">{verifyResult.razorpay_payment_id}</span>
                      </div>
                      {verifyResult.email && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Payer Email</span>
                          <span>{verifyResult.email}</span>
                        </div>
                      )}
                      {verifyResult.amount_mismatch && (
                        <div className="mt-1 p-2 bg-amber-100 rounded text-amber-700 font-medium">
                          {verifyResult.warning}
                        </div>
                      )}
                      {verifyResult.registrations_confirmed && (
                        <div className="mt-1 text-emerald-600 font-medium">
                          {verifyResult.registrations_confirmed} registration(s) confirmed
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>
              {verifyResult ? "Close" : "Cancel"}
            </Button>
            {(!verifyResult || !verifyResult.verified) && verifyResult?.status !== "already_completed" && (
              <Button
                onClick={handleVerifyPayment}
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Verify with Razorpay
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
