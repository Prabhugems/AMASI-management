"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import Script from "next/script"
import {
  ArrowLeft,
  User,
  Plus,
  Trash2,
  Users,
  Loader2,
  Shield,
  Tag,
  CheckCircle,
  AlertCircle,
  Edit2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

declare global {
  interface Window {
    Razorpay: any
  }
}

interface TicketType {
  id: string
  name: string
  price: number
  tax_percentage: number
  description?: string
}

interface AttendeeData {
  id: string
  name: string
  email: string
  phone: string
  ticketType: TicketType
  designation?: string
  institution?: string
}

interface CheckoutData {
  selection: { ticketId: string; quantity: number }[]
  totals: { subtotal: number; tax: number; total: number; count: number }
  registrationType: string
}

export default function GroupRegistrationPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [discountCode, setDiscountCode] = useState("")
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false)
  const [discountApplied, setDiscountApplied] = useState<{
    id: string
    amount: number
    code: string
  } | null>(null)
  const [discountError, setDiscountError] = useState("")
  const [error, setError] = useState("")
  const [isAddingAttendee, setIsAddingAttendee] = useState(false)
  const [editingAttendee, setEditingAttendee] = useState<AttendeeData | null>(null)
  const [attendees, setAttendees] = useState<AttendeeData[]>([])

  const router = useRouter()
  const params = useParams()
  const eventSlug = params.eventSlug as string
  const supabase = createClient()

  // Buyer form data
  const [buyerData, setBuyerData] = useState({
    name: "",
    email: "",
    phone: "",
    institution: "",
    department: "",
  })

  // New attendee form data
  const [newAttendee, setNewAttendee] = useState({
    name: "",
    email: "",
    phone: "",
    ticketTypeId: "",
    designation: "",
    institution: "",
  })

  // Get checkout data from session storage
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem(`checkout_${eventSlug}`)
    if (!stored) {
      router.push(`/register/${eventSlug}`)
      return
    }
    const data = JSON.parse(stored)
    if (data.registrationType !== "group") {
      router.push(`/register/${eventSlug}/checkout`)
      return
    }
    setCheckoutData(data)
  }, [eventSlug, router])

  // Fetch event details
  const { data: event, isLoading } = useQuery({
    queryKey: ["group-checkout-event", eventSlug],
    queryFn: async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventSlug)

      let query = supabase
        .from("events")
        .select(`*, ticket_types (*)`)

      if (isUuid) {
        query = query.eq("id", eventSlug)
      } else {
        query = query.eq("slug", eventSlug)
      }

      const { data, error } = await query.maybeSingle()
      if (error) throw error

      return data as any
    },
    enabled: !!eventSlug,
  })

  // Get available tickets (those selected in the first step)
  const availableTickets = useMemo(() => {
    if (!checkoutData || !event?.ticket_types) return []

    const selectedTicketIds = checkoutData.selection.map(s => s.ticketId)
    return event.ticket_types.filter((t: TicketType) =>
      selectedTicketIds.includes(t.id)
    )
  }, [checkoutData, event?.ticket_types])

  // Calculate attendee total
  const calculateAttendeeTotal = (attendee: AttendeeData) => {
    const tax = (attendee.ticketType.price * attendee.ticketType.tax_percentage) / 100
    return attendee.ticketType.price + tax
  }

  // Calculate grand total
  const totals = useMemo(() => {
    let subtotal = 0
    let tax = 0

    attendees.forEach((att) => {
      subtotal += att.ticketType.price
      tax += (att.ticketType.price * att.ticketType.tax_percentage) / 100
    })

    const discount = discountApplied?.amount || 0
    return {
      subtotal,
      tax,
      discount,
      total: Math.max(0, subtotal + tax - discount),
      count: attendees.length,
    }
  }, [attendees, discountApplied])

  // Add attendee
  const handleAddAttendee = () => {
    if (!newAttendee.name || !newAttendee.email || !newAttendee.ticketTypeId) {
      toast.error("Please fill in name, email, and select a ticket type")
      return
    }

    const ticket = availableTickets.find((t: TicketType) => t.id === newAttendee.ticketTypeId)
    if (!ticket) {
      toast.error("Invalid ticket type")
      return
    }

    const attendee: AttendeeData = {
      id: Date.now().toString(),
      name: newAttendee.name,
      email: newAttendee.email,
      phone: newAttendee.phone,
      ticketType: ticket,
      designation: newAttendee.designation,
      institution: newAttendee.institution,
    }

    if (editingAttendee) {
      setAttendees(attendees.map(a => a.id === editingAttendee.id ? { ...attendee, id: editingAttendee.id } : a))
      setEditingAttendee(null)
    } else {
      setAttendees([...attendees, attendee])
    }

    setNewAttendee({
      name: "",
      email: "",
      phone: "",
      ticketTypeId: "",
      designation: "",
      institution: "",
    })
    setIsAddingAttendee(false)
  }

  // Remove attendee
  const handleRemoveAttendee = (id: string) => {
    setAttendees(attendees.filter(a => a.id !== id))
  }

  // Edit attendee
  const handleEditAttendee = (attendee: AttendeeData) => {
    setNewAttendee({
      name: attendee.name,
      email: attendee.email,
      phone: attendee.phone,
      ticketTypeId: attendee.ticketType.id,
      designation: attendee.designation || "",
      institution: attendee.institution || "",
    })
    setEditingAttendee(attendee)
    setIsAddingAttendee(true)
  }

  // Validate discount code
  const validateDiscountCode = async () => {
    if (!discountCode.trim()) return

    setIsValidatingDiscount(true)
    setDiscountError("")

    try {
      const response = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: discountCode,
          event_id: event?.id,
          order_amount: totals.subtotal + totals.tax,
        }),
      })

      const data = await response.json()

      if (data.valid) {
        setDiscountApplied({
          id: data.discount.id,
          code: data.discount.code,
          amount: data.discount.calculated_discount,
        })
        setDiscountError("")
        toast.success("Discount applied!")
      } else {
        setDiscountError(data.error || "Invalid discount code")
        setDiscountApplied(null)
      }
    } catch (_err) {
      setDiscountError("Failed to validate discount code")
    } finally {
      setIsValidatingDiscount(false)
    }
  }

  // Validate form
  const validateForm = (): boolean => {
    if (!buyerData.name.trim()) {
      setError("Buyer name is required")
      return false
    }
    if (!buyerData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerData.email)) {
      setError("Valid buyer email is required")
      return false
    }
    if (attendees.length === 0) {
      setError("Please add at least one attendee")
      return false
    }
    setError("")
    return true
  }

  // Handle payment
  const handlePayment = async () => {
    if (!validateForm()) return
    if (!event) return

    setIsSubmitting(true)
    setError("")

    try {
      // Create group registration
      const payload = {
        event_id: event.id,
        buyer: {
          name: buyerData.name,
          email: buyerData.email,
          phone: buyerData.phone,
          form_data: {
            institution: buyerData.institution,
            department: buyerData.department,
          },
        },
        attendees: attendees.map(att => ({
          name: att.name,
          email: att.email,
          phone: att.phone,
          ticket_type_id: att.ticketType.id,
          form_data: {
            designation: att.designation,
            institution: att.institution,
          },
        })),
        discount_code: discountApplied?.code,
        total_amount: totals.total,
      }

      // Handle FREE registration
      if (totals.total === 0) {
        const response = await fetch("/api/registrations/group", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, payment_method: "free" }),
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error)

        sessionStorage.removeItem(`checkout_${eventSlug}`)
        router.push(`/register/success?order=${data.order_number}&email=${buyerData.email}&type=group`)
        return
      }

      // Create Razorpay order
      const orderResponse = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totals.total,
          currency: "INR",
          payment_type: "group_registration",
          event_id: event.id,
          payer_name: buyerData.name,
          payer_email: buyerData.email,
          payer_phone: buyerData.phone,
          discount_code: discountApplied?.code,
          metadata: {
            buyer: buyerData,
            attendees_count: attendees.length,
            totals,
          },
        }),
      })

      const orderData = await orderResponse.json()

      if (!orderData.success) {
        throw new Error(orderData.error || "Failed to create order")
      }

      // Initialize Razorpay
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "AMASI",
        description: `Group Registration for ${event.name}`,
        order_id: orderData.order_id,
        prefill: {
          name: buyerData.name,
          email: buyerData.email,
          contact: buyerData.phone,
        },
        theme: {
          color: "#8B5CF6",
        },
        handler: async (response: any) => {
          // Verify payment
          const verifyResponse = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          })

          const verifyData = await verifyResponse.json()

          if (verifyData.success) {
            // Create group registration after successful payment
            const regResponse = await fetch("/api/registrations/group", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...payload,
                payment_method: "razorpay",
                payment_id: verifyData.payment_id,
              }),
            })

            const regData = await regResponse.json()
            if (!regResponse.ok) throw new Error(regData.error)

            sessionStorage.removeItem(`checkout_${eventSlug}`)
            router.push(`/register/success?order=${regData.order_number}&email=${buyerData.email}&type=group`)
          } else {
            setError("Payment verification failed. Please contact support.")
          }
        },
        modal: {
          ondismiss: () => {
            setIsSubmitting(false)
          },
        },
      }

      const razorpay = new window.Razorpay(options)
      razorpay.open()
    } catch (err: any) {
      console.error("Payment error:", err)
      setError(err.message || "Payment failed. Please try again.")
      setIsSubmitting(false)
    }
  }

  if (isLoading || !checkoutData) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-1/3 rounded bg-gray-200" />
            <div className="h-64 rounded-xl bg-gray-200" />
          </div>
        </div>
      </div>
    )
  }

  // Check if registration is closed
  if (event?.registration_open === false) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-lg mx-auto text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Registration Closed</h1>
            <p className="text-gray-600 mb-6">
              Registration for this event is currently closed. Please check back later or contact the organizers for more information.
            </p>
            <Link
              href={`/register/${eventSlug}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Event
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const inputClassName = `
    w-full px-4 py-3 rounded-lg border transition-all duration-300
    bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500
    focus:outline-none focus:ring-2 focus:ring-emerald-100
  `

  const labelClassName = "block text-sm font-medium mb-2 text-gray-700"

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Link
          href={`/register/${eventSlug}?type=group`}
          className="inline-flex items-center gap-2 mb-6 text-sm font-medium text-gray-600 transition-colors hover:text-emerald-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to event
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Group Registration
                  </h1>
                  <p className="text-sm text-gray-500">
                    {event?.name}
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Buyer Details */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
                <User className="w-5 h-5 text-emerald-600" />
                Your Details (Coordinator/Buyer)
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                You will receive all tickets and payment receipts
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClassName}>Full Name *</label>
                  <Input
                    value={buyerData.name}
                    onChange={(e) => setBuyerData({ ...buyerData, name: e.target.value })}
                    placeholder="Dr. Priya Sharma"
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Email *</label>
                  <Input
                    type="email"
                    value={buyerData.email}
                    onChange={(e) => setBuyerData({ ...buyerData, email: e.target.value })}
                    placeholder="priya@aiims.edu"
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Phone</label>
                  <Input
                    value={buyerData.phone}
                    onChange={(e) => setBuyerData({ ...buyerData, phone: e.target.value })}
                    placeholder="+91 99887 76655"
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Institution</label>
                  <Input
                    value={buyerData.institution}
                    onChange={(e) => setBuyerData({ ...buyerData, institution: e.target.value })}
                    placeholder="AIIMS Delhi"
                    className={inputClassName}
                  />
                </div>
              </div>
            </div>

            {/* Attendees Section */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                    <Users className="w-5 h-5 text-emerald-600" />
                    Attendees ({attendees.length} added)
                  </h2>
                  <p className="text-sm text-gray-500">
                    Add details for each person attending
                  </p>
                </div>
                <Button onClick={() => setIsAddingAttendee(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Attendee
                </Button>
              </div>

              {attendees.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No attendees added yet</p>
                  <p className="text-sm">Click "Add Attendee" to start</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {attendees.map((attendee, index) => (
                    <div
                      key={attendee.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {index + 1}. {attendee.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {attendee.ticketType.name} • ₹{attendee.ticketType.price.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400">
                          {attendee.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-gray-900">
                          ₹{calculateAttendeeTotal(attendee).toLocaleString()}
                        </p>
                        <button
                          onClick={() => handleEditAttendee(attendee)}
                          className="p-2 text-gray-400 hover:text-gray-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveAttendee(attendee.id)}
                          className="p-2 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm sticky top-24 overflow-hidden">
              <div className="p-5 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">
                  Order Summary
                </h3>
                <p className="text-sm text-gray-600">
                  {event?.name}
                </p>
              </div>

              <div className="p-5 space-y-4">
                {attendees.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">
                    Add attendees to see order summary
                  </p>
                ) : (
                  <>
                    {/* Attendee List */}
                    {attendees.map((attendee, index) => (
                      <div key={attendee.id} className="flex justify-between text-sm">
                        <span className="text-gray-500">
                          {index + 1}. {attendee.name}
                        </span>
                        <span className="text-gray-900">
                          ₹{calculateAttendeeTotal(attendee).toLocaleString()}
                        </span>
                      </div>
                    ))}

                    {/* Discount Code */}
                    {event?.discount_enabled && (
                      <div className="pt-4 border-t border-gray-200">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Discount code"
                              value={discountCode}
                              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm bg-white border border-gray-200 text-gray-900"
                            />
                          </div>
                          <button
                            onClick={validateDiscountCode}
                            disabled={isValidatingDiscount || !discountCode.trim()}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {isValidatingDiscount ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Apply"
                            )}
                          </button>
                        </div>
                        {discountApplied && (
                          <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Discount applied: -₹{discountApplied.amount.toLocaleString()}
                          </p>
                        )}
                        {discountError && (
                          <p className="text-sm text-red-600 mt-2">{discountError}</p>
                        )}
                      </div>
                    )}

                    {/* Totals */}
                    <div className="pt-4 border-t border-gray-200 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Subtotal ({totals.count} attendees)</span>
                        <span className="text-gray-900">
                          ₹{totals.subtotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">GST</span>
                        <span className="text-gray-900">
                          ₹{totals.tax.toLocaleString()}
                        </span>
                      </div>
                      {totals.discount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600">Discount</span>
                          <span className="text-green-600">-₹{totals.discount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold pt-4 border-t border-gray-200">
                        <span className="text-gray-900">Grand Total</span>
                        <span className="text-emerald-600">₹{totals.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Pay Button */}
              <div className="p-5 pt-0">
                <Button
                  onClick={handlePayment}
                  disabled={isSubmitting || attendees.length === 0}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : totals.total === 0 ? (
                    "Complete Free Registration"
                  ) : (
                    <>
                      <Shield className="w-5 h-5 mr-2" />
                      Pay ₹{totals.total.toLocaleString()}
                    </>
                  )}
                </Button>
                <p className="text-center text-xs mt-3 text-gray-500">
                  Secure payment powered by Razorpay
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Attendee Modal */}
      <Dialog open={isAddingAttendee} onOpenChange={setIsAddingAttendee}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAttendee ? "Edit Attendee" : "Add Attendee"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Ticket Type Selection */}
            <div>
              <label className={labelClassName}>Ticket Type *</label>
              <select
                value={newAttendee.ticketTypeId}
                onChange={(e) => setNewAttendee({ ...newAttendee, ticketTypeId: e.target.value })}
                className={inputClassName}
              >
                <option value="">Select Ticket</option>
                {availableTickets.map((ticket: TicketType) => (
                  <option key={ticket.id} value={ticket.id}>
                    {ticket.name} - ₹{ticket.price.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClassName}>Full Name *</label>
                <Input
                  value={newAttendee.name}
                  onChange={(e) => setNewAttendee({ ...newAttendee, name: e.target.value })}
                  placeholder="Dr. Amit Verma"
                />
              </div>

              <div>
                <label className={labelClassName}>Email *</label>
                <Input
                  type="email"
                  value={newAttendee.email}
                  onChange={(e) => setNewAttendee({ ...newAttendee, email: e.target.value })}
                  placeholder="amit@hospital.com"
                />
              </div>

              <div>
                <label className={labelClassName}>Phone</label>
                <Input
                  value={newAttendee.phone}
                  onChange={(e) => setNewAttendee({ ...newAttendee, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className={labelClassName}>Designation</label>
                <Input
                  value={newAttendee.designation}
                  onChange={(e) => setNewAttendee({ ...newAttendee, designation: e.target.value })}
                  placeholder="Senior Surgeon"
                />
              </div>

              <div className="col-span-2">
                <label className={labelClassName}>Institution</label>
                <Input
                  value={newAttendee.institution}
                  onChange={(e) => setNewAttendee({ ...newAttendee, institution: e.target.value })}
                  placeholder="Apollo Hospital"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddingAttendee(false)
                  setEditingAttendee(null)
                  setNewAttendee({
                    name: "",
                    email: "",
                    phone: "",
                    ticketTypeId: "",
                    designation: "",
                    institution: "",
                  })
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleAddAttendee} className="flex-1">
                {editingAttendee ? "Update Attendee" : "Add Attendee"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
