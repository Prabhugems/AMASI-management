"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  Search,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  CreditCard,
  Calendar,
  MapPin,
  Ticket,
  User,
  Mail,
  Phone,
  Building2,
  RefreshCw,
  Download,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface Registration {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone?: string
  attendee_designation?: string
  attendee_institution?: string
  status: string
  total_amount: number
  checked_in: boolean
  badge_url?: string
  certificate_url?: string
  ticket_type?: { id: string; name: string; price: number }
  event?: {
    id: string
    name: string
    start_date: string
    end_date: string
    venue?: string
    city?: string
  }
  payment?: {
    id: string
    payment_number: string
    status: string
    net_amount: number
    razorpay_order_id?: string
  }
}

declare global {
  interface Window {
    Razorpay: any
  }
}

function StatusPageContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get("q") || ""

  const [query, setQuery] = useState(initialQuery)
  const [loading, setLoading] = useState(false)
  const [registration, setRegistration] = useState<Registration | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)

  const searchRegistration = async () => {
    if (!query.trim()) {
      toast.error("Please enter email or registration number")
      return
    }

    setLoading(true)
    setError(null)
    setRegistration(null)

    try {
      const res = await fetch(`/api/public/registration-status?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Registration not found")
        return
      }

      setRegistration(data.registration)
    } catch (err) {
      setError("Failed to search. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleRetryPayment = async () => {
    if (!registration || !registration.payment) return

    setPaymentLoading(true)

    try {
      // Create new Razorpay order for retry
      const res = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: registration.payment.net_amount,
          currency: "INR",
          event_id: registration.event?.id,
          payer_name: registration.attendee_name,
          payer_email: registration.attendee_email,
          payer_phone: registration.attendee_phone || "",
          tickets: registration.ticket_type ? [{ id: registration.ticket_type.id, quantity: 1 }] : [],
          metadata: {
            registration_id: registration.id,
            payment_id: registration.payment.id,
            retry: true,
          },
        }),
      })

      const orderData = await res.json()

      if (!res.ok) {
        throw new Error(orderData.error || "Failed to create payment order")
      }

      // Load Razorpay script if not loaded
      if (!window.Razorpay) {
        const script = document.createElement("script")
        script.src = "https://checkout.razorpay.com/v1/checkout.js"
        script.async = true
        document.body.appendChild(script)
        await new Promise((resolve) => (script.onload = resolve))
      }

      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: registration.event?.name || "Event Registration",
        description: `Payment for ${registration.ticket_type?.name || "Registration"}`,
        order_id: orderData.order_id,
        prefill: {
          name: registration.attendee_name,
          email: registration.attendee_email,
          contact: registration.attendee_phone || "",
        },
        handler: async (response: any) => {
          // Verify payment
          const verifyRes = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              registration_id: registration.id,
            }),
          })

          if (verifyRes.ok) {
            toast.success("Payment successful! Your registration is confirmed.")
            // Refresh registration data
            searchRegistration()
          } else {
            toast.error("Payment verification failed. Please contact support.")
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentLoading(false)
          },
        },
        theme: {
          color: "#3b82f6",
        },
      }

      const razorpay = new window.Razorpay(options)
      razorpay.open()
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate payment")
    } finally {
      setPaymentLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "confirmed":
        return { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100", label: "Confirmed" }
      case "pending":
        return { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100", label: "Pending Payment" }
      case "failed":
        return { icon: XCircle, color: "text-red-600", bg: "bg-red-100", label: "Payment Failed" }
      case "cancelled":
        return { icon: XCircle, color: "text-gray-600", bg: "bg-gray-100", label: "Cancelled" }
      default:
        return { icon: AlertCircle, color: "text-gray-600", bg: "bg-gray-100", label: status }
    }
  }

  const canRetryPayment = registration?.status === "pending" || registration?.status === "failed"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Registration Status</h1>
          <p className="text-gray-600 mt-1">Check your registration status and payment details</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Search Box */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enter your Email or Registration Number
          </label>
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="email@example.com or REG-12345"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchRegistration()}
              className="flex-1"
            />
            <Button onClick={searchRegistration} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Search</span>
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <h3 className="font-semibold text-red-800 mb-1">Registration Not Found</h3>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Registration Details */}
        {registration && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {/* Status Banner */}
            {(() => {
              const statusConfig = getStatusConfig(registration.status)
              const StatusIcon = statusConfig.icon
              return (
                <div className={`${statusConfig.bg} px-6 py-4 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-6 w-6 ${statusConfig.color}`} />
                    <div>
                      <p className={`font-semibold ${statusConfig.color}`}>{statusConfig.label}</p>
                      <p className="text-sm text-gray-600">Reg #{registration.registration_number}</p>
                    </div>
                  </div>
                  {canRetryPayment && (
                    <Button onClick={handleRetryPayment} disabled={paymentLoading} size="sm">
                      {paymentLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      Pay Now
                    </Button>
                  )}
                </div>
              )
            })()}

            {/* Attendee Info */}
            <div className="p-6 border-b">
              <h3 className="font-semibold text-lg text-gray-900 mb-4">{registration.attendee_name}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span>{registration.attendee_email}</span>
                </div>
                {registration.attendee_phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{registration.attendee_phone}</span>
                  </div>
                )}
                {registration.attendee_designation && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="h-4 w-4" />
                    <span>{registration.attendee_designation}</span>
                  </div>
                )}
                {registration.attendee_institution && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Building2 className="h-4 w-4" />
                    <span>{registration.attendee_institution}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Event Info */}
            {registration.event && (
              <div className="p-6 border-b bg-gray-50">
                <h4 className="font-medium text-gray-900 mb-3">{registration.event.name}</h4>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {formatDate(registration.event.start_date)} - {formatDate(registration.event.end_date)}
                    </span>
                  </div>
                  {(registration.event.venue || registration.event.city) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{registration.event.venue || registration.event.city}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ticket & Payment Info */}
            <div className="p-6">
              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex items-center gap-2 text-gray-600">
                  <Ticket className="h-4 w-4" />
                  <span>Ticket Type</span>
                </div>
                <span className="font-medium">{registration.ticket_type?.name || "General"}</span>
              </div>

              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex items-center gap-2 text-gray-600">
                  <CreditCard className="h-4 w-4" />
                  <span>Amount</span>
                </div>
                <span className="font-semibold text-lg">{registration.total_amount.toLocaleString()}</span>
              </div>

              {registration.payment && (
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2 text-gray-600">
                    <RefreshCw className="h-4 w-4" />
                    <span>Payment Status</span>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      registration.payment.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : registration.payment.status === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {registration.payment.status}
                  </span>
                </div>
              )}
            </div>

            {/* Downloads */}
            {registration.status === "confirmed" && (registration.badge_url || registration.certificate_url) && (
              <div className="p-6 bg-gray-50 border-t">
                <h4 className="font-medium text-gray-900 mb-3">Downloads</h4>
                <div className="flex gap-3">
                  {registration.badge_url && (
                    <a
                      href={registration.badge_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4" />
                      Download Badge
                    </a>
                  )}
                  {registration.certificate_url && (
                    <a
                      href={registration.certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4" />
                      Download Certificate
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Retry Payment CTA */}
            {canRetryPayment && (
              <div className="p-6 bg-amber-50 border-t">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-amber-800">Payment Required</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Your registration is not yet confirmed. Please complete the payment to confirm your spot.
                    </p>
                    <Button onClick={handleRetryPayment} disabled={paymentLoading} className="mt-3">
                      {paymentLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      Complete Payment - {registration.total_amount.toLocaleString()}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Help Text */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Can't find your registration? Contact the event organizers for assistance.</p>
        </div>
      </div>
    </div>
  )
}

export default function RegistrationStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <StatusPageContent />
    </Suspense>
  )
}
