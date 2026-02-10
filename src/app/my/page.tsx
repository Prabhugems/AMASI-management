"use client"

import { useState, useEffect } from "react"
import {
  Search,
  Loader2,
  User,
  Building2,
  Ticket,
  Calendar,
  MapPin,
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
  ShieldCheck,
  XCircle,
  BookOpen,
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

  // Payment verification
  const [showVerifyForm, setShowVerifyForm] = useState(false)
  const [verifyRpId, setVerifyRpId] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ status: string; message: string } | null>(null)

  const handleVerifyPayment = async () => {
    if (!verifyRpId.trim() && pendingPayments.length === 0) return

    setIsVerifying(true)
    setVerifyResult(null)
    try {
      const res = await fetch("/api/payments/verify-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_payment_id: verifyRpId.trim() || undefined,
          payment_id: pendingPayments.length > 0 ? pendingPayments[0].id : undefined,
          email: searchQuery.trim().toLowerCase(),
        }),
      })

      const result = await res.json()
      setVerifyResult(result)

      if (result.status === "verified") {
        // Payment was recovered! Refresh the page after a short delay
        setTimeout(() => {
          setShowVerifyForm(false)
          setVerifyResult(null)
          setVerifyRpId("")
          // Re-trigger search to show updated registration
          const form = document.querySelector("form")
          if (form) form.requestSubmit()
        }, 3000)
      }
    } catch (_error: any) {
      setVerifyResult({
        status: "error",
        message: "Verification failed. Please try again.",
      })
    } finally {
      setIsVerifying(false)
    }
  }

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
        let errorMsg = "Failed to download badge"
        try {
          const data = await res.json()
          errorMsg = data.error || errorMsg
        } catch {
          // Response was not JSON
        }
        throw new Error(errorMsg)
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
          let errorMsg = "Certificate not available yet"
          try {
            const data = await res.json()
            errorMsg = data.error || errorMsg
          } catch {
            // Response was not JSON (e.g. HTML error page)
          }
          throw new Error(errorMsg)
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
      // Use final-receipt endpoint for consolidated receipt (ticket + all addons + payment history)
      const res = await fetch(`/api/registrations/${selectedRegistration.id}/final-receipt`)

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
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                  <Clock className="w-4 h-4" />
                  Payment Pending
                </div>
                <p className="text-sm text-amber-600 mb-3">
                  We found {pendingPayments.length} incomplete payment(s). Your payment may not have completed successfully.
                </p>
                {pendingPayments.map((p) => (
                  <div key={p.id} className="text-xs bg-white p-3 rounded-lg border border-amber-100 mb-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{p.events?.name || "Event"}</span>
                      <span className="font-medium">₹{p.amount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-500">
                        {new Date(p.created_at).toLocaleDateString("en-IN")}
                      </span>
                      <span className="text-gray-500">{p.payment_number}</span>
                    </div>
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <XCircle className="w-3 h-3" />
                        {p.status === "failed" ? "Failed" : "Pending"}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Verify Payment Section */}
                {!showVerifyForm ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-amber-600">
                      If money was deducted from your account, you can verify your payment:
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowVerifyForm(true)}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Verify My Payment
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-amber-200 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Razorpay Payment ID
                      </label>
                      <input
                        type="text"
                        value={verifyRpId}
                        onChange={(e) => setVerifyRpId(e.target.value)}
                        placeholder="pay_XXXXXXXXXXXXXX"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Check your UPI app, bank SMS, or email for this ID. Leave blank to auto-check.
                      </p>
                    </div>

                    {/* Verify Result */}
                    {verifyResult && (
                      <div className={`p-3 rounded-lg text-sm ${
                        verifyResult.status === "verified"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : verifyResult.status === "already_completed"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}>
                        <div className="flex items-start gap-2">
                          {verifyResult.status === "verified" ? (
                            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          ) : verifyResult.status === "already_completed" ? (
                            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          )}
                          <p>{verifyResult.message}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowVerifyForm(false)
                          setVerifyResult(null)
                          setVerifyRpId("")
                        }}
                        className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleVerifyPayment}
                        disabled={isVerifying}
                        className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isVerifying ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Checking...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            Submit
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
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

          {/* Pending Payments */}
          {pendingPayments.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
              <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                <Clock className="w-4 h-4" />
                {pendingPayments.length} Pending Payment{pendingPayments.length > 1 ? "s" : ""}
              </div>
              <p className="text-xs text-amber-600 mb-3">
                These payments were not completed. Select a registration above to verify.
              </p>
              {pendingPayments.map((p) => (
                <div key={p.id} className="text-xs bg-white p-3 rounded-lg border border-amber-100 mb-2 last:mb-0">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{p.events?.name || "Event"}</span>
                    <span className="font-medium">Rs.{p.amount.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-500 font-mono">{p.payment_number}</span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium ${
                      p.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {p.status === "failed" ? "Failed" : "Pending"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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

        {/* Abstract Submissions Section */}
        <AbstractSubmissions
          eventId={event?.id}
          email={registration.attendee_email}
          registrationNumber={registration.registration_number}
        />

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

        {/* Pending Payments Section */}
        {pendingPayments.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center gap-2 text-amber-700 font-semibold mb-3">
              <Clock className="w-5 h-5" />
              Pending Payments ({pendingPayments.length})
            </div>
            <p className="text-sm text-gray-500 mb-4">
              These payments were not completed. If money was deducted, you can verify below.
            </p>
            <div className="space-y-3">
              {pendingPayments.map((p) => (
                <div key={p.id} className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{p.events?.name || "Event Payment"}</p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{p.payment_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">Rs.{p.amount.toLocaleString("en-IN")}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        p.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        <XCircle className="w-3 h-3" />
                        {p.status === "failed" ? "Failed" : "Pending"}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(p.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                  </p>
                </div>
              ))}
            </div>

            {/* Verify Payment */}
            {!showVerifyForm ? (
              <div className="mt-4">
                <p className="text-xs text-amber-600 mb-2">
                  If money was deducted from your account, you can verify your payment:
                </p>
                <button
                  type="button"
                  onClick={() => setShowVerifyForm(true)}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Verify My Payment
                </button>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-white rounded-lg border border-amber-200 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Razorpay Payment ID
                  </label>
                  <input
                    type="text"
                    value={verifyRpId}
                    onChange={(e) => setVerifyRpId(e.target.value)}
                    placeholder="pay_XXXXXXXXXXXXXX"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Check your UPI app, bank SMS, or email for this ID. Leave blank to auto-check.
                  </p>
                </div>

                {verifyResult && (
                  <div className={`p-3 rounded-lg text-sm ${
                    verifyResult.status === "verified"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : verifyResult.status === "already_completed"
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}>
                    <div className="flex items-start gap-2">
                      {verifyResult.status === "verified" || verifyResult.status === "already_completed" ? (
                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      )}
                      <p>{verifyResult.message}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowVerifyForm(false)
                      setVerifyResult(null)
                      setVerifyRpId("")
                    }}
                    className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyPayment}
                    disabled={isVerifying}
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Submit
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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

// Abstract Submissions Component
function AbstractSubmissions({
  eventId,
  email,
  registrationNumber: _registrationNumber,
}: {
  eventId?: string
  email: string
  registrationNumber: string
}) {
  const [abstracts, setAbstracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>(null)
  const [abstractSettings, setAbstractSettings] = useState<any>(null)

  useEffect(() => {
    if (!eventId) return

    const fetchData = async () => {
      try {
        // Check if abstracts are enabled
        const settingsRes = await fetch(`/api/event-settings?event_id=${eventId}`)
        const settingsData = await settingsRes.json()
        setSettings(settingsData)

        if (!settingsData?.enable_abstracts) {
          setLoading(false)
          return
        }

        // Fetch abstract settings for deadline
        const absSettingsRes = await fetch(`/api/abstract-settings/${eventId}`)
        const absSettingsData = await absSettingsRes.json()
        setAbstractSettings(absSettingsData)

        // Fetch user's abstracts
        const abstractsRes = await fetch(
          `/api/abstracts?event_id=${eventId}&email=${encodeURIComponent(email.toLowerCase())}`
        )
        const abstractsData = await abstractsRes.json()
        setAbstracts(abstractsData || [])
      } catch (error) {
        console.error("Failed to fetch abstracts:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [eventId, email])

  if (loading) {
    return null
  }

  if (!settings?.enable_abstracts) {
    return null
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    submitted: { bg: "bg-blue-100", text: "text-blue-700" },
    under_review: { bg: "bg-yellow-100", text: "text-yellow-700" },
    revision_requested: { bg: "bg-orange-100", text: "text-orange-700" },
    accepted: { bg: "bg-green-100", text: "text-green-700" },
    rejected: { bg: "bg-red-100", text: "text-red-700" },
    withdrawn: { bg: "bg-gray-100", text: "text-gray-600" },
  }

  const maxSubmissions = abstractSettings?.max_submissions_per_person || 3
  const canSubmitMore = abstracts.filter((a) => a.status !== "withdrawn").length < maxSubmissions

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Abstract Submissions</h3>
            {abstractSettings?.submission_deadline && (
              <p className="text-xs text-gray-500">
                Deadline: {formatDate(abstractSettings.submission_deadline)}
              </p>
            )}
          </div>
        </div>
        {canSubmitMore && (
          <a
            href={`/events/${eventId}/submit-abstract`}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Submit New
          </a>
        )}
      </div>

      {abstracts.length > 0 ? (
        <div className="space-y-3">
          {abstracts.map((abstract) => {
            const status = statusColors[abstract.status] || statusColors.submitted
            return (
              <div
                key={abstract.id}
                className="p-4 bg-gray-50 rounded-xl border border-gray-100"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-emerald-600">
                        {abstract.abstract_number}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${status.bg} ${status.text}`}
                      >
                        {abstract.status.replace("_", " ")}
                      </span>
                      {abstract.accepted_as && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 capitalize">
                          {abstract.accepted_as}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900 line-clamp-2">
                      {abstract.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {abstract.category?.name || "No category"} • Submitted{" "}
                      {formatDate(abstract.submitted_at)}
                    </p>
                  </div>
                </div>

                {abstract.status === "revision_requested" && abstract.decision_notes && (
                  <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <p className="text-xs font-medium text-orange-700 mb-1">Revision Requested:</p>
                    <p className="text-sm text-orange-600">{abstract.decision_notes}</p>
                  </div>
                )}

                {abstract.status === "accepted" && (abstract.session_date || abstract.session_location) && (
                  <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <p className="text-xs font-medium text-emerald-700 mb-1">Presentation Details:</p>
                    <div className="text-sm text-emerald-600">
                      {abstract.session_date && (
                        <p className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(abstract.session_date)}
                          {abstract.session_time && ` at ${abstract.session_time}`}
                        </p>
                      )}
                      {abstract.session_location && (
                        <p className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {abstract.session_location}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-6">
          <BookOpen className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500 mb-3">No abstracts submitted yet</p>
          {canSubmitMore && (
            <a
              href={`/events/${eventId}/submit-abstract`}
              className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Submit Your First Abstract
            </a>
          )}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-500">
          {abstracts.filter((a) => a.status !== "withdrawn").length} of {maxSubmissions} submissions used
        </p>
      </div>
    </div>
  )
}
