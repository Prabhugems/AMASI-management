"use client"

import { useState, useMemo, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CategoryPermissionPicker } from "@/components/team/category-permission-picker"
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  Shield,
  UserCog,
  Plane,
  Zap,
  Send,
  MessageSquare,
  Users,
  Upload,
  ClipboardList,
  Calendar,
  Hotel,
  MapPin,
  Check,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Event = {
  id: string
  name: string
  short_name: string
  start_date: string
  end_date: string | null
  status: string | null
}

type InviteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

type ActiveTab = "single" | "bulk"
type Step = 1 | 2 | 3 | 4
type SendMode = "email" | "email_whatsapp"
type BulkStep = "input" | "preview" | "sending" | "results"

type ParsedRow = {
  name: string
  email: string
  role: string
  preset: string
  valid: boolean
  error?: string
}

type InviteResult = {
  email: string
  status: "sent" | "duplicate" | "exists" | "invalid" | "error"
  reason?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^(\+91[\s-]?)?[6-9]\d{9}$/

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrator", icon: Shield, color: "from-purple-500 to-pink-500", bgLight: "bg-purple-50 border-purple-200", textColor: "text-purple-700" },
  { value: "coordinator", label: "Coordinator", icon: UserCog, color: "from-blue-500 to-indigo-500", bgLight: "bg-blue-50 border-blue-200", textColor: "text-blue-700" },
  { value: "travel", label: "Travel", icon: Plane, color: "from-cyan-500 to-blue-500", bgLight: "bg-cyan-50 border-cyan-200", textColor: "text-cyan-700" },
]

const PRESETS = [
  { value: "administrator", label: "Administrator", icon: Shield, description: "Full system access", role: "admin", permissions: [] as string[], allEvents: true, allPermissions: true, gradient: "from-purple-500 to-pink-500", borderColor: "border-purple-300", bgLight: "bg-purple-50" },
  { value: "event-manager", label: "Event Manager", icon: UserCog, description: "All event modules", role: "coordinator", permissions: ["speakers", "program", "checkin", "badges", "certificates", "registrations", "abstracts"], allEvents: false, allPermissions: false, gradient: "from-blue-500 to-indigo-500", borderColor: "border-blue-300", bgLight: "bg-blue-50" },
  { value: "registration-manager", label: "Registration Mgr", icon: ClipboardList, description: "Registrations only", role: "coordinator", permissions: ["registrations"], allEvents: false, allPermissions: false, gradient: "from-teal-500 to-emerald-500", borderColor: "border-teal-300", bgLight: "bg-teal-50" },
  { value: "program-coordinator", label: "Program Coord.", icon: Calendar, description: "Speakers & program", role: "coordinator", permissions: ["speakers", "program"], allEvents: false, allPermissions: false, gradient: "from-indigo-500 to-violet-500", borderColor: "border-indigo-300", bgLight: "bg-indigo-50" },
  { value: "checkin-staff", label: "Check-in Staff", icon: CheckCircle, description: "Check-in & badges", role: "coordinator", permissions: ["checkin", "badges"], allEvents: false, allPermissions: false, gradient: "from-green-500 to-emerald-500", borderColor: "border-green-300", bgLight: "bg-green-50" },
  { value: "travel-manager", label: "Travel Manager", icon: MapPin, description: "All travel modules", role: "travel", permissions: ["flights", "hotels", "transfers", "trains"], allEvents: false, allPermissions: false, gradient: "from-cyan-500 to-blue-500", borderColor: "border-cyan-300", bgLight: "bg-cyan-50" },
  { value: "hotel-coordinator", label: "Hotel Coord.", icon: Hotel, description: "Hotels only", role: "travel", permissions: ["hotels"], allEvents: false, allPermissions: false, gradient: "from-amber-500 to-orange-500", borderColor: "border-amber-300", bgLight: "bg-amber-50" },
  { value: "flight-coordinator", label: "Flight Coord.", icon: Plane, description: "Flights only", role: "travel", permissions: ["flights"], allEvents: false, allPermissions: false, gradient: "from-sky-500 to-blue-500", borderColor: "border-sky-300", bgLight: "bg-sky-50" },
]

const VALID_ROLES = ["admin", "coordinator", "travel"]

const PERMISSION_LABELS: Record<string, string> = {
  flights: "Flights", hotels: "Hotels", transfers: "Transfers", trains: "Trains",
  speakers: "Speakers", program: "Program", checkin: "Check-in", badges: "Badges",
  certificates: "Certificates", registrations: "Registrations", abstracts: "Abstracts",
  forms: "Forms", surveys: "Surveys", leads: "Leads", addons: "Add-ons",
  waitlist: "Waitlist", delegate_portal: "Delegate Portal", print_station: "Print Station",
  sponsors: "Sponsors", budget: "Budget", visa_letters: "Visa Letters", meals: "Meals",
  examination: "Examination",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InviteDialog({ open, onOpenChange, onComplete }: InviteDialogProps) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  // -- Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>("single")

  // -- Single invite state
  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState("coordinator")
  const [permissions, setPermissions] = useState<string[]>([])
  const [allAccess, setAllAccess] = useState(false)
  const [eventIds, setEventIds] = useState<string[]>([])
  const [allEvents, setAllEvents] = useState(true)
  const [express, setExpress] = useState(false)
  const [sendMode, setSendMode] = useState<SendMode>("email")
  const [sending, setSending] = useState(false)

  // -- Bulk invite state
  const [bulkStep, setBulkStep] = useState<BulkStep>("input")
  const [csvText, setCsvText] = useState("")
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [bulkResults, setBulkResults] = useState<InviteResult[]>([])

  // -- Events query
  const { data: events } = useQuery({
    queryKey: ["events-list"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("events").select("id, name, short_name, start_date, end_date, status").order("start_date", { ascending: false })
      return (data || []) as Event[]
    },
  })

  const categorizedEvents = useMemo(() => {
    const now = new Date()
    const live: Event[] = []
    const completed: Event[] = []
    for (const event of events || []) {
      const endDate = event.end_date ? new Date(event.end_date) : null
      const isCompleted = event.status === "completed" || event.status === "cancelled" || (endDate && endDate < now)
      if (isCompleted) completed.push(event); else live.push(event)
    }
    return { live, completed }
  }, [events])

  // -- Reset
  const resetSingle = () => {
    setStep(1); setName(""); setEmail(""); setPhone(""); setRole("coordinator")
    setPermissions([]); setAllAccess(false); setEventIds([]); setAllEvents(true)
    setExpress(false); setSendMode("email"); setSending(false)
  }

  const resetBulk = () => {
    setBulkStep("input"); setCsvText(""); setParsedRows([]); setBulkResults([])
  }

  const handleClose = () => {
    resetSingle(); resetBulk(); setActiveTab("single"); onOpenChange(false)
  }

  // -- Preset apply
  const applyPreset = (presetValue: string) => {
    const preset = PRESETS.find(p => p.value === presetValue)
    if (!preset) return
    setRole(preset.role)
    setPermissions(preset.allPermissions ? [] : preset.permissions)
    setAllAccess(preset.allPermissions)
    setAllEvents(preset.allEvents)
  }

  // -- Detected preset
  const detectedPreset = useMemo(() => {
    const currentPerms = [...(allAccess ? [] : permissions)].sort()
    for (const preset of PRESETS) {
      if (preset.role !== role) continue
      if (preset.allPermissions !== allAccess) continue
      if (preset.allEvents !== allEvents) continue
      if (!preset.allPermissions) {
        const presetPerms = [...preset.permissions].sort()
        if (presetPerms.length !== currentPerms.length) continue
        if (presetPerms.some((p, i) => p !== currentPerms[i])) continue
      }
      return preset.value
    }
    return null
  }, [role, permissions, allAccess, allEvents])

  // -- Validation
  const step1Valid = useMemo(() => {
    const emailOk = EMAIL_REGEX.test(email.trim())
    const nameOk = name.trim().length > 0
    const phoneOk = !phone.trim() || PHONE_REGEX.test(phone.trim().replace(/\s/g, ""))
    return emailOk && nameOk && phoneOk
  }, [email, name, phone])

  const phoneError = useMemo(() => {
    if (!phone.trim()) return null
    return PHONE_REGEX.test(phone.trim().replace(/\s/g, "")) ? null : "Invalid phone format (+91 XXXXXXXXXX)"
  }, [phone])

  // -- Single submit
  const handleSubmit = async () => {
    setSending(true)
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim(),
          role,
          permissions: allAccess ? [] : permissions,
          event_ids: allEvents ? [] : eventIds,
          phone: phone.trim() || null,
          express,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to send invitation")
      }

      const data = await res.json()

      // WhatsApp send (fire-and-forget, already handled server-side if phone present)
      const whatsappSent = data?.whatsapp_sent
      toast.success(
        whatsappSent
          ? `Invitation sent to ${email} via email + WhatsApp`
          : `Invitation sent to ${email}`
      )

      onComplete()
      handleClose()
    } catch (error: any) {
      toast.error(error.message || "Failed to send invitation")
    } finally {
      setSending(false)
    }
  }

  // -- Bulk CSV parse
  const parseCsv = () => {
    const lines = csvText.trim().split("\n").filter(l => l.trim())
    if (lines.length === 0) { toast.error("No data to parse"); return }

    // Detect separator
    const sep = lines[0].includes("\t") ? "\t" : ","

    // Skip header row if detected
    const firstLine = lines[0].toLowerCase()
    const hasHeader = firstLine.includes("name") || firstLine.includes("email")
    const dataLines = hasHeader ? lines.slice(1) : lines

    const seen = new Set<string>()
    const rows: ParsedRow[] = dataLines.map(line => {
      const parts = line.split(sep).map(s => s.trim().replace(/^["']|["']$/g, ""))
      const [rowName, rowEmail, rowRole, rowPreset] = parts

      if (!rowName || !rowEmail) return { name: rowName || "", email: rowEmail || "", role: rowRole || "coordinator", preset: rowPreset || "", valid: false, error: "Name and email required" }
      if (!EMAIL_REGEX.test(rowEmail)) return { name: rowName, email: rowEmail, role: rowRole || "coordinator", preset: rowPreset || "", valid: false, error: "Invalid email" }
      if (seen.has(rowEmail.toLowerCase())) return { name: rowName, email: rowEmail, role: rowRole || "coordinator", preset: rowPreset || "", valid: false, error: "Duplicate in list" }
      seen.add(rowEmail.toLowerCase())

      const finalRole = VALID_ROLES.includes(rowRole?.toLowerCase()) ? rowRole.toLowerCase() : "coordinator"

      return { name: rowName, email: rowEmail, role: finalRole, preset: rowPreset || "", valid: true }
    })

    setParsedRows(rows)
    setBulkStep("preview")
  }

  // -- Bulk submit
  const handleBulkSubmit = async () => {
    const validRows = parsedRows.filter(r => r.valid)
    if (validRows.length === 0) { toast.error("No valid rows to send"); return }

    setBulkStep("sending")
    try {
      const res = await fetch("/api/team/invite/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invites: validRows.map(r => {
            const preset = PRESETS.find(p => p.value === r.preset?.toLowerCase().replace(/\s/g, "-"))
            return {
              email: r.email.toLowerCase(),
              name: r.name,
              role: r.role,
              permissions: preset ? (preset.allPermissions ? [] : preset.permissions) : [],
              event_ids: [],
            }
          }),
        }),
      })

      if (!res.ok) throw new Error("Bulk invite failed")
      const data = await res.json()
      setBulkResults(data.results || [])
      setBulkStep("results")

      const sentCount = (data.results || []).filter((r: InviteResult) => r.status === "sent").length
      if (sentCount > 0) {
        toast.success(`${sentCount} invitation(s) sent successfully`)
        onComplete()
      }
    } catch {
      toast.error("Bulk invite failed")
      setBulkStep("preview")
    }
  }

  // -- Role info
  const getRoleInfo = (r: string) => ROLE_OPTIONS.find(o => o.value === r) || ROLE_OPTIONS[1]

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v) }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#185FA5] to-[#185FA5]/70 flex items-center justify-center">
              <Send className="h-5 w-5 text-white" />
            </div>
            Invite Team Member
          </DialogTitle>
          <DialogDescription>Send an invitation to join the AMASI management portal</DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="px-6 pt-4">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => { setActiveTab("single"); resetBulk() }}
              className={cn("flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === "single" ? "bg-white dark:bg-slate-700 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Mail className="h-4 w-4" />
              Single Invite
            </button>
            <button
              onClick={() => { setActiveTab("bulk"); resetSingle() }}
              className={cn("flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === "bulk" ? "bg-white dark:bg-slate-700 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Users className="h-4 w-4" />
              Bulk Invite
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === "single" ? (
            <SingleInviteFlow
              step={step}
              name={name} setName={setName}
              email={email} setEmail={setEmail}
              phone={phone} setPhone={setPhone}
              phoneError={phoneError}
              role={role} setRole={setRole}
              permissions={permissions} setPermissions={setPermissions}
              allAccess={allAccess} setAllAccess={setAllAccess}
              eventIds={eventIds} setEventIds={setEventIds}
              allEvents={allEvents} setAllEvents={setAllEvents}
              express={express} setExpress={setExpress}
              sendMode={sendMode} setSendMode={setSendMode}
              detectedPreset={detectedPreset}
              applyPreset={applyPreset}
              events={events || []}
              categorizedEvents={categorizedEvents}
              getRoleInfo={getRoleInfo}
            />
          ) : (
            <BulkInviteFlow
              bulkStep={bulkStep}
              csvText={csvText} setCsvText={setCsvText}
              parsedRows={parsedRows}
              bulkResults={bulkResults}
              onParse={parseCsv}
              onBack={() => setBulkStep("input")}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          {activeTab === "single" ? (
            <>
              <div className="flex items-center gap-2">
                {/* Step indicators */}
                {[1, 2, 3, 4].map((s) => (
                  <button
                    key={s}
                    onClick={() => { if (s === 1 || (s === 2 && step >= 1) || (s === 3 && step >= 2) || (s === 4 && step >= 3 && step1Valid)) setStep(s as Step) }}
                    className={cn(
                      "w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all",
                      step === s ? "bg-[#185FA5] text-white" :
                      step > s ? "bg-[#185FA5]/20 text-[#185FA5]" :
                      "bg-slate-200 dark:bg-slate-700 text-muted-foreground"
                    )}
                  >
                    {step > s ? <Check className="h-3.5 w-3.5" /> : s}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground ml-2">
                  Step {step} of 4
                </span>
              </div>
              <div className="flex items-center gap-2">
                {step > 1 && (
                  <Button variant="outline" size="sm" onClick={() => setStep((step - 1) as Step)}>
                    <ChevronLeft className="h-4 w-4 mr-1" />Back
                  </Button>
                )}
                {step < 4 ? (
                  <Button
                    size="sm"
                    className="bg-[#185FA5] hover:bg-[#14508c] text-white"
                    onClick={() => setStep((step + 1) as Step)}
                    disabled={step === 1 && !step1Valid}
                  >
                    Next<ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="bg-[#185FA5] hover:bg-[#14508c] text-white"
                    onClick={handleSubmit}
                    disabled={!step1Valid || sending}
                  >
                    {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Send Invite
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground">
                {bulkStep === "preview" ? `${parsedRows.filter(r => r.valid).length} valid / ${parsedRows.length} total` : ""}
              </span>
              <div className="flex items-center gap-2">
                {bulkStep === "input" && (
                  <Button size="sm" className="bg-[#185FA5] hover:bg-[#14508c] text-white" onClick={parseCsv} disabled={!csvText.trim()}>
                    <Upload className="h-4 w-4 mr-2" />Parse CSV
                  </Button>
                )}
                {bulkStep === "preview" && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setBulkStep("input")}>
                      <ChevronLeft className="h-4 w-4 mr-1" />Edit
                    </Button>
                    <Button size="sm" className="bg-[#185FA5] hover:bg-[#14508c] text-white" onClick={handleBulkSubmit} disabled={parsedRows.filter(r => r.valid).length === 0}>
                      <Send className="h-4 w-4 mr-2" />Send {parsedRows.filter(r => r.valid).length} Invites
                    </Button>
                  </>
                )}
                {bulkStep === "results" && (
                  <Button size="sm" variant="outline" onClick={handleClose}>Done</Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// Single Invite Flow — 4 Steps
// =============================================================================

function SingleInviteFlow({
  step, name, setName, email, setEmail, phone, setPhone, phoneError,
  role, setRole, permissions, setPermissions, allAccess, setAllAccess,
  eventIds, setEventIds, allEvents, setAllEvents,
  express, setExpress, sendMode, setSendMode,
  detectedPreset, applyPreset,
  events, categorizedEvents, getRoleInfo,
}: {
  step: Step
  name: string; setName: (v: string) => void
  email: string; setEmail: (v: string) => void
  phone: string; setPhone: (v: string) => void
  phoneError: string | null
  role: string; setRole: (v: string) => void
  permissions: string[]; setPermissions: (v: string[]) => void
  allAccess: boolean; setAllAccess: (v: boolean) => void
  eventIds: string[]; setEventIds: (v: string[]) => void
  allEvents: boolean; setAllEvents: (v: boolean) => void
  express: boolean; setExpress: (v: boolean) => void
  sendMode: SendMode; setSendMode: (v: SendMode) => void
  detectedPreset: string | null
  applyPreset: (v: string) => void
  events: Event[]
  categorizedEvents: { live: Event[]; completed: Event[] }
  getRoleInfo: (r: string) => typeof ROLE_OPTIONS[0]
}) {
  return (
    <div className="space-y-5">
      {/* ============ STEP 1: BASIC INFO ============ */}
      {step === 1 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Information</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Full Name <span className="text-red-500">*</span></Label>
              <Input placeholder="Dr. John Doe" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
              {phoneError && <p className="text-xs text-red-500">{phoneError}</p>}
              {!phoneError && phone.trim() && <p className="text-xs text-green-600">WhatsApp invite will also be sent</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Email Address <span className="text-red-500">*</span></Label>
            <Input type="email" placeholder="john@hospital.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            {email.trim() && !EMAIL_REGEX.test(email.trim()) && <p className="text-xs text-red-500">Invalid email format</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Role</Label>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((r) => {
                const Icon = r.icon
                return (
                  <button
                    key={r.value}
                    onClick={() => setRole(r.value)}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center",
                      role === r.value
                        ? "border-[#185FA5] bg-[#185FA5]/5"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white", r.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium">{r.label}</span>
                    {role === r.value && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#185FA5] flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Express toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" />
              <div>
                <span className="text-sm font-medium text-amber-900 dark:text-amber-200">Express invite (24h)</span>
                <p className="text-xs text-amber-600 dark:text-amber-400">On-site team — urgent email</p>
              </div>
            </div>
            <Switch checked={express} onCheckedChange={setExpress} />
          </div>
        </div>
      )}

      {/* ============ STEP 2: PERMISSIONS ============ */}
      {step === 2 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Permissions</h3>

          {/* Preset quick-apply */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Quick presets:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {PRESETS.filter(p => p.role === role || p.value === "administrator").map((preset) => {
                const Icon = preset.icon
                const isActive = detectedPreset === preset.value
                return (
                  <button
                    key={preset.value}
                    onClick={() => applyPreset(preset.value)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all text-left",
                      isActive
                        ? `${preset.bgLight} ${preset.borderColor} border-2`
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate">{preset.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{preset.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <CategoryPermissionPicker
            selectedPermissions={permissions}
            onChange={setPermissions}
            allAccess={allAccess}
            onAllAccessChange={setAllAccess}
          />
        </div>
      )}

      {/* ============ STEP 3: EVENT ACCESS ============ */}
      {step === 3 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Event Access</h3>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="text-sm font-medium">All Events</p>
              <p className="text-xs text-muted-foreground">Access to all current and future events</p>
            </div>
            <Switch checked={allEvents} onCheckedChange={setAllEvents} />
          </div>

          {!allEvents && (
            <div className="space-y-1 max-h-60 overflow-y-auto rounded-lg border p-2">
              {categorizedEvents.live.length > 0 && (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 pt-1">Live Events</p>
                  {categorizedEvents.live.map((event) => (
                    <label key={event.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={eventIds.includes(event.id)}
                        onChange={(e) => {
                          if (e.target.checked) setEventIds([...eventIds, event.id])
                          else setEventIds(eventIds.filter(id => id !== event.id))
                        }}
                        className="rounded border-slate-300"
                      />
                      <div className="min-w-0">
                        <p className="text-sm truncate">{event.short_name || event.name}</p>
                        <p className="text-[10px] text-muted-foreground">{event.start_date ? new Date(event.start_date).toLocaleDateString() : ""}</p>
                      </div>
                    </label>
                  ))}
                </>
              )}
              {categorizedEvents.completed.length > 0 && (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 pt-2">Past Events</p>
                  {categorizedEvents.completed.slice(0, 5).map((event) => (
                    <label key={event.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={eventIds.includes(event.id)}
                        onChange={(e) => {
                          if (e.target.checked) setEventIds([...eventIds, event.id])
                          else setEventIds(eventIds.filter(id => id !== event.id))
                        }}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm truncate">{event.short_name || event.name}</span>
                    </label>
                  ))}
                </>
              )}
              {events.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No events found</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ STEP 4: REVIEW & SEND ============ */}
      {step === 4 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Review & Send</h3>

          {/* Summary card */}
          <div className="rounded-xl border bg-white dark:bg-slate-800 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm", getRoleInfo(role).color)}>
                  {name.trim() ? name.trim().split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
                </div>
                <div>
                  <p className="font-semibold">{name.trim() || "—"}</p>
                  <p className="text-sm text-muted-foreground">{email.trim()}</p>
                </div>
                {express && (
                  <Badge className="ml-auto bg-amber-100 text-amber-700 border-amber-200">
                    <Zap className="h-3 w-3 mr-1" />Express
                  </Badge>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Role</span>
                <Badge variant="outline" className={cn("text-xs", getRoleInfo(role).bgLight, getRoleInfo(role).textColor)}>
                  {getRoleInfo(role).label}
                </Badge>
              </div>

              {phone.trim() && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{phone.trim()}</span>
                </div>
              )}

              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Permissions</span>
                <div className="text-right">
                  {allAccess ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200">Full Access</Badge>
                  ) : permissions.length === 0 ? (
                    <span className="text-xs text-muted-foreground">None selected</span>
                  ) : (
                    <div className="flex flex-wrap gap-1 justify-end max-w-[250px]">
                      {permissions.slice(0, 5).map(p => (
                        <Badge key={p} variant="outline" className="text-[10px]">{PERMISSION_LABELS[p] || p}</Badge>
                      ))}
                      {permissions.length > 5 && <Badge variant="outline" className="text-[10px]">+{permissions.length - 5} more</Badge>}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Event Access</span>
                <span className="text-xs">
                  {allEvents ? "All Events" : `${eventIds.length} event${eventIds.length !== 1 ? "s" : ""}`}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Expiry</span>
                <span className="text-xs">{express ? "24 hours" : "7 days"}</span>
              </div>
            </div>
          </div>

          {/* Send mode toggle */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Send via:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSendMode("email")}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm transition-all",
                  sendMode === "email" ? "border-[#185FA5] bg-[#185FA5]/5" : "border-slate-200 dark:border-slate-700"
                )}
              >
                <Mail className="h-4 w-4" />
                Email only
              </button>
              <button
                onClick={() => phone.trim() ? setSendMode("email_whatsapp") : toast.error("Add phone number first")}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm transition-all",
                  sendMode === "email_whatsapp" ? "border-[#185FA5] bg-[#185FA5]/5" : "border-slate-200 dark:border-slate-700",
                  !phone.trim() && "opacity-50 cursor-not-allowed"
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Email + WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Bulk Invite Flow
// =============================================================================

function BulkInviteFlow({
  bulkStep, csvText, setCsvText, parsedRows, bulkResults, onParse, onBack,
}: {
  bulkStep: BulkStep
  csvText: string; setCsvText: (v: string) => void
  parsedRows: ParsedRow[]
  bulkResults: InviteResult[]
  onParse: () => void
  onBack: () => void
}) {
  if (bulkStep === "input") {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Paste CSV Data</h3>
        <p className="text-xs text-muted-foreground">
          Columns: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">Name, Email, Role, Preset</code> (header row optional)
        </p>
        <Textarea
          placeholder={`John Doe, john@hospital.com, coordinator, registration-manager\nJane Smith, jane@hospital.com, travel, travel-manager`}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          className="min-h-[200px] font-mono text-sm"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Valid roles: admin, coordinator, travel. Valid presets: {PRESETS.map(p => p.value).join(", ")}
        </p>
      </div>
    )
  }

  if (bulkStep === "preview") {
    const validCount = parsedRows.filter(r => r.valid).length
    const invalidCount = parsedRows.length - validCount
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Preview</h3>
          <Badge className="bg-green-100 text-green-700">{validCount} valid</Badge>
          {invalidCount > 0 && <Badge className="bg-red-100 text-red-700">{invalidCount} invalid</Badge>}
        </div>
        <div className="border rounded-lg overflow-hidden max-h-[350px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsedRows.map((row, i) => (
                <TableRow key={i} className={cn(!row.valid && "bg-red-50 dark:bg-red-950/20")}>
                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="text-sm">{row.name}</TableCell>
                  <TableCell className="text-sm font-mono">{row.email}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{row.role}</Badge></TableCell>
                  <TableCell>
                    {row.valid ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-red-600"><XCircle className="h-3 w-3" />{row.error}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  if (bulkStep === "sending") {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-200">
        <Loader2 className="h-10 w-10 animate-spin text-[#185FA5] mb-4" />
        <p className="text-sm font-medium">Sending invitations...</p>
        <p className="text-xs text-muted-foreground mt-1">Processing {parsedRows.filter(r => r.valid).length} invites</p>
      </div>
    )
  }

  if (bulkStep === "results") {
    const sent = bulkResults.filter(r => r.status === "sent").length
    const failed = bulkResults.length - sent
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Results</h3>
          <Badge className="bg-green-100 text-green-700">{sent} sent</Badge>
          {failed > 0 && <Badge className="bg-red-100 text-red-700">{failed} failed</Badge>}
        </div>
        <div className="border rounded-lg overflow-hidden max-h-[350px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bulkResults.map((result, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-sm">{result.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs",
                      result.status === "sent" ? "bg-green-50 text-green-700 border-green-200" :
                      result.status === "duplicate" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      result.status === "exists" ? "bg-blue-50 text-blue-700 border-blue-200" :
                      "bg-red-50 text-red-700 border-red-200"
                    )}>
                      {result.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{result.reason || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return null
}
