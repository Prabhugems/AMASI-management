"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { Html5Qrcode } from "html5-qrcode"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  QrCode,
  Loader2,
  CheckCircle2,
  Mail,
  MessageCircle,
  RotateCcw,
  User,
  Calendar,
  MapPin,
  Ticket,
  AlertCircle,
  Keyboard,
  Briefcase,
  Building2,
  Camera,
  SwitchCamera,
  XCircle,
  Maximize,
  Minimize2,
} from "lucide-react"
import { toast } from "sonner"
import * as Sentry from "@sentry/nextjs"
import { matchDelegate, type CachedDelegate } from "@/lib/kiosk-delegate-match"
import {
  getOrCreateDeviceId,
  replaceDelegateCache,
  getDelegateCache,
  enqueueScan,
  newId,
  cachePrintTemplate,
  getPrintTemplate,
  recordPrintOutcome,
  getLastPrintForRegistration,
  getPendingPrintSyncs,
  markPrintSynced,
  pruneStaleData,
} from "@/lib/kiosk-offline-store"
import { drainScanQueue } from "@/lib/kiosk-sync-worker"
import { isNetworkFailure } from "@/lib/offline-scan-queue"

type CheckinResult = {
  success: boolean
  message: string
  // Non-blocking note on an otherwise-successful check-in (e.g. outside the
  // list's configured time window) — informational only.
  warning?: string
  registration?: {
    id: string
    registration_number: string
    attendee_name: string
    attendee_email: string
    attendee_designation?: string
    attendee_institution?: string
    ticket_type?: { name: string }
  }
  alreadyCheckedIn?: boolean
}

// Scanner-burst auto-submit tunables (mirror of the staff check-in kiosk): a
// barcode/QR scanner types the whole code in a fast burst and often omits a
// trailing Enter, so we auto-submit on a brief idle when the input arrived at
// scanner speed. Manual typing is slower and still uses the "Check in" button.
const MANUAL_MIN_LEN = 3
const SCANNER_MAX_AVG_GAP_MS = 50
const AUTO_SUBMIT_IDLE_MS = 200

interface KioskCheckinScreenProps {
  eventId: string
  listId: string
  // Exactly one of these two is ever provided by a caller. `token` is a
  // checkin_lists.access_token (the original direct-URL path, Stage 1/2 --
  // Task 6 admin links). `stationToken` is a kiosk_stations token (Stage 3 --
  // the /kiosk-station/[token] route never passes the underlying list's own
  // token to this component at all).
  token?: string
  stationToken?: string
  // The kiosk_stations row's own admin-facing name (e.g. "Front Desk 1") --
  // display-only, so staff on-site can confirm which physical station a
  // device is provisioned as. Only ever set on the /kiosk-station/[token]
  // path; the original direct-URL path has no station record to name.
  stationName?: string
  // Stage 4 (check-in + print badge). mode is "checkin" for every existing
  // caller (Stage 1-3 direct-URL and station flows) -- print-related props
  // are only ever populated when mode === "checkin_and_print".
  mode?: "checkin" | "checkin_and_print"
  autoPrintBadge?: boolean
  printStationId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  badgeTemplate?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  printSettings?: any
  // print_stations.print_mode ("label" | "overlay" | "full_badge") -- the
  // linked Print Station's configured mode, cached alongside the template
  // (see CachedPrintTemplate) so printBadge renders overlay mode correctly.
  printMode?: string
  // Multi-list shared-station mode (KioskStationShell, see
  // src/components/kiosk/KioskStationShell.tsx). All three are undefined/
  // false for every existing caller -- the direct-URL kiosk and a
  // single-list station both render this component directly, unchanged.
  externallyDriven?: boolean
  onSwitchList?: () => void
  closingSoonMinutes?: number | null
}

export function KioskCheckinScreen({
  eventId,
  listId,
  token = "",
  stationToken,
  stationName,
  mode = "checkin",
  autoPrintBadge = false,
  printStationId,
  badgeTemplate,
  printSettings,
  printMode,
  externallyDriven = false,
  onSwitchList,
  closingSoonMinutes,
}: KioskCheckinScreenProps) {
  const supabase = createClient()

  const [registrationNumber, setRegistrationNumber] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<CheckinResult | null>(null)
  const [countdown, setCountdown] = useState(10)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false)
  const [whatsappSent, setWhatsappSent] = useState(false)
  const [cacheReady, setCacheReady] = useState(false)
  const [cacheError, setCacheError] = useState<string | null>(null)
  const [listBlockedReason, setListBlockedReason] = useState<string | null>(null)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [usbSupported, setUsbSupported] = useState(false)
  const [printerConnected, setPrinterConnected] = useState(false)
  const [printerName, setPrinterName] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [printStatus, setPrintStatus] = useState<{ success: boolean; message: string } | null>(null)
  // Camera QR scan mode -- an alternative to the manual/external-scanner text
  // input below, using the same html5-qrcode integration already proven in
  // the standalone Print Station page (src/app/print/[token]/page.tsx).
  // Defaults to "camera" (unlike that page's "manual" default) since a
  // self-service kiosk's primary interaction is walk-up-and-scan.
  const [scanMode, setScanMode] = useState<"camera" | "manual">("camera")
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>("")
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerContainerId = "kiosk-qr-scanner-container"
  // For the persistent status strip only -- not read by any check-in/sync
  // logic, which already checks navigator.onLine directly at the point of
  // use rather than trusting a possibly-stale piece of React state.
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine)
  const [requestingHelp, setRequestingHelp] = useState(false)
  const [helpRequestId, setHelpRequestId] = useState<string | null>(null)
  // Fullscreen reduces (but, per browser/OS, cannot eliminate) the surface
  // for someone to navigate away from the kiosk on a handed-over device --
  // true lockdown needs the device's own OS-level kiosk/screen-pinning
  // mode, which this cannot force. This is a lightweight, user-gesture-
  // gated deterrent, not a security boundary.
  const [isFullscreen, setIsFullscreen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Scanner-burst auto-submit + double-submit guard (see handleRegChange).
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null)
  const burstStartRef = useRef<number>(0)
  const lastKeyTimeRef = useRef<number>(0)
  const submittingRef = useRef<boolean>(false)
  const delegatesRef = useRef<CachedDelegate[]>([])
  const deviceIdRef = useRef<string>("")
  // In-flight guard for syncNow -- the click handler (`void syncNow()` in
  // handleCheckin), the `online` listener, and the 20s interval poll can all
  // fire close together, and drainScanQueue has no guard of its own against
  // two overlapping passes over the same pending queue.
  const syncInFlightRef = useRef<boolean>(false)
  // Same in-flight guard as syncInFlightRef above, but for syncPrintLog --
  // print-log sync and scan sync are independent pending queues, so this is
  // a separate ref rather than reusing syncInFlightRef.
  const printSyncInFlightRef = useRef<boolean>(false)

  // Local-first bootstrap: load whatever's already cached from a previous
  // session immediately (works offline from a cold reload), then refresh
  // from the server if online. Refreshes again every 5 minutes while
  // online. ~2,000 records for a full event roster -- load the whole list,
  // no pagination (see the Stage 1 plan's architecture notes).
  useEffect(() => {
    let cancelled = false

    // cacheReady only ever becomes true when there is a genuinely usable
    // local cache: either the local IndexedDB read already had entries from
    // a prior session (safe to accept scans immediately, even offline), or
    // a server refresh has completed in some terminal way (success, 401,
    // non-ok response, network-failure) -- never simply "the local read
    // finished, even if it returned zero rows". A brand-new device with an
    // empty cache and a refresh still in flight must keep showing
    // "Loading…", not silently accept scans against an empty roster.
    async function refreshFromServer() {
      if (!token && !stationToken) return
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (!cancelled && delegatesRef.current.length > 0) setCacheReady(true)
        return
      }
      try {
        const authParam = token
          ? `token=${encodeURIComponent(token)}`
          : `station_token=${encodeURIComponent(stationToken!)}&list_id=${encodeURIComponent(listId)}`
        const res = await fetch(
          `/api/kiosk/delegates?event_id=${encodeURIComponent(eventId)}&${authParam}`
        )
        if (res.status === 401) {
          if (!cancelled) {
            setCacheError("This kiosk link has expired or is invalid. Ask an admin to reshare it.")
            if (delegatesRef.current.length > 0) setCacheReady(true)
          }
          return
        }
        if (!res.ok) {
          if (!cancelled && delegatesRef.current.length > 0) setCacheReady(true)
          return
        }
        const data = (await res.json()) as { delegates: CachedDelegate[]; list_purpose?: string; blocked?: boolean }
        if (cancelled) return

        if (data.blocked) {
          // The server is the single authority on whether self check-in is
          // allowed against this list -- an unattended collection-purpose
          // list is blocked (see /api/kiosk/checkin/route.ts), while an
          // attended station serving a collection-purpose list gets the
          // real roster (blocked: false) even though list_purpose is still
          // "collection". Trust `blocked` directly rather than re-deriving
          // this policy from list_purpose alone, which can no longer
          // distinguish the two cases on its own.
          delegatesRef.current = []
          await replaceDelegateCache(listId, [])
          setListBlockedReason("Self check-in isn't available for this list. Please see a staff member.")
          setCacheReady(true)
          return
        }

        setListBlockedReason(null)
        await replaceDelegateCache(listId, data.delegates)
        delegatesRef.current = data.delegates
        setCacheError(null)
        setCacheReady(true)
      } catch (err) {
        // A network failure here is a routine, expected condition (this
        // runs on an interval regardless of connectivity) -- the
        // on-device cache stays valid and in use, nothing to report.
        // Anything else is unexpected and must not be swallowed silently.
        if (!isNetworkFailure(err)) {
          Sentry.captureException(err, { tags: { module: "kiosk-page" }, extra: { eventId, listId } })
        }
        if (!cancelled && delegatesRef.current.length > 0) setCacheReady(true)
      }
    }

    async function bootstrap() {
      if (!token && !stationToken) {
        if (!cancelled) setCacheError("This kiosk link is missing its access token. Ask an admin to reshare it.")
        return
      }
      try {
        deviceIdRef.current = await getOrCreateDeviceId()
        delegatesRef.current = await getDelegateCache(listId)
        // Only safe to accept scans immediately if the local cache already
        // has entries from a prior session -- an empty read must not flip
        // cacheReady here, or a brand-new device would accept scans against
        // a roster it hasn't actually fetched yet.
        if (!cancelled && delegatesRef.current.length > 0) setCacheReady(true)
        await refreshFromServer()
      } catch (err) {
        // getOrCreateDeviceId/getDelegateCache throwing (e.g. IndexedDB
        // unavailable) must not leave the kiosk showing "Loading…" forever
        // with zero diagnostic signal -- indistinguishable from a hung page
        // on an unattended device.
        Sentry.captureException(err, { tags: { module: "kiosk-page" }, extra: { eventId, listId } })
        if (!cancelled) setCacheError("This kiosk couldn't start. Please see a staff member.")
      }
    }

    bootstrap()
    const refreshInterval = setInterval(refreshFromServer, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(refreshInterval)
    }
  }, [eventId, listId, token, stationToken])

  // Fetch event and list details
  const { data: event } = useQuery({
    queryKey: ["event-kiosk", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("events")
        .select("id, name, short_name, start_date, venue_name, city")
        .eq("id", eventId)
        .maybeSingle()
      return data
    },
  })

  const { data: list } = useQuery({
    queryKey: ["checkin-list-kiosk", listId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("checkin_lists")
        .select("id, name, description, allow_multiple_checkins")
        .eq("id", listId)
        .maybeSingle()
      return data
    },
  })

  // Stage 4: cache the badge template (and every element's remote image as
  // a local data URL, plus the resolved print mode and event name) once,
  // while online, so printing later has zero network dependency. Runs once
  // per mount when this station is in checkin_and_print mode; re-fetches
  // are not needed within a session -- an admin changing the linked Print
  // Station's template mid-event is rare enough that a reload (which
  // remounts this component) is an acceptable way to pick up a change,
  // matching this codebase's existing tolerance for similar edge cases
  // elsewhere in the kiosk. Placed after the event/list queries above (not
  // before) and depends on event?.name so the cached copy picks up the
  // event name once that query settles -- it's frequently still loading at
  // the very first mount.
  useEffect(() => {
    if (mode !== "checkin_and_print" || !printStationId || !badgeTemplate) return
    if (typeof navigator !== "undefined" && !navigator.onLine) return

    // Narrowed to a local const: TS can't carry the `!printStationId` guard's
    // narrowing across the nested async closure below (printStationId is an
    // optional prop, not a const), so capture the checked value here.
    const stationId = printStationId
    let cancelled = false

    async function cacheTemplate() {
      try {
        const elements = badgeTemplate?.template_data?.elements || []
        const imageDataUrls: Record<string, string> = {}

        for (const el of elements) {
          if ((el.type === "image" || el.type === "photo") && el.imageUrl && !imageDataUrls[el.imageUrl]) {
            try {
              const res = await fetch(el.imageUrl)
              const blob = await res.blob()
              const dataUrl: string = await new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.onerror = reject
                reader.readAsDataURL(blob)
              })
              imageDataUrls[el.imageUrl] = dataUrl
            } catch (err) {
              // One unreachable image asset must not prevent caching the
              // rest of the template -- that element just won't render at
              // print time (matching this file's existing "missing QR"
              // placeholder pattern), not block check-in/print entirely.
              Sentry.captureException(err, { tags: { module: "kiosk-print-cache" }, extra: { eventId, listId, imageUrl: el.imageUrl } })
            }
          }
        }

        if (cancelled) return
        await cachePrintTemplate(listId, {
          badgeTemplate,
          printSettings,
          printStationId: stationId,
          printMode,
          eventName: event?.name || "",
          imageDataUrls,
          cachedAt: Date.now(),
        })

        // Warm the JS chunks the print path needs while still online, so the
        // FIRST print attempt after this device goes offline doesn't have to
        // fetch them over the network -- printBadge below lazy-imports these
        // same three modules, and the service worker's existing /_next/
        // caching for /kiosk-station/ referrers picks them up as a side
        // effect of these imports resolving now. Fire-and-forget: a failure
        // here just means the first print retries the fetch as before, it
        // must never block or fail check-in bootstrap.
        void import("@/lib/badge-render")
        void import("qrcode")
        void import("html2canvas")
      } catch (err) {
        Sentry.captureException(err, { tags: { module: "kiosk-print-cache" }, extra: { eventId, listId } })
      }
    }

    cacheTemplate()
    return () => {
      cancelled = true
    }
  }, [mode, printStationId, badgeTemplate, printSettings, printMode, event?.name, eventId, listId])

  // Best-effort local storage cleanup (any mode) -- runs once per mount, not
  // gated on print-mode, and never awaited by anything on the check-in
  // path. A device reused across many events/lists never had anything
  // removing old, already-synced data; left unchecked, IndexedDB usage
  // grows without bound over the device's lifetime.
  useEffect(() => {
    pruneStaleData().catch((err) => {
      Sentry.captureException(err, { tags: { module: "kiosk-offline-store" }, extra: { eventId, listId } })
    })
    // Intentionally runs once per mount only -- eventId/listId changing
    // doesn't need a re-prune, and re-running on every render would be
    // wasteful IndexedDB churn for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Stage 4: feature-detect WebUSB, silently try to reconnect to a
  // previously-paired printer (browser remembers the grant; no picker
  // shown), and listen for the printer being unplugged/reset mid-event so
  // the UI falls back to "Connect Printer" instead of every subsequent
  // print silently failing with no recovery short of a reload. Gated on
  // mode so this never touches navigator.usb for any existing mode:
  // "checkin" caller.
  useEffect(() => {
    if (mode !== "checkin_and_print") return
    let cancelled = false
    let cleanupDisconnect: (() => void) | undefined
    ;(async () => {
      const { isWebUSBSupported, reconnectUsbPrinter, getUsbPrinterName, onUsbDisconnect } = await import("@/lib/usb-printer")
      if (!isWebUSBSupported()) return
      if (cancelled) return
      setUsbSupported(true)
      const result = await reconnectUsbPrinter()
      if (cancelled) return
      if (result.success) {
        setPrinterConnected(true)
        setPrinterName(result.name || getUsbPrinterName())
      }
      cleanupDisconnect = onUsbDisconnect(() => {
        setPrinterConnected(false)
        setPrinterName(null)
      })
    })()
    return () => {
      cancelled = true
      cleanupDisconnect?.()
    }
  }, [mode])

  // Stage 4: local-first badge print. Renders the already-cached template
  // (Task 6) to a canvas and sends it over an already-paired WebUSB
  // connection -- no network call anywhere in this function. Only ever
  // invoked from mode === "checkin_and_print" code paths (auto-print effect
  // below, handlePrintButtonClick).
  const printBadge = useCallback(async (registration: NonNullable<CheckinResult["registration"]>) => {
    setPrinting(true)
    setPrintStatus(null)
    try {
      // Cheapest possible check first, before any rendering work: if the
      // printer isn't actually connected (unplugged, reset, or the reconnect
      // on mount never found it), fail fast with a clear message instead of
      // doing a full QR-gen + html2canvas render that's guaranteed to be
      // thrown away.
      const { isUsbPrinterConnected } = await import("@/lib/usb-printer")
      if (!isUsbPrinterConnected()) {
        setPrintStatus({ success: false, message: "Printer not connected — tap Connect Printer first." })
        return
      }

      const template = await getPrintTemplate(listId)
      if (!template) {
        // Two different failure modes look identical here but need different
        // guidance: printStationId unset means an admin never linked this
        // station to a Print Station at all (persistent -- retapping never
        // helps, a volunteer would retap forever with no way to know that).
        // printStationId set but nothing cached yet is the genuine transient
        // case -- the online bootstrap cache (Task 6) just hasn't landed.
        setPrintStatus(
          printStationId
            ? { success: false, message: "Badge template not ready yet. Try again in a moment." }
            : { success: false, message: "This station isn't set up for printing yet — see an admin." }
        )
        return
      }

      const badgeTemplate = template.badgeTemplate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elements = badgeTemplate?.template_data?.elements || []
      // Substitute cached data URLs for remote imageUrls, and pre-generate
      // QR codes -- both must happen before rendering, since neither can
      // hit the network at this point (matches the existing /print/[token]
      // pattern for QR pre-generation). A cache miss on an image (Task 6's
      // pre-cache fetch failed for that one asset) must NOT leave the
      // original remote URL in place -- renderElementToHtml would emit an
      // <img src="https://..."> that the browser fetches immediately, and
      // html2canvas's useCORS option would fetch it again -- both real
      // network calls inside a function that must be zero-network at print
      // time. Drop the image for that element instead; the rest of the
      // badge still prints.
      const resolvedElements = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        elements.map(async (el: any) => {
          if (el.type === "image" || el.type === "photo") {
            if (el.imageUrl && template.imageDataUrls[el.imageUrl]) {
              return { ...el, imageUrl: template.imageDataUrls[el.imageUrl] }
            }
            if (el.imageUrl) {
              Sentry.captureMessage("Kiosk print: cached badge image missing at print time", {
                level: "warning",
                tags: { module: "kiosk-print" },
                extra: { eventId, listId, imageUrl: el.imageUrl },
              })
              return { ...el, imageUrl: null }
            }
            return el
          }
          if (el.type === "qr_code") {
            const { replacePlaceholders } = await import("@/lib/badge-render")
            const qrValue = replacePlaceholders(el.content || "", registration, template.eventName || "")
            if (qrValue) {
              try {
                const QRCode = (await import("qrcode")).default
                const dataUrl = await QRCode.toDataURL(qrValue, {
                  width: Math.min(el.width, el.height) * 2,
                  margin: 1,
                  errorCorrectionLevel: "M",
                })
                return { ...el, _qrDataUrl: dataUrl }
              } catch {
                return el
              }
            }
          }
          return el
        })
      )

      const { generatePrintContent, getPaperDimensions } = await import("@/lib/badge-render")
      const printContent = generatePrintContent({
        registration,
        printSettings: template.printSettings,
        printMode: template.printMode || "full_badge",
        badgeTemplate: { ...badgeTemplate, template_data: { ...badgeTemplate.template_data, elements: resolvedElements } },
        eventName: template.eventName || "",
      })

      const dim = getPaperDimensions(template.printSettings?.paper_size || "4x6", template.printSettings?.orientation || "portrait")
      const container = document.createElement("div")
      container.id = `print-render-kiosk-${Date.now()}`
      container.style.position = "absolute"
      container.style.left = "-9999px"
      container.style.top = "0"
      container.style.width = dim.width
      container.style.height = dim.height
      const bodyMatch = printContent.match(/<body[^>]*>([\s\S]*)<\/body>/)
      // Without re-applying these wrapper styles in scope, the badge's
      // absolutely-positioned children collapse the container to 0×0 and
      // html2canvas produces an empty canvas -- mirrors the exact pattern
      // in src/app/print/[token]/page.tsx's USB print branch.
      const scopedStyle = `<style>
        #${container.id} .badge-wrapper, #${container.id} .badge-container {
          width: ${dim.width}; height: ${dim.height};
        }
        #${container.id} .badge-container { position: relative; overflow: hidden; }
      </style>`
      container.innerHTML = scopedStyle + (bodyMatch ? bodyMatch[1] : printContent)
      document.body.appendChild(container)
      await new Promise((resolve) => setTimeout(resolve, 400))

      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false })
      document.body.removeChild(container)

      if (!canvas.width || !canvas.height) {
        throw new Error("Rendered badge canvas was empty — check that the template has elements within the paper bounds.")
      }

      const { printBadgeViaUsb } = await import("@/lib/usb-printer")
      const result = await printBadgeViaUsb(canvas, template.printSettings?.paper_size || "4x6")

      await recordPrintOutcome(
        { print_id: newId(), list_id: listId, registration_id: registration.id, printed_at: Date.now() },
        result.success ? "success" : "failed"
      )

      setPrintStatus(
        result.success
          ? { success: true, message: "Badge printed!" }
          : { success: false, message: result.error || "Print failed" }
      )
    } catch (err) {
      Sentry.captureException(err, { tags: { module: "kiosk-print" }, extra: { eventId, listId } })
      setPrintStatus({ success: false, message: "Something went wrong printing this badge." })
    } finally {
      setPrinting(false)
    }
  }, [listId, eventId, printStationId])

  // Auto-print fires exactly once per successful check-in result when this
  // station is configured for it -- EXCEPT when this registration already
  // has a successful local print on record. Per the Tito check-in model, a
  // repeat scan of an already-checked-in delegate is always success: true
  // too (never an error), so without this check a second scan at an
  // auto-print station would silently print a second badge with zero
  // warning. Reprinting must always go through the manual "Print Badge"
  // button's existing warn-before-reprint confirm in handlePrintButtonClick
  // -- auto-print only ever prints once per registration.
  // Deliberately keyed only on `result` -- must not re-fire if printBadge's
  // own identity changes (e.g. event name resolving after the query
  // settles) for the same result.
  useEffect(() => {
    if (mode !== "checkin_and_print" || !autoPrintBadge || !result?.success || !result.registration) return
    const registration = result.registration
    let cancelled = false
    ;(async () => {
      try {
        const last = await getLastPrintForRegistration(listId, registration.id)
        if (cancelled) return
        if (last && last.status === "success") {
          setPrintStatus({
            success: true,
            message: `Badge already printed at ${new Date(last.printed_at).toLocaleTimeString()} — tap Print Badge to reprint.`,
          })
          return
        }
        void printBadge(registration)
      } catch (err) {
        // This path runs completely unattended (no human triggers it, no
        // retry button) -- an unhandled rejection here (e.g. IndexedDB
        // quota/unavailable) would otherwise vanish with zero telemetry.
        // Fall through to NOT auto-printing on error: a human can still use
        // the manual "Print Badge" button, which is the safer default over
        // crashing or silently hanging.
        if (!cancelled) {
          Sentry.captureException(err, { tags: { module: "kiosk-print" }, extra: { eventId, listId } })
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // Intentionally does not depend on printBadge's identity changing --
    // this must fire exactly once per successful check-in result, not
    // re-fire if printBadge's useCallback deps happen to change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  // Manual "Print Badge" button handler -- warns before a reprint (local
  // IndexedDB lookup only, no network).
  const handlePrintButtonClick = async () => {
    if (!result?.registration) return
    const last = await getLastPrintForRegistration(listId, result.registration.id)
    if (last && last.status === "success") {
      const when = new Date(last.printed_at).toLocaleTimeString()
      if (!confirm(`Already printed at ${when} — print again?`)) return
    }
    void printBadge(result.registration)
  }

  const resetKiosk = useCallback(() => {
    setResult(null)
    setRegistrationNumber("")
    setCountdown(10)
    setEmailSent(false)
    setWhatsappSent(false)
    // The scan/entry screen never renders printStatus, so without clearing
    // it here it silently persists across resets -- the next delegate's
    // success screen could otherwise show the PREVIOUS delegate's "Badge
    // printed!" (or a stale reprint-warning message) before this delegate
    // has done anything. setPrinting(false) is defensive, in case a reset
    // happens mid-print.
    setPrintStatus(null)
    setPrinting(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  // Auto-reset countdown
  useEffect(() => {
    if (result) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            resetKiosk()
            return 10
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [result, resetKiosk])

  // Focus input on mount and after reset
  useEffect(() => {
    if (!result) {
      inputRef.current?.focus()
    }
  }, [result])

  // Clear any pending burst auto-submit on unmount.
  useEffect(() => () => {
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current)
  }, [])

  const syncNow = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return
    // The click handler, the `online` listener, and the 20s interval poll
    // can all fire close together -- without this guard, two overlapping
    // drains would both read the same "pending" rows and could double-POST
    // a scan before either pass marks it synced/conflict.
    if (syncInFlightRef.current) return
    syncInFlightRef.current = true
    try {
      const { remaining } = await drainScanQueue(
        listId,
        eventId,
        stationToken,
        () => {},
        () => {}
      )
      setPendingSyncCount(remaining)
    } catch (err) {
      // drainScanQueue can reject (e.g. IndexedDB unavailable -- Safari
      // private browsing, quota exceeded), and the underlying idb module
      // caches a rejected connection promise -- left uncaught, this would
      // reject on every subsequent call for the rest of the session, as an
      // unhandled rejection each time (handleCheckin's `void syncNow()`,
      // the `online` listener, and the setInterval poll all call this).
      Sentry.captureException(err, { tags: { module: "kiosk-page" }, extra: { eventId, listId } })
    } finally {
      syncInFlightRef.current = false
    }
  }, [eventId, listId, stationToken])

  // Local-first: resolve from the on-device delegate cache and render
  // immediately -- zero network calls on this path. The scan is durably
  // queued (IndexedDB survives a reload) and synced in the background by
  // the sync worker. See the Stage 1 plan for why this replaces the old
  // "await the network, retry twice, then queue" behavior.
  const handleCheckin = async (override?: string) => {
    const searchTerm = (override ?? registrationNumber).trim()
    if (!searchTerm) {
      toast.error("Please enter a registration number")
      return
    }
    // This guard must live inside handleCheckin itself, not only on the
    // submit button's `disabled` attribute -- the barcode-scanner-burst
    // path (handleRegChange's auto-submit) and the Enter-key handler both
    // call handleCheckin directly, bypassing the button entirely.
    if (listBlockedReason) {
      setResult({ success: false, message: listBlockedReason })
      return
    }
    if (submittingRef.current) return
    submittingRef.current = true
    setIsProcessing(true)

    try {
      const delegate = matchDelegate(delegatesRef.current, searchTerm)

      if (!delegate) {
        setResult({
          success: false,
          message: "Registration not found. Please check your registration number.",
        })
        return
      }

      const scanId = newId()

      await enqueueScan({
        scan_id: scanId,
        station_id: deviceIdRef.current,
        list_id: listId,
        delegate_code: searchTerm,
        scanned_at: Date.now(),
        registration_id: delegate.id,
        registration_snapshot: delegate,
      })

      setResult({
        success: true,
        message: "Check-in successful!",
        registration: {
          id: delegate.id,
          registration_number: delegate.registration_number,
          attendee_name: delegate.attendee_name,
          attendee_email: delegate.attendee_email,
          attendee_designation: delegate.attendee_designation ?? undefined,
          attendee_institution: delegate.attendee_institution ?? undefined,
        },
      })

      void syncNow()
    } catch (error) {
      // The most safety-critical write in the local-first redesign
      // (durable IndexedDB enqueue) must never fail silently -- e.g. quota
      // exceeded, Safari private-browsing storage restrictions. Surface an
      // honest failure rather than leaving the attendee on a stuck screen.
      Sentry.captureException(error, { tags: { module: "kiosk-page" }, extra: { eventId, listId, searchTerm } })
      setResult({
        success: false,
        message: "Something went wrong recording this check-in. Please try again.",
      })
    } finally {
      setIsProcessing(false)
      submittingRef.current = false
    }
  }

  // ============================================================
  // CAMERA QR SCANNER — ported from src/app/print/[token]/page.tsx's
  // proven html5-qrcode integration, not reinvented. A scanned code feeds
  // into the exact same local-first handleCheckin(override) path the
  // manual input and external hardware scanner already use -- this is
  // purely an additional input method, not a new check-in code path.
  // ============================================================

  // Persisted across reloads so a device only needs the front/back guess
  // corrected once (via switchCamera below), not every time the tab
  // restarts -- the label-matching heuristic in getCameras isn't reliable
  // on every Android tablet's camera naming.
  const CAMERA_PREF_KEY = "kiosk-camera-id"

  const getCameras = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras()
      if (devices && devices.length > 0) {
        setCameras(devices)
        const remembered = typeof window !== "undefined" ? window.localStorage.getItem(CAMERA_PREF_KEY) : null
        const rememberedStillPresent = remembered && devices.some((d) => d.id === remembered)
        if (rememberedStillPresent) {
          setSelectedCameraId(remembered!)
          return
        }
        const backCamera = devices.find((d) =>
          d.label.toLowerCase().includes("back") ||
          d.label.toLowerCase().includes("rear") ||
          d.label.toLowerCase().includes("environment")
        )
        setSelectedCameraId(backCamera?.id || devices[0].id)
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { module: "kiosk-camera" }, extra: { eventId, listId } })
      setCameraError("Unable to access camera. Please grant camera permission.")
    }
  }, [eventId, listId])

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && cameraActive) {
      try {
        const scanner = scannerRef.current
        if (scanner.isScanning) {
          await scanner.stop()
        }
        scannerRef.current = null
      } catch {
        // Ignore stop errors -- scanner might already be stopped.
      }
    }
    setCameraActive(false)
  }, [cameraActive])

  const handleQrCodeScanned = useCallback((decodedText: string) => {
    stopScanner()
    // Same URL-vs-raw-value handling as the print station's camera scanner,
    // for consistency: a badge QR may encode a bare registration number or
    // a verify-style URL ending in one.
    let code = decodedText
    if (code.includes("/")) {
      const parts = code.split("/")
      code = parts[parts.length - 1]
    }
    handleCheckin(code.trim())
  }, [stopScanner]) // eslint-disable-line react-hooks/exhaustive-deps -- handleCheckin is stable across the lifetime of one mount (reads refs, not state, for its match logic)

  const startScanner = useCallback(async () => {
    if (!selectedCameraId) {
      await getCameras()
      return
    }
    setCameraError(null)
    try {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop()
        } catch {
          // Ignore stop errors on an already-stopped/never-started instance.
        }
      }
      scannerRef.current = new Html5Qrcode(scannerContainerId)
      await scannerRef.current.start(
        selectedCameraId,
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (decodedText) => handleQrCodeScanned(decodedText),
        () => {
          // Per-frame "no code found" callback -- expected continuously
          // while scanning, not an error.
        }
      )
      setCameraActive(true)
    } catch (err) {
      Sentry.captureException(err, { tags: { module: "kiosk-camera" }, extra: { eventId, listId } })
      setCameraError(err instanceof Error ? err.message : "Failed to start camera")
      setCameraActive(false)
    }
  }, [selectedCameraId, getCameras, handleQrCodeScanned, eventId, listId])

  const switchCamera = useCallback(async () => {
    if (cameras.length < 2) return
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId)
    const nextIndex = (currentIndex + 1) % cameras.length
    const nextId = cameras[nextIndex].id
    setSelectedCameraId(nextId)
    try {
      window.localStorage.setItem(CAMERA_PREF_KEY, nextId)
    } catch {
      // Storage unavailable (private browsing, quota) -- the choice just
      // won't survive a reload; not worth failing the switch over.
    }
    if (cameraActive) {
      await stopScanner()
      setTimeout(() => startScanner(), 300)
    }
  }, [cameras, selectedCameraId, cameraActive, stopScanner, startScanner])

  // Camera only runs on the entry screen (no active result) and only in
  // "camera" scan mode -- mirrors the print station page's identical gate.
  useEffect(() => {
    if (scanMode === "camera" && !result) {
      getCameras()
    } else if (scanMode === "manual") {
      stopScanner()
    }
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode, result])

  useEffect(() => {
    if (scanMode === "camera" && selectedCameraId && !result && !cameraActive) {
      startScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode, selectedCameraId, result, cameraActive])

  // Mobile browsers commonly kill an active camera stream when a tab is
  // backgrounded (screen sleep, switching apps) without necessarily
  // reporting it as an error -- html5-qrcode's isScanning flag can stay
  // true while frames have actually stopped flowing. Without this, an
  // unattended kiosk that gets backgrounded once needs a manual reload to
  // scan again. Force a clean stop+restart on every return to foreground.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      if (scanMode !== "camera" || result) return
      stopScanner().then(() => {
        setTimeout(() => startScanner(), 300)
      })
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode, result])

  // Silent background self-heal, same rationale as the old flush effect it
  // replaces: no "queue"/"pending" language in the attendee-facing UI, and
  // a 20s poll because navigator.onLine only reflects the OS network
  // interface, not request health.
  useEffect(() => {
    // KioskStationShell owns draining every assigned list's queue when this
    // screen is rendered under it -- a second timer here would double-POST
    // whichever scan both timers raced to drain first.
    if (externallyDriven) return
    if (typeof navigator !== "undefined" && navigator.onLine) void syncNow()
    window.addEventListener("online", syncNow)
    const pollId = setInterval(syncNow, 20000)
    return () => {
      window.removeEventListener("online", syncNow)
      clearInterval(pollId)
    }
  }, [syncNow, externallyDriven])

  // Display-only online/offline tracking for the status strip (see
  // "online"/"offline" listeners above for the actual sync-trigger logic,
  // which is separate and unaffected by this).
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // Fullscreen can be denied/unsupported (e.g. iOS Safari has no
      // Fullscreen API at all) -- fails silently, matches this device's
      // existing "degrade, don't error" pattern for unsupported browser
      // capabilities (see the WebUSB feature-detect above).
    }
  }

  // Stage 4: opportunistic sync of local print-log entries (Task 5's
  // recordPrintOutcome, written by printBadge above) into print_jobs, so the
  // standalone Print Station admin view's audit trail includes
  // kiosk-triggered prints. This never gates or blocks printing itself --
  // printing already happened locally, possibly minutes or hours earlier --
  // it's purely a best-effort mirror, same tolerance as syncNow above.
  const syncPrintLog = useCallback(async () => {
    if (mode !== "checkin_and_print") return
    if (typeof navigator !== "undefined" && !navigator.onLine) return
    // The online listener and the 20s interval poll can fire close together
    // -- without this guard, two overlapping passes could both read the same
    // "pending" rows and double-POST a print-log entry before either pass
    // marks it synced.
    if (printSyncInFlightRef.current) return
    printSyncInFlightRef.current = true
    try {
      const pending = await getPendingPrintSyncs(listId)
      for (const entry of pending) {
        if (entry.status !== "success") {
          // A locally-failed print never made it out of a printer -- syncing
          // it to print_jobs would insert a row that inflates the linked
          // print station's total_prints/unique_prints stats (the DB trigger
          // fires unconditionally on every insert) and would be invisible to
          // reprint-limit enforcement, which filters on status="completed".
          // Nothing to sync; mark it synced so it doesn't get re-examined on
          // every future poll forever.
          await markPrintSynced(entry.print_id)
          continue
        }
        try {
          const res = await fetch("/api/kiosk/print-sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              print_station_id: printStationId,
              registration_id: entry.registration_id,
              printed_at: entry.printed_at,
              // The local log keeps its own "success"/"failed" vocabulary
              // (an internal, already-shipped record) -- the server side
              // only ever accepts "completed" (matching every other
              // print_jobs writer in this codebase), and only successful
              // local prints reach this fetch call at all (see the guard
              // above).
              status: "completed",
            }),
          })
          if (res.ok) {
            await markPrintSynced(entry.print_id)
          } else if (res.status === 429) {
            // Our own rate limit -- a backlog of queued print-log entries
            // syncing on reconnect can plausibly exceed
            // /api/kiosk/print-sync's 30/min "public" tier. Queue-wide: stop
            // this pass rather than hammering the rest of the backlog into
            // the same limit immediately. Mirrors drainScanQueue's
            // "retry-break" handling of a 429 in kiosk-sync-worker.ts.
            break
          }
          // Any other non-ok status (4xx/5xx) is left pending and retried
          // per-entry on the next poll, same as a network-level failure.
        } catch {
          // Routine offline/transient failure -- this entry stays pending
          // and is retried on the next poll, same tolerance as syncNow.
          break
        }
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { module: "kiosk-print-sync" }, extra: { eventId, listId } })
    } finally {
      printSyncInFlightRef.current = false
    }
  }, [mode, listId, printStationId, eventId])

  useEffect(() => {
    if (mode !== "checkin_and_print") return
    if (typeof navigator !== "undefined" && navigator.onLine) void syncPrintLog()
    window.addEventListener("online", syncPrintLog)
    const pollId = setInterval(syncPrintLog, 20000)
    return () => {
      window.removeEventListener("online", syncPrintLog)
      clearInterval(pollId)
    }
  }, [syncPrintLog, mode])

  const handleEmailBadge = async () => {
    if (!result?.registration) return

    setSendingEmail(true)
    try {
      const response = await fetch("/api/badges/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: result.registration.id,
          event_id: eventId,
        }),
      })

      if (response.ok) {
        setEmailSent(true)
        toast.success("Badge sent to your email!")
      } else {
        toast.error("Failed to send badge. Please try again.")
      }
    } catch {
      toast.error("Failed to send badge")
    } finally {
      setSendingEmail(false)
    }
  }

  const handleWhatsappBadge = async () => {
    if (!result?.registration) return

    setSendingWhatsapp(true)
    try {
      const response = await fetch("/api/kiosk/whatsapp-badge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: result.registration.id,
          event_id: eventId,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        setWhatsappSent(true)
        toast.success(data.message || "Badge sent on WhatsApp!")
      } else {
        toast.error(data.message || "Couldn't send WhatsApp. Please try again.")
      }
    } catch {
      toast.error("Couldn't send WhatsApp")
    } finally {
      setSendingWhatsapp(false)
    }
  }

  // Reuses the existing help-request system (src/app/api/help-request) --
  // the same one delegate/faculty portals already use -- rather than
  // building new admin-notification plumbing. The server resolves the
  // actual recipient (event.contact_email or the event creator); the
  // "email" field here just identifies the requester in the admin's
  // dashboard, and this device has no real person's email to offer.
  const handleRequestHelp = async () => {
    setRequestingHelp(true)
    try {
      const response = await fetch("/api/help-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          name: stationName ? `Kiosk: ${stationName}` : "Kiosk Station",
          email: "kiosk-alerts@internal.local",
          category: "Kiosk",
          message: `A kiosk station requested assistance.\nStation: ${stationName || "(unnamed)"}\nList: ${list?.name || listId}\nOnline: ${isOnline ? "yes" : "no"}`,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data.success) {
        setHelpRequestId(newId())
        toast.success("An admin has been notified.")
      } else {
        toast.error(data.error || "Couldn't send the request. Please try again.")
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { module: "kiosk-help-request" }, extra: { eventId, listId } })
      toast.error("Couldn't send the request. Please try again.")
    } finally {
      setRequestingHelp(false)
    }
  }

  const handleRegChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setRegistrationNumber(value)

    // Anchor a fresh burst after any pause; timing-based so a fast scanner
    // outrunning React state can't confuse the detection.
    const now = Date.now()
    if (now - lastKeyTimeRef.current > 500) burstStartRef.current = now
    lastKeyTimeRef.current = now

    // Auto-submit shortly after typing stops, but only if the whole entry
    // arrived at scanner speed. Reads the live DOM value, not React state.
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current)
    autoSubmitTimerRef.current = setTimeout(() => {
      autoSubmitTimerRef.current = null
      const current = (inputRef.current?.value || "").trim().toUpperCase()
      if (current.length < MANUAL_MIN_LEN) return
      const span = lastKeyTimeRef.current - burstStartRef.current
      const avgGap = current.length > 1 ? span / (current.length - 1) : 0
      if (avgGap <= SCANNER_MAX_AVG_GAP_MS) handleCheckin(current)
    }, AUTO_SUBMIT_IDLE_MS)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Scanner with an Enter/CR suffix lands here. Cancel any pending burst
      // submit and submit the live DOM value (not possibly-stale state).
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current)
        autoSubmitTimerRef.current = null
      }
      handleCheckin(inputRef.current?.value || registrationNumber)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ""
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  // ============================================================
  // SUCCESS / ERROR SCREEN
  // ============================================================
  if (result) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800/50 border-b border-white/10 px-4 sm:px-8 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                {event?.short_name || event?.name}
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 truncate">
                {list?.name}
                {stationName && ` · ${stationName}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs sm:text-sm text-gray-400">Auto-reset in</p>
              <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
                {countdown}s
              </p>
            </div>
          </div>
        </div>

        {/* Result Content */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-8 overflow-y-auto">
          <div className="max-w-2xl w-full text-center">
            {result.success ? (
              <>
                {/* Success — ring-expand animation */}
                <div className="mb-8 relative w-32 h-32 sm:w-40 sm:h-40 mx-auto">
                  <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
                  <div className="relative w-full h-full rounded-full bg-emerald-500/20 outline outline-1 -outline-offset-1 outline-emerald-500/40 flex items-center justify-center">
                    <CheckCircle2 className="h-16 w-16 sm:h-20 sm:w-20 text-emerald-300" />
                  </div>
                </div>

                <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3">
                  Welcome, {result.registration?.attendee_name?.split(" ")[0]}!
                </h1>
                <p className="text-base sm:text-xl text-emerald-300 mb-2">
                  {result.alreadyCheckedIn ? "You're already checked in" : "Check-in successful"}
                </p>
                {result.warning && (
                  <p className="text-sm text-amber-300 mb-6 max-w-md mx-auto">{result.warning}</p>
                )}
                {!result.warning && <div className="mb-8" />}

                {/* Details — stacked-list pattern */}
                <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg overflow-hidden mb-8 text-left">
                  <ul className="divide-y divide-white/5">
                    <li className="flex items-center gap-x-4 px-5 py-4">
                      <div className="size-10 flex-none rounded-full bg-white/5 outline outline-1 -outline-offset-1 outline-white/10 flex items-center justify-center text-white/60">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Name</p>
                        <p className="mt-0.5 text-base sm:text-lg font-medium text-white">
                          {result.registration?.attendee_name}
                        </p>
                      </div>
                    </li>
                    <li className="flex items-center gap-x-4 px-5 py-4">
                      <div className="size-10 flex-none rounded-full bg-white/5 outline outline-1 -outline-offset-1 outline-white/10 flex items-center justify-center text-white/60">
                        <Ticket className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Registration</p>
                        <p className="mt-0.5 text-base sm:text-lg font-medium text-white font-mono">
                          {result.registration?.registration_number}
                        </p>
                      </div>
                    </li>
                    {result.registration?.attendee_designation && (
                      <li className="flex items-center gap-x-4 px-5 py-4">
                        <div className="size-10 flex-none rounded-full bg-white/5 outline outline-1 -outline-offset-1 outline-white/10 flex items-center justify-center text-white/60">
                          <Briefcase className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Designation</p>
                          <p className="mt-0.5 text-base sm:text-lg font-medium text-white">
                            {result.registration.attendee_designation}
                          </p>
                        </div>
                      </li>
                    )}
                    {result.registration?.attendee_institution && (
                      <li className="flex items-center gap-x-4 px-5 py-4">
                        <div className="size-10 flex-none rounded-full bg-white/5 outline outline-1 -outline-offset-1 outline-white/10 flex items-center justify-center text-white/60">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Institution</p>
                          <p className="mt-0.5 text-base sm:text-lg font-medium text-white">
                            {result.registration.attendee_institution}
                          </p>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 sm:h-16 px-6 sm:px-8 text-base bg-transparent border-white/15 text-white hover:bg-white/10 hover:text-white"
                    onClick={resetKiosk}
                  >
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Done
                  </Button>
                  {!emailSent ? (
                    <Button
                      size="lg"
                      className="h-14 sm:h-16 px-6 sm:px-8 text-base"
                      onClick={handleEmailBadge}
                      disabled={sendingEmail}
                    >
                      {sendingEmail ? (
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      ) : (
                        <Mail className="h-5 w-5 mr-2" />
                      )}
                      Email my badge
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="h-14 sm:h-16 px-6 sm:px-8 text-base bg-emerald-600 hover:bg-emerald-600 text-white"
                      disabled
                    >
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Badge sent
                    </Button>
                  )}
                  {!whatsappSent ? (
                    <Button
                      size="lg"
                      className="h-14 sm:h-16 px-6 sm:px-8 text-base bg-[#25D366] hover:bg-[#1eb955] text-white"
                      onClick={handleWhatsappBadge}
                      disabled={sendingWhatsapp}
                    >
                      {sendingWhatsapp ? (
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      ) : (
                        <MessageCircle className="h-5 w-5 mr-2" />
                      )}
                      WhatsApp my badge
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="h-14 sm:h-16 px-6 sm:px-8 text-base bg-emerald-600 hover:bg-emerald-600 text-white"
                      disabled
                    >
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Sent on WhatsApp
                    </Button>
                  )}
                  {mode === "checkin_and_print" && usbSupported && (
                    !printerConnected ? (
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-14 sm:h-16 px-6 sm:px-8 text-base bg-transparent border-white/15 text-white hover:bg-white/10 hover:text-white"
                        onClick={async () => {
                          const { connectUsbPrinter } = await import("@/lib/usb-printer")
                          const res = await connectUsbPrinter()
                          if (res.success) {
                            setPrinterConnected(true)
                            setPrinterName(res.name || null)
                          } else {
                            setPrintStatus({ success: false, message: res.error || "Connection failed" })
                          }
                        }}
                      >
                        Connect Printer
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        className="h-14 sm:h-16 px-6 sm:px-8 text-base"
                        onClick={handlePrintButtonClick}
                        disabled={printing}
                      >
                        {printing ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : null}
                        Print Badge
                      </Button>
                    )
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Error — ring-expand animation */}
                <div className="mb-8 relative w-32 h-32 sm:w-40 sm:h-40 mx-auto">
                  <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                  <div className="relative w-full h-full rounded-full bg-red-500/20 outline outline-1 -outline-offset-1 outline-red-500/40 flex items-center justify-center">
                    <AlertCircle className="h-16 w-16 sm:h-20 sm:w-20 text-red-300" />
                  </div>
                </div>

                <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3">
                  Check-in failed
                </h1>
                <p className="text-base sm:text-xl text-red-300 mb-8 max-w-md mx-auto">
                  {result.message}
                </p>

                <Button
                  size="lg"
                  className="h-14 sm:h-16 px-8 sm:px-12 text-base"
                  onClick={resetKiosk}
                >
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Try again
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-800/50 border-t border-white/10 px-4 sm:px-8 py-4 text-center">
          <p className="text-xs sm:text-sm text-gray-400">
            Touch anywhere or wait {countdown} seconds to check in another person
          </p>
          {printStatus && (
            <p className={printStatus.success ? "text-xs text-emerald-400 mt-1" : "text-xs text-red-400 mt-1"}>
              {printStatus.message}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ============================================================
  // SCAN / ENTRY SCREEN
  // ============================================================
  return (
    <div
      className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Header */}
      <div className="bg-gray-800/50 border-b border-white/10 px-4 sm:px-8 py-4 sm:py-6 relative">
        <button
          onClick={toggleFullscreen}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 p-2 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
        <div className="max-w-4xl mx-auto flex items-start sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">
              {event?.short_name || event?.name || "Event"}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs sm:text-sm text-gray-400">
              {event?.start_date && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(event.start_date)}
                </span>
              )}
              {event?.venue_name && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.venue_name}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs sm:text-sm text-gray-400">Checking in for</p>
            <div className="flex items-center gap-2 justify-end">
              <p className="text-base sm:text-xl font-semibold text-white truncate">
                {list?.name || "Loading…"}
              </p>
              {onSwitchList && (
                <button
                  onClick={() => {
                    if (confirm(`Leave ${list?.name || "this list"} and return to the menu?`)) {
                      onSwitchList()
                    }
                  }}
                  className="text-xs text-indigo-300 underline hover:text-indigo-200 shrink-0"
                >
                  Switch list
                </button>
              )}
            </div>
            {stationName && (
              <p className="text-xs text-gray-500 truncate">{stationName}</p>
            )}
            {typeof closingSoonMinutes === "number" && closingSoonMinutes >= 0 && closingSoonMinutes <= 5 && (
              <p className="text-xs text-amber-400 mt-0.5">
                {list?.name || "This list"} closes in {closingSoonMinutes} minute{closingSoonMinutes === 1 ? "" : "s"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-2xl w-full">
          {/* Hero icon + headline */}
          <div className="text-center mb-8">
            <div className="size-20 sm:size-28 mx-auto rounded-3xl bg-indigo-500/15 outline outline-1 -outline-offset-1 outline-indigo-500/30 flex items-center justify-center mb-6 text-indigo-300">
              <QrCode className="h-12 w-12 sm:h-16 sm:w-16" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">Self check-in</h2>
            <p className="text-base sm:text-lg text-gray-400 max-w-md mx-auto">
              Scan QR code or enter your name, phone, or registration number
            </p>
          </div>

          {/* Scan mode toggle */}
          <div className="flex bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-xl p-1 mb-4">
            <button
              onClick={() => setScanMode("camera")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                scanMode === "camera" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <Camera className="w-5 h-5" />
              Camera Scan
            </button>
            <button
              onClick={() => setScanMode("manual")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                scanMode === "manual" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <Keyboard className="w-5 h-5" />
              Manual / Scanner
            </button>
          </div>

          {scanMode === "camera" ? (
            /* Camera viewport — action-panel surface */
            <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-4 sm:p-5">
              <div className="relative">
                <div
                  id={scannerContainerId}
                  className="w-full aspect-square max-w-sm mx-auto rounded-xl overflow-hidden bg-black"
                />
                {cameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-56 h-56 sm:w-64 sm:h-64 border-2 border-white/50 rounded-lg relative">
                      <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
                      <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
                      <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />
                    </div>
                  </div>
                )}
                {cameraActive && cameras.length > 1 && (
                  <button
                    onClick={switchCamera}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 p-3 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
                    title="Switch camera"
                  >
                    <SwitchCamera className="w-5 h-5" />
                  </button>
                )}
                {!cameraActive && !cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-xl">
                    <div className="text-center text-white">
                      <Loader2 className="w-10 h-10 mx-auto animate-spin" />
                      <p className="mt-3 text-sm">Starting camera…</p>
                    </div>
                  </div>
                )}
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
                        className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-4 text-center text-sm text-gray-400">
                Point camera at your badge QR code
              </p>
              {isProcessing && (
                <div className="mt-3 flex items-center justify-center gap-2 text-emerald-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-medium">Checking in…</span>
                </div>
              )}
            </div>
          ) : (
            /* Manual / external-scanner input panel — action-panel surface */
            <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-5 sm:p-6">
              <div className="relative">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Registration #, name, phone, or email…"
                  value={registrationNumber}
                  onChange={handleRegChange}
                  onKeyDown={handleKeyDown}
                  className="h-14 sm:h-16 text-base sm:text-xl text-center bg-white text-slate-900 border-0 rounded-xl placeholder:text-slate-400 pr-14"
                  autoComplete="off"
                  autoFocus
                />
                <Keyboard className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 sm:h-7 sm:w-7 text-slate-400 pointer-events-none" />
              </div>

              <Button
                size="lg"
                className="w-full h-14 sm:h-16 mt-4 text-base sm:text-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
                onClick={() => handleCheckin()}
                disabled={isProcessing || !cacheReady || !registrationNumber.trim()}
              >
                {!cacheReady && cacheError ? (
                  "Unavailable"
                ) : !cacheReady ? (
                  <>
                    <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                    Loading…
                  </>
                ) : isProcessing ? (
                  <>
                    <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                    Checking in…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-6 w-6 mr-2" />
                    Check in
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Instructions — action-panel cards */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-4 flex items-start gap-3">
              <div className="size-10 flex-none rounded-full bg-blue-500/15 outline outline-1 -outline-offset-1 outline-blue-500/30 flex items-center justify-center text-blue-300">
                <QrCode className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Badge scanner</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Scan your badge with the scanner at this kiosk
                </p>
              </div>
            </div>
            <div className="bg-gray-800/50 outline outline-1 -outline-offset-1 outline-white/10 rounded-lg p-4 flex items-start gap-3">
              <div className="size-10 flex-none rounded-full bg-purple-500/15 outline outline-1 -outline-offset-1 outline-purple-500/30 flex items-center justify-center text-purple-300">
                <Keyboard className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Manual entry</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Type your name, phone number, or registration ID
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-800/50 border-t border-white/10 px-4 sm:px-8 py-4 text-center">
        {/* Persistent status strip -- so a silently-disconnected printer or
            a dead camera doesn't look identical to "working fine" on an
            unattended device. */}
        <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 mb-2 text-[11px]">
          <span className={`inline-flex items-center gap-1 ${isOnline ? "text-emerald-400" : "text-amber-400"}`}>
            <span className={`size-1.5 rounded-full ${isOnline ? "bg-emerald-400" : "bg-amber-400"}`} />
            {isOnline ? "Online" : "Offline"}
          </span>
          {scanMode === "camera" && (
            <span className={`inline-flex items-center gap-1 ${cameraActive ? "text-emerald-400" : cameraError ? "text-red-400" : "text-gray-500"}`}>
              <span className={`size-1.5 rounded-full ${cameraActive ? "bg-emerald-400" : cameraError ? "bg-red-400" : "bg-gray-500"}`} />
              {cameraActive ? "Camera active" : cameraError ? "Camera error" : "Camera starting…"}
            </span>
          )}
          {mode === "checkin_and_print" && usbSupported && (
            <span className={`inline-flex items-center gap-1 ${printerConnected ? "text-emerald-400" : "text-gray-500"}`}>
              <span className={`size-1.5 rounded-full ${printerConnected ? "bg-emerald-400" : "bg-gray-500"}`} />
              {printerConnected ? "Printer connected" : "Printer not connected"}
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-gray-400">
          Need help? Please contact the registration desk
        </p>
        {helpRequestId ? (
          <p className="text-xs text-emerald-400 mt-1">Help requested — an admin has been notified.</p>
        ) : (
          <button
            onClick={handleRequestHelp}
            disabled={requestingHelp}
            className="text-xs text-indigo-300 underline hover:text-indigo-200 mt-1 disabled:opacity-50"
          >
            {requestingHelp ? "Sending…" : "Tap here to notify an admin"}
          </button>
        )}
        {cacheError && (
          <p className="text-xs text-red-400 mt-1">{cacheError}</p>
        )}
        {pendingSyncCount > 0 && (
          <p className="text-xs text-gray-500 mt-1">Syncing {pendingSyncCount} check-in{pendingSyncCount === 1 ? "" : "s"}…</p>
        )}
      </div>
    </div>
  )
}
