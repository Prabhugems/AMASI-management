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
  AlertTriangle,
  WifiOff,
  Printer,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import * as Sentry from "@sentry/nextjs"
import { matchDelegate, searchDelegates, type CachedDelegate } from "@/lib/kiosk-delegate-match"
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
  getScanHistoryForRegistration,
  cacheStationNames,
  getStationNames,
  cacheCollectedStatus,
  getCollectedStatus,
  cacheListPurpose,
  getListPurpose,
  type CachedStationName,
  type CachedCollectedEntry,
} from "@/lib/kiosk-offline-store"
import { drainScanQueue } from "@/lib/kiosk-sync-worker"
import { isNetworkFailure } from "@/lib/offline-scan-queue"
import { resolveStationName } from "@/lib/kiosk-station-lookup-client"
import { CATEGORY_COLORS, type ListCategory } from "@/lib/checkin-list-category"
import { useScreenWakeLock } from "@/hooks/use-screen-wake-lock"
import { useForceLightTheme } from "@/hooks/use-force-light-theme"
import { BatteryStatusBadge } from "@/components/kiosk/BatteryStatusBadge"

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
  // Set when `alreadyCheckedIn` was determined to be a duplicate collection
  // scan for this delegate/list (as opposed to the server's own "repeat
  // entry" success path, which never sets these). Consumed by a later task's
  // amber duplicate-warning screen.
  duplicateCheckedInAt?: string // ISO timestamp
  duplicateStationName?: string // display name of where it was first collected
  // Set only when `matchDelegate` found no delegate at all for the scanned
  // code (as opposed to a matched delegate that turns out to be a
  // duplicate, or some other failure like an IndexedDB-enqueue error).
  // Consumed by NotOnListScreen below.
  notOnList?: boolean
  scannedCode?: string
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
  // The active list's scheduled close time (checkin_lists.kiosk_closes_at),
  // used only for the collection-list "ready to scan" screen's "Open until
  // {time}" subtext -- distinct from closingSoonMinutes above, which is a
  // soft ≤5-minute warning, not the actual close time. Only ever populated
  // by KioskStationShell; every other caller omits it, which this component
  // must handle by simply omitting the "Open until" line.
  listClosesAt?: string | null
  contactPhone?: string | null
  category?: ListCategory
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
  listClosesAt,
  contactPhone,
  category,
}: KioskCheckinScreenProps) {
  const supabase = createClient()

  // This component's mount lifetime IS "a job is active" (KioskStationShell
  // unmounts it entirely when returning to the menu, and the direct-URL
  // /kiosk/[eventId]/[listId] path never shows a menu at all) -- so holding
  // the wake lock for this component's whole lifetime, with no extra active/
  // inactive state of its own, already implements work order §6.1 exactly
  // ("hold while a job is active, release on the menu").
  useScreenWakeLock()
  // Shared kiosk tablets have no per-user theme preference and sit under
  // bright hall lighting -- see the hook for why this overrides the site-wide
  // dark default (work order §2.4).
  useForceLightTheme()

  // Render-time / effect-gating printer type -- from the top-level SSR
  // prop (always synchronously available), NOT the offline-cached
  // template (which only resolves async inside printBadge itself). Both
  // trace to the same print_stations.print_settings column.
  const printerType: "usb" | "browser" = printSettings?.printer_type === "browser" ? "browser" : "usb"

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
  // True only when the server's last-known response for this list was
  // list_purpose === "collection" AND blocked === false (a genuinely
  // attended station serving a collection list). Defaults to false --
  // "treat as an entry list, no local duplicate check" -- including while
  // the very first fetch is still in flight or has failed: this state only
  // decides whether handleCheckin shows a nicer local "duplicate" UI, never
  // whether a scan is authorized. The server's own `blocked` flag already
  // gates that.
  const [isCollectionListActive, setIsCollectionListActive] = useState(false)
  // The active list's display name, sourced from /api/kiosk/delegates'
  // response (see refreshFromServer) and rehydrated from the same offline
  // cache as isCollectionListActive -- NOT from a direct browser query
  // against checkin_lists, which has no anon/authenticated-browser SELECT
  // policy at all (RLS enabled, zero policies) and so always silently
  // returns null. That was the actual, previously-invisible cause of every
  // "Loading…"/"this list" fallback string this file has ever shown for a
  // list name -- confirmed via `select policyname from pg_policies where
  // tablename = 'checkin_lists'` returning zero rows.
  const [listName, setListName] = useState<string | null>(null)
  // Timestamp of the most recent real check-in attempt (success or failure)
  // -- drives the collection-list ready screen's "last scan N seconds ago"
  // status chip. Not set for the empty-input early-return in handleCheckin,
  // since that's not a real scan attempt.
  const [lastScanAt, setLastScanAt] = useState<number | null>(null)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [usbSupported, setUsbSupported] = useState(false)
  const [printerConnected, setPrinterConnected] = useState(false)
  const [printerName, setPrinterName] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [printStatus, setPrintStatus] = useState<{ success: boolean; message: string } | null>(null)
  const [printerSetupDone, setPrinterSetupDone] = useState(false)
  const [checkingPrinter, setCheckingPrinter] = useState(true)
  const [testPrinting, setTestPrinting] = useState(false)
  const [testPrintStatus, setTestPrintStatus] = useState<{ success: boolean; message: string } | null>(null)
  const [printerVerified, setPrinterVerified] = useState(false)
  const [awaitingPrintConfirm, setAwaitingPrintConfirm] = useState(false)
  // Set on every print attempt (success or failure) so the idle/ready
  // screen's "Reprint last badge" action always has a target -- most useful
  // exactly when the last attempt failed and the volunteer has already
  // moved on to the next delegate before noticing. Deliberately NOT cleared
  // by resetKiosk (see spec §6 -- this must survive across resets).
  const [lastPrintedRegistration, setLastPrintedRegistration] = useState<NonNullable<CheckinResult["registration"]> | null>(null)
  // Camera QR scan mode -- an alternative to the manual/external-scanner text
  // input below, using the same html5-qrcode integration already proven in
  // the standalone Print Station page (src/app/print/[token]/page.tsx).
  // Defaults to "camera" (unlike that page's "manual" default) since a
  // self-service kiosk's primary interaction is walk-up-and-scan.
  const [scanMode, setScanMode] = useState<"camera" | "manual">("camera")
  // Work order §5 -- lookup-only fallback for a badge that won't scan or a
  // phone whose QR won't load, so that doesn't require a walk to the (one-
  // person) help desk. Deliberately kept out of the scanMode toggle above:
  // this is secondary to the scanner, not a co-equal third input mode.
  const [nameSearchOpen, setNameSearchOpen] = useState(false)
  const [nameSearchQuery, setNameSearchQuery] = useState("")
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>("")
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerContainerId = "kiosk-qr-scanner-container"
  // True for the component's whole lifetime, flipped false exactly once on
  // real unmount (see the dedicated effect below with an empty dep array).
  // switchCamera and the visibility-regain handler both `await` a stop()
  // call before deciding whether to restart the scanner -- if the whole
  // screen unmounts (a volunteer tapped "Switch list") while that await is
  // in flight, clearing restartScannerTimeoutRef alone isn't enough: the
  // async function resumes AFTER unmount and would schedule a brand-new,
  // now-uncancellable timeout. Checking this ref right after every such
  // await is what actually stops that continuation from proceeding.
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])
  // Tracks the pending "restart the scanner in 300ms" timer scheduled by
  // switchCamera and the visibility-regain handler below. Both used a bare,
  // uncancelled setTimeout -- if the component unmounted in that 300ms
  // window (e.g. a volunteer tapped "Switch list" right after switching
  // cameras), the stale timer still fired after unmount and called
  // startScanner() again, racing the unmount cleanup's own scanner.stop().
  // Two overlapping getUserMedia/track-stop calls on the same physical
  // camera is a known cause of multi-second-to-tens-of-seconds stalls in
  // Chromium's video-capture pipeline -- consistent with the tab-freeze
  // reported when leaving a camera-active screen. Storing the timer id
  // lets every relevant cleanup cancel it before it can fire late.
  const restartScannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // For the persistent status strip only -- not read by any check-in/sync
  // logic, which already checks navigator.onLine directly at the point of
  // use rather than trusting a possibly-stale piece of React state.
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine)
  // Brief, transient "just went offline" banner (collection-list stations
  // only, see the isCollectionListActive branch below) -- a one-time heads-
  // up that auto-dismisses on its own short timer, NOT a persistent
  // connectivity gate. Deliberately independent of isOnline/the footer's
  // Online-Offline dot (which stays accurate and unaffected) and of the
  // countdown/result auto-reset mechanism (which is specifically for
  // clearing a completed check-in result, not this).
  const [showOfflineBanner, setShowOfflineBanner] = useState(false)
  const offlineBannerTimerRef = useRef<NodeJS.Timeout | null>(null)
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
  // Layer 2 cross-device duplicate detection support (see the two effects
  // below and handleCheckin's Layer 2 block). Refs, not state -- both are
  // read synchronously inside handleCheckin, which must never await a
  // network call.
  const cachedStationNamesRef = useRef<CachedStationName[]>([])
  const collectedStatusRef = useRef<Map<string, CachedCollectedEntry>>(new Map())
  // In-flight guard for syncNow -- the click handler (`void syncNow()` in
  // handleCheckin), the `online` listener, and the 20s interval poll can all
  // fire close together, and drainScanQueue has no guard of its own against
  // two overlapping passes over the same pending queue.
  const syncInFlightRef = useRef<boolean>(false)
  // Same in-flight guard as syncInFlightRef above, but for syncPrintLog --
  // print-log sync and scan sync are independent pending queues, so this is
  // a separate ref rather than reusing syncInFlightRef.
  const printSyncInFlightRef = useRef<boolean>(false)
  // Bug-audit fix (2026-08): the auto-print effect and the manual "Print
  // Badge" button's handler each independently await getLastPrintForRegistration
  // (an async IndexedDB read) before calling printBadge -- the `printing`
  // STATE flag alone can't prevent both from starting, since both can read
  // the same stale `printing: false` before either's setPrinting(true)
  // takes effect. A synchronous ref, checked and set atomically at the top
  // of printBadge itself (same pattern as submittingRef/syncInFlightRef
  // above), is what actually closes the race -- two physical badges could
  // otherwise print for the same person.
  const printingRef = useRef<boolean>(false)

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
        const data = (await res.json()) as { delegates: CachedDelegate[]; name?: string; list_purpose?: string; blocked?: boolean }
        if (cancelled) return

        // This state's only job is deciding whether handleCheckin runs a
        // local, same-tablet duplicate check for a nicer UI -- it is NOT the
        // authorization boundary (the server's `blocked` flag above already
        // is). True only when this is a collection-purpose list AND the
        // station is genuinely attended (blocked === false); false for
        // entry lists, blocked collection lists, and any response shape
        // that doesn't say otherwise.
        setIsCollectionListActive(data.list_purpose === "collection" && data.blocked === false)
        if (data.name) setListName(data.name)

        // Persist this server answer alongside the roster -- unlike the
        // delegate cache, list_purpose/blocked/name previously had no
        // offline persistence at all, so a cold-started/reloaded tablet had
        // no way to recover isCollectionListActive/listName without a
        // fresh, successful, online round-trip. Written in BOTH branches
        // below (blocked and success) since either one is a definitive
        // server answer about this list's purpose/blocked/name.
        await cacheListPurpose(listId, {
          list_purpose: data.list_purpose ?? "",
          blocked: data.blocked ?? true,
          name: data.name,
        })

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
        // Rehydrate isCollectionListActive from the last known-good server
        // answer BEFORE anything network-dependent happens -- this must run
        // regardless of online/offline state, exactly like getDelegateCache
        // above, so a cold-started tablet (or one reloaded while offline)
        // has the CORRECT collection-list-active flag immediately, rather
        // than silently defaulting to false (plain entry-list behavior,
        // with all collection-list duplicate detection disabled) until the
        // next successful online refreshFromServer() call.
        const cachedPurpose = await getListPurpose(listId)
        if (cachedPurpose && !cancelled) {
          setIsCollectionListActive(cachedPurpose.list_purpose === "collection" && cachedPurpose.blocked === false)
          if (cachedPurpose.name) setListName(cachedPurpose.name)
        }
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
    // Re-sync the instant connectivity returns, rather than waiting for the
    // next scheduled 5-minute poll -- closes the "up to 5 minutes of
    // silently-stale collection-list state after Wi-Fi returns" gap left by
    // the interval alone.
    window.addEventListener("online", refreshFromServer)
    return () => {
      cancelled = true
      clearInterval(refreshInterval)
      window.removeEventListener("online", refreshFromServer)
    }
  }, [eventId, listId, token, stationToken])

  // Station-name cache: loads/refreshes the display names of every station
  // at this event, so a cross-device duplicate (Layer 2 below) can show
  // "collected at Lunch Desk 2" instead of a bare id. Station names change
  // rarely, so this uses the same 5-minute cadence as the roster refresh
  // above. Only relevant on the station_token path -- the direct single-
  // list-token path can never have isCollectionListActive true, so there's
  // nothing for this data to support there.
  useEffect(() => {
    if (!stationToken) return
    // Narrowed to a local const: TS can't carry the `!stationToken` guard's
    // narrowing across the nested async closure below (stationToken is an
    // optional prop, not a const) -- same pattern as printStationId's
    // capture in the badge-template-cache effect above.
    const resolvedStationToken = stationToken
    let cancelled = false

    async function loadStationNames() {
      try {
        const cached = await getStationNames(eventId)
        if (!cancelled) cachedStationNamesRef.current = cached
      } catch (err) {
        Sentry.captureException(err, { tags: { module: "kiosk-page" }, extra: { eventId } })
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) return
      try {
        const res = await fetch(
          `/api/kiosk/station-names?event_id=${encodeURIComponent(eventId)}&station_token=${encodeURIComponent(resolvedStationToken)}`
        )
        if (!res.ok) return
        const data = (await res.json()) as { stations: CachedStationName[] }
        if (cancelled) return
        cachedStationNamesRef.current = data.stations
        await cacheStationNames(eventId, data.stations)
      } catch (err) {
        // A network failure here is routine (this runs on an interval
        // regardless of connectivity) -- the cached names stay valid and in
        // use, nothing to report.
        if (!isNetworkFailure(err)) {
          Sentry.captureException(err, { tags: { module: "kiosk-page" }, extra: { eventId } })
        }
      }
    }

    loadStationNames()
    const interval = setInterval(loadStationNames, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [eventId, stationToken])

  // Layer 2 cross-device duplicate detection: a ~30s background poll of
  // "already collected" status for the active list, so a tablet that's been
  // online in the last ~30s already knows what other desks did before the
  // NEXT scan happens here. Deliberately NOT a synchronous, blocking
  // round-trip inside handleCheckin -- this kiosk is local-first/optimistic
  // throughout. Only active when this is a genuinely attended station
  // serving a collection-purpose list (isCollectionListActive) -- never
  // runs for entry lists, unattended stations, or the direct-token path.
  useEffect(() => {
    if (!stationToken || !isCollectionListActive) return
    // Narrowed to a local const -- same reasoning as loadStationNames above.
    const resolvedStationToken = stationToken
    let cancelled = false

    async function loadCollectedStatus() {
      try {
        const cached = await getCollectedStatus(listId)
        if (!cancelled) {
          collectedStatusRef.current = new Map(cached.map((e) => [e.registration_id, e]))
        }
      } catch (err) {
        Sentry.captureException(err, { tags: { module: "kiosk-page" }, extra: { eventId, listId } })
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) return
      try {
        const res = await fetch(
          `/api/kiosk/collected-status?event_id=${encodeURIComponent(eventId)}&station_token=${encodeURIComponent(resolvedStationToken)}&list_id=${encodeURIComponent(listId)}`
        )
        if (!res.ok) return
        const data = (await res.json()) as { registrations: CachedCollectedEntry[]; blocked?: boolean }
        if (cancelled) return
        if (data.blocked) return
        collectedStatusRef.current = new Map(data.registrations.map((e) => [e.registration_id, e]))
        await cacheCollectedStatus(listId, data.registrations)
      } catch (err) {
        // A network failure here is routine (this runs on an interval
        // regardless of connectivity) -- the cached collected-status map
        // stays valid and in use, nothing to report.
        if (!isNetworkFailure(err)) {
          Sentry.captureException(err, { tags: { module: "kiosk-page" }, extra: { eventId, listId } })
        }
      }
    }

    loadCollectedStatus()
    const interval = setInterval(loadCollectedStatus, 30 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [eventId, listId, stationToken, isCollectionListActive])

  // Forces a re-render once a second while the collection-list ready screen
  // is showing, purely so its "last scan N seconds ago" chip counts up live
  // rather than only updating on the next actual scan. The value itself
  // isn't read anywhere -- it just triggers a render, matching this file's
  // existing tolerance for small ticking effects (e.g. the auto-reset
  // countdown below).
  const [, forceSecondTick] = useState(0)
  useEffect(() => {
    if (!isCollectionListActive) return
    const interval = setInterval(() => forceSecondTick((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [isCollectionListActive])

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
    if (mode !== "checkin_and_print" || printerType === "browser") {
      setCheckingPrinter(false)
      return
    }
    let cancelled = false
    let cleanupDisconnect: (() => void) | undefined
    ;(async () => {
      const { isWebUSBSupported, reconnectUsbPrinter, getUsbPrinterName, onUsbDisconnect } = await import("@/lib/usb-printer")
      if (!isWebUSBSupported()) {
        if (!cancelled) setCheckingPrinter(false)
        return
      }
      if (cancelled) return
      setUsbSupported(true)
      const result = await reconnectUsbPrinter()
      if (cancelled) return
      if (result.success) {
        setPrinterConnected(true)
        setPrinterName(result.name || getUsbPrinterName())
      }
      setCheckingPrinter(false)
      cleanupDisconnect = onUsbDisconnect(() => {
        setPrinterConnected(false)
        setPrinterName(null)
      })
    })()
    return () => {
      cancelled = true
      cleanupDisconnect?.()
    }
  }, [mode, printerType])

  const handleConnectPrinter = useCallback(async () => {
    setPrintStatus(null)
    setPrinterVerified(false)
    setAwaitingPrintConfirm(false)
    const { connectUsbPrinter } = await import("@/lib/usb-printer")
    const res = await connectUsbPrinter()
    if (res.success) {
      setPrinterConnected(true)
      setPrinterName(res.name || null)
    } else {
      setPrintStatus({ success: false, message: res.error || "Connection failed" })
    }
  }, [])

  const handleTestPrint = useCallback(async () => {
    setTestPrinting(true)
    setTestPrintStatus(null)
    setPrinterVerified(false)
    try {
      if (printerType === "browser") {
        const { printHtmlViaBrowser, buildBrowserTestPageHtml } = await import("@/lib/browser-print")
        const res = await printHtmlViaBrowser(buildBrowserTestPageHtml(event?.short_name || event?.name || "Event"))
        if (res.success) {
          setAwaitingPrintConfirm(true)
        } else {
          setTestPrintStatus({ success: false, message: res.error || "Could not open the print dialog." })
        }
        return
      }
      const { testUsbPrinter } = await import("@/lib/usb-printer")
      const res = await testUsbPrinter()
      if (res.success) {
        // Bytes leaving the USB port successfully is not proof a badge
        // actually printed -- a non-thermal printer, or a thermal printer
        // with no paper loaded, accepts the exact same bytes and produces
        // nothing. Confirmed live: an HP LaserJet reported "sent" and
        // printed nothing. Ask the volunteer to confirm with their own
        // eyes before this printer is considered ready.
        setAwaitingPrintConfirm(true)
      } else {
        setTestPrintStatus({ success: false, message: res.error || "Test print failed." })
      }
    } finally {
      setTestPrinting(false)
    }
  }, [printerType, event?.short_name, event?.name])

  const handleConfirmTestPrint = useCallback((badgePrinted: boolean) => {
    setAwaitingPrintConfirm(false)
    if (badgePrinted) {
      setPrinterVerified(true)
      setTestPrintStatus({ success: true, message: "Printer verified." })
    } else {
      setPrinterVerified(false)
      setTestPrintStatus({ success: false, message: "No badge came out — check the printer and try again." })
    }
  }, [])

  // Stage 4: local-first badge print. Renders the already-cached template
  // (Task 6) to a canvas and sends it over an already-paired WebUSB
  // connection -- no network call anywhere in this function. Only ever
  // invoked from mode === "checkin_and_print" code paths (auto-print effect
  // below, handlePrintButtonClick).
  const printBadge = useCallback(async (registration: NonNullable<CheckinResult["registration"]>) => {
    // See printingRef's own declaration comment: the auto-print effect and
    // the manual button's handler can both reach this call before either
    // sets `printing` state, so only a synchronous ref actually prevents
    // two concurrent prints for the same registration.
    if (printingRef.current) return
    printingRef.current = true
    setLastPrintedRegistration(registration)
    setPrinting(true)
    setPrintStatus(null)
    try {
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

      const printerType = template.printSettings?.printer_type === "browser" ? "browser" : "usb"

      // Cheapest possible check first, before any rendering work, for Path A
      // only -- Path B has no persistent WebUSB connection to check.
      if (printerType !== "browser") {
        const { isUsbPrinterConnected } = await import("@/lib/usb-printer")
        if (!isUsbPrinterConnected()) {
          setPrintStatus({ success: false, message: "Printer not connected — tap Connect Printer first." })
          return
        }
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
        // A custom-font template's Google Fonts <link> would otherwise load
        // live inside the print iframe (a real network call) -- found during
        // the §8 printing-spec audit. Path A (USB) never had this problem:
        // it strips the <head> before rendering, so this only matters here.
        offline: true,
      })

      if (printerType === "browser") {
        // Path B: printContent is already a full HTML document, correctly
        // sized via @page CSS (getPaperDimensions/generatePrintContent) --
        // no canvas rasterization or WebUSB needed, just the OS print
        // dialog. Zero network calls, matches the offline-first
        // requirement identically to Path A.
        const { printHtmlViaBrowser } = await import("@/lib/browser-print")
        const result = await printHtmlViaBrowser(printContent)
        await recordPrintOutcome(
          { print_id: newId(), list_id: listId, registration_id: registration.id, printed_at: Date.now() },
          result.success ? "success" : "failed"
        )
        setPrintStatus(
          result.success
            ? { success: true, message: "Sent to printer." }
            : { success: false, message: result.error || "Could not open the print dialog." }
        )
        return
      }

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
      printingRef.current = false
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
        token,
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
  }, [eventId, listId, stationToken, token])

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
    setLastScanAt(Date.now())

    try {
      const delegate = matchDelegate(delegatesRef.current, searchTerm)

      if (!delegate) {
        setResult({
          success: false,
          message: "Registration not found. Please check your registration number.",
          notOnList: true,
          scannedCode: searchTerm,
        })
        return
      }

      // Layer 1 duplicate detection: instant, same-tablet, fully offline --
      // only relevant on a collection-purpose list at a genuinely attended
      // station (isCollectionListActive). Entry-purpose lists (and any list
      // this component isn't sure about) must take the exact same path as
      // before this check existed -- repeat entry scans are always a
      // success, never flagged here.
      if (isCollectionListActive) {
        const allPriorScans = await getScanHistoryForRegistration(listId, delegate.id)
        // Bug-audit fix (2026-08): a "conflict" scan_log entry means either a
        // genuine duplicate (the server said alreadyCheckedIn:true) OR a
        // completely unrelated terminal business rejection (e.g. eligibility
        // changed mid-sync, list not found) that the sync worker files under
        // the exact same status. Treating any conflict record as "already
        // collected" permanently blocked a legitimate re-scan on this same
        // device once its history held even one such rejection. A "pending"
        // entry still counts -- that's this same tablet's own not-yet-synced
        // enqueue, exactly the local duplicate Layer 1 exists to catch.
        const priorScans = allPriorScans.filter(
          (s) =>
            s.status === "pending" ||
            s.status === "synced" ||
            (s.status === "conflict" &&
              typeof s.server_response === "object" &&
              s.server_response !== null &&
              (s.server_response as { alreadyCheckedIn?: boolean }).alreadyCheckedIn === true)
        )
        if (priorScans.length > 0) {
          const earliest = priorScans.reduce((a, b) => (a.scanned_at < b.scanned_at ? a : b))
          setResult({
            success: false,
            message: "Self check-in isn't available for this list. Please see a staff member.", // Never displayed: DuplicateWarningScreen (see below) unconditionally intercepts every alreadyCheckedIn:true+success:false result before this message could render; kept only for CheckinResult's type shape.
            alreadyCheckedIn: true,
            duplicateCheckedInAt: new Date(earliest.scanned_at).toISOString(),
            duplicateStationName: stationName || "this station",
            registration: {
              id: delegate.id,
              registration_number: delegate.registration_number,
              attendee_name: delegate.attendee_name,
              attendee_email: delegate.attendee_email,
              attendee_designation: delegate.attendee_designation ?? undefined,
              attendee_institution: delegate.attendee_institution ?? undefined,
            },
          })
          return
        }

        // Layer 2 duplicate detection: cross-device, from the ~30s
        // background poll's local cache (never a network call here --
        // handleCheckin must stay synchronous with respect to fetches). A
        // hit means some OTHER tablet already collected this item for this
        // registration on this list, as of the last successful poll.
        const crossDeviceMatch = collectedStatusRef.current.get(delegate.id)
        if (crossDeviceMatch) {
          setResult({
            success: false,
            message: "Self check-in isn't available for this list. Please see a staff member.", // Never displayed: DuplicateWarningScreen (see below) unconditionally intercepts every alreadyCheckedIn:true+success:false result before this message could render; kept only for CheckinResult's type shape.
            alreadyCheckedIn: true,
            duplicateCheckedInAt: crossDeviceMatch.checked_in_at,
            duplicateStationName: resolveStationName(crossDeviceMatch.station_id, cachedStationNamesRef.current),
            registration: {
              id: delegate.id,
              registration_number: delegate.registration_number,
              attendee_name: delegate.attendee_name,
              attendee_email: delegate.attendee_email,
              attendee_designation: delegate.attendee_designation ?? undefined,
              attendee_institution: delegate.attendee_institution ?? undefined,
            },
          })
          return
        }
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
      if (!isMountedRef.current) return
      if (restartScannerTimeoutRef.current) clearTimeout(restartScannerTimeoutRef.current)
      restartScannerTimeoutRef.current = setTimeout(() => {
        restartScannerTimeoutRef.current = null
        if (isMountedRef.current) startScanner()
      }, 300)
    }
  }, [cameras, selectedCameraId, cameraActive, stopScanner, startScanner])

  // Camera only runs on the entry screen (no active result) and only in
  // "camera" scan mode -- mirrors the print station page's identical gate.
  useEffect(() => {
    const showingPrinterSetup = mode === "checkin_and_print" && !printerSetupDone
    if (scanMode === "camera" && !result && !showingPrinterSetup) {
      getCameras()
    } else if (scanMode === "manual") {
      stopScanner()
    }
    return () => {
      // Cancel any restart scheduled by switchCamera/visibilitychange below
      // -- without this, a restart timer still pending when this effect's
      // cleanup runs (e.g. the whole component unmounting because a
      // volunteer tapped "Switch list") fires late, racing the stop() call
      // right below it for the same physical camera device. See this ref's
      // declaration for the full incident this closes.
      if (restartScannerTimeoutRef.current) {
        clearTimeout(restartScannerTimeoutRef.current)
        restartScannerTimeoutRef.current = null
      }
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode, result, mode, printerSetupDone])

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
        if (!isMountedRef.current) return
        if (restartScannerTimeoutRef.current) clearTimeout(restartScannerTimeoutRef.current)
        restartScannerTimeoutRef.current = setTimeout(() => {
          restartScannerTimeoutRef.current = null
          if (isMountedRef.current) startScanner()
        }, 300)
      })
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (restartScannerTimeoutRef.current) {
        clearTimeout(restartScannerTimeoutRef.current)
        restartScannerTimeoutRef.current = null
      }
    }
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
    const handleOffline = () => {
      setIsOnline(false)
      // Trigger the transient "just went offline" banner (collection-list
      // stations only -- see the isCollectionListActive branch below, which
      // is the only place showOfflineBanner is ever read). A short,
      // self-clearing timer, not tied to the countdown/result mechanism.
      setShowOfflineBanner(true)
      if (offlineBannerTimerRef.current) clearTimeout(offlineBannerTimerRef.current)
      offlineBannerTimerRef.current = setTimeout(() => setShowOfflineBanner(false), 6000)
    }
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      if (offlineBannerTimerRef.current) clearTimeout(offlineBannerTimerRef.current)
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
          message: `A kiosk station requested assistance.\nStation: ${stationName || "(unnamed)"}\nList: ${listName || listId}\nOnline: ${isOnline ? "yes" : "no"}`,
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
  // PRINTER SETUP SCREEN — shown once per mount (i.e. once per time the
  // volunteer enters this job from the menu, since KioskCheckinScreen
  // remounts on key={activeList.id} in KioskStationShell), before the scan
  // screen or its camera ever start. A volunteer must be able to connect
  // and test a badge before any delegate is standing there -- discovering
  // a dead printer on the success card after the first scan is too late.
  // ============================================================
  if (mode === "checkin_and_print" && !printerSetupDone) {
    return (
      <PrinterSetupScreen
        eventName={event?.short_name || event?.name}
        stationName={stationName}
        listName={listName || "this list"}
        checking={checkingPrinter}
        usbSupported={usbSupported}
        printerConnected={printerConnected}
        printerVerified={printerVerified}
        printerName={printerName}
        onConnect={handleConnectPrinter}
        connectStatus={printStatus}
        onTestPrint={handleTestPrint}
        testPrinting={testPrinting}
        awaitingPrintConfirm={awaitingPrintConfirm}
        onConfirmTestPrint={handleConfirmTestPrint}
        testPrintStatus={testPrintStatus}
        contactPhone={contactPhone}
        printerType={printerType}
        onContinue={() => {
          setPrintStatus(null)
          setPrinterSetupDone(true)
        }}
        isOnline={isOnline}
        onSwitchList={onSwitchList}
      />
    )
  }

  // ============================================================
  // SUCCESS / ERROR SCREEN
  // ============================================================
  if (result) {
    // A duplicate collection scan (Layer 1 same-tablet or Layer 2 cross-device)
    // is a routine, expected, non-error event for a volunteer -- not a system
    // failure -- so it gets its own full-screen amber warning instead of
    // falling into the generic red error screen below. This is distinct from
    // a repeat-ENTRY success (`success: true, alreadyCheckedIn: true`, the
    // Tito-model case per CLAUDE.md), which never satisfies this condition
    // and still renders through the existing green success branch untouched.
    // Deliberately NOT gated on `mode === "checkin"` (unlike the collection
    // ready/success screens below) -- a duplicate scan must never print a
    // badge regardless of station mode, so there is no printer capability
    // to lose here. Gating this on mode was tried and reverted: it made a
    // checkin_and_print + collection-list duplicate fall through to the
    // generic error screen, which discards duplicateCheckedInAt/
    // duplicateStationName entirely and shows a placeholder "self check-in
    // isn't available" message on a station where staff ARE present and
    // self check-in IS supported -- i.e. it hid the exact "already
    // collected, do not issue again" signal this whole feature exists to
    // surface. This screen renders for every mode on a genuine duplicate.
    if (!result.success && result.alreadyCheckedIn) {
      return (
        <DuplicateWarningScreen
          attendeeName={result.registration?.attendee_name || ""}
          registrationNumber={result.registration?.registration_number || ""}
          listName={listName || "this list"}
          duplicateCheckedInAt={result.duplicateCheckedInAt}
          duplicateStationName={result.duplicateStationName}
          countdown={countdown}
          stationName={stationName}
          pendingSyncCount={pendingSyncCount}
          isOnline={isOnline}
        />
      )
    }
    // A successful collection-list scan at a genuinely attended station gets
    // the redesigned full-screen green confirmation instead of the generic
    // self-service success screen below. Placed AFTER the duplicate check
    // above -- a duplicate always takes the amber screen even when
    // isCollectionListActive is also true, since that branch already
    // returned by this point. `mode === "checkin"` exemption -- see the
    // DuplicateWarningScreen gate above for the full rationale: a
    // checkin_and_print station falls through to the original self-service
    // success screen instead, which has the printer connect/print UI this
    // component deliberately does not.
    if (isCollectionListActive && result.success && mode === "checkin") {
      return (
        <CollectionSuccessScreen
          listName={listName || "this list"}
          attendeeName={result.registration?.attendee_name || ""}
          registrationNumber={result.registration?.registration_number || ""}
          attendeeInstitution={result.registration?.attendee_institution}
          countdown={countdown}
          stationName={stationName}
          pendingSyncCount={pendingSyncCount}
          isOnline={isOnline}
        />
      )
    }
    // A scanned code that matches nobody on the active collection list --
    // distinct from a duplicate (matched delegate, already collected) and
    // from any other failure (e.g. an IndexedDB-enqueue error), neither of
    // which set `notOnList`. Same `mode === "checkin"` exemption as the two
    // gates above, for consistency -- a checkin_and_print station falls
    // through to the original generic "Registration not found" error screen
    // instead.
    if (isCollectionListActive && result.notOnList && mode === "checkin") {
      return (
        <NotOnListScreen
          listName={listName || "this list"}
          scannedCode={result.scannedCode}
          countdown={countdown}
          stationName={stationName}
          pendingSyncCount={pendingSyncCount}
          isOnline={isOnline}
        />
      )
    }
    return (
      <div className="fixed inset-0 bg-background flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 sm:px-8 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                {event?.short_name || event?.name}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {listName}
                {stationName && ` · ${stationName}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs sm:text-sm text-muted-foreground">Auto-reset in</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
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
                    <CheckCircle2 className="h-16 w-16 sm:h-20 sm:w-20 text-emerald-600" />
                  </div>
                </div>

                <h1 className="text-3xl sm:text-5xl font-bold text-foreground mb-3">
                  Welcome, {result.registration?.attendee_name?.split(" ")[0]}!
                </h1>
                <p className="text-base sm:text-xl text-emerald-700 mb-2">
                  {result.alreadyCheckedIn ? "You're already checked in" : "Check-in successful"}
                </p>
                {result.warning && (
                  <p className="text-sm text-amber-800 mb-6 max-w-md mx-auto">{result.warning}</p>
                )}
                {!result.warning && <div className="mb-8" />}

                {/* Details — stacked-list pattern */}
                <div className="bg-card outline outline-1 -outline-offset-1 outline-border rounded-lg overflow-hidden mb-8 text-left">
                  <ul className="divide-y divide-border">
                    <li className="flex items-center gap-x-4 px-5 py-4">
                      <div className="size-10 flex-none rounded-full bg-muted outline outline-1 -outline-offset-1 outline-border flex items-center justify-center text-muted-foreground">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Name</p>
                        <p className="mt-0.5 text-base sm:text-lg font-medium text-foreground">
                          {result.registration?.attendee_name}
                        </p>
                      </div>
                    </li>
                    <li className="flex items-center gap-x-4 px-5 py-4">
                      <div className="size-10 flex-none rounded-full bg-muted outline outline-1 -outline-offset-1 outline-border flex items-center justify-center text-muted-foreground">
                        <Ticket className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Registration</p>
                        <p className="mt-0.5 text-base sm:text-lg font-medium text-foreground font-mono">
                          {result.registration?.registration_number}
                        </p>
                      </div>
                    </li>
                    {result.registration?.attendee_designation && (
                      <li className="flex items-center gap-x-4 px-5 py-4">
                        <div className="size-10 flex-none rounded-full bg-muted outline outline-1 -outline-offset-1 outline-border flex items-center justify-center text-muted-foreground">
                          <Briefcase className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Designation</p>
                          <p className="mt-0.5 text-base sm:text-lg font-medium text-foreground">
                            {result.registration.attendee_designation}
                          </p>
                        </div>
                      </li>
                    )}
                    {result.registration?.attendee_institution && (
                      <li className="flex items-center gap-x-4 px-5 py-4">
                        <div className="size-10 flex-none rounded-full bg-muted outline outline-1 -outline-offset-1 outline-border flex items-center justify-center text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Institution</p>
                          <p className="mt-0.5 text-base sm:text-lg font-medium text-foreground">
                            {result.registration.attendee_institution}
                          </p>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>

                {mode === "checkin_and_print" && printStatus && !printStatus.success && (
                  <div className="mb-8 rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 sm:p-6 text-left">
                    <p className="text-lg sm:text-xl font-bold text-amber-800 mb-1">
                      Checked in — badge did not print
                    </p>
                    <p className="text-sm text-amber-800/80 mb-4">
                      Check the printer: labels loaded, cable connected, lid closed.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        size="lg"
                        className="h-12 px-6 text-sm"
                        onClick={handlePrintButtonClick}
                        disabled={printing}
                      >
                        {printing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Print again
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-12 px-6 text-sm bg-transparent border-border text-foreground hover:bg-muted"
                        onClick={resetKiosk}
                      >
                        Skip and continue
                      </Button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 sm:h-16 px-6 sm:px-8 text-base bg-transparent border-border text-foreground hover:bg-muted"
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
                  {mode === "checkin_and_print" && (usbSupported || printerType === "browser") && !(printStatus && !printStatus.success) && (
                    printerType !== "browser" && !printerConnected ? (
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-14 sm:h-16 px-6 sm:px-8 text-base bg-transparent border-border text-foreground hover:bg-muted"
                        onClick={handleConnectPrinter}
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

                <h1 className="text-3xl sm:text-5xl font-bold text-foreground mb-3">
                  Check-in failed
                </h1>
                <p className="text-base sm:text-xl text-red-700 mb-8 max-w-md mx-auto">
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
        <div className="bg-card border-t border-border px-4 sm:px-8 py-4 text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Touch anywhere or wait {countdown} seconds to check in another person
          </p>
          {printStatus && (
            <p className={printStatus.success ? "text-xs text-emerald-700 mt-1" : "text-xs text-red-700 mt-1"}>
              {printStatus.message}
            </p>
          )}
          {/* Persistent, small, cornered reprint action (badge-printing spec
              §6) -- distinct from the primary "Print Badge" button above,
              which prints/retries THIS check-in. This survives to whichever
              person's badge was printed most recently, matching the exact
              pattern already used on the idle/ready screen's footer, so a
              volunteer who's moved on can still reprint the last badge from
              here too. */}
          {mode === "checkin_and_print" && lastPrintedRegistration && (
            <button
              onClick={() => printBadge(lastPrintedRegistration)}
              disabled={printing}
              className="text-xs text-indigo-600 underline hover:text-indigo-800 mt-1 disabled:opacity-50"
            >
              {printing ? "Reprinting…" : `Reprint badge for ${lastPrintedRegistration.attendee_name}`}
            </button>
          )}
        </div>
      </div>
    )
  }

  // A genuinely attended station serving a collection-purpose list gets the
  // redesigned "ready to scan" screen instead of the self-service entry
  // screen below -- entry lists, the direct-token path, and any
  // checkin_and_print station are untouched (`mode === "checkin"` -- the
  // project owner's explicit scope decision is that checkin_and_print
  // stations keep the original self-service screens, which have the printer
  // connect/print UI CollectionReadyScreen deliberately does not).
  if (isCollectionListActive && mode === "checkin") {
    return (
      // CollectionReadyScreen renders continuously here, regardless of
      // showOfflineBanner -- see the comment on OfflineTransitionScreen's
      // render below for why. The wrapper is a plain non-fixed div (the
      // fixed positioning lives on CollectionReadyScreen's own root), just
      // tall enough to host the absolutely-positioned overlay banner.
      <div className="relative h-full w-full">
        <CollectionReadyScreen
          listName={listName || "this list"}
          listClosesAt={listClosesAt}
          lastScanAt={lastScanAt}
          stationName={stationName}
          pendingSyncCount={pendingSyncCount}
          isOnline={isOnline}
          onSwitchList={onSwitchList}
          scanMode={scanMode}
          setScanMode={setScanMode}
          cameraActive={cameraActive}
          cameraError={cameraError}
          cameras={cameras}
          switchCamera={switchCamera}
          startScanner={startScanner}
          scannerContainerId={scannerContainerId}
          registrationNumber={registrationNumber}
          handleRegChange={handleRegChange}
          handleKeyDown={handleKeyDown}
          handleCheckin={handleCheckin}
          inputRef={inputRef}
          isProcessing={isProcessing}
          cacheReady={cacheReady}
          cacheError={cacheError}
          delegatesRef={delegatesRef}
        />
        {/* A short-lived, one-time "just went offline" notice -- NOT a
            persistent connectivity gate, and NOT a full-screen replacement
            of CollectionReadyScreen above (which previously unmounted the
            live camera/Html5Qrcode viewport and the focused manual-entry
            <Input> for its ~6s duration -- neither the camera effect nor
            the input ever re-initialized on remount, permanently killing
            the scanner until a manual reload). Rendered as an absolutely-
            positioned overlay banner on top of the still-mounted screen
            instead, so nothing here ever unmounts: the camera keeps
            streaming and the input keeps accepting keystrokes underneath,
            completely unaffected by this banner appearing/disappearing.
            showOfflineBanner flips back to false on its own timer (see
            handleOffline above) regardless of whether connectivity has
            actually returned. */}
        {showOfflineBanner && (
          <div className="fixed inset-x-0 top-0 z-50 flex justify-center pointer-events-none px-4 pt-4 sm:pt-6">
            <OfflineTransitionScreen queueDepth={pendingSyncCount} mode={mode} />
          </div>
        )}
      </div>
    )
  }

  // ============================================================
  // SCAN / ENTRY SCREEN
  // ============================================================
  return (
    <div
      className="fixed inset-0 bg-background flex flex-col"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Header — coloured by the active list's category (blue/violet/cyan)
          so the job is identifiable from 2 metres, replacing the previous
          neutral grey bar. Falls back to the neutral grey only if category
          is somehow unset (should not happen once every caller supplies it). */}
      <div className={`${category ? CATEGORY_COLORS[category].header : "bg-gray-800/50"} border-b border-white/10 px-4 sm:px-8 py-4 sm:py-6 relative`}>
        <button
          onClick={toggleFullscreen}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 p-2 rounded-full text-gray-200 hover:text-white hover:bg-white/10 transition-colors"
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
        <div className="max-w-4xl mx-auto flex items-start sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">
              {event?.short_name || event?.name || "Event"}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs sm:text-sm text-white/70">
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
            {/* Station identity leads, as a color-coded badge -- a volunteer
                glancing at a shared, multi-job tablet needs to confirm WHICH
                desk and WHICH kind of job they're on before anything else.
                Previously this was tiny gray-500 text below the list name,
                easy to miss entirely and visually identical regardless of
                which list was active. Color mirrors isCollectionListActive:
                amber matches this app's existing collection-list visual
                language (menu tile "Needs a volunteer watching", the
                duplicate-scan warning screen); indigo matches the entry-list
                QR icon color already used on this same screen. */}
            {stationName && (
              <div className="flex items-center justify-end gap-1.5 mb-1.5">
                <span
                  className={`inline-flex items-center gap-1.5 max-w-[240px] truncate rounded-full border px-3 py-1 text-xs sm:text-sm font-bold uppercase tracking-wide ${
                    isCollectionListActive
                      ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
                      : "border-indigo-500/30 bg-indigo-500/15 text-indigo-300"
                  }`}
                >
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${isCollectionListActive ? "bg-amber-400" : "bg-indigo-400"}`}
                  />
                  <span className="truncate">{stationName}</span>
                </span>
              </div>
            )}
            <p className="text-xs sm:text-sm text-white/70">Checking in for</p>
            <div className="flex items-center gap-2 justify-end">
              <p
                className={`text-base sm:text-xl font-semibold truncate ${
                  isCollectionListActive ? "text-amber-300" : "text-white"
                }`}
              >
                {listName || "Loading…"}
              </p>
              {onSwitchList && (
                <button
                  onClick={() => {
                    if (confirm(`Leave ${listName || "this list"} and return to the menu?`)) {
                      onSwitchList()
                    }
                  }}
                  className="text-xs text-indigo-300 underline hover:text-indigo-200 shrink-0"
                >
                  Switch list
                </button>
              )}
            </div>
            {typeof closingSoonMinutes === "number" && closingSoonMinutes >= 0 && closingSoonMinutes <= 5 && (
              <p className="text-xs text-amber-400 mt-0.5">
                {listName || "This list"} closes in {closingSoonMinutes} minute{closingSoonMinutes === 1 ? "" : "s"}
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
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Self check-in</h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto">
              Scan QR code or enter your name, phone, or registration number
            </p>
          </div>

          {/* Scan mode toggle */}
          <div className="flex bg-card outline outline-1 -outline-offset-1 outline-border rounded-xl p-1 mb-4">
            <button
              onClick={() => setScanMode("camera")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                scanMode === "camera" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Camera className="w-5 h-5" />
              Camera Scan
            </button>
            <button
              onClick={() => setScanMode("manual")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                scanMode === "manual" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Keyboard className="w-5 h-5" />
              Manual / Scanner
            </button>
          </div>

          {scanMode === "camera" ? (
            /* Camera viewport — action-panel surface */
            <div className="bg-card outline outline-1 -outline-offset-1 outline-border rounded-lg p-4 sm:p-5">
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
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Point camera at your badge QR code
              </p>
              {isProcessing && (
                <div className="mt-3 flex items-center justify-center gap-2 text-emerald-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-medium">Checking in…</span>
                </div>
              )}
            </div>
          ) : (
            /* Manual / external-scanner input panel — action-panel surface */
            <div className="bg-card outline outline-1 -outline-offset-1 outline-border rounded-lg p-5 sm:p-6">
              <div className="relative">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Registration #, name, phone, or email…"
                  value={registrationNumber}
                  onChange={handleRegChange}
                  onKeyDown={handleKeyDown}
                  className="h-14 sm:h-16 text-base sm:text-xl text-center bg-white text-slate-900 border border-border rounded-xl placeholder:text-slate-400 pr-14"
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
            <div className="bg-card outline outline-1 -outline-offset-1 outline-border rounded-lg p-4 flex items-start gap-3">
              <div className="size-10 flex-none rounded-full bg-blue-500/15 outline outline-1 -outline-offset-1 outline-blue-500/30 flex items-center justify-center text-blue-700">
                <QrCode className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Badge scanner</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Scan your badge with the scanner at this kiosk
                </p>
              </div>
            </div>
            <div className="bg-card outline outline-1 -outline-offset-1 outline-border rounded-lg p-4 flex items-start gap-3">
              <div className="size-10 flex-none rounded-full bg-purple-500/15 outline outline-1 -outline-offset-1 outline-purple-500/30 flex items-center justify-center text-purple-700">
                <Keyboard className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Manual entry</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Type your name, phone number, or registration ID
                </p>
              </div>
            </div>
          </div>

          {/* Name search — secondary to the scanner (work order §5). A
              badge that won't scan, or a phone whose QR won't load, must not
              require a walk to the help desk. Searches only the already-
              cached roster in delegatesRef -- no network call, works
              offline -- and never auto-selects: the volunteer always taps
              the right person, then proceeds through the exact same
              handleCheckin path a scan uses (registration_number override,
              so matchDelegate resolves to precisely this person). */}
          <div className="mt-4 text-center">
            {!nameSearchOpen ? (
              <button
                onClick={() => setNameSearchOpen(true)}
                className="text-sm text-indigo-600 underline hover:text-indigo-800"
              >
                Can&apos;t scan? Search by name
              </button>
            ) : (
              <div className="bg-card outline outline-1 -outline-offset-1 outline-border rounded-lg p-4 sm:p-5 text-left">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-sm font-semibold text-foreground">Search by name</p>
                  <button
                    onClick={() => {
                      setNameSearchOpen(false)
                      setNameSearchQuery("")
                    }}
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Close
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    autoFocus
                    type="text"
                    value={nameSearchQuery}
                    onChange={(e) => setNameSearchQuery(e.target.value)}
                    placeholder="Name, phone, or registration ID…"
                    autoComplete="off"
                    className="pl-10"
                  />
                </div>
                {nameSearchQuery.trim().length >= 2 && (() => {
                  const results = searchDelegates(delegatesRef.current, nameSearchQuery)
                  return (
                    <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
                      {results.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setNameSearchOpen(false)
                            setNameSearchQuery("")
                            void handleCheckin(d.registration_number)
                          }}
                          className="w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left hover:bg-muted transition-colors"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-foreground truncate">{d.attendee_name}</span>
                            <span className="block text-xs text-muted-foreground truncate">
                              {d.registration_number}
                              {d.attendee_institution ? ` · ${d.attendee_institution}` : ""}
                            </span>
                          </span>
                        </button>
                      ))}
                      {results.length === 0 && (
                        <p className="text-sm text-muted-foreground py-2">No match — see the help desk</p>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-card border-t border-border px-4 sm:px-8 py-4 text-center">
        {/* Persistent status strip -- so a silently-disconnected printer or
            a dead camera doesn't look identical to "working fine" on an
            unattended device. */}
        <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 mb-2 text-[11px]">
          <span className={`inline-flex items-center gap-1 ${isOnline ? "text-emerald-700" : "text-amber-700"}`}>
            <span className={`size-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
            {isOnline ? "Online" : "Offline"}
          </span>
          {scanMode === "camera" && (
            <span className={`inline-flex items-center gap-1 ${cameraActive ? "text-emerald-700" : cameraError ? "text-red-700" : "text-muted-foreground"}`}>
              <span className={`size-1.5 rounded-full ${cameraActive ? "bg-emerald-500" : cameraError ? "bg-red-500" : "bg-muted-foreground"}`} />
              {cameraActive ? "Camera active" : cameraError ? "Camera error" : "Camera starting…"}
            </span>
          )}
          {mode === "checkin_and_print" && (usbSupported || printerType === "browser") && (
            <span className={`inline-flex items-center gap-1 ${(printerType === "browser" ? printerVerified : printerConnected && printerVerified) ? "text-emerald-700" : "text-red-700"}`}>
              <span className={`size-1.5 rounded-full ${(printerType === "browser" ? printerVerified : printerConnected && printerVerified) ? "bg-emerald-500" : "bg-red-500"}`} />
              {(printerType === "browser" ? printerVerified : printerConnected && printerVerified) ? "Printer ready" : "Printer problem — call for help"}
            </span>
          )}
          <BatteryStatusBadge />
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Need help? Please contact the registration desk
        </p>
        {helpRequestId ? (
          <p className="text-xs text-emerald-700 mt-1">Help requested — an admin has been notified.</p>
        ) : (
          <button
            onClick={handleRequestHelp}
            disabled={requestingHelp}
            className="text-xs text-indigo-600 underline hover:text-indigo-800 mt-1 disabled:opacity-50"
          >
            {requestingHelp ? "Sending…" : "Tap here to notify an admin"}
          </button>
        )}
        {mode === "checkin_and_print" && lastPrintedRegistration && (
          <button
            onClick={() => printBadge(lastPrintedRegistration)}
            disabled={printing}
            className="text-xs text-indigo-600 underline hover:text-indigo-800 mt-1 disabled:opacity-50"
          >
            {printing ? "Reprinting…" : `Reprint badge for ${lastPrintedRegistration.attendee_name}`}
          </button>
        )}
        {cacheError && (
          <p className="text-xs text-red-700 mt-1">{cacheError}</p>
        )}
        {pendingSyncCount > 0 && (
          <p className="text-xs text-muted-foreground mt-1">Syncing {pendingSyncCount} check-in{pendingSyncCount === 1 ? "" : "s"}…</p>
        )}
      </div>
    </div>
  )
}

// Renders a human-readable relative time (e.g. "17 minutes ago") for the
// duplicate-warning screen's footer line. Never hardcoded -- computed live
// from the real `duplicateCheckedInAt` timestamp every render.
function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return "Just now"
  if (minutes === 1) return "1 minute ago"
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.round(minutes / 60)
  if (hours === 1) return "1 hour ago"
  if (hours < 24) return `${hours} hours ago`
  return new Date(iso).toLocaleString([], { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })
}

interface PrinterSetupScreenProps {
  eventName?: string
  stationName?: string
  listName: string
  checking: boolean
  usbSupported: boolean
  printerConnected: boolean
  printerVerified: boolean
  printerName: string | null
  onConnect: () => void
  connectStatus: { success: boolean; message: string } | null
  onTestPrint: () => void
  testPrinting: boolean
  awaitingPrintConfirm: boolean
  onConfirmTestPrint: (badgePrinted: boolean) => void
  testPrintStatus: { success: boolean; message: string } | null
  onContinue: () => void
  isOnline: boolean
  contactPhone?: string | null
  printerType: "usb" | "browser"
  onSwitchList?: () => void
}

// Gates the scan screen for any checkin_and_print list -- a volunteer
// connects and test-prints here, before a delegate is ever standing in
// front of them. Skippable: the Continue button always works, and the
// success screen's own Connect Printer / Print Badge flow (unchanged) is
// still there as a fallback for anyone who skips this screen.
function PrinterSetupScreen({
  eventName,
  stationName,
  listName,
  checking,
  usbSupported,
  printerConnected,
  printerVerified,
  printerName,
  onConnect,
  connectStatus,
  onTestPrint,
  testPrinting,
  awaitingPrintConfirm,
  onConfirmTestPrint,
  testPrintStatus,
  onContinue,
  isOnline,
  contactPhone,
  printerType,
  onSwitchList,
}: PrinterSetupScreenProps) {
  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="bg-card border-b border-border px-4 sm:px-8 py-4 sm:py-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{eventName || "Event"}</h1>
          {stationName && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-3 py-1 text-xs sm:text-sm font-bold uppercase tracking-wide text-indigo-700 shrink-0">
              <span className="size-1.5 rounded-full bg-indigo-500" />
              {stationName}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <div className="size-20 sm:size-24 mx-auto rounded-3xl bg-indigo-500/15 outline outline-1 -outline-offset-1 outline-indigo-500/30 flex items-center justify-center mb-5 text-indigo-700">
              <Printer className="h-10 w-10 sm:h-12 sm:w-12" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Set up the printer</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              {`${listName} prints a badge on check-in. Connect and test it now — the delegate line can't wait while you find out it's dead.`}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">Status</span>
              {checking ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
                </span>
              ) : printerType === "browser" ? (
                <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${printerVerified ? "text-emerald-700" : "text-muted-foreground"}`}>
                  <span className={`size-1.5 rounded-full ${printerVerified ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                  {printerVerified ? "Verified" : "Not tested yet"}
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                    !printerConnected ? "text-muted-foreground" : printerVerified ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      !printerConnected ? "bg-muted-foreground" : printerVerified ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {!printerConnected
                    ? "Not connected"
                    : printerVerified
                      ? `${printerName || "Printer"} — verified`
                      : "Connected — not tested"}
                </span>
              )}
            </div>

            {printerType !== "browser" && !usbSupported && !checking && (
              <p className="text-xs text-amber-700">
                This browser can&apos;t connect to a printer over USB. Use Chrome or Edge, or skip and print
                elsewhere.
              </p>
            )}

            {(printerType === "browser" || usbSupported) && (
              awaitingPrintConfirm ? (
                <div className="space-y-2">
                  <p className="text-sm text-foreground text-center">Did a badge come out?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-12 bg-transparent border-border text-foreground hover:bg-muted"
                      onClick={() => onConfirmTestPrint(false)}
                    >
                      No
                    </Button>
                    <Button className="h-12" onClick={() => onConfirmTestPrint(true)}>
                      Yes
                    </Button>
                  </div>
                </div>
              ) : printerType === "browser" ? (
                <Button className="w-full h-12" onClick={onTestPrint} disabled={testPrinting}>
                  {testPrinting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Test Print
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-12 bg-transparent border-border text-foreground hover:bg-muted"
                    onClick={onConnect}
                    disabled={checking}
                  >
                    {printerConnected ? "Reconnect" : "Connect Printer"}
                  </Button>
                  <Button className="h-12" onClick={onTestPrint} disabled={!printerConnected || testPrinting}>
                    {testPrinting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Test Print
                  </Button>
                </div>
              )
            )}

            {connectStatus && !connectStatus.success && <p className="text-xs text-red-700">{connectStatus.message}</p>}
            {testPrintStatus && (
              <p className={testPrintStatus.success ? "text-xs text-emerald-700" : "text-xs text-red-700"}>
                {testPrintStatus.message}
              </p>
            )}
          </div>

          <Button size="lg" className="w-full h-14 sm:h-16 mt-6 text-base" onClick={onContinue}>
            {printerVerified ? "Start Scanning" : "Skip — Start Scanning"}
          </Button>

          {contactPhone && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Printer trouble? Call {contactPhone}
            </p>
          )}

          {onSwitchList && (
            <button
              onClick={() => {
                if (confirm(`Leave ${listName} and return to the station menu?`)) {
                  onSwitchList()
                }
              }}
              className="mt-4 w-full px-6 py-3 rounded-xl bg-muted border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Wrong list? <span className="font-normal opacity-80">Tap here to go back to the station menu</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-card border-t border-border px-4 sm:px-8 py-3 text-center">
        <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 text-[11px]">
          <span className={`inline-flex items-center gap-1 ${isOnline ? "text-emerald-700" : "text-amber-700"}`}>
            <span className={`size-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
            {isOnline ? "Online" : "Offline"}
          </span>
          {usbSupported && (
            <span
              className={`inline-flex items-center gap-1 ${
                !printerConnected ? "text-muted-foreground" : printerVerified ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  !printerConnected ? "bg-muted-foreground" : printerVerified ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {!printerConnected ? "Printer not connected" : printerVerified ? "Printer verified" : "Printer connected — not tested"}
            </span>
          )}
          <BatteryStatusBadge />
        </div>
      </div>
    </div>
  )
}

interface DuplicateWarningScreenProps {
  attendeeName: string
  registrationNumber: string
  listName: string
  duplicateCheckedInAt?: string
  duplicateStationName?: string
  countdown: number
  stationName?: string
  pendingSyncCount: number
  isOnline: boolean
}

// Full-screen amber "already collected" warning for a duplicate collection
// scan (Breakfast/Lunch/Dinner/Registration Kit etc.) -- the single
// highest-priority visual piece of the attended-station feature. Structurally
// distinct from both the green success screen and the generic red error
// screen: a hazard-stripe top bar, amber background, near-black text, and a
// STOP-word headline, so a volunteer working fast can tell it apart from
// either other outcome at a glance -- this is a routine, expected, non-error
// event, never a system failure.
function DuplicateWarningScreen({
  attendeeName,
  registrationNumber,
  listName,
  duplicateCheckedInAt,
  duplicateStationName,
  countdown,
  stationName,
  pendingSyncCount,
  isOnline,
}: DuplicateWarningScreenProps) {
  useEffect(() => {
    let ctx: AudioContext | null = null
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      if (ctx.state === "suspended") {
        ctx.resume()
      }
      // Ported from the staff scanner's "warning" tone (src/app/checkin/access/[accessToken]/page.tsx):
      // two identical flat beeps, distinct from both the success chime and the
      // error buzzer, so a volunteer working by ear alone can tell it apart.
      for (const startOffset of [0, 0.18]) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(660, ctx.currentTime + startOffset)
        gain.gain.setValueAtTime(0.3, ctx.currentTime + startOffset)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startOffset + 0.15)
        osc.start(ctx.currentTime + startOffset)
        osc.stop(ctx.currentTime + startOffset + 0.15)
      }
      if (navigator.vibrate) navigator.vibrate([120, 80, 120])
    } catch {
      // Audio can throw in some browsers/contexts (autoplay policy, no audio
      // device, etc.) -- must never crash the kiosk over a warning tone.
    }
    return () => {
      ctx?.close()
    }
  }, [])

  const firstName = attendeeName.split(" ")[0] || attendeeName

  return (
    <div className="fixed inset-0 flex flex-col bg-warning text-warning-foreground">
      {/* Hazard-stripe bar -- no Tailwind utility for a repeating diagonal
          gradient, so this is the one deliberate inline-style exception in
          this file. */}
      <div
        className="flex-none h-[22px]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, #111827 0 22px, transparent 22px 44px)",
        }}
      />

      <div className="flex-1 flex flex-col gap-5 px-8 sm:px-14 py-8 min-h-0">
        <div className="flex items-center gap-5 sm:gap-6">
          <AlertTriangle className="h-16 w-16 sm:h-20 sm:w-20 flex-none" strokeWidth={2.3} />
          <div className="flex flex-col gap-0.5 min-w-0">
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-none">
              ALREADY HAD {listName.toUpperCase()}
            </h1>
            <p className="text-xl sm:text-2xl font-semibold">Do not give this again.</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row gap-6 min-h-0">
          <div className="flex-[1.15] flex flex-col justify-center gap-3 min-w-0">
            <p className="text-sm sm:text-base font-bold uppercase tracking-widest opacity-70">
              Same delegate
            </p>
            <p className="text-5xl sm:text-7xl font-bold leading-none text-balance break-words">
              {attendeeName || firstName}
            </p>
            <p className="text-xl sm:text-2xl font-medium opacity-80">
              Delegate · {registrationNumber}
            </p>
          </div>

          <div className="flex-1 bg-white text-slate-900 rounded-2xl sm:rounded-3xl shadow-paper-lg p-6 sm:p-8 flex flex-col justify-center gap-4">
            <p className="text-sm sm:text-base font-bold uppercase tracking-widest text-slate-500">
              Already given
            </p>
            <div className="flex flex-col gap-3.5">
              <div className="flex items-baseline gap-3.5">
                <span className="text-base sm:text-lg w-20 sm:w-24 flex-none text-slate-500">When</span>
                <span className="text-2xl sm:text-3xl font-bold">
                  {duplicateCheckedInAt
                    ? new Date(duplicateCheckedInAt).toLocaleString([], { hour: "numeric", minute: "2-digit" })
                    : "earlier today"}
                </span>
              </div>
              <div className="flex items-baseline gap-3.5">
                <span className="text-base sm:text-lg w-20 sm:w-24 flex-none text-slate-500">Where</span>
                <span className="text-2xl sm:text-3xl font-bold">
                  {duplicateStationName || "another station"}
                </span>
              </div>
            </div>
            <p className="text-base sm:text-lg text-slate-500 border-t border-slate-200 pt-4">
              {duplicateCheckedInAt && `${formatRelativeTime(duplicateCheckedInAt)}. `}
              If they say this is wrong, send them to the help desk — don&apos;t decide here.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-6">
          <div className="flex flex-col gap-2.5 flex-1">
            <p className="text-lg sm:text-xl font-bold">
              Back to scanning in {countdown}s
            </p>
            <div className="h-2.5 rounded-full bg-black/20 overflow-hidden">
              <div
                className="h-full bg-black/80 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${(countdown / 10) * 100}%` }}
              />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-semibold opacity-80 shrink-0">
            Nothing was recorded for this scan
          </p>
        </div>
      </div>

      <div className="flex-none h-24 sm:h-[104px] bg-sidebar text-sidebar-foreground flex items-center gap-6 sm:gap-8 px-6 sm:px-10">
        <div className="flex flex-col gap-0.5 w-[180px] sm:w-[220px] shrink-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-sidebar-muted">Station</p>
          <p className="text-lg sm:text-xl font-semibold truncate">{stationName || "—"}</p>
        </div>
        <div className="flex-1 flex items-center gap-3 px-4 sm:px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-widest text-sidebar-muted shrink-0">List</span>
          <span className="text-xl sm:text-2xl font-bold truncate">{listName}</span>
        </div>
        <div className="flex flex-col gap-0.5 text-right shrink-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-sidebar-muted">Waiting to send</p>
          <p className="text-lg sm:text-xl font-semibold">
            {pendingSyncCount} scan{pendingSyncCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-full shrink-0 ${isOnline ? "bg-emerald-500/20" : "bg-amber-500/20"}`}>
          <span className={`size-3 rounded-full ${isOnline ? "bg-emerald-400" : "bg-amber-400"}`} />
          <span className="text-base sm:text-lg font-semibold">{isOnline ? "Online" : "Offline"}</span>
        </div>
      </div>
    </div>
  )
}

// Shared dark sidebar-style footer (Station / List / Waiting to send /
// Online-Offline) -- byte-identical to DuplicateWarningScreen's footer
// above, factored out so the two new collection-list screens below don't
// each hand-duplicate it a second and third time.
function KioskStationFooter({
  listName,
  stationName,
  pendingSyncCount,
  isOnline,
}: {
  listName: string
  stationName?: string
  pendingSyncCount: number
  isOnline: boolean
}) {
  return (
    <div className="flex-none h-24 sm:h-[104px] bg-sidebar text-sidebar-foreground flex items-center gap-6 sm:gap-8 px-6 sm:px-10">
      <div className="flex flex-col gap-0.5 w-[180px] sm:w-[220px] shrink-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-sidebar-muted">Station</p>
        <p className="text-lg sm:text-xl font-semibold truncate">{stationName || "—"}</p>
      </div>
      <div className="flex-1 flex items-center gap-3 px-4 sm:px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 min-w-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-sidebar-muted shrink-0">List</span>
        <span className="text-xl sm:text-2xl font-bold truncate">{listName}</span>
      </div>
      <div className="flex flex-col gap-0.5 text-right shrink-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-sidebar-muted">Waiting to send</p>
        <p className="text-lg sm:text-xl font-semibold">
          {pendingSyncCount} scan{pendingSyncCount === 1 ? "" : "s"}
        </p>
      </div>
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-full shrink-0 ${isOnline ? "bg-emerald-500/20" : "bg-amber-500/20"}`}>
        <span className={`size-3 rounded-full ${isOnline ? "bg-emerald-400" : "bg-amber-400"}`} />
        <span className="text-base sm:text-lg font-semibold">{isOnline ? "Online" : "Offline"}</span>
      </div>
    </div>
  )
}

interface CollectionReadyScreenProps {
  listName: string
  listClosesAt?: string | null
  lastScanAt: number | null
  stationName?: string
  pendingSyncCount: number
  isOnline: boolean
  onSwitchList?: () => void
  // Camera / manual-entry passthrough -- the exact same state and handlers
  // the self-service scan screen uses, reused verbatim so no capability
  // (camera QR scan included) is removed for collection lists, only restyled.
  scanMode: "camera" | "manual"
  setScanMode: (mode: "camera" | "manual") => void
  cameraActive: boolean
  cameraError: string | null
  cameras: { id: string; label: string }[]
  switchCamera: () => void
  startScanner: () => void
  scannerContainerId: string
  registrationNumber: string
  handleRegChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  handleCheckin: (override?: string) => void
  inputRef: React.RefObject<HTMLInputElement>
  isProcessing: boolean
  cacheReady: boolean
  cacheError: string | null
  // Work order §5 name search -- same cached-roster ref the parent already
  // reads for the primary scan/manual path, threaded down so this screen
  // can search it too without a second fetch/cache.
  delegatesRef: { current: CachedDelegate[] }
}

// Redesigned "ready to scan" idle screen for a genuinely attended station
// serving a collection-purpose list (Breakfast/Lunch/Kit Collection etc.) --
// matches /tmp/screen_2_ready_to_scan.html. Entry lists, the direct-token
// path, and any checkin_and_print station never reach this component; they
// keep the original self-service scan/entry screen untouched.
function CollectionReadyScreen({
  listName,
  listClosesAt,
  lastScanAt,
  stationName,
  pendingSyncCount,
  isOnline,
  onSwitchList,
  scanMode,
  setScanMode,
  cameraActive,
  cameraError,
  cameras,
  switchCamera,
  startScanner,
  scannerContainerId,
  registrationNumber,
  handleRegChange,
  handleKeyDown,
  handleCheckin,
  inputRef,
  isProcessing,
  cacheReady,
  cacheError,
  delegatesRef,
}: CollectionReadyScreenProps) {
  const lastScanLabel = lastScanAt
    ? `last scan ${Math.max(0, Math.round((Date.now() - lastScanAt) / 1000))} seconds ago`
    : "no scans yet"
  const [nameSearchOpen, setNameSearchOpen] = useState(false)
  const [nameSearchQuery, setNameSearchQuery] = useState("")

  return (
    <div className="fixed inset-0 flex flex-col bg-background" onClick={() => inputRef.current?.focus()}>
      {/* Header */}
      <div className="flex-none bg-primary text-primary-foreground px-6 sm:px-12 py-5 sm:py-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-3 sm:gap-4 min-w-0">
          <span className="text-xs sm:text-sm font-semibold uppercase tracking-widest opacity-80 shrink-0">
            You are scanning for
          </span>
          <span className="text-2xl sm:text-4xl font-bold tracking-tight truncate">{listName}</span>
        </div>
        {listClosesAt && (
          <span className="text-base sm:text-xl font-medium opacity-90 shrink-0">
            Open until {new Date(listClosesAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 sm:gap-6 px-4 sm:px-8 py-6 min-h-0 overflow-y-auto">
        <div className="size-28 sm:size-40 rounded-full bg-primary-10 flex items-center justify-center text-primary">
          <QrCode className="h-12 w-12 sm:h-16 sm:w-16" />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold text-foreground text-center">Scan the badge</h1>
        <p className="text-base sm:text-xl text-muted-foreground text-center max-w-xl">
          Hold the scanner over the barcode. You don&apos;t have to type anything.
        </p>
        <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-card border border-border">
          <span className="size-3 rounded-full bg-success animate-pulse" />
          <span className="text-sm sm:text-base font-medium text-muted-foreground">
            Scanner connected · {lastScanLabel}
          </span>
        </div>

        <div className="w-full max-w-2xl mt-2">
          {/* Scan mode toggle -- same state/handlers as the self-service screen,
              restyled for a light background */}
          <div className="flex bg-muted border border-border rounded-xl p-1 mb-4">
            <button
              onClick={() => setScanMode("camera")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                scanMode === "camera" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Camera className="w-5 h-5" />
              Camera Scan
            </button>
            <button
              onClick={() => setScanMode("manual")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                scanMode === "manual" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Keyboard className="w-5 h-5" />
              Manual / Scanner
            </button>
          </div>

          {scanMode === "camera" ? (
            /* Camera viewport -- identical functionality to the self-service
               screen's camera branch, restyled for a light background */
            <div className="bg-card border border-border rounded-lg p-4 sm:p-5">
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
                        onClick={(e) => {
                          e.stopPropagation()
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
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Point camera at the delegate&apos;s badge QR code
              </p>
              {isProcessing && (
                <div className="mt-3 flex items-center justify-center gap-2 text-success">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-medium">Checking in…</span>
                </div>
              )}
            </div>
          ) : (
            /* Manual / external-scanner input -- identical functionality to
               the self-service screen's manual branch */
            <div className="bg-card border border-border rounded-lg p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
              <div className="relative">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Registration #, name, phone, or email…"
                  value={registrationNumber}
                  onChange={handleRegChange}
                  onKeyDown={handleKeyDown}
                  className="h-14 sm:h-16 text-base sm:text-xl text-center bg-white text-slate-900 border border-border rounded-xl placeholder:text-slate-400 pr-14"
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
              {cacheError && <p className="mt-2 text-center text-xs text-red-500">{cacheError}</p>}
            </div>
          )}

          {/* Name search -- same offline-only roster lookup as the
              self-service screen (work order §5), secondary to the
              scanner/manual entry above. */}
          <div className="mt-4 text-center" onClick={(e) => e.stopPropagation()}>
            {!nameSearchOpen ? (
              <button
                onClick={() => setNameSearchOpen(true)}
                className="text-sm text-indigo-600 underline hover:text-indigo-800"
              >
                Can&apos;t scan? Search by name
              </button>
            ) : (
              <div className="bg-card border border-border rounded-lg p-4 sm:p-5 text-left">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-sm font-semibold text-foreground">Search by name</p>
                  <button
                    onClick={() => {
                      setNameSearchOpen(false)
                      setNameSearchQuery("")
                    }}
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Close
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    autoFocus
                    type="text"
                    value={nameSearchQuery}
                    onChange={(e) => setNameSearchQuery(e.target.value)}
                    placeholder="Name, phone, or registration ID…"
                    autoComplete="off"
                    className="pl-10"
                  />
                </div>
                {nameSearchQuery.trim().length >= 2 && (() => {
                  const results = searchDelegates(delegatesRef.current, nameSearchQuery)
                  return (
                    <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
                      {results.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setNameSearchOpen(false)
                            setNameSearchQuery("")
                            handleCheckin(d.registration_number)
                          }}
                          className="w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left hover:bg-muted transition-colors"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-foreground truncate">{d.attendee_name}</span>
                            <span className="block text-xs text-muted-foreground truncate">
                              {d.registration_number}
                              {d.attendee_institution ? ` · ${d.attendee_institution}` : ""}
                            </span>
                          </span>
                        </button>
                      ))}
                      {results.length === 0 && (
                        <p className="text-sm text-muted-foreground py-2">No match — see the help desk</p>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>

        {onSwitchList && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm(`Leave ${listName} and return to the station menu?`)) {
                onSwitchList()
              }
            }}
            className="mt-2 px-6 py-3 rounded-xl bg-muted border border-border text-sm sm:text-base font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Wrong list? <span className="font-normal opacity-80">Tap here to go back to the station menu</span>
          </button>
        )}
      </div>

      <KioskStationFooter
        listName={listName}
        stationName={stationName}
        pendingSyncCount={pendingSyncCount}
        isOnline={isOnline}
      />
    </div>
  )
}

interface CollectionSuccessScreenProps {
  listName: string
  attendeeName: string
  registrationNumber: string
  attendeeInstitution?: string
  countdown: number
  stationName?: string
  pendingSyncCount: number
  isOnline: boolean
}

// Redesigned success confirmation for a collection-purpose list at a
// genuinely attended station -- matches /tmp/screen_3_success.html. Only
// ever reached when `result.success` is true for a collection-list scan; a
// duplicate scan (success: false) is diverted to DuplicateWarningScreen
// before this component can be reached, so "First time today" is always
// accurate here, not conditionally computed.
function CollectionSuccessScreen({
  listName,
  attendeeName,
  registrationNumber,
  attendeeInstitution,
  countdown,
  stationName,
  pendingSyncCount,
  isOnline,
}: CollectionSuccessScreenProps) {
  return (
    <div className="fixed inset-0 flex flex-col bg-success text-success-foreground">
      <div className="flex-1 flex flex-col px-6 sm:px-14 py-8 sm:py-11 gap-2 min-h-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <CheckCircle2 className="h-14 w-14 sm:h-20 sm:w-20 flex-none" strokeWidth={2.2} />
            <h1 className="text-3xl sm:text-6xl font-bold tracking-wide truncate">
              {listName.toUpperCase()} GIVEN
            </h1>
          </div>
          <span className="px-5 sm:px-6 py-3 sm:py-3.5 rounded-full bg-white/20 text-lg sm:text-2xl font-semibold shrink-0">
            First time today
          </span>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-4 sm:gap-5 min-h-0">
          <p className="text-5xl sm:text-8xl font-bold leading-none tracking-tight text-balance break-words">
            {attendeeName || "Delegate"}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-lg sm:text-3xl font-medium opacity-95">
            <span>Delegate · {registrationNumber}</span>
            {attendeeInstitution && (
              <>
                <span className="opacity-50">·</span>
                <span>{attendeeInstitution}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex flex-col gap-2.5 flex-1 min-w-[220px]">
            <p className="text-lg sm:text-xl font-semibold opacity-90">
              Back to scanning in {countdown} seconds
            </p>
            <div className="h-2.5 rounded-full bg-white/25 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${(countdown / 10) * 100}%` }}
              />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-medium opacity-85 shrink-0">Or just scan the next badge</p>
        </div>
      </div>

      <KioskStationFooter
        listName={listName}
        stationName={stationName}
        pendingSyncCount={pendingSyncCount}
        isOnline={isOnline}
      />
    </div>
  )
}

interface NotOnListScreenProps {
  listName: string
  scannedCode?: string
  countdown: number
  stationName?: string
  pendingSyncCount: number
  isOnline: boolean
}

// Full-screen red "not on this list" result for a scanned badge that
// matches nobody on the active collection list -- matches
// /tmp/screen_5_not_found.html. Only ever reached for a collection-list
// scan (isCollectionListActive); the self-service "Registration not found"
// error keeps its existing generic red error screen untouched. Distinct
// from DuplicateWarningScreen (a matched delegate who already collected) --
// here there's no delegate at all, so there's nothing to hand over and
// nothing to warn about repeating.
function NotOnListScreen({
  listName,
  scannedCode,
  countdown,
  stationName,
  pendingSyncCount,
  isOnline,
}: NotOnListScreenProps) {
  return (
    <div className="fixed inset-0 flex flex-col bg-destructive text-destructive-foreground">
      <div className="flex-1 flex flex-col gap-5 px-8 sm:px-14 py-8 sm:py-11 min-h-0">
        <div className="flex items-center gap-5 sm:gap-6">
          <XCircle className="h-16 w-16 sm:h-20 sm:w-20 flex-none" strokeWidth={2.3} />
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-none text-balance">
            NOT ON THE {listName.toUpperCase()} LIST
          </h1>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-5 sm:gap-6 min-h-0">
          <p className="text-6xl sm:text-8xl font-bold leading-none tracking-tight">Please see staff</p>
          <p className="text-xl sm:text-3xl font-medium opacity-95 max-w-3xl text-balance">
            Walk them to the help desk. Don&apos;t hand anything over, and don&apos;t scan again.
          </p>
          {scannedCode && (
            <div className="flex items-center gap-4 px-6 py-4 rounded-xl bg-white/15 self-start">
              <span className="text-sm sm:text-base font-semibold uppercase tracking-widest opacity-80">
                Badge scanned
              </span>
              <span className="font-mono text-xl sm:text-2xl font-bold">{scannedCode}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex flex-col gap-2.5 flex-1 min-w-[220px]">
            <p className="text-lg sm:text-xl font-semibold opacity-90">
              Back to scanning in {countdown}s
            </p>
            <div className="h-2.5 rounded-full bg-white/25 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${(countdown / 10) * 100}%` }}
              />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-medium opacity-85 shrink-0">
            This may belong to another day or list
          </p>
        </div>
      </div>

      <KioskStationFooter
        listName={listName}
        stationName={stationName}
        pendingSyncCount={pendingSyncCount}
        isOnline={isOnline}
      />
    </div>
  )
}

interface OfflineTransitionScreenProps {
  queueDepth: number
  // Kept for the "Badge printer still working" reassurance line -- in
  // practice this component's only call site (the isCollectionListActive
  // render branch above) already gates on `mode === "checkin"`, so this is
  // always "checkin" today. Left as a real prop (not hardcoded) rather than
  // assuming that will always be true, since it costs nothing here.
  mode: "checkin" | "checkin_and_print"
}

// Brief, transient "just went offline" notice -- shown for a few seconds
// the instant this tablet loses connectivity (see
// showOfflineBanner/handleOffline above), then automatically hidden again
// regardless of whether connectivity has actually returned. Pure
// reassurance, never a blocker.
//
// Deliberately a small, non-fixed BANNER (not a full-screen takeover) --
// its caller renders it as an absolutely-positioned overlay ON TOP of the
// still-mounted, still-live CollectionReadyScreen (camera viewport +
// manual-entry input), rather than replacing it. An earlier version of
// this component was a `fixed inset-0` full-screen replacement, which
// unmounted CollectionReadyScreen for its ~6s duration; neither the camera
// effect nor the manual <Input> ever re-initialized on the subsequent
// remount, so the camera preview never came back until a manual reload,
// while the UI's own "Camera active" indicator kept claiming everything
// was fine. Rendering this as a small overlay instead means
// CollectionReadyScreen never unmounts, so that failure mode can't happen
// -- scanning keeps full capability throughout, exactly as required.
function OfflineTransitionScreen({ queueDepth, mode }: OfflineTransitionScreenProps) {
  return (
    <div className="pointer-events-auto w-full max-w-2xl rounded-2xl bg-info text-info-foreground shadow-lg overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 px-5 sm:px-7 py-3 sm:py-4">
        <WifiOff className="h-6 w-6 sm:h-7 sm:w-7 flex-none" strokeWidth={2.1} />
        <h2 className="text-base sm:text-xl font-bold tracking-tight">No Wi-Fi right now — keep going</h2>
        <span className="ml-auto px-3.5 py-1.5 rounded-full bg-white/20 text-xs sm:text-sm font-semibold shrink-0">
          {queueDepth} scan{queueDepth === 1 ? "" : "s"} saved on this tablet
        </span>
      </div>
      <div className="px-5 sm:px-7 pb-3.5 sm:pb-4">
        <p className="text-xs sm:text-sm leading-snug opacity-95 text-balance">
          <span className="font-bold">Scanning still works.</span> Every scan is saved here and sent up on its own
          when the Wi-Fi returns. A duplicate scanned on THIS tablet is always caught instantly. A duplicate
          collected on another tablet won&apos;t show here until you&apos;re back online.
        </p>
        {mode === "checkin_and_print" && (
          <p className="mt-1.5 text-xs sm:text-sm font-semibold opacity-95">Badge printer still working.</p>
        )}
      </div>
    </div>
  )
}
