"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Html5Qrcode } from "html5-qrcode"
import QRCode from "qrcode"
import {
  Printer,
  Camera,
  CameraOff,
  Keyboard,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  History,
  RefreshCw,
  Search,
  Building,
  Mail,
  Phone,
  Ticket,
  Tag,
  Layers,
  FileText,
  Wifi,
  Clock,
  Power,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  Eye,
  SwitchCamera,
} from "lucide-react"

interface PrintStation {
  id: string
  name: string
  description: string | null
  print_mode: "label" | "overlay" | "full_badge"
  badge_template_id: string | null
  print_settings: {
    paper_size: string
    orientation: string
    rotation?: number
    printer_ip?: string
    printer_port?: number
    margins: { top: number; right: number; bottom: number; left: number }
    scale: number
    copies: number
  }
  is_active: boolean
  allow_reprint: boolean
  max_reprints: number
  auto_print: boolean
  require_checkin: boolean
  access_token: string
  event_id: string
  badge_templates: {
    id: string
    name: string
    template_data: any
  } | null
  events: {
    id: string
    name: string
    short_name: string
  } | null
}

interface Registration {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  attendee_institution: string | null
  attendee_designation: string | null
  ticket_type_id: string | null
  status: string
  ticket_type?: string
  ticket_types?: { name: string } | null
}

interface PrintJob {
  id: string
  print_number: number
  status: string
  printed_at: string
  registrations: {
    registration_number: string
    attendee_name: string
  }
}

type ScanMode = "camera" | "manual"

export default function PrintStationKioskPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
      <PrintStationKioskPage />
    </Suspense>
  )
}

function PrintStationKioskPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params.token as string
  const queryClient = useQueryClient()
  const previewCode = searchParams.get("preview")

  const [scanMode, setScanMode] = useState<ScanMode>("manual")
  const [manualInput, setManualInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [scannedRegistration, setScannedRegistration] = useState<Registration | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)
  const [printSuccess, setPrintSuccess] = useState(false)
  const [_printError, setPrintError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [_isFullscreen, setIsFullscreen] = useState(false)
  const [reprintInfo, setReprintInfo] = useState<{ is_reprint: boolean; print_number: number } | null>(null)
  const [zplPrinting, setZplPrinting] = useState(false)
  const [zplStatus, setZplStatus] = useState<{ success: boolean; message: string } | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>("")
  const [printerOnline, setPrinterOnline] = useState<boolean | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const printFrameRef = useRef<HTMLIFrameElement>(null)
  const scannerContainerId = "qr-scanner-container"
  const wakeLockRef = useRef<any>(null)

  // Fetch station details by token - always fetch fresh to get updated templates
  const { data: station, isLoading: stationLoading, error: stationError, refetch: refetchStation } = useQuery({
    queryKey: ["print-station", token],
    queryFn: async () => {
      const res = await fetch(`/api/print-stations?token=${token}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Invalid station")
      }
      return res.json() as Promise<PrintStation>
    },
    retry: false,
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true, // Refetch when window regains focus
  })

  // Fetch print history for this station
  const { data: printHistory } = useQuery({
    queryKey: ["print-history", station?.id],
    queryFn: async () => {
      if (!station?.id) return []
      const res = await fetch(`/api/print-stations/print?station_id=${station.id}&limit=20`)
      return res.json() as Promise<PrintJob[]>
    },
    enabled: !!station?.id,
    refetchInterval: 10000
  })

  // Print mutation
  const printMutation = useMutation({
    mutationFn: async (registrationNumber: string) => {
      const hasDirectPrinter = !!station?.print_settings?.printer_ip

      // When Zebra IP is configured, create job as "completed" (we'll print locally)
      // No queue needed — iPad sends ZPL directly to printer via HTTP
      const res = await fetch("/api/print-stations/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          registration_number: registrationNumber,
          queue: false,
          device_info: {
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          }
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Print failed")
      }

      // If we have a direct printer, generate ZPL and send it
      if (hasDirectPrinter) {
        const { generateZPL } = await import("@/lib/zpl-generator")
        const { sendZPLToZebra } = await import("@/lib/zebra-printer")

        const reg = data.registration
        const zpl = generateZPL(
          {
            attendee_name: reg.attendee_name,
            attendee_email: reg.attendee_email,
            attendee_phone: reg.attendee_phone,
            attendee_institution: reg.attendee_institution,
            attendee_designation: reg.attendee_designation,
            registration_number: reg.registration_number,
            ticket_type: reg.ticket_type,
            ticket_types: reg.ticket_types,
          },
          {
            id: station?.id,
            name: station?.name,
            print_settings: station?.print_settings,
            events: station?.events,
          },
          station?.badge_templates,
          station?.print_mode
        )

        const printResult = await sendZPLToZebra(station!.print_settings!.printer_ip!, zpl)

        if (!printResult.success) {
          // Fallback: queue the job with pre-generated ZPL for print agent
          await fetch("/api/print-stations/queue", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              job_id: data.job_id,
              status: "queued",
              zpl_data: zpl,
            })
          })
          return { ...data, directPrintFailed: true, fallbackQueued: true }
        }

        return { ...data, directPrinted: true }
      }

      return data
    },
    onSuccess: (data) => {
      setScannedRegistration(data.registration)
      setReprintInfo({ is_reprint: data.is_reprint, print_number: data.print_number })
      queryClient.invalidateQueries({ queryKey: ["print-history", station?.id] })

      if (soundEnabled) playSuccessSound()

      const hasDirectPrinter = !!station?.print_settings?.printer_ip

      // Direct print to Zebra succeeded
      if (data.directPrinted) {
        setZplStatus({ success: true, message: "Printed!" })
        setPrintSuccess(true)
        // Auto-reset after 1.5s for next scan
        setTimeout(() => {
          resetScan()
        }, 1500)
        return
      }

      // Direct print failed, fell back to queue
      if (data.directPrintFailed) {
        setZplStatus({
          success: false,
          message: data.fallbackQueued
            ? "Printer unreachable — queued for print agent"
            : "Print failed"
        })
        setPrintSuccess(true)
        setTimeout(() => {
          setZplStatus(null)
          setPrintSuccess(false)
          setReprintInfo(null)
        }, 4000)
        return
      }

      // Browser print path (no Zebra configured)
      if (!hasDirectPrinter && (station?.auto_print || isPrinting)) {
        const printData = {
          registration: data.registration,
          station: {
            id: station?.id,
            name: station?.name,
            print_mode: station?.print_mode,
            print_settings: station?.print_settings,
            events: station?.events
          },
          badge_template: station?.badge_templates
        }
        triggerPrint(printData)
      }

      setPrintSuccess(true)
      setTimeout(() => {
        setPrintSuccess(false)
        setReprintInfo(null)
      }, 3000)
    },
    onError: (error: Error) => {
      setError(error.message)
      setPrintError(error.message)
      if (soundEnabled) playErrorSound()
      setTimeout(() => {
        setError(null)
        setPrintError(null)
      }, 5000)
    }
  })

  // Auto focus input
  useEffect(() => {
    if (scanMode === "manual" && inputRef.current) {
      inputRef.current.focus()
    }
  }, [scanMode, scannedRegistration])

  // Auto-load preview registration from URL parameter
  useEffect(() => {
    if (previewCode && station && !scannedRegistration) {
      printMutation.mutate(previewCode)
    }
  }, [previewCode, station])

  // Handle keyboard shortcut for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F11" || (e.key === "f" && e.metaKey)) {
        e.preventDefault()
        toggleFullscreen()
      }
      if (e.key === "Escape" && scannedRegistration) {
        resetScan()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [scannedRegistration])

  const playSuccessSound = () => {
    // Use Web Audio API to generate a simple success beep
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.frequency.value = 800
      oscillator.type = "sine"
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch (_e) {
      // Silently fail if audio not supported
    }
  }

  const playErrorSound = () => {
    // Use Web Audio API to generate a simple error beep
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.frequency.value = 300
      oscillator.type = "square"
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.4)
    } catch (_e) {
      // Silently fail if audio not supported
    }
  }

  const toggleFullscreen = () => {
    const doc = document as any
    const el = document.documentElement as any
    if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
      // Try standard first, then webkit (Safari/iPad)
      if (el.requestFullscreen) {
        el.requestFullscreen()
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen()
      }
      setIsFullscreen(true)
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen()
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen()
      }
      setIsFullscreen(false)
    }
  }

  // Wake Lock - prevent iPad/tablet from sleeping
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen")
        }
      } catch (_e) {
        // Wake Lock not supported or permission denied
      }
    }
    requestWakeLock()

    // Re-acquire wake lock when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (wakeLockRef.current) {
        wakeLockRef.current.release()
        wakeLockRef.current = null
      }
    }
  }, [])

  // Printer health check polling (every 15s)
  useEffect(() => {
    const printerIp = station?.print_settings?.printer_ip
    if (!printerIp) return

    let active = true
    const check = async () => {
      try {
        const { isZebraReachable } = await import("@/lib/zebra-printer")
        const online = await isZebraReachable(printerIp)
        if (active) setPrinterOnline(online)
      } catch {
        if (active) setPrinterOnline(false)
      }
    }

    check()
    const interval = setInterval(check, 15000)
    return () => { active = false; clearInterval(interval) }
  }, [station?.print_settings?.printer_ip])

  // Register service worker for PWA
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
  }, [])

  // ===========================================
  // Camera QR Scanner Functions
  // ===========================================

  // Get available cameras
  const getCameras = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras()
      if (devices && devices.length > 0) {
        setCameras(devices)
        // Prefer back camera on mobile
        const backCamera = devices.find(d =>
          d.label.toLowerCase().includes("back") ||
          d.label.toLowerCase().includes("rear") ||
          d.label.toLowerCase().includes("environment")
        )
        setSelectedCameraId(backCamera?.id || devices[0].id)
      }
    } catch (err: any) {
      console.error("Error getting cameras:", err)
      setCameraError("Unable to access camera. Please grant camera permission.")
    }
  }, [])

  // Start camera scanner
  const startScanner = useCallback(async () => {
    if (!selectedCameraId) {
      await getCameras()
      return
    }

    setCameraError(null)

    try {
      // Stop existing scanner if any
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop()
        } catch (_e) {
          // Ignore stop errors
        }
      }

      // Create new scanner instance
      scannerRef.current = new Html5Qrcode(scannerContainerId)

      await scannerRef.current.start(
        selectedCameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          // QR code successfully scanned
          handleQrCodeScanned(decodedText)
        },
        (_errorMessage) => {
          // QR code scanning in progress - ignore errors
        }
      )

      setCameraActive(true)
    } catch (err: any) {
      console.error("Error starting scanner:", err)
      setCameraError(err.message || "Failed to start camera")
      setCameraActive(false)
    }
  }, [selectedCameraId, getCameras])

  // Stop camera scanner
  const stopScanner = useCallback(async () => {
    if (scannerRef.current && cameraActive) {
      try {
        const scanner = scannerRef.current
        // Check if scanner is actually running before stopping
        if (scanner.isScanning) {
          await scanner.stop()
        }
        scannerRef.current = null
      } catch (e) {
        // Ignore stop errors - scanner might already be stopped
        console.log("Scanner stop error (safe to ignore):", e)
      }
    }
    setCameraActive(false)
  }, [cameraActive])

  // Handle scanned QR code
  const handleQrCodeScanned = useCallback((decodedText: string) => {
    // Stop scanner after successful scan
    stopScanner()

    // Play success sound
    if (soundEnabled) playSuccessSound()

    // Process the scanned code (could be registration number or URL)
    let registrationNumber = decodedText

    // If it's a URL, try to extract registration number
    if (decodedText.includes("/")) {
      const parts = decodedText.split("/")
      registrationNumber = parts[parts.length - 1]
    }

    // Clean up the registration number
    registrationNumber = registrationNumber.trim()

    // Trigger the print mutation with scanned code
    setError(null)
    setIsPrinting(true)
    printMutation.mutate(registrationNumber)
  }, [soundEnabled, stopScanner])

  // Switch camera (front/back)
  const switchCamera = useCallback(async () => {
    if (cameras.length < 2) return

    const currentIndex = cameras.findIndex(c => c.id === selectedCameraId)
    const nextIndex = (currentIndex + 1) % cameras.length
    setSelectedCameraId(cameras[nextIndex].id)

    // Restart scanner with new camera
    if (cameraActive) {
      await stopScanner()
      // Small delay before restarting
      setTimeout(() => {
        startScanner()
      }, 300)
    }
  }, [cameras, selectedCameraId, cameraActive, stopScanner, startScanner])

  // Initialize cameras when switching to camera mode
  useEffect(() => {
    if (scanMode === "camera" && !scannedRegistration) {
      getCameras()
    } else if (scanMode === "manual") {
      stopScanner()
    }

    // Cleanup on unmount
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [scanMode, scannedRegistration, getCameras, stopScanner])

  // Start scanner when camera is selected and mode is camera
  useEffect(() => {
    if (scanMode === "camera" && selectedCameraId && !scannedRegistration && !cameraActive) {
      startScanner()
    }
  }, [scanMode, selectedCameraId, scannedRegistration, cameraActive, startScanner])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualInput.trim()) return

    setError(null)
    setIsPrinting(true)
    printMutation.mutate(manualInput.trim())
    setManualInput("")
  }

  const _handlePrint = () => {
    if (!scannedRegistration) return
    setIsPrinting(true)
    printMutation.mutate(scannedRegistration.registration_number)
  }

  const triggerPrint = async (data: any, _downloadPdf = false) => {
    // Pre-generate QR code data URLs for all QR elements in the template
    const badgeTemplate = data.badge_template || station?.badge_templates
    if (badgeTemplate?.template_data?.elements) {
      const elements = badgeTemplate.template_data.elements
      for (const el of elements) {
        if (el.type === "qr_code") {
          const qrValue = replacePlaceholders(el.content || "", data.registration)
          if (qrValue) {
            try {
              el._qrDataUrl = await QRCode.toDataURL(qrValue, {
                width: Math.min(el.width, el.height) * 2,
                margin: 1,
                errorCorrectionLevel: "M",
              })
            } catch (_e) {
              // Fallback to external API if QRCode fails
            }
          }
        }
      }
    }

    // Create printable content based on print mode and template
    const printContent = generatePrintContent(data)

    // Use hidden iframe for printing (works on iPad Safari unlike window.open)
    const iframe = printFrameRef.current
    if (iframe) {
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(printContent)
        doc.close()

        // Wait for fonts/images to load then trigger print
        setTimeout(() => {
          try {
            iframe.contentWindow?.print()
          } catch (_e) {
            // Fallback: open in new tab if iframe print fails
            const blob = new Blob([printContent], { type: "text/html" })
            const url = URL.createObjectURL(blob)
            window.open(url, "_blank")
            setTimeout(() => URL.revokeObjectURL(url), 10000)
          }
        }, 600)
      }
    }

    setIsPrinting(false)
  }

  // Direct ZPL print to Zebra (used by manual "Print to Zebra" button)
  const triggerZplPrint = async (data: any) => {
    setZplPrinting(true)
    setZplStatus(null)

    try {
      const { generateZPL } = await import("@/lib/zpl-generator")
      const { sendZPLToZebra } = await import("@/lib/zebra-printer")

      const reg = data.registration
      const zpl = generateZPL(
        {
          attendee_name: reg.attendee_name,
          attendee_email: reg.attendee_email,
          attendee_phone: reg.attendee_phone,
          attendee_institution: reg.attendee_institution,
          attendee_designation: reg.attendee_designation,
          registration_number: reg.registration_number,
          ticket_type: reg.ticket_type,
          ticket_types: reg.ticket_types,
        },
        {
          id: station?.id,
          name: station?.name,
          print_settings: station?.print_settings,
          events: station?.events,
        },
        station?.badge_templates,
        station?.print_mode
      )

      const result = await sendZPLToZebra(station!.print_settings!.printer_ip!, zpl)

      if (result.success) {
        setZplStatus({ success: true, message: "Printed!" })
        if (soundEnabled) playSuccessSound()
        setPrintSuccess(true)
        setTimeout(() => resetScan(), 1500)
      } else {
        setZplStatus({ success: false, message: result.error || "Print failed" })
        if (soundEnabled) playErrorSound()
      }
    } catch (err: any) {
      setZplStatus({ success: false, message: err.message || "Print failed" })
      if (soundEnabled) playErrorSound()
    }

    setZplPrinting(false)
  }

  // Check if direct ZPL printing is available
  const hasZplPrinter = !!station?.print_settings?.printer_ip

  // Replace placeholders in text with registration data
  const replacePlaceholders = (text: string, reg: any) => {
    if (!text) return ""
    let result = text
    result = result.replace(/\{\{name\}\}/g, reg?.attendee_name || "")
    result = result.replace(/\{\{registration_number\}\}/g, reg?.registration_number || "")
    result = result.replace(/\{\{ticket_type\}\}/g, reg?.ticket_type || reg?.ticket_types?.name || "")
    result = result.replace(/\{\{email\}\}/g, reg?.attendee_email || "")
    result = result.replace(/\{\{phone\}\}/g, reg?.attendee_phone || "")
    result = result.replace(/\{\{institution\}\}/g, reg?.attendee_institution || "")
    result = result.replace(/\{\{designation\}\}/g, reg?.attendee_designation || "")
    result = result.replace(/\{\{event_name\}\}/g, station?.events?.name || "")
    result = result.replace(/\{\{event_date\}\}/g, "")
    return result
  }

  // Render a single badge element to HTML
  const renderElementToHtml = (element: any, registration: any): string => {
    const content = replacePlaceholders(element.content || "", registration)
    const rotation = element.rotation || 0
    const opacity = (element.opacity ?? 100) / 100

    const baseStyle = `
      position: absolute;
      left: ${element.x}px;
      top: ${element.y}px;
      width: ${element.width}px;
      height: ${element.height}px;
      z-index: ${element.zIndex || 0};
      opacity: ${opacity};
      ${rotation ? `transform: rotate(${rotation}deg); transform-origin: center center;` : ""}
    `

    if (element.type === "shape") {
      const gradientBg = element.gradient?.enabled && element.gradient.colors.length >= 2
        ? element.gradient.type === "radial"
          ? `radial-gradient(circle, ${element.gradient.colors.join(", ")})`
          : `linear-gradient(${element.gradient.angle || 0}deg, ${element.gradient.colors.join(", ")})`
        : null

      const bgStyle = gradientBg ? `background-image: ${gradientBg};` : `background-color: ${element.backgroundColor || "#e5e7eb"};`
      const borderStyle = element.borderWidth ? `border: ${element.borderWidth}px solid ${element.borderColor || "transparent"};` : ""
      const radiusStyle = element.shapeType === "circle" ? "border-radius: 50%;" : `border-radius: ${element.borderRadius || 0}px;`

      if (element.shapeType === "triangle") {
        return `<div style="${baseStyle}">
          <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
            <polygon points="50,0 100,100 0,100" fill="${element.backgroundColor || "#e5e7eb"}" />
          </svg>
        </div>`
      }

      return `<div style="${baseStyle} ${bgStyle} ${borderStyle} ${radiusStyle}"></div>`
    }

    if (element.type === "image") {
      if (element.imageUrl) {
        return `<div style="${baseStyle}">
          <img src="${element.imageUrl}" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>`
      }
      return ""
    }

    if (element.type === "photo") {
      if (element.imageUrl) {
        return `<div style="${baseStyle}">
          <img src="${element.imageUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: ${element.borderRadius || 0}px; border: ${element.borderWidth || 0}px solid ${element.borderColor || "transparent"};" />
        </div>`
      }
      return ""
    }

    if (element.type === "line") {
      return `<div style="${baseStyle} display: flex; align-items: center;">
        <div style="width: 100%; height: ${Math.max(1, element.height)}px; background-color: ${element.color || "#000000"};"></div>
      </div>`
    }

    if (element.type === "qr_code") {
      const qrValue = replacePlaceholders(element.content || "", registration)
      const qrSize = Math.min(element.width, element.height)
      // Use pre-generated data URL if available, fallback to external API
      const qrDataUrl = element._qrDataUrl
      const qrSrc = qrDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(qrValue)}`
      return `<div style="${baseStyle} display: flex; align-items: center; justify-content: center;">
        <img src="${qrSrc}" style="width: ${qrSize}px; height: ${qrSize}px;" />
      </div>`
    }

    if (element.type === "barcode") {
      // For barcodes, we'll show a placeholder - actual barcode rendering would need jsbarcode
      return `<div style="${baseStyle} display: flex; align-items: center; justify-content: center; font-family: monospace; font-size: 12px;">
        ${content}
      </div>`
    }

    // Text element
    const shadowStyle = element.shadowEnabled
      ? `text-shadow: ${element.shadowOffsetX || 2}px ${element.shadowOffsetY || 2}px ${element.shadowBlur || 4}px ${element.shadowColor || "rgba(0,0,0,0.3)"};`
      : ""

    return `<div style="
      ${baseStyle}
      display: flex;
      align-items: center;
      overflow: hidden;
      white-space: pre-wrap;
      font-size: ${element.fontSize || 14}px;
      font-family: ${element.fontFamily || "Arial, sans-serif"};
      font-weight: ${element.fontWeight || "normal"};
      font-style: ${element.fontStyle || "normal"};
      color: ${element.color || "#000000"};
      text-align: ${element.align || "left"};
      justify-content: ${element.align === "center" ? "center" : element.align === "right" ? "flex-end" : "flex-start"};
      background-color: ${element.backgroundColor || "transparent"};
      line-height: ${element.lineHeight || 1.3};
      letter-spacing: ${element.letterSpacing ? `${element.letterSpacing}px` : "normal"};
      ${shadowStyle}
      border: ${element.borderWidth || 0}px solid ${element.borderColor || "transparent"};
      border-radius: ${element.borderRadius || 0}px;
    ">${content}</div>`
  }

  const generatePrintContent = (data: any) => {
    const { registration, station: stationInfo, badge_template } = data
    const settings = stationInfo.print_settings || {}
    const dimensions = getPaperDimensions(settings.paper_size, settings.orientation)
    const isOverlayMode = stationInfo.print_mode === "overlay"
    // Overlay mode: NO rotation (pre-printed stock orientation is fixed)
    // Full badge/label: 180° rotation for thermal printers (labels feed bottom-first)
    const rotation = isOverlayMode ? 0 : (settings.rotation ?? 180)

    // If we have a badge template, render it
    if (badge_template?.template_data) {
      const templateData = badge_template.template_data
      let elements = templateData.elements || []
      // For overlay mode: transparent background, skip background images (keep only variable data)
      const bgColor = isOverlayMode ? "transparent" : (templateData.backgroundColor || "#ffffff")

      if (isOverlayMode) {
        // Overlay mode: Only print variable data on pre-printed stock
        // Skip images, shapes, lines - all design elements are pre-printed
        // Keep ONLY: text, QR codes, barcodes (variable content)
        elements = elements.filter((el: any) => {
          // Keep only variable content elements
          if (el.type === "text" || el.type === "qr_code" || el.type === "barcode") {
            return true
          }
          // Skip everything else: image, photo, shape, line
          return false
        })
      }

      // Get Google Fonts used in the template
      const googleFonts = new Set<string>()
      elements.forEach((el: any) => {
        if (el.fontFamily && el.fontFamily.includes("'")) {
          const fontName = el.fontFamily.match(/'([^']+)'/)?.[1]
          if (fontName) googleFonts.add(fontName.replace(/ /g, "+"))
        }
      })
      const googleFontsLink = googleFonts.size > 0
        ? `<link href="https://fonts.googleapis.com/css2?${Array.from(googleFonts).map(f => `family=${f}:wght@400;500;600;700`).join("&")}&display=swap" rel="stylesheet" />`
        : ""

      // Sort elements by zIndex
      const sortedElements = [...elements].sort((a: any, b: any) => (a.zIndex || 0) - (b.zIndex || 0))
      const elementsHtml = sortedElements.map((el: any) => renderElementToHtml(el, registration)).join("\n")

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print Badge - ${registration.attendee_name}</title>
          ${googleFontsLink}
          <style>
            @page {
              size: ${dimensions.width} ${dimensions.height};
              margin: 0;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body {
              width: ${dimensions.width};
              height: ${dimensions.height};
              overflow: hidden;
            }
            .badge-wrapper {
              width: ${dimensions.width};
              height: ${dimensions.height};
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .badge-container {
              position: relative;
              width: ${dimensions.width};
              height: ${dimensions.height};
              background-color: ${bgColor};
              overflow: hidden;
              ${rotation ? `transform: rotate(${rotation}deg); transform-origin: center center;` : ""}
            }
            @media print {
              html, body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              * {
                -webkit-font-smoothing: none !important;
                text-rendering: geometricPrecision !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="badge-wrapper">
            <div class="badge-container">
              ${elementsHtml}
            </div>
          </div>
        </body>
        </html>
      `
    }

    // Fallback: Simple default layout if no template
    const isLabel = stationInfo.print_mode === "label"
    const ticketTypeName = registration.ticket_type || registration.ticket_types?.name || "Attendee"
    const eventName = station?.events?.name || stationInfo?.events?.name || "Event"

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Badge - ${registration.attendee_name}</title>
        <style>
          @page { size: ${dimensions.width} ${dimensions.height}; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: ${dimensions.width}; height: ${dimensions.height}; font-family: Arial, sans-serif; background: white; overflow: hidden; }
          .badge-wrapper { width: ${dimensions.width}; height: ${dimensions.height}; display: flex; align-items: center; justify-content: center; }
          .badge { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: ${isLabel ? "5mm" : "10mm"}; text-align: center; background: white; ${rotation ? `transform: rotate(${rotation}deg); transform-origin: center center;` : ""} }
          .event-name { font-size: ${isLabel ? "10pt" : "14pt"}; font-weight: bold; color: #333; margin-bottom: ${isLabel ? "3mm" : "8mm"}; text-transform: uppercase; }
          .attendee-name { font-size: ${isLabel ? "16pt" : "28pt"}; font-weight: bold; color: #000; margin-bottom: ${isLabel ? "2mm" : "5mm"}; }
          .designation { font-size: ${isLabel ? "11pt" : "16pt"}; color: #444; margin-bottom: 2mm; }
          .institution { font-size: ${isLabel ? "10pt" : "14pt"}; color: #666; margin-bottom: ${isLabel ? "3mm" : "6mm"}; }
          .ticket-type { font-size: ${isLabel ? "11pt" : "16pt"}; font-weight: bold; color: white; background: #333; padding: 2mm 6mm; border-radius: 2mm; margin-bottom: 3mm; }
          .reg-number { font-size: ${isLabel ? "9pt" : "11pt"}; color: #888; font-family: monospace; }
          @media print { html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
        </style>
      </head>
      <body>
        <div class="badge-wrapper">
          <div class="badge">
            <div class="event-name">${eventName}</div>
            <div class="attendee-name">${registration.attendee_name}</div>
            ${registration.attendee_designation ? `<div class="designation">${registration.attendee_designation}</div>` : ""}
            ${registration.attendee_institution ? `<div class="institution">${registration.attendee_institution}</div>` : ""}
            <div class="ticket-type">${ticketTypeName}</div>
            <div class="reg-number">${registration.registration_number}</div>
          </div>
        </div>
      </body>
      </html>
    `
  }

  const getPaperDimensions = (paperSize: string, orientation: string) => {
    const sizes: Record<string, { width: string; height: string }> = {
      "4x2": { width: "4in", height: "2in" },
      "4x3": { width: "4in", height: "3in" },
      "4x6": { width: "4in", height: "6in" },
      "a6": { width: "105mm", height: "148mm" },
      "a5": { width: "148mm", height: "210mm" }
    }

    const size = sizes[paperSize] || sizes["4x6"]

    if (orientation === "landscape") {
      return { width: size.height, height: size.width }
    }

    return size
  }

  const _renderBadgeTemplate = (templateData: any, registration: Registration) => {
    // Basic template rendering - this would be more sophisticated in production
    let html = templateData.html || ""

    // Replace placeholders
    html = html.replace(/\{name\}/g, registration.attendee_name)
    html = html.replace(/\{email\}/g, registration.attendee_email)
    html = html.replace(/\{institution\}/g, registration.attendee_institution || "")
    html = html.replace(/\{designation\}/g, registration.attendee_designation || "")
    html = html.replace(/\{registration_number\}/g, registration.registration_number)
    html = html.replace(/\{ticket_type\}/g, registration.ticket_type || registration.ticket_types?.name || "")

    return html
  }

  const resetScan = () => {
    setScannedRegistration(null)
    setError(null)
    setPrintError(null)
    setPrintSuccess(false)
    setManualInput("")
    setReprintInfo(null)
    setZplStatus(null)

    // If in camera mode, restart the scanner
    if (scanMode === "camera") {
      // Small delay to allow state to update
      setTimeout(() => {
        startScanner()
      }, 300)
    } else if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const getPrintModeIcon = (mode: string) => {
    switch (mode) {
      case "label": return <Tag className="w-5 h-5" />
      case "overlay": return <Layers className="w-5 h-5" />
      case "full_badge": return <FileText className="w-5 h-5" />
      default: return <Printer className="w-5 h-5" />
    }
  }

  const getPrintModeLabel = (mode: string) => {
    switch (mode) {
      case "label": return "Label Print"
      case "overlay": return "Overlay Print"
      case "full_badge": return "Full Badge"
      default: return mode
    }
  }

  const getPrintModeColor = (mode: string) => {
    switch (mode) {
      case "label": return "from-amber-500 to-orange-500"
      case "overlay": return "from-purple-500 to-pink-500"
      case "full_badge": return "from-blue-500 to-cyan-500"
      default: return "from-gray-500 to-gray-600"
    }
  }

  // Loading state
  if (stationLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-border"></div>
            <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-6 text-muted-foreground font-medium text-lg">Connecting to print station...</p>
        </div>
      </div>
    )
  }

  // Error state - invalid token
  if (stationError || !station) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-12 h-12 text-destructive" />
          </div>
          <h1 className="mt-6 text-2xl font-bold">Station Not Found</h1>
          <p className="mt-3 text-muted-foreground">
            This print station link is invalid or has expired. Please contact the event organizer for a valid link.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 flex items-center gap-2 px-6 py-3 bg-muted rounded-xl mx-auto hover:bg-muted/80 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Inactive station
  if (!station.is_active) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-12 h-12 text-amber-500" />
          </div>
          <h1 className="mt-6 text-2xl font-bold">Station Inactive</h1>
          <p className="mt-3 text-muted-foreground">
            This print station is currently inactive. Please contact the event organizer to activate it.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 bg-gradient-to-br ${getPrintModeColor(station.print_mode)} rounded-xl flex items-center justify-center text-white shadow-lg`}>
              {getPrintModeIcon(station.print_mode)}
            </div>
            <div>
              <h1 className="font-bold text-lg">{station.name}</h1>
              <p className="text-sm text-muted-foreground">
                {station.events?.name} • {getPrintModeLabel(station.print_mode)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetchStation()}
              className="p-2.5 bg-muted rounded-xl hover:bg-muted/80 transition-colors"
              title="Refresh template"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-xl transition-colors ${
                soundEnabled ? "bg-muted text-foreground" : "bg-muted/50 text-muted-foreground"
              }`}
              title={soundEnabled ? "Mute sounds" : "Enable sounds"}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2.5 rounded-xl transition-colors ${
                showHistory ? "bg-purple-500/20 text-purple-600" : "bg-muted text-foreground"
              }`}
              title="Print history"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2.5 bg-muted rounded-xl hover:bg-muted/80 transition-colors"
              title="Toggle fullscreen (F11)"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Main Content */}
        <div className={`flex-1 p-4 flex flex-col ${showHistory ? "max-w-2xl" : ""}`}>
          {/* Scan Input Section */}
          <div className="flex-1 flex items-center justify-center">
            {!scannedRegistration ? (
              <div className="w-full max-w-lg">
                {/* Mode Toggle */}
                <div className="flex bg-muted rounded-xl p-1 mb-6">
                  <button
                    onClick={() => setScanMode("manual")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                      scanMode === "manual"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Keyboard className="w-5 h-5" />
                    Manual Entry
                  </button>
                  <button
                    onClick={() => setScanMode("camera")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                      scanMode === "camera"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Camera className="w-5 h-5" />
                    Camera Scan
                  </button>
                </div>

                {scanMode === "manual" ? (
                  <form onSubmit={handleManualSubmit}>
                    <div className="relative">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
                      <input
                        ref={inputRef}
                        type="text"
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        placeholder="Scan QR code or enter registration number..."
                        className="w-full pl-14 pr-6 py-5 bg-muted border-2 border-border rounded-2xl text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder-muted-foreground"
                        autoFocus
                        autoComplete="off"
                      />
                    </div>
                    {printMutation.isPending && (
                      <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Looking up attendee...</span>
                      </div>
                    )}
                  </form>
                ) : (
                  <div className="bg-muted rounded-2xl p-4 border-2 border-border">
                    {/* Camera Scanner Container */}
                    <div className="relative">
                      {/* Scanner viewport */}
                      <div
                        id={scannerContainerId}
                        className="w-full aspect-square max-w-sm mx-auto rounded-xl overflow-hidden bg-black"
                      />

                      {/* Scanner overlay with targeting box */}
                      {cameraActive && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                          <div className="w-64 h-64 border-2 border-white/50 rounded-lg relative">
                            {/* Corner indicators */}
                            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-purple-500 rounded-tl-lg" />
                            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-purple-500 rounded-tr-lg" />
                            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-purple-500 rounded-bl-lg" />
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-purple-500 rounded-br-lg" />
                            {/* Scanning line animation */}
                            <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-pulse" style={{ top: '50%' }} />
                          </div>
                        </div>
                      )}

                      {/* Camera controls */}
                      {cameraActive && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                          {cameras.length > 1 && (
                            <button
                              onClick={switchCamera}
                              className="p-3 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
                              title="Switch camera"
                            >
                              <SwitchCamera className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={stopScanner}
                            className="p-3 bg-red-500/80 backdrop-blur-sm text-white rounded-full hover:bg-red-600 transition-colors"
                            title="Stop camera"
                          >
                            <CameraOff className="w-5 h-5" />
                          </button>
                        </div>
                      )}

                      {/* Loading state */}
                      {!cameraActive && !cameraError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-xl">
                          <div className="text-center text-white">
                            <Loader2 className="w-10 h-10 mx-auto animate-spin" />
                            <p className="mt-3 text-sm">Starting camera...</p>
                          </div>
                        </div>
                      )}

                      {/* Error state */}
                      {cameraError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/90 rounded-xl p-6">
                          <div className="text-center">
                            <XCircle className="w-12 h-12 mx-auto text-red-500" />
                            <p className="mt-3 text-sm text-white">{cameraError}</p>
                            <button
                              onClick={() => {
                                setCameraError(null)
                                startScanner()
                              }}
                              className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600"
                            >
                              Try Again
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Instructions */}
                    <div className="mt-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        Point camera at attendee's QR code
                      </p>
                      {printMutation.isPending && (
                        <div className="mt-3 flex items-center justify-center gap-2 text-purple-600">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm font-medium">Looking up attendee...</span>
                        </div>
                      )}
                    </div>

                    {/* Fallback to manual */}
                    <button
                      onClick={() => setScanMode("manual")}
                      className="mt-4 w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Or enter registration number manually
                    </button>
                  </div>
                )}

                {/* Error Display */}
                {error && (
                  <div className="mt-4 p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-destructive font-medium">{error}</p>
                      <button
                        onClick={resetScan}
                        className="mt-2 text-sm text-destructive/80 hover:underline"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                )}

                {/* Station Info */}
                <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
                  {station.auto_print && (
                    <div className="flex items-center gap-2">
                      <Power className="w-4 h-4 text-emerald-500" />
                      <span>Auto-print enabled</span>
                    </div>
                  )}
                  {station.allow_reprint && (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      <span>Reprints: max {station.max_reprints}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Attendee Found - Show Details */
              <div className="w-full max-w-lg">
                {/* Success Banner */}
                {printSuccess && (
                  <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                    <div>
                      <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                        {reprintInfo?.is_reprint ? `Reprint #${reprintInfo.print_number} successful` : "Print job sent successfully!"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Attendee Card */}
                <div className="bg-card rounded-2xl border-2 border-border overflow-hidden shadow-lg">
                  <div className={`p-6 bg-gradient-to-r ${getPrintModeColor(station.print_mode)} text-white`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white/80 text-sm font-medium">{station.events?.name}</p>
                        <h2 className="text-2xl font-bold mt-1">{scannedRegistration.attendee_name}</h2>
                        {scannedRegistration.attendee_designation && (
                          <p className="mt-1 text-white/90">{scannedRegistration.attendee_designation}</p>
                        )}
                      </div>
                      <div className="px-3 py-1.5 bg-white/20 rounded-lg text-sm font-medium">
                        {scannedRegistration.ticket_type || scannedRegistration.ticket_types?.name || "Attendee"}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {scannedRegistration.attendee_email && (
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm truncate">{scannedRegistration.attendee_email}</span>
                        </div>
                      )}
                      {scannedRegistration.attendee_phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{scannedRegistration.attendee_phone}</span>
                        </div>
                      )}
                      {scannedRegistration.attendee_institution && (
                        <div className="flex items-center gap-3 col-span-2">
                          <Building className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{scannedRegistration.attendee_institution}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Ticket className="w-4 h-4" />
                        <span className="text-sm font-mono">{scannedRegistration.registration_number}</span>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        scannedRegistration.status === "confirmed"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-amber-500/10 text-amber-600"
                      }`}>
                        {scannedRegistration.status}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ZPL Status */}
                {zplStatus && (
                  <div className={`mb-4 p-4 rounded-xl flex items-center gap-3 ${
                    zplStatus.success
                      ? "bg-emerald-500/10 border border-emerald-500/30"
                      : "bg-destructive/10 border border-destructive/30"
                  }`}>
                    {zplStatus.success ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive" />
                    )}
                    <span className={zplStatus.success ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}>
                      {zplStatus.message}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-6 space-y-3">
                  {/* Show ZPL Direct Print button if printer IP is configured */}
                  {hasZplPrinter && (
                    <button
                      onClick={() => {
                        if (scannedRegistration) {
                          const printData = {
                            registration: scannedRegistration,
                            station: {
                              id: station.id,
                              name: station.name,
                              print_mode: station.print_mode,
                              print_settings: station.print_settings,
                              events: station.events
                            },
                            badge_template: station.badge_templates
                          }
                          triggerZplPrint(printData)
                        }
                      }}
                      disabled={zplPrinting}
                      className={`w-full flex items-center justify-center gap-2 px-5 py-4 bg-gradient-to-r ${getPrintModeColor(station.print_mode)} text-white rounded-xl font-medium hover:opacity-90 transition-all shadow-lg disabled:opacity-50`}
                    >
                      {zplPrinting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Sending to Printer...
                        </>
                      ) : (
                        <>
                          <Printer className="w-5 h-5" />
                          Print to Zebra ({station.print_settings?.printer_ip})
                        </>
                      )}
                    </button>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        // Open preview for Save as PDF
                        if (scannedRegistration) {
                          const printData = {
                            registration: scannedRegistration,
                            station: {
                              id: station.id,
                              name: station.name,
                              print_mode: station.print_mode,
                              print_settings: station.print_settings,
                              events: station.events
                            },
                            badge_template: station.badge_templates
                          }
                          triggerPrint(printData, true) // true = preview only
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-muted rounded-xl font-medium hover:bg-muted/80 transition-colors border border-border"
                    >
                      <Eye className="w-5 h-5" />
                      Preview / Save PDF
                    </button>
                    {!hasZplPrinter && (
                      <button
                        onClick={() => {
                          // Browser print dialog
                          if (scannedRegistration) {
                            const printData = {
                              registration: scannedRegistration,
                              station: {
                                id: station.id,
                                name: station.name,
                                print_mode: station.print_mode,
                                print_settings: station.print_settings,
                                events: station.events
                              },
                              badge_template: station.badge_templates
                            }
                            triggerPrint(printData, false)
                          }
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r ${getPrintModeColor(station.print_mode)} text-white rounded-xl font-medium hover:opacity-90 transition-all shadow-lg`}
                      >
                        <Printer className="w-5 h-5" />
                        Print Badge
                      </button>
                    )}
                  </div>
                  <button
                    onClick={resetScan}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-muted/50 rounded-xl font-medium hover:bg-muted transition-colors text-muted-foreground"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Scan Next Attendee
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* History Panel */}
        {showHistory && (
          <div className="w-80 bg-card border-l border-border flex flex-col">
            <div className="p-4 border-b border-border">
              <h3 className="font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-muted-foreground" />
                Recent Prints
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!printHistory?.length ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No prints yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {printHistory.map((job) => (
                    <div key={job.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{job.registrations?.attendee_name}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            {job.registrations?.registration_number}
                          </p>
                        </div>
                        {job.print_number > 1 && (
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-xs rounded-full">
                            #{job.print_number}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {new Date(job.printed_at).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      <footer className="bg-card border-t border-border px-4 py-2 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <Wifi className="w-4 h-4" />
              <span>Connected</span>
            </div>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              {station.print_settings?.paper_size} • {station.print_settings?.orientation}
            </span>
            {hasZplPrinter && (
              <>
                <span className="text-muted-foreground">•</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    printerOnline === null ? "bg-gray-400" : printerOnline ? "bg-emerald-500" : "bg-red-500"
                  }`} />
                  <Printer className="w-4 h-4" />
                  <span className={printerOnline ? "text-emerald-600" : printerOnline === false ? "text-red-600" : "text-muted-foreground"}>
                    {printerOnline === null ? "Checking..." : printerOnline ? "Printer Online" : "Printer Offline"}
                  </span>
                  <span className="text-muted-foreground text-xs">({station.print_settings?.printer_ip})</span>
                </div>
              </>
            )}
          </div>
          <div className="text-muted-foreground">
            Tap <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">ESC</kbd> to reset
          </div>
        </div>
      </footer>

      {/* Hidden iframe for printing (iPad compatible) */}
      <iframe
        ref={printFrameRef}
        className="hidden"
        title="Print Frame"
        style={{ position: "absolute", width: 0, height: 0, border: "none" }}
      />
    </div>
  )
}
