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
} from "lucide-react"
import jsPDF from "jspdf"

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
}

export default function ConvocationPortalWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
      <ConvocationPortalPage />
    </Suspense>
  )
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
    } catch (e: any) {
      setError(e.message)
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
    doc.text("Association of Minimal Access Surgeons of India", w / 2, 18, { align: "center" })
    doc.setFontSize(12)
    doc.text("AMASI", w / 2, 26, { align: "center" })
    doc.setFontSize(16)
    doc.text("CONVOCATION INVITATION", w / 2, 38, { align: "center" })

    // Body
    doc.setTextColor(0, 0, 0)
    let y = 60

    doc.setFontSize(14)
    doc.text("Dear Dr. " + data.name + ",", 20, y)
    y += 12

    doc.setFontSize(11)
    const bodyText = "On behalf of the Association of Minimal Access Surgeons of India (AMASI), we are pleased to inform you that you have successfully passed the FMAS Examination. We extend our heartfelt congratulations on this impressive accomplishment."
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
      ["AMASI Number", data.amasi_number ? String(data.amasi_number) : "-"],
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
    doc.text("Secretary, AMASI", 20, y)

    doc.save(`Convocation-Invitation-${data.convocation_number}.pdf`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-[#1a5276] text-white py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-90" />
          <h1 className="text-2xl font-bold">AMASI Convocation Portal</h1>
          <p className="text-white/70 mt-1 text-sm">Fellowship in Minimal Access Surgery</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Lookup */}
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
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {data && (
          <div className="space-y-6">
            {/* Congrats banner */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
              <GraduationCap className="h-10 w-10 mx-auto text-green-600 mb-2" />
              <h2 className="text-xl font-bold text-green-800">Congratulations, Dr. {data.name}!</h2>
              <p className="text-green-700 text-sm mt-1">You have successfully passed your FMAS Examination</p>
            </div>

            {/* Details card */}
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-[#1a5276] text-white px-6 py-4">
                <p className="text-sm opacity-70">Convocation Number</p>
                <p className="text-2xl font-mono font-bold">{data.convocation_number}</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-medium">Dr. {data.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">AMASI Number</p>
                    <p className="font-medium">{data.amasi_number || "-"}</p>
                  </div>
                </div>

                <hr />

                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Convocation Ceremony</p>
                  <p className="font-bold text-lg">27th August 2026</p>
                  <p className="text-sm text-muted-foreground">Biswa Bangla Convention Centre, Kolkata, India</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={downloadInvitation} className="flex-1 h-12 gap-2" size="lg">
                <Download className="h-5 w-5" />
                Download Invitation PDF
              </Button>
              {data.fillout_link && (
                <Button
                  variant="outline"
                  className="flex-1 h-12 gap-2"
                  size="lg"
                  onClick={() => window.open(data.fillout_link!, "_blank")}
                >
                  <ExternalLink className="h-5 w-5" />
                  Fill Convocation Form
                </Button>
              )}
            </div>

            {/* Conference Registration */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <h3 className="font-bold text-amber-800 mb-1">Register for AMASICON 2026</h3>
              <p className="text-sm text-amber-700 mb-3">Visit the conference website and select category <strong>"FMAS Convocation"</strong> to register.</p>
              <Button
                variant="outline"
                className="gap-2 border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={() => window.open("https://www.amasicon2026.com", "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                www.amasicon2026.com
              </Button>
            </div>

            {/* Back */}
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
