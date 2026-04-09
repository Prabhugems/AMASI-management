"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Printer,
  QrCode,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  ScanLine,
  FileText,
  RefreshCw,
  Search,
  Award,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode"

type CoordinatorInfo = {
  id: string
  event_id: string
  hall_name: string
  coordinator_name: string
  portal_token: string
  event?: {
    id: string
    name: string
    short_name?: string
  }
}

type ScanResult = {
  success?: boolean
  error?: string
  abstract?: {
    id: string
    number: string
    title: string
    presenter: string
    affiliation?: string
    presentation_type?: string
    presented_at?: string
    event?: string
  }
  not_presented?: boolean
}

export default function PrintCertificatePage() {
  const params = useParams()
  const token = params.token as string
  const supabase = createClient()

  const [scannerOpen, setScannerOpen] = useState(false)
  const [manualInput, setManualInput] = useState("")
  const [processing, setProcessing] = useState(false)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)
  const [printingCert, setPrintingCert] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [printCount, setPrintCount] = useState(0)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const processingRef = useRef(false)

  // Real-time clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch coordinator info
  const { data: coordinator, isLoading, error } = useQuery({
    queryKey: ["print-station-coordinator", token],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("hall_coordinators")
        .select(`*, event:events(id, name, short_name)`)
        .eq("portal_token", token)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as CoordinatorInfo | null
    },
  })

  // Look up presenter by scan data
  const lookupPresenter = useCallback(async (scanData: string) => {
    if (processingRef.current || !scanData.trim()) return
    processingRef.current = true
    setProcessing(true)
    setLastResult(null)

    try {
      const searchValue = scanData.trim()

      // Try to find abstract
      // 1. By abstract number
      let { data: abstract } = await (supabase as any)
        .from("abstracts")
        .select(`
          id, abstract_number, title, status, accepted_as,
          presenting_author_name, presenting_author_email,
          presenting_author_affiliation, event_id,
          presentation_completed, presentation_completed_at,
          events(name, short_name)
        `)
        .eq("abstract_number", searchValue)
        .maybeSingle()

      // 2. Try by registration number
      if (!abstract) {
        const { data: registration } = await (supabase as any)
          .from("registrations")
          .select("id, attendee_email, event_id")
          .eq("registration_number", searchValue)
          .maybeSingle()

        if (registration) {
          const { data: byEmail } = await (supabase as any)
            .from("abstracts")
            .select(`
              id, abstract_number, title, status, accepted_as,
              presenting_author_name, presenting_author_email,
              presenting_author_affiliation, event_id,
              presentation_completed, presentation_completed_at,
              events(name, short_name)
            `)
            .eq("event_id", registration.event_id)
            .ilike("presenting_author_email", registration.attendee_email)
            .eq("status", "accepted")
            .maybeSingle()

          if (byEmail) {
            abstract = byEmail
          }
        }
      }

      // 3. Try by email
      if (!abstract) {
        const { data: byEmail } = await (supabase as any)
          .from("abstracts")
          .select(`
            id, abstract_number, title, status, accepted_as,
            presenting_author_name, presenting_author_email,
            presenting_author_affiliation, event_id,
            presentation_completed, presentation_completed_at,
            events(name, short_name)
          `)
          .ilike("presenting_author_email", searchValue)
          .eq("status", "accepted")
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (byEmail) {
          abstract = byEmail
        }
      }

      if (!abstract) {
        setLastResult({ error: "Presenter not found" })
        toast.error("No presenter found for this badge")
        return
      }

      if (abstract.status !== "accepted") {
        setLastResult({ error: `Abstract status: ${abstract.status}` })
        toast.error("Abstract not accepted")
        return
      }

      if (!abstract.presentation_completed) {
        setLastResult({
          not_presented: true,
          error: "Presentation not completed yet",
          abstract: {
            id: abstract.id,
            number: abstract.abstract_number,
            title: abstract.title,
            presenter: abstract.presenting_author_name,
            affiliation: abstract.presenting_author_affiliation,
            presentation_type: abstract.accepted_as,
            event: abstract.events?.name || abstract.events?.short_name,
          },
        })
        toast.error("Presenter has not completed presentation yet")
        return
      }

      // Valid presenter who has completed presentation
      setLastResult({
        success: true,
        abstract: {
          id: abstract.id,
          number: abstract.abstract_number,
          title: abstract.title,
          presenter: abstract.presenting_author_name,
          affiliation: abstract.presenting_author_affiliation,
          presentation_type: abstract.accepted_as,
          presented_at: abstract.presentation_completed_at,
          event: abstract.events?.name || abstract.events?.short_name,
        },
      })
      toast.success("Presenter verified - Ready to print")
    } catch (err) {
      console.error("Lookup error:", err)
      setLastResult({ error: "Lookup failed" })
      toast.error("Failed to look up presenter")
    } finally {
      setProcessing(false)
      processingRef.current = false
    }
  }, [supabase])

  // Scanner initialization
  useEffect(() => {
    if (!scannerOpen) {
      if (scannerRef.current) {
        const state = scannerRef.current.getState()
        if (state === Html5QrcodeScannerState.SCANNING) {
          scannerRef.current.stop().catch(() => {})
        }
        scannerRef.current = null
      }
      return
    }

    const initScanner = async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader-print")
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
          (decodedText) => {
            if (!processingRef.current) {
              lookupPresenter(decodedText)
            }
          },
          () => {}
        )
      } catch (err) {
        console.error("Scanner init error:", err)
        toast.error("Could not access camera")
      }
    }

    const timer = setTimeout(initScanner, 100)
    return () => clearTimeout(timer)
  }, [scannerOpen, lookupPresenter])

  // Print certificate
  const printCertificate = async () => {
    if (!lastResult?.abstract?.id) return

    setPrintingCert(true)
    try {
      const res = await fetch("/api/abstracts/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: coordinator?.event_id,
          abstract_ids: [lastResult.abstract.id],
          require_presented: false,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Failed to generate certificate")
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      // Open in new window for printing
      const printWindow = window.open(url, "_blank")
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print()
        }
      }

      setPrintCount((c) => c + 1)
      toast.success("Certificate sent to printer")
      setLastResult(null)
    } catch (err) {
      toast.error("Failed to print certificate")
    } finally {
      setPrintingCert(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-purple-500/30 rounded-full animate-spin border-t-purple-500" />
            <Printer className="absolute inset-0 m-auto h-8 w-8 text-purple-500" />
          </div>
          <p className="mt-4 text-white/60">Loading Print Station...</p>
        </div>
      </div>
    )
  }

  if (error || !coordinator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          <p className="text-white/50">Invalid print station link</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-48 h-48 sm:w-96 sm:h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 sm:w-96 sm:h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Header */}
      <div className="relative z-50 bg-black/40 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
              <Printer className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Certificate Print Station</h1>
              <p className="text-xs text-white/50">{coordinator.hall_name} • {coordinator.event?.short_name || coordinator.event?.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black font-mono text-white">
              {currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-xs text-white/40">Printed: {printCount}</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Scan Button */}
        <button
          onClick={() => setScannerOpen(true)}
          className="w-full flex items-center justify-center gap-3 p-4 sm:p-8 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-3xl text-white font-bold text-lg sm:text-2xl hover:shadow-lg hover:shadow-purple-500/30 transition-all mb-8"
        >
          <QrCode className="h-10 w-10" />
          Scan Badge to Print Certificate
        </button>

        {/* Manual Input */}
        <div className="flex gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
            <Input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualInput.trim()) {
                  lookupPresenter(manualInput.trim())
                  setManualInput("")
                }
              }}
              className="bg-white/5 border-white/10 text-white pl-12 h-14 text-lg rounded-xl"
              placeholder="Enter abstract # or registration #..."
            />
          </div>
          <Button
            onClick={() => {
              if (manualInput.trim()) {
                lookupPresenter(manualInput.trim())
                setManualInput("")
              }
            }}
            disabled={processing || !manualInput.trim()}
            className="bg-purple-500 hover:bg-purple-600 h-14 px-8 rounded-xl"
          >
            {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
          </Button>
        </div>

        {/* Result Card */}
        {lastResult && (
          <div
            className={cn(
              "rounded-3xl border-2 p-8 transition-all",
              lastResult.success
                ? "bg-emerald-500/10 border-emerald-500/50"
                : lastResult.not_presented
                ? "bg-amber-500/10 border-amber-500/50"
                : "bg-red-500/10 border-red-500/50"
            )}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "p-4 rounded-2xl",
                  lastResult.success
                    ? "bg-emerald-500"
                    : lastResult.not_presented
                    ? "bg-amber-500"
                    : "bg-red-500"
                )}
              >
                {lastResult.success ? (
                  <CheckCircle className="h-10 w-10 text-white" />
                ) : lastResult.not_presented ? (
                  <FileText className="h-10 w-10 text-white" />
                ) : (
                  <XCircle className="h-10 w-10 text-white" />
                )}
              </div>
              <div className="flex-1">
                <h2
                  className={cn(
                    "text-2xl font-bold",
                    lastResult.success
                      ? "text-emerald-400"
                      : lastResult.not_presented
                      ? "text-amber-400"
                      : "text-red-400"
                  )}
                >
                  {lastResult.success
                    ? "Ready to Print"
                    : lastResult.not_presented
                    ? "Not Yet Presented"
                    : lastResult.error || "Not Found"}
                </h2>
                {lastResult.abstract && (
                  <div className="mt-4 space-y-2 text-white/70">
                    <p className="text-xl font-semibold text-white">{lastResult.abstract.presenter}</p>
                    {lastResult.abstract.affiliation && (
                      <p className="text-sm">{lastResult.abstract.affiliation}</p>
                    )}
                    <p className="text-sm">
                      <span className="text-white/40">Abstract:</span> {lastResult.abstract.number}
                    </p>
                    <p className="text-sm line-clamp-2">
                      <span className="text-white/40">Title:</span> {lastResult.abstract.title}
                    </p>
                    {lastResult.abstract.presented_at && (
                      <p className="text-sm">
                        <span className="text-white/40">Presented:</span>{" "}
                        {new Date(lastResult.abstract.presented_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Print Button */}
            {lastResult.success && (
              <div className="mt-6 flex gap-4">
                <Button
                  onClick={printCertificate}
                  disabled={printingCert}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 h-16 text-xl gap-3 rounded-xl"
                >
                  {printingCert ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Printer className="h-6 w-6" />
                  )}
                  Print Certificate
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLastResult(null)}
                  className="h-16 px-6 border-white/20 text-white hover:bg-white/10 rounded-xl"
                >
                  Clear
                </Button>
              </div>
            )}

            {lastResult.not_presented && (
              <p className="mt-4 text-amber-400/80 text-sm">
                This presenter needs to complete their presentation at the podium before their certificate can be printed.
              </p>
            )}
          </div>
        )}

        {/* Empty State */}
        {!lastResult && !processing && (
          <div className="text-center py-16">
            <Award className="h-20 w-20 mx-auto text-white/10 mb-4" />
            <p className="text-white/40 text-lg">Scan a presenter badge to print their certificate</p>
            <p className="text-white/30 text-sm mt-2">Only presenters who have completed their presentation are eligible</p>
          </div>
        )}
      </div>

      {/* QR Scanner Dialog */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md bg-[#0a0a0f] border-white/10 text-white p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-purple-400" />
              Scan Presenter Badge
            </DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <div className="relative aspect-square bg-black rounded-2xl overflow-hidden mb-4">
              <div id="qr-reader-print" className="w-full h-full" />
              {processing && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                  <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
                </div>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => setScannerOpen(false)}
              className="w-full border-white/20 text-white hover:bg-white/10"
            >
              Close Scanner
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
