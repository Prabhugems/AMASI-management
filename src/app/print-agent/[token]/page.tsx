"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Printer,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  History,
  Power,
  Settings,
  RefreshCw,
  Zap,
  Clock,
} from "lucide-react"

interface StationInfo {
  id: string
  name: string
  print_settings: any
  badge_template: any
  event: { id: string; name: string; short_name: string } | null
}

interface QueueJob {
  id: string
  print_number: number
  status: string
  registration_data: any
  created_at: string
  registrations: {
    id: string
    registration_number: string
    attendee_name: string
    attendee_email: string
    attendee_phone: string | null
    attendee_institution: string | null
    attendee_designation: string | null
    ticket_type_id: string | null
    status: string
    ticket_types: { name: string } | null
  }
}

interface PrintedJob {
  id: string
  name: string
  regNumber: string
  time: string
  status: "success" | "failed"
  error?: string
}

export default function PrintAgentPage() {
  const params = useParams()
  const token = params.token as string

  const [station, setStation] = useState<StationInfo | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [printerIp, setPrinterIp] = useState("")
  const [printerPort, setPrinterPort] = useState("9100")
  const [configured, setConfigured] = useState(false)
  const [polling, setPolling] = useState(false)
  const [jobsProcessed, setJobsProcessed] = useState(0)
  const [printedJobs, setPrintedJobs] = useState<PrintedJob[]>([])
  const [currentJob, setCurrentJob] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const agentIdRef = useRef(`agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)

  // Connect to station
  useEffect(() => {
    const connect = async () => {
      try {
        const res = await fetch(`/api/print-stations?token=${token}`)
        if (!res.ok) throw new Error("Invalid station token")
        const data = await res.json()
        setStation({
          id: data.id,
          name: data.name,
          print_settings: data.print_settings,
          badge_template: data.badge_templates,
          event: data.events,
        })
        // Pre-fill printer IP from station settings
        if (data.print_settings?.printer_ip) {
          setPrinterIp(data.print_settings.printer_ip)
          setPrinterPort(String(data.print_settings.printer_port || 9100))
        }
        setConnected(true)
      } catch (err: any) {
        setError(err.message || "Failed to connect")
      } finally {
        setLoading(false)
      }
    }
    connect()
  }, [token])

  // Send ZPL to Zebra printer via server-side TCP
  const sendToZebra = useCallback(async (zpl: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/print-stations/zpl-print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printer_ip: printerIp,
          printer_port: parseInt(printerPort),
          test_print: false,
          // We're sending pre-generated ZPL, but the API generates it from registration data
          // So we use generate_only=false with the actual printer IP
        })
      })
      const result = await res.json()
      return { success: result.success, error: result.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [printerIp, printerPort])

  // Process a single queued job
  const processJob = useCallback(async (job: QueueJob) => {
    const reg = job.registrations || job.registration_data
    const regName = reg?.attendee_name || "Unknown"
    const regNumber = reg?.registration_number || "N/A"

    setCurrentJob(regName)

    try {
      // Generate ZPL from server
      const zplRes = await fetch("/api/print-stations/zpl-print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printer_ip: printerIp,
          printer_port: parseInt(printerPort),
          registration: {
            attendee_name: reg?.attendee_name,
            attendee_email: reg?.attendee_email,
            attendee_phone: reg?.attendee_phone,
            attendee_institution: reg?.attendee_institution,
            attendee_designation: reg?.attendee_designation,
            registration_number: reg?.registration_number,
            ticket_type: reg?.ticket_types?.name || "",
          },
          station: {
            id: station?.id,
            print_settings: station?.print_settings,
            events: station?.event,
          },
          badge_template: station?.badge_template,
        })
      })

      const zplResult = await zplRes.json()

      if (zplResult.success) {
        // Mark as completed
        await fetch("/api/print-stations/queue", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_id: job.id,
            status: "completed",
            agent_id: agentIdRef.current,
          })
        })

        setPrintedJobs(prev => [{
          id: job.id,
          name: regName,
          regNumber,
          time: new Date().toLocaleTimeString(),
          status: "success" as const,
        }, ...prev].slice(0, 50))

        setJobsProcessed(prev => prev + 1)
      } else {
        throw new Error(zplResult.error || "Print failed")
      }
    } catch (err: any) {
      // Mark as failed
      await fetch("/api/print-stations/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: job.id,
          status: "failed",
          error_message: err.message,
          agent_id: agentIdRef.current,
        })
      })

      setPrintedJobs(prev => [{
        id: job.id,
        name: regName,
        regNumber,
        time: new Date().toLocaleTimeString(),
        status: "failed" as const,
        error: err.message,
      }, ...prev].slice(0, 50))
    }

    setCurrentJob(null)
  }, [printerIp, printerPort, station])

  // Poll for queued jobs
  const pollQueue = useCallback(async () => {
    if (!configured || !connected) return

    try {
      const res = await fetch(
        `/api/print-stations/queue?token=${token}&agent_id=${agentIdRef.current}`
      )
      if (!res.ok) return

      const data = await res.json()

      if (data.jobs && data.jobs.length > 0) {
        // Process jobs sequentially
        for (const job of data.jobs) {
          await processJob(job)
        }
      }
    } catch (err) {
      console.error("Poll error:", err)
    }
  }, [configured, connected, token, processJob])

  // Start/stop polling
  const startPolling = useCallback(() => {
    if (pollingRef.current) return
    setPolling(true)
    // Poll every 2 seconds
    pollingRef.current = setInterval(pollQueue, 2000)
    // Also poll immediately
    pollQueue()
  }, [pollQueue])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setPolling(false)
  }, [])

  // Auto-start polling when configured
  useEffect(() => {
    if (configured && connected) {
      startPolling()
    }
    return () => stopPolling()
  }, [configured, connected, startPolling, stopPolling])

  // Test printer connection
  const testPrinter = async () => {
    setTestStatus(null)
    try {
      const res = await fetch("/api/print-stations/zpl-print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printer_ip: printerIp,
          printer_port: parseInt(printerPort),
          test_print: true,
        })
      })
      const result = await res.json()
      if (result.success) {
        setTestStatus({ success: true, message: "Test label printed! Check your Zebra." })
      } else {
        setTestStatus({ success: false, message: result.error || "Connection failed" })
      }
    } catch (err: any) {
      setTestStatus({ success: false, message: err.message || "Connection failed" })
    }
  }

  const handleConfigure = () => {
    if (!printerIp.trim()) return
    setConfigured(true)
    setShowSettings(false)
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
          <p className="mt-4 text-gray-400 text-lg">Connecting to print station...</p>
        </div>
      </div>
    )
  }

  // Error
  if (error || !station) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-white">Connection Failed</h1>
          <p className="mt-2 text-gray-400">{error || "Station not found"}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-3 bg-gray-800 rounded-xl text-white hover:bg-gray-700"
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Setup screen (enter printer IP)
  if (!configured || showSettings) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Printer className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Print Agent</h1>
            <p className="text-gray-400 mt-1">{station.event?.name}</p>
            <p className="text-gray-500 text-sm">{station.name}</p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-4">Zebra Printer Setup</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Printer IP Address</label>
                <input
                  type="text"
                  value={printerIp}
                  onChange={(e) => setPrinterIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Find it on the Zebra config label (hold Feed button for 5 seconds)
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Port</label>
                <input
                  type="text"
                  value={printerPort}
                  onChange={(e) => setPrinterPort(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Test Connection */}
              <button
                onClick={testPrinter}
                disabled={!printerIp.trim()}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-300 hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Test Print
              </button>

              {testStatus && (
                <div className={`p-3 rounded-xl flex items-center gap-2 text-sm ${
                  testStatus.success
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                    : "bg-red-500/10 border border-red-500/30 text-red-400"
                }`}>
                  {testStatus.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {testStatus.message}
                </div>
              )}

              {/* Start Agent */}
              <button
                onClick={handleConfigure}
                disabled={!printerIp.trim()}
                className="w-full px-4 py-4 bg-blue-600 rounded-xl text-white font-semibold text-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Power className="w-5 h-5" />
                Start Print Agent
              </button>
            </div>
          </div>

          <p className="text-center text-gray-600 text-xs mt-6">
            This laptop must be on the same WiFi network as the Zebra printer.
            <br />
            Keep this page open — it will auto-print badges from the iPad kiosk.
          </p>
        </div>
      </div>
    )
  }

  // Main agent view (running)
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Print Agent</h1>
              <p className="text-sm text-gray-400">{station.event?.name} &middot; {station.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              {polling ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <Wifi className="w-4 h-4" />
                  Listening
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-400">
                  <WifiOff className="w-4 h-4" />
                  Stopped
                </div>
              )}
            </div>

            <button
              onClick={() => { stopPolling(); setShowSettings(true) }}
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Status Dashboard */}
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
              <p className="text-4xl font-bold text-blue-400">{jobsProcessed}</p>
              <p className="text-sm text-gray-400 mt-1">Badges Printed</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
              <div className="flex items-center justify-center gap-2">
                <Printer className="w-5 h-5 text-gray-400" />
                <p className="text-lg font-mono text-gray-300">{printerIp}</p>
              </div>
              <p className="text-sm text-gray-400 mt-1">Zebra ZD230</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
              {polling ? (
                <>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
                    <p className="text-lg font-semibold text-emerald-400">Active</p>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">Polling every 2s</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-red-400">Stopped</p>
                  <button
                    onClick={startPolling}
                    className="mt-2 px-3 py-1 bg-blue-600 rounded-lg text-sm hover:bg-blue-700"
                  >
                    Resume
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Current Job */}
          {currentJob && (
            <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-5 flex items-center gap-4">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <div>
                <p className="text-blue-400 font-semibold text-lg">Printing...</p>
                <p className="text-blue-300">{currentJob}</p>
              </div>
            </div>
          )}

          {/* Waiting state */}
          {!currentJob && polling && printedJobs.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <div className="relative w-20 h-20 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-gray-800" />
                <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-gray-300">Waiting for print jobs...</h2>
              <p className="text-gray-500 mt-2">
                Scan badges on the iPad kiosk — they will print here automatically.
              </p>
            </div>
          )}

          {/* Print History */}
          {printedJobs.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-400" />
                <h3 className="font-semibold">Print Log</h3>
                <span className="text-sm text-gray-500 ml-auto">{printedJobs.length} jobs</span>
              </div>
              <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
                {printedJobs.map((job) => (
                  <div key={job.id} className="px-5 py-3 flex items-center gap-4">
                    {job.status === "success" ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{job.name}</p>
                      <p className="text-sm text-gray-500 font-mono">{job.regNumber}</p>
                    </div>
                    {job.error && (
                      <p className="text-xs text-red-400 truncate max-w-48">{job.error}</p>
                    )}
                    <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {job.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <span>Agent ID: {agentIdRef.current.slice(0, 16)}...</span>
          <span>Keep this page open for auto-printing</span>
        </div>
      </footer>
    </div>
  )
}
