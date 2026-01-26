"use client"

import { useState } from "react"
import Script from "next/script"
import {
  Search,
  Loader2,
  User,
  Building2,
  Ticket,
  Calendar,
  MapPin,
  Download,
  Award,
  FileText,
  CheckCircle,
  Clock,
  Mail,
  Phone,
  QrCode,
  ArrowRight,
  RefreshCw,
  CalendarDays,
  ExternalLink,
  Receipt,
  Package,
  Plus,
  ShoppingCart,
  CreditCard,
  AlertCircle,
} from "lucide-react"

interface RegistrationAddon {
  id: string
  quantity: number
  unit_price: number
  total_price: number
  addon?: { id: string; name: string; is_course?: boolean }
  addon_variant?: { id: string; name: string }
}

interface Payment {
  id: string
  payment_number: string
  amount: number
  status: string
  razorpay_payment_id?: string
  completed_at?: string
}

interface PendingPayment {
  id: string
  payment_number: string
  payer_name: string
  payer_email: string
  amount: number
  status: string
  payment_method: string
  razorpay_order_id?: string
  created_at: string
  event_id: string
  events?: { name: string; short_name?: string }
}

interface Registration {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone?: string
  attendee_designation?: string
  attendee_institution?: string
  status: string
  payment_status?: string
  total_amount?: number
  checked_in: boolean
  checked_in_at?: string
  badge_generated_at?: string
  badge_url?: string
  certificate_generated_at?: string
  certificate_url?: string
  checkin_token?: string
  ticket_type?: { id: string; name: string; price?: number }
  event?: {
    id: string
    name: string
    short_name?: string
    start_date: string
    end_date: string
    venue_name?: string
    city?: string
    logo_url?: string
    banner_url?: string
  }
  payment?: Payment
  addons?: RegistrationAddon[]
}

declare global {
  interface Window {
    Razorpay: any
  }
}

export default function DelegatePortalPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([])
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null)
  const [downloadingBadge, setDownloadingBadge] = useState(false)
  const [downloadingCert, setDownloadingCert] = useState(false)
  const [downloadingReceipt, setDownloadingReceipt] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)

  const handleRetryPayment = async (reg: Registration) => {
    if (!reg.total_amount || reg.total_amount <= 0) return

    setPaymentLoading(true)

    try {
      // Create new Razorpay order for retry
      const res = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: reg.total_amount,
          currency: "INR",
          event_id: reg.event?.id,
          payer_name: reg.attendee_name,
          payer_email: reg.attendee_email,
          payer_phone: reg.attendee_phone,
          metadata: {
            registration_id: reg.id,
            retry: true,
          },
        }),
      })

      const orderData = await res.json()

      if (!res.ok || !orderData.success) {
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
        name: reg.event?.name || "Event Registration",
        description: `Payment for ${reg.ticket_type?.name || "Registration"}`,
        order_id: orderData.order_id,
        prefill: {
          name: reg.attendee_name,
          email: reg.attendee_email,
          contact: reg.attendee_phone || "",
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
            }),
          })

          if (verifyRes.ok) {
            alert("Payment successful! Your registration is confirmed.")
            // Refresh registration data
            const form = document.createElement("form")
            form.style.display = "none"
            document.body.appendChild(form)
            window.location.reload()
          } else {
            alert("Payment verification failed. Please contact support.")
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentLoading(false)
          },
        },
        theme: {
          color: "#6366F1",
        },
      }

      const razorpay = new window.Razorpay(options)
      razorpay.open()
    } catch (err: any) {
      alert(err.message || "Failed to initiate payment")
      setPaymentLoading(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setLoading(true)
    setError(null)
    setSelectedRegistration(null)
    setPendingPayments([])

    try {
      const res = await fetch(`/api/my?q=${encodeURIComponent(searchQuery.trim())}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Registration not found")
      }

      setRegistrations(data.registrations || [])
      setPendingPayments(data.pending_payments || [])

      // If only one registration, select it automatically
      if (data.registrations?.length === 1) {
        setSelectedRegistration(data.registrations[0])
      }
    } catch (err: any) {
      setError(err.message)
      setRegistrations([])
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadBadge = async () => {
    if (!selectedRegistration) return

    setDownloadingBadge(true)
    try {
      const token = selectedRegistration.checkin_token || selectedRegistration.registration_number
      const res = await fetch(`/api/badge/${token}/download`)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to download badge")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `badge-${selectedRegistration.registration_number}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setDownloadingBadge(false)
    }
  }

  const handleDownloadCertificate = async () => {
    if (!selectedRegistration) return

    setDownloadingCert(true)
    try {
      if (selectedRegistration.certificate_url) {
        window.open(selectedRegistration.certificate_url, "_blank")
      } else {
        // Generate certificate on the fly
        const res = await fetch(`/api/certificate/${selectedRegistration.registration_number}/download`)

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Certificate not available yet")
        }

        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `certificate-${selectedRegistration.registration_number}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setDownloadingCert(false)
    }
  }

  const handleDownloadReceipt = async () => {
    if (!selectedRegistration) return

    setDownloadingReceipt(true)
    try {
      const res = await fetch(`/api/receipt/${selectedRegistration.registration_number}`)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to download receipt")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `receipt-${selectedRegistration.registration_number}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setDownloadingReceipt(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  // Search/Entry View
  if (registrations.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
              <User className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Delegate Portal</h1>
            <p className="text-white/70">Access your badge, certificate & event details</p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-2xl p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter your Email, Phone, or Registration Number
            </label>
            <div className="relative mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="email@example.com or 9876543210"
                className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-center"
                autoFocus
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            {/* Show pending payments if registration not found */}
            {pendingPayments.length > 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                  <Clock className="w-4 h-4" />
                  Payment Pending
                </div>
                <p className="text-sm text-amber-600 mb-3">
                  We found {pendingPayments.length} incomplete payment(s). Your payment may not have completed successfully.
                </p>
                {pendingPayments.map((p) => (
                  <div key={p.id} className="text-xs bg-white p-2 rounded border border-amber-100 mb-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{p.events?.name || "Event"}</span>
                      <span className="font-medium">Rs.{p.amount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="text-gray-500 mt-1">
                      {new Date(p.created_at).toLocaleDateString("en-IN")} - {p.payment_number}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-amber-600 mt-2">
                  If amount was deducted, please contact support with payment details.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !searchQuery.trim()}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Looking up...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Find My Registration
                </>
              )}
            </button>

            <p className="text-center text-sm text-gray-500 mt-4">
              Use the email or phone you registered with
            </p>
          </form>
        </div>
      </div>
    )
  }

  // Multiple Events Selection View
  if (registrations.length > 1 && !selectedRegistration) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-4 py-8">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Back Button */}
          <button
            onClick={() => {
              setRegistrations([])
              setSearchQuery("")
            }}
            className="text-white/70 hover:text-white flex items-center gap-2 text-sm mb-4"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Search again
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Welcome, {registrations[0].attendee_name}!
            </h1>
            <p className="text-white/70">You have {registrations.length} event registrations</p>
          </div>

          {/* Event List */}
          <div className="space-y-3">
            {registrations.map((reg) => (
              <button
                key={reg.id}
                onClick={() => setSelectedRegistration(reg)}
                className="w-full bg-white rounded-xl p-4 text-left hover:shadow-xl transition-all group"
              >
                <div className="flex items-center gap-4">
                  {reg.event?.logo_url ? (
                    <img
                      src={reg.event.logo_url}
                      alt={reg.event.name}
                      className="w-14 h-14 rounded-lg object-contain bg-gray-100"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
                      {(reg.event?.short_name || reg.event?.name || "E")[0]}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {reg.event?.short_name || reg.event?.name}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {reg.event?.start_date ? formatDate(reg.event.start_date) : "TBA"}
                      </span>
                      {reg.event?.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {reg.event.city}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 font-mono mt-1">{reg.registration_number}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Delegate Info View
  const registration = selectedRegistration!
  const event = registration.event

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-4 py-8">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Back Button */}
        <button
          onClick={() => {
            if (registrations.length > 1) {
              setSelectedRegistration(null)
            } else {
              setRegistrations([])
              setSelectedRegistration(null)
              setSearchQuery("")
            }
          }}
          className="text-white/70 hover:text-white flex items-center gap-2 text-sm mb-4"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          {registrations.length > 1 ? "Back to my events" : "Search another registration"}
        </button>

        {/* Event Banner */}
        {event && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {event.banner_url ? (
              <div
                className="h-32 bg-cover bg-center"
                style={{ backgroundImage: `url(${event.banner_url})` }}
              />
            ) : (
              <div className="h-32 bg-gradient-to-r from-indigo-600 to-purple-600" />
            )}
            <div className="p-4 -mt-8 relative">
              <div className="flex items-end gap-4">
                {event.logo_url ? (
                  <img
                    src={event.logo_url}
                    alt={event.name}
                    className="w-16 h-16 rounded-xl bg-white shadow-lg object-contain border-2 border-white"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-indigo-600 shadow-lg flex items-center justify-center text-white text-2xl font-bold border-2 border-white">
                    {(event.short_name || event.name)[0]}
                  </div>
                )}
                <div className="flex-1 pb-1">
                  <h2 className="font-bold text-gray-900">{event.short_name || event.name}</h2>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(event.start_date)}
                    </span>
                    {event.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.city}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delegate Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-3xl font-bold">
              {registration.attendee_name.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{registration.attendee_name}</h1>
            {registration.attendee_designation && (
              <p className="text-gray-600">{registration.attendee_designation}</p>
            )}
            {registration.attendee_institution && (
              <p className="text-gray-500 text-sm flex items-center justify-center gap-1 mt-1">
                <Building2 className="w-4 h-4" />
                {registration.attendee_institution}
              </p>
            )}
          </div>

          {/* Registration Number */}
          <div className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-xl p-4 text-center mb-6">
            <p className="text-xs text-indigo-600 font-medium mb-1">REGISTRATION NUMBER</p>
            <p className="text-2xl font-mono font-bold text-indigo-700 tracking-wider">
              {registration.registration_number}
            </p>
          </div>

          {/* Status & Details */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600 flex items-center gap-2">
                <Ticket className="w-4 h-4" />
                Ticket Type
              </span>
              <span className="font-medium">{registration.ticket_type?.name || "General"}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Status
              </span>
              <span
                className={`font-medium px-2 py-0.5 rounded-full text-sm ${
                  registration.status === "confirmed"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {registration.status === "confirmed" ? "Confirmed" : registration.status}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600 flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Payment
              </span>
              <span
                className={`font-medium px-2 py-0.5 rounded-full text-sm ${
                  registration.payment_status === "completed"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {registration.payment_status === "completed" ? "Paid" : "Pending"}
              </span>
            </div>

            {/* Payment Retry Section */}
            {registration.payment_status !== "completed" && registration.total_amount && registration.total_amount > 0 && (
              <div className="py-3 px-4 bg-amber-50 rounded-xl my-3">
                <div className="flex items-center gap-2 text-amber-700 mb-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium text-sm">Payment Required</span>
                </div>
                <p className="text-xs text-amber-600 mb-3">
                  Complete payment to confirm your registration.
                </p>
                <button
                  onClick={() => handleRetryPayment(registration)}
                  disabled={paymentLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
                >
                  {paymentLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Pay Rs.{registration.total_amount.toLocaleString("en-IN")}
                    </>
                  )}
                </button>
              </div>
            )}

            {registration.total_amount && registration.total_amount > 0 && (
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600 flex items-center gap-2">
                  Amount
                </span>
                <span className="font-medium">Rs.{registration.total_amount.toLocaleString("en-IN")}</span>
              </div>
            )}

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600 flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                Check-in
              </span>
              {registration.checked_in ? (
                <span className="text-green-600 font-medium text-sm">
                  {registration.checked_in_at ? formatDateTime(registration.checked_in_at) : "Yes"}
                </span>
              ) : (
                <span className="text-gray-500 text-sm">Not yet</span>
              )}
            </div>

            {registration.attendee_email && (
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </span>
                <span className="text-sm text-gray-700">{registration.attendee_email}</span>
              </div>
            )}

            {registration.attendee_phone && (
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone
                </span>
                <span className="text-sm text-gray-700">{registration.attendee_phone}</span>
              </div>
            )}
          </div>

          {/* Purchased Addons */}
          <div className="border-t border-gray-100 pt-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Purchased Add-ons</h3>
              {registration.status === "confirmed" && event && (
                <a
                  href={`/my/addons?reg=${registration.registration_number}&event=${event.id}`}
                  className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Buy More
                </a>
              )}
            </div>
            {registration.addons && registration.addons.length > 0 ? (
              <div className="space-y-2">
                {registration.addons.map((regAddon) => (
                  <div
                    key={regAddon.id}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700 font-medium">
                        {regAddon.addon?.name}
                        {regAddon.addon_variant && (
                          <span className="text-gray-500 text-sm ml-1">
                            ({regAddon.addon_variant.name})
                          </span>
                        )}
                      </span>
                      {regAddon.quantity > 1 && (
                        <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                          x{regAddon.quantity}
                        </span>
                      )}
                    </div>
                    {regAddon.total_price > 0 && (
                      <span className="text-sm text-gray-600">
                        Rs.{regAddon.total_price.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No add-ons purchased yet</p>
                {registration.status === "confirmed" && event && (
                  <a
                    href={`/my/addons?reg=${registration.registration_number}&event=${event.id}`}
                    className="inline-flex items-center gap-1 mt-2 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Browse Available Add-ons
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Download Buttons */}
        <div className="grid grid-cols-3 gap-3">
          {/* Badge Download */}
          <button
            onClick={handleDownloadBadge}
            disabled={downloadingBadge || registration.status !== "confirmed"}
            className="bg-white rounded-2xl shadow-xl p-6 text-center hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-indigo-200 transition-colors">
              {downloadingBadge ? (
                <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin" />
              ) : (
                <FileText className="w-7 h-7 text-indigo-600" />
              )}
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Badge</h3>
            {registration.badge_generated_at ? (
              <p className="text-xs text-green-600">Ready to download</p>
            ) : (
              <p className="text-xs text-gray-500">Generate & Download</p>
            )}
          </button>

          {/* Certificate Download */}
          <button
            onClick={handleDownloadCertificate}
            disabled={downloadingCert || !registration.certificate_generated_at}
            className="bg-white rounded-2xl shadow-xl p-5 text-center hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:bg-amber-200 transition-colors">
              {downloadingCert ? (
                <RefreshCw className="w-6 h-6 text-amber-600 animate-spin" />
              ) : (
                <Award className="w-6 h-6 text-amber-600" />
              )}
            </div>
            <h3 className="font-semibold text-gray-900 text-sm mb-1">Certificate</h3>
            {registration.certificate_generated_at ? (
              <p className="text-xs text-green-600">Ready</p>
            ) : (
              <p className="text-xs text-gray-500">Not yet</p>
            )}
          </button>

          {/* Receipt Download */}
          <button
            onClick={handleDownloadReceipt}
            disabled={downloadingReceipt || registration.status !== "confirmed"}
            className="bg-white rounded-2xl shadow-xl p-5 text-center hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:bg-green-200 transition-colors">
              {downloadingReceipt ? (
                <RefreshCw className="w-6 h-6 text-green-600 animate-spin" />
              ) : (
                <Receipt className="w-6 h-6 text-green-600" />
              )}
            </div>
            <h3 className="font-semibold text-gray-900 text-sm mb-1">Receipt</h3>
            <p className="text-xs text-green-600">Download</p>
          </button>
        </div>

        {/* Program Schedule Link */}
        {event && (
          <a
            href={`/p/${event.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white rounded-2xl shadow-xl p-5 hover:shadow-2xl transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                <CalendarDays className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                  Program Schedule
                </h3>
                <p className="text-sm text-gray-500">View sessions, speakers & timings</p>
              </div>
              <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
            </div>
          </a>
        )}

        {/* Footer Note */}
        <div className="text-center text-white/60 text-sm py-4">
          <p>Print your badge and bring it to the event venue.</p>
          <p className="mt-1">Certificates are available after event completion.</p>
        </div>
      </div>
    </div>
  )
}
