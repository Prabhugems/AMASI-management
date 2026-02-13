"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  CheckCircle,
  Mail,
  Calendar,
  Download,
  ArrowRight,
  Sparkles,
  Loader2,
  FileText,
  User,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react"

function SuccessContent() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const searchParams = useSearchParams()
  const supabase = createClient()

  const registrationNumber = searchParams.get("reg")
  const email = searchParams.get("email")
  const paymentMethod = searchParams.get("method")

  useEffect(() => {
    setMounted(true)
  }, [])

  const _isDark = mounted ? resolvedTheme === "dark" : false

  // Fetch registration details to get ID for PDF download
  const { data: registration } = useQuery({
    queryKey: ["registration-success", registrationNumber],
    queryFn: async () => {
      if (!registrationNumber) return null
      const { data } = await supabase
        .from("registrations")
        .select("id, events(name, short_name, start_date, city)")
        .eq("registration_number", registrationNumber)
        .maybeSingle() as { data: { id: string; events: { name: string; short_name: string | null; start_date: string; city: string | null } | null } | null }
      return data
    },
    enabled: !!registrationNumber,
  })

  // Generate QR code URL
  const qrCodeUrl = registrationNumber
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(registrationNumber)}`
    : null

  // Copy registration number
  const handleCopy = async () => {
    if (registrationNumber) {
      await navigator.clipboard.writeText(registrationNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Download PDF receipt
  const handleDownloadPdf = async () => {
    if (!registration?.id) return
    setDownloadingPdf(true)
    try {
      const response = await fetch(`/api/registrations/${registration.id}/receipt`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `AMASI-Receipt-${registrationNumber}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error("Failed to download PDF:", error)
    } finally {
      setDownloadingPdf(false)
    }
  }

  const eventInfo = registration?.events as { name: string; short_name: string; start_date: string; city: string } | null

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto text-center">
        {/* Success Animation */}
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-emerald-500/20 rounded-full animate-ping" />
          </div>
          <div className="relative inline-flex p-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 shadow-2xl shadow-emerald-500/40">
            <CheckCircle className="w-16 h-16 text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-black mb-4 text-gray-900">
          Registration{" "}
          <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
            Successful!
          </span>
        </h1>

        <p className="text-lg mb-8 text-gray-600">
          {paymentMethod === "cash"
            ? "Your spot has been reserved. Please pay at the venue."
            : paymentMethod === "bank_transfer"
            ? "Your registration is pending. Please complete the bank transfer."
            : "Thank you for registering. Your payment has been processed successfully."}
        </p>

        {/* Registration Card with QR Code */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* QR Code */}
            {qrCodeUrl && (
              <div className="flex flex-col items-center">
                <div className="p-3 bg-white border-2 border-gray-100 rounded-xl">
                  <img
                    src={qrCodeUrl}
                    alt="Registration QR Code"
                    className="w-32 h-32"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Scan for quick check-in</p>
              </div>
            )}

            {/* Details */}
            <div className="flex-1 text-left">
              <h2 className="text-lg font-bold mb-4 text-gray-900">
                Confirmation Details
              </h2>

              <div className="space-y-4">
                {registrationNumber && (
                  <div className="flex items-center justify-between gap-4 p-3 bg-emerald-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-100">
                        <Sparkles className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs text-emerald-600 font-medium">
                          Registration Number
                        </p>
                        <p className="font-mono font-bold text-emerald-900 text-lg">
                          {registrationNumber}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="p-2 rounded-lg hover:bg-emerald-100 transition-colors"
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Copy className="w-5 h-5 text-emerald-600" />
                      )}
                    </button>
                  </div>
                )}

                {eventInfo && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-50">
                      <Calendar className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {eventInfo.short_name || eventInfo.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(eventInfo.start_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                        {eventInfo.city && ` • ${eventInfo.city}`}
                      </p>
                    </div>
                  </div>
                )}

                {email && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">
                        Confirmation sent to
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {email}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={handleDownloadPdf}
              disabled={!registration?.id || downloadingPdf}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors disabled:opacity-50"
            >
              {downloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Download Receipt
            </button>
            <Link
              href={`/my?q=${encodeURIComponent(email || registrationNumber || "")}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-medium transition-colors"
            >
              <User className="w-4 h-4" />
              My Registrations
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* What's Next */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 text-left">
          <h2 className="text-lg font-bold mb-4 text-gray-900">
            What's Next?
          </h2>

          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="p-1 rounded-full bg-emerald-100 text-emerald-600 mt-0.5">
                <CheckCircle className="w-4 h-4" />
              </div>
              <p className="text-gray-700">
                Check your email for the confirmation and event details
              </p>
            </li>
            <li className="flex items-start gap-3">
              <div className="p-1 rounded-full bg-emerald-100 text-emerald-600 mt-0.5">
                <Calendar className="w-4 h-4" />
              </div>
              <p className="text-gray-700">
                Add the event to your calendar to stay updated
              </p>
            </li>
            <li className="flex items-start gap-3">
              <div className="p-1 rounded-full bg-emerald-100 text-emerald-600 mt-0.5">
                <Download className="w-4 h-4" />
              </div>
              <p className="text-gray-700">
                Your badge and certificate will be available at the venue
              </p>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-medium shadow-lg hover:bg-emerald-700 hover:shadow-xl transition-all"
          >
            Browse More Events
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function SuccessLoading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto text-center">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<SuccessLoading />}>
      <SuccessContent />
    </Suspense>
  )
}
