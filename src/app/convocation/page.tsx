"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  GraduationCap,
  Search,
  Loader2,
  Download,
  ExternalLink,
  AlertCircle,
  Copy,
  Check,
  MapPin,
  CalendarPlus,
  FileText,
  HelpCircle,
  Mail,
  Phone,
  Sparkles,
  Info,
} from "lucide-react"
import jsPDF from "jspdf"
import { COMPANY_CONFIG } from "@/lib/config"

type ConvocationData = {
  name: string
  email: string
  phone: string | null
  registration_number: string
  convocation_number: string
  total_marks: number | null
  amasi_number: number | null
  fillout_link: string | null
  category: string | null
  event_title: string | null
  event_date: string | null
  event_venue: string | null
}

export default function ConvocationPortalWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
      <ConvocationPortalPage />
    </Suspense>
  )
}

// Copy-to-clipboard button
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

// Generate .ics calendar file
function downloadCalendarEvent() {
  const start = "20260827T090000"
  const end = "20260827T180000"
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AMASI//Convocation//EN",
    "BEGIN:VEVENT",
    `DTSTART:${start}`,
    `DTEND:${end}`,
    "SUMMARY:FMAS Convocation Ceremony - AMASI",
    "LOCATION:Biswa Bangla Convention Centre\\, Kolkata\\, India",
    "DESCRIPTION:FMAS Convocation Ceremony organized by the Association of Minimal Access Surgeons of India (AMASI).",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "FMAS-Convocation-2026.ics"
  a.click()
  URL.revokeObjectURL(url)
}

function ConvocationPortalPage() {
  const searchParams = useSearchParams()
  const [convNo, setConvNo] = useState("")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ConvocationData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Auto-lookup if ?c= param is provided
  useEffect(() => {
    const c = searchParams.get("c")
    if (c) {
      setConvNo(c.toUpperCase())
      doLookup(c)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doLookup = async (num: string) => {
    if (!num.trim()) return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch(`/api/convocation/${encodeURIComponent(num.trim())}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Not found")
      }
      setData(await res.json())
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong"
      setError(message)
    }
    setLoading(false)
  }

  const lookup = () => doLookup(convNo)

  const downloadInvitation = () => {
    if (!data) return
    const doc = new jsPDF()
    const w = doc.internal.pageSize.getWidth()

    // Header
    doc.setFillColor(26, 82, 118)
    doc.rect(0, 0, w, 45, "F")

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.text(COMPANY_CONFIG.fullName, w / 2, 18, { align: "center" })
    doc.setFontSize(12)
    doc.text(COMPANY_CONFIG.name, w / 2, 26, { align: "center" })
    doc.setFontSize(16)
    doc.text("CONVOCATION INVITATION", w / 2, 38, { align: "center" })

    // Body
    doc.setTextColor(0, 0, 0)
    let y = 60

    doc.setFontSize(14)
    doc.text("Dear Dr. " + data.name + ",", 20, y)
    y += 12

    doc.setFontSize(11)
    const bodyText = `On behalf of the ${COMPANY_CONFIG.fullName} (${COMPANY_CONFIG.name}), we are pleased to inform you that you have successfully passed the FMAS Examination. We extend our heartfelt congratulations on this impressive accomplishment.`
    const lines = doc.splitTextToSize(bodyText, w - 40)
    doc.text(lines, 20, y)
    y += lines.length * 6 + 10

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("You are cordially invited to the Convocation Ceremony", w / 2, y, { align: "center" })
    y += 12

    // Event details box
    doc.setFillColor(248, 249, 250)
    doc.roundedRect(20, y - 4, w - 40, 30, 3, 3, "F")
    doc.setFontSize(13)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(26, 82, 118)
    doc.text("27th August 2026", w / 2, y + 8, { align: "center" })
    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    doc.text("Biswa Bangla Convention Centre, Kolkata, India", w / 2, y + 18, { align: "center" })
    y += 40

    // Candidate details
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Candidate Details", 20, y)
    y += 8
    doc.setDrawColor(26, 82, 118)
    doc.line(20, y, w - 20, y)
    y += 8

    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")

    const details = [
      ["Name", "Dr. " + data.name],
      ["Convocation Number", data.convocation_number],
      [`${COMPANY_CONFIG.name} Number`, data.amasi_number ? String(data.amasi_number) : "-"],
    ]

    for (const [label, value] of details) {
      doc.setFont("helvetica", "bold")
      doc.text(label + ":", 25, y)
      doc.setFont("helvetica", "normal")
      doc.text(value, 85, y)
      y += 8
    }

    // Conference registration
    y += 10
    doc.setFillColor(255, 243, 205)
    doc.roundedRect(20, y - 4, w - 40, 28, 3, 3, "F")
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(146, 64, 14)
    doc.text("Register for the Conference", w / 2, y + 6, { align: "center" })
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.text('Visit www.amasicon2026.com and select category "FMAS Convocation"', w / 2, y + 16, { align: "center" })
    y += 38

    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    const footerText = "Please keep this invitation for your records. You will receive further details regarding dress code, schedule, and registration for the ceremony."
    const footerLines = doc.splitTextToSize(footerText, w - 40)
    doc.text(footerLines, 20, y)

    y += footerLines.length * 5 + 15
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.text("Sincerely,", 20, y)
    y += 7
    doc.setFont("helvetica", "bold")
    doc.text("Dr. Roshan Shetty A", 20, y)
    y += 6
    doc.setFont("helvetica", "normal")
    doc.text(`Secretary, ${COMPANY_CONFIG.name}`, 20, y)

    doc.save(`Convocation-Invitation-${data.convocation_number}.pdf`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-[#1a5276] text-white py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-90" />
          <h1 className="text-2xl font-bold">{COMPANY_CONFIG.name} Convocation Portal</h1>
          <p className="text-white/70 mt-1 text-sm">Fellowship in Minimal Access Surgery</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Lookup Section */}
        {!data && (
          <div className="bg-white border rounded-2xl shadow-sm p-8">
            <h2 className="text-lg font-semibold mb-1">Enter your Convocation Number</h2>
            <p className="text-sm text-muted-foreground mb-6">Your convocation number was shared via email (e.g., 122AEC1001)</p>
            <div className="flex gap-3">
              <Input
                value={convNo}
                onChange={(e) => setConvNo(e.target.value.toUpperCase())}
                placeholder="e.g. 122AEC1001"
                className="font-mono text-lg h-12"
                onKeyDown={(e) => e.key === "Enter" && lookup()}
              />
              <Button onClick={lookup} disabled={loading || !convNo.trim()} className="h-12 px-6 gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Lookup
              </Button>
            </div>
            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Full Portal View after successful lookup */}
        {data && (
          <div className="space-y-6">

            {/* 1. Congratulations Banner */}
            <div className="relative overflow-hidden bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 rounded-2xl p-8 text-center text-white shadow-lg">
              {/* Sparkle decorations */}
              <div className="absolute top-3 left-6 animate-pulse">
                <Sparkles className="h-5 w-5 text-yellow-200/70" />
              </div>
              <div className="absolute top-6 right-8 animate-pulse" style={{ animationDelay: "0.5s" }}>
                <Sparkles className="h-4 w-4 text-yellow-200/60" />
              </div>
              <div className="absolute bottom-4 left-12 animate-pulse" style={{ animationDelay: "1s" }}>
                <Sparkles className="h-3 w-3 text-yellow-200/50" />
              </div>
              <div className="absolute bottom-6 right-14 animate-pulse" style={{ animationDelay: "0.7s" }}>
                <Sparkles className="h-5 w-5 text-yellow-200/60" />
              </div>

              <GraduationCap className="h-12 w-12 mx-auto mb-3 text-white/90" />
              <h2 className="text-2xl sm:text-3xl font-bold">
                Congratulations, Dr. {data.name}!
              </h2>
              <p className="text-white/85 mt-2 text-sm sm:text-base">
                You have successfully passed your FMAS Examination
              </p>
              {data.event_title && (
                <p className="text-white/60 mt-1 text-xs">{data.event_title}</p>
              )}
            </div>

            {/* 2. Convocation Details Card */}
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-[#1a5276] text-white px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/60">Convocation Number</p>
                    <p className="text-2xl sm:text-3xl font-mono font-bold mt-1">{data.convocation_number}</p>
                  </div>
                  <CopyButton text={data.convocation_number} />
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Name</p>
                    <p className="font-medium mt-0.5">Dr. {data.name}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{COMPANY_CONFIG.name} Number</p>
                      {data.amasi_number && <CopyButton text={String(data.amasi_number)} />}
                    </div>
                    <p className="font-medium mt-0.5">{data.amasi_number || "-"}</p>
                  </div>
                </div>
                {data.event_title && (
                  <>
                    <hr />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Event</p>
                      <p className="font-medium mt-0.5">{data.event_title}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 3. Ceremony Info Card */}
            <div className="bg-white border rounded-2xl shadow-sm p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-[#1a5276]" />
                Convocation Ceremony
              </h3>
              <div className="bg-slate-50 rounded-xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <CalendarPlus className="h-4 w-4 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-semibold text-lg">27th August 2026</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Venue</p>
                    <p className="font-semibold">Biswa Bangla Convention Centre</p>
                    <p className="text-sm text-muted-foreground">Kolkata, India</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => window.open("https://maps.google.com/?q=Biswa+Bangla+Convention+Centre+Kolkata", "_blank")}
                >
                  <MapPin className="h-4 w-4" />
                  View on Google Maps
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={downloadCalendarEvent}
                >
                  <CalendarPlus className="h-4 w-4" />
                  Add to Calendar
                </Button>
              </div>
            </div>

            {/* 4. Action Buttons Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Download Invitation PDF */}
              <button
                onClick={downloadInvitation}
                className="flex items-center gap-4 bg-white border rounded-2xl shadow-sm p-5 text-left hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <div className="h-11 w-11 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                  <Download className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Download Invitation</p>
                  <p className="text-xs text-muted-foreground">PDF invitation letter</p>
                </div>
              </button>

              {/* Fill Convocation Form */}
              {data.fillout_link ? (
                <button
                  onClick={() => window.open(data.fillout_link!, "_blank")}
                  className="flex items-center gap-4 bg-gradient-to-br from-purple-50 to-violet-50 border-2 border-purple-200 rounded-2xl shadow-sm p-5 text-left hover:shadow-md hover:border-purple-300 transition-all group"
                >
                  <div className="h-11 w-11 rounded-xl bg-purple-200 flex items-center justify-center shrink-0 group-hover:bg-purple-300 transition-colors">
                    <FileText className="h-5 w-5 text-purple-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-purple-900">Fill Convocation Form</p>
                    <p className="text-xs text-purple-600">Required - complete your details</p>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-4 bg-slate-50 border rounded-2xl p-5 text-left opacity-60">
                  <div className="h-11 w-11 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-600">Convocation Form</p>
                    <p className="text-xs text-muted-foreground">Not available yet</p>
                  </div>
                </div>
              )}

              {/* Register for AMASICON 2026 */}
              <button
                onClick={() => window.open("https://www.amasicon2026.com", "_blank")}
                className="flex items-center gap-4 bg-white border rounded-2xl shadow-sm p-5 text-left hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <div className="h-11 w-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors">
                  <ExternalLink className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Register for AMASICON 2026</p>
                  <p className="text-xs text-muted-foreground">Category: &quot;FMAS Convocation&quot;</p>
                </div>
              </button>

              {/* FAQ */}
              <button
                onClick={() => window.open("https://v0-faq-redraft.vercel.app/", "_blank")}
                className="flex items-center gap-4 bg-white border rounded-2xl shadow-sm p-5 text-left hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
                  <HelpCircle className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">FAQ</p>
                  <p className="text-xs text-muted-foreground">Frequently asked questions</p>
                </div>
              </button>
            </div>

            {/* 5. Important Notes Section */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Important Notes
              </h3>
              <ul className="space-y-2 text-sm text-amber-800">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 shrink-0">&#x2022;</span>
                  <span>Certificate name <strong>cannot be corrected</strong> after the deadline. Please verify your name in the convocation form.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 shrink-0">&#x2022;</span>
                  <span>Dispatch address is <strong>mandatory</strong> for certificate delivery. Ensure it is filled correctly.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 shrink-0">&#x2022;</span>
                  <span>{COMPANY_CONFIG.name} membership is required for attending the convocation ceremony.</span>
                </li>
              </ul>
            </div>

            {/* 6. Need Help Section */}
            <div className="bg-white border rounded-2xl shadow-sm p-6">
              <h3 className="font-semibold mb-3">Need Help?</h3>
              <div className="space-y-3">
                <a
                  href={`mailto:${COMPANY_CONFIG.supportEmail}`}
                  className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  {COMPANY_CONFIG.supportEmail}
                </a>
                <a
                  href="tel:+919876543210"
                  className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  Contact us for assistance
                </a>
              </div>
            </div>

            {/* Back / Look up another */}
            <button
              onClick={() => { setData(null); setConvNo(""); }}
              className="text-sm text-muted-foreground hover:text-foreground mx-auto block"
            >
              &larr; Look up another number
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
