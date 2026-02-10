"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Building2,
  Calendar,
  Clock,
  CheckCircle,
  PlayCircle,
  RefreshCw,
  Phone,
  UserCheck,
  UserX,
  Mic,
  Monitor,
  Coffee,
  AlertTriangle,
  CircleDot,
  XCircle,
  Timer,
  Users,
  ChevronRight,
  Send,
  MessageCircle,
  Radio,
  List,
  PhoneCall,
  Volume2,
  Lightbulb,
  ThermometerSun,
  SkipForward,
  CheckCheck,
  Headphones,
  Wrench,
  Zap,
  Target,
  Shield,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Session = {
  id: string
  session_name: string
  description?: string
  session_type: string
  session_date?: string
  start_time?: string
  end_time?: string
  hall?: string
  specialty_track?: string
  coordinator_status?: string
  coordinator_notes?: string
  coordinator_checklist?: Record<string, boolean>
  audience_count?: number
  speakers?: string
  speakers_text?: string  // With contact details: "Name (email, phone) | Name2 (email, phone)"
  moderators?: string
  moderators_text?: string
  chairpersons?: string
  chairpersons_text?: string
  faculty_name?: string
  faculty_email?: string
  faculty_phone?: string
}

type Issue = {
  id: string
  type: string
  description: string
  priority: "low" | "medium" | "high" | "critical"
  status: "reported" | "acknowledged" | "in_progress" | "resolved"
  session_id?: string
  created_at: string
}

type CoordinatorInfo = {
  id: string
  event_id: string
  hall_name: string
  coordinator_name: string
  coordinator_email: string
  coordinator_phone?: string
  portal_token: string
  event?: {
    id: string
    name: string
    short_name?: string
    start_date: string
    end_date: string
    venue_name?: string
    city?: string
    logo_url?: string
  }
}

const SESSION_STATUS = [
  { value: "scheduled", label: "Scheduled", color: "from-slate-500 to-slate-600", icon: Clock },
  { value: "speaker_arrived", label: "Speaker Ready", color: "from-blue-500 to-blue-600", icon: UserCheck },
  { value: "in_progress", label: "LIVE", color: "from-green-500 to-emerald-600", icon: PlayCircle },
  { value: "completed", label: "Completed", color: "from-emerald-500 to-teal-600", icon: CheckCircle },
  { value: "delayed", label: "Delayed", color: "from-amber-500 to-orange-600", icon: Timer },
  { value: "speaker_absent", label: "No Speaker", color: "from-red-500 to-rose-600", icon: UserX },
  { value: "cancelled", label: "Cancelled", color: "from-red-600 to-red-700", icon: XCircle },
]

const CHECKLIST_ITEMS = [
  { key: "speaker_arrived", label: "Speaker", icon: UserCheck, color: "blue" },
  { key: "av_ready", label: "AV Ready", icon: Monitor, color: "purple" },
  { key: "mic_checked", label: "Mic Test", icon: Mic, color: "pink" },
  { key: "presentation_loaded", label: "PPT Load", icon: Monitor, color: "orange" },
  { key: "water_arranged", label: "Water", icon: Coffee, color: "cyan" },
]

const ISSUE_TYPES = [
  { value: "av_failure", label: "AV/Projector Down", icon: Monitor, priority: "critical" as const, team: "Technical", color: "red" },
  { value: "mic_issue", label: "Mic Not Working", icon: Mic, priority: "high" as const, team: "Technical", color: "orange" },
  { value: "speaker_missing", label: "Speaker Not Here", icon: UserX, priority: "critical" as const, team: "Program", color: "red" },
  { value: "speaker_late", label: "Speaker Late", icon: Timer, priority: "medium" as const, team: "Program", color: "yellow" },
  { value: "overcrowding", label: "Overcrowded", icon: Users, priority: "high" as const, team: "Security", color: "orange" },
  { value: "ac_issue", label: "AC Problem", icon: ThermometerSun, priority: "medium" as const, team: "Facilities", color: "yellow" },
  { value: "lighting", label: "Lighting", icon: Lightbulb, priority: "low" as const, team: "Facilities", color: "blue" },
  { value: "sound_issue", label: "Sound Issue", icon: Volume2, priority: "high" as const, team: "Technical", color: "orange" },
  { value: "emergency", label: "Emergency", icon: AlertTriangle, priority: "critical" as const, team: "Security", color: "red" },
  { value: "other", label: "Other", icon: Wrench, priority: "medium" as const, team: "Control", color: "gray" },
]

const CONTROL_CONTACTS = [
  { name: "Control Room", phone: "+919876543210", role: "Main Hub", icon: Headphones },
  { name: "Tech Support", phone: "+919876543211", role: "AV/IT", icon: Wrench },
  { name: "Program Head", phone: "+919876543212", role: "Schedule", icon: Calendar },
]

export default function HallControlDashboard() {
  const params = useParams()
  const token = params.token as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<"control" | "schedule" | "contacts" | "issues">("control")
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isOnline, setIsOnline] = useState(true)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false)
  const [issueDialogOpen, setIssueDialogOpen] = useState(false)
  const [selectedIssueType, setSelectedIssueType] = useState<string | null>(null)
  const [issueDescription, setIssueDescription] = useState("")
  const [_audienceDialogOpen, _setAudienceDialogOpen] = useState(false)
  const [_audienceCount, _setAudienceCount] = useState("")
  const [localIssues, setLocalIssues] = useState<Issue[]>([])

  // Real-time clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Online status
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Fetch coordinator
  const { data: coordinator, isLoading, error } = useQuery({
    queryKey: ["hall-coordinator", token],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("hall_coordinators")
        .select(`*, event:events(*)`)
        .eq("portal_token", token)
        .single()
      if (error) throw error
      return data as CoordinatorInfo
    },
  })

  // Fetch sessions
  const { data: sessions, isLoading: loadingSessions, refetch } = useQuery({
    queryKey: ["coordinator-sessions", coordinator?.event_id, coordinator?.hall_name],
    enabled: !!coordinator,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sessions")
        .select("*")
        .eq("event_id", coordinator!.event_id)
        .eq("hall", coordinator!.hall_name)
        .order("session_date")
        .order("start_time")
      return (data || []) as Session[]
    },
  })

  // Fetch ALL registrations including speakers/faculty (with flexible matching)
  const { data: speakerRegistrations } = useQuery({
    queryKey: ["coordinator-speakers", coordinator?.event_id],
    enabled: !!coordinator,
    queryFn: async () => {
      // Fetch all registrations - we'll do smart matching client-side
      const { data } = await (supabase as any)
        .from("registrations")
        .select("attendee_name, attendee_phone, attendee_email, attendee_designation, first_name, last_name, phone, whatsapp")
        .eq("event_id", coordinator!.event_id)
      return data || []
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await (supabase as any)
        .from("sessions")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coordinator-sessions"] }),
  })

  // Smart name normalization (removes titles, extra spaces)
  const normalizeName = useCallback((name: string) => {
    if (!name) return ""
    return name
      .toLowerCase()
      .trim()
      .replace(/^(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?|shri\.?|smt\.?)\s*/i, "") // Remove titles
      .replace(/\s+/g, " ") // Normalize spaces
      .replace(/[^a-z\s]/g, "") // Remove special chars
      .trim()
  }, [])

  // Extract name parts for matching
  const getNameParts = useCallback((name: string) => {
    const normalized = normalizeName(name)
    const parts = normalized.split(" ").filter(p => p.length > 1)
    return {
      full: normalized,
      parts,
      first: parts[0] || "",
      last: parts[parts.length - 1] || "",
    }
  }, [normalizeName])

  // AI-like smart phone finder - matches names flexibly
  const findSpeakerPhone = useCallback((name: string) => {
    if (!speakerRegistrations || !name) return null

    const searchName = getNameParts(name)
    if (!searchName.full || searchName.parts.length === 0) return null

    // Score-based matching for better accuracy
    let bestMatch: any = null
    let bestScore = 0

    for (const r of speakerRegistrations as any[]) {
      // Get all possible name variations from registration
      const regNames = [
        r.attendee_name,
        r.first_name && r.last_name ? `${r.first_name} ${r.last_name}` : null,
        r.first_name,
        r.last_name,
      ].filter(Boolean).map(n => getNameParts(n))

      for (const regName of regNames) {
        let score = 0

        // Exact match = 100 points
        if (searchName.full === regName.full) {
          score = 100
        }
        // All parts match in either direction = 80 points
        else if (searchName.parts.every(p => regName.parts.includes(p)) ||
                 regName.parts.every(p => searchName.parts.includes(p))) {
          score = 80
        }
        // First name + last name match = 70 points
        else if (searchName.first === regName.first && searchName.last === regName.last) {
          score = 70
        }
        // Last name match + partial first = 60 points
        else if (searchName.last === regName.last &&
                 (searchName.first.startsWith(regName.first) || regName.first.startsWith(searchName.first))) {
          score = 60
        }
        // Contains full name = 50 points
        else if (searchName.full.includes(regName.full) || regName.full.includes(searchName.full)) {
          score = 50
        }
        // At least 2 parts match = 40 points
        else if (searchName.parts.filter(p => regName.parts.some(rp => rp === p || rp.includes(p) || p.includes(rp))).length >= 2) {
          score = 40
        }
        // Last name only match (single word search) = 30 points
        else if (searchName.parts.length === 1 && regName.parts.includes(searchName.first)) {
          score = 30
        }
        // Fuzzy partial match = 20 points
        else if (searchName.parts.some(p => regName.parts.some(rp => rp.includes(p) || p.includes(rp)))) {
          score = 20
        }

        if (score > bestScore) {
          bestScore = score
          bestMatch = r
        }
      }
    }

    // Only return if we have a reasonable confidence (score >= 30)
    if (bestMatch && bestScore >= 30) {
      return bestMatch.attendee_phone || bestMatch.phone || bestMatch.whatsapp || null
    }
    return null
  }, [speakerRegistrations, getNameParts])

  const parseTime = (t: string | undefined) => {
    if (!t) return 0
    const [h, m] = t.split(":").map(Number)
    return h * 60 + (m || 0)
  }

  const formatTime = (t: string | undefined) => {
    if (!t) return "--:--"
    const [h, m] = t.split(":")
    const hr = parseInt(h)
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`
  }

  const getSessionTiming = useCallback((s: Session) => {
    const now = currentTime.getHours() * 60 + currentTime.getMinutes()
    const today = currentTime.toISOString().split("T")[0]
    if (s.session_date !== today) return s.session_date! < today ? "past" : "future"
    const start = parseTime(s.start_time)
    const end = parseTime(s.end_time)
    if (now < start - 30) return "upcoming"
    if (now < start) return "starting_soon"
    if (now <= end) return "current"
    return "past"
  }, [currentTime])

  const getStatusInfo = (status?: string) => SESSION_STATUS.find(s => s.value === status) || SESSION_STATUS[0]

  // Day groups
  const dayGroups = useMemo(() => {
    if (!sessions) return []
    const groups = new Map<string, Session[]>()
    sessions.forEach(s => {
      const d = s.session_date || "unknown"
      if (!groups.has(d)) groups.set(d, [])
      groups.get(d)!.push(s)
    })
    const result = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, sessions]) => {
      const d = new Date(date)
      return { date, day: d.getDate(), weekday: d.toLocaleDateString("en", { weekday: "short" }), month: d.toLocaleDateString("en", { month: "short" }), sessions }
    })
    if (result.length && !selectedDay) {
      const today = new Date().toISOString().split("T")[0]
      setSelectedDay(result.find(d => d.date === today)?.date || result[0].date)
    }
    return result
  }, [sessions, selectedDay])

  const todaySessions = useMemo(() => dayGroups.find(d => d.date === selectedDay)?.sessions || [], [dayGroups, selectedDay])

  // Current & next sessions
  const { currentSession, nextSession, upcomingSessions } = useMemo(() => {
    let current: Session | null = null, next: Session | null = null
    const upcoming: Session[] = []
    for (const s of todaySessions) {
      const t = getSessionTiming(s)
      if (t === "current" || t === "starting_soon") current = current || s
      else if (t === "upcoming") { next = next || s; upcoming.push(s) }
    }
    return { currentSession: current, nextSession: next, upcomingSessions: upcoming.slice(0, 5) }
  }, [todaySessions, getSessionTiming])

  // Time info for current session
  const timeInfo = useMemo(() => {
    if (!currentSession) return null
    const now = currentTime.getHours() * 60 + currentTime.getMinutes()
    const start = parseTime(currentSession.start_time)
    const end = parseTime(currentSession.end_time)
    const remaining = end - now
    const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
    return { remaining, progress, isOvertime: remaining < 0, overtimeMinutes: remaining < 0 ? Math.abs(remaining) : 0 }
  }, [currentSession, currentTime])

  // Calculate cascade delay for subsequent sessions
  const cascadeDelay = useMemo(() => {
    if (!timeInfo?.isOvertime) return 0
    return timeInfo.overtimeMinutes
  }, [timeInfo])

  // Helper to format adjusted time
  const formatAdjustedTime = useCallback((originalTime: string | undefined, delay: number) => {
    if (!originalTime || delay === 0) return formatTime(originalTime)
    const [h, m] = originalTime.split(":").map(Number)
    const totalMinutes = h * 60 + (m || 0) + delay
    const newH = Math.floor(totalMinutes / 60)
    const newM = totalMinutes % 60
    return `${newH % 12 || 12}:${newM.toString().padStart(2, "0")} ${newH >= 12 ? "PM" : "AM"}`
  }, [])

  // Stats
  const stats = useMemo(() => {
    const total = todaySessions.length
    const completed = todaySessions.filter(s => s.coordinator_status === "completed").length
    const live = todaySessions.filter(s => s.coordinator_status === "in_progress").length
    const delayed = todaySessions.filter(s => s.coordinator_status === "delayed").length
    return { total, completed, live, pending: total - completed, delayed, progress: total ? Math.round((completed / total) * 100) : 0 }
  }, [todaySessions])

  // Parse contact info from formatted string "Name (email, phone)"
  const parseContactFromText = useCallback((formatted: string) => {
    const match = formatted.match(/^(.+?)\s*\(([^)]+)\)$/)
    if (match) {
      const name = match[1].trim()
      const contacts = match[2].split(",").map(c => c.trim())
      const email = contacts.find(c => c.includes("@"))
      const phone = contacts.find(c => !c.includes("@") && /\d/.test(c))
      return { name, email, phone }
    }
    return { name: formatted.trim(), email: undefined, phone: undefined }
  }, [])

  // AI-like smart parser for speaker names from session data
  const parseSpeakers = useCallback((s: Session) => {
    const speakers: { name: string; role: string; phone: string | null; email?: string }[] = []
    const addedNames = new Set<string>()

    // Common role keywords to detect
    const roleKeywords: Record<string, string> = {
      "chair": "Chairperson",
      "chairperson": "Chairperson",
      "co-chair": "Co-Chair",
      "moderator": "Moderator",
      "speaker": "Speaker",
      "panelist": "Panelist",
      "panellist": "Panelist",
      "discussant": "Discussant",
      "faculty": "Faculty",
      "presenter": "Presenter",
      "convener": "Convener",
      "coordinator": "Hall Co-Ordinator",
      "hall co-ordinator": "Hall Co-Ordinator",
      "guest": "Guest Speaker",
      "chief guest": "Chief Guest",
      "keynote": "Keynote Speaker",
      "invited": "Invited Speaker",
    }

    // Detect role from text
    const detectRole = (text: string): string => {
      const lower = text.toLowerCase()
      for (const [keyword, role] of Object.entries(roleKeywords)) {
        if (lower.includes(keyword)) return role
      }
      return "Speaker"
    }

    const addPerson = (name: string, role: string, directPhone?: string | null, directEmail?: string) => {
      // Clean name
      const cleanName = name.trim()
        .replace(/^(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?|shri\.?|smt\.?)\s+/i, match => match) // Keep titles
        .replace(/[*_#]+/g, "") // Remove markdown
        .replace(/\s+/g, " ") // Normalize spaces
        .trim()

      // Skip if too short, too long, or doesn't look like a name
      if (cleanName.length < 2 || cleanName.length > 60) return
      if (!/[A-Za-z]{2,}/.test(cleanName)) return // Must have at least 2 letters
      if (/^\d+$/.test(cleanName)) return // Skip pure numbers
      if (/^(session|break|lunch|tea|coffee|registration|inauguration|valedictory|panel|discussion|q&a|networking)$/i.test(cleanName)) return

      // Normalize for dedup check
      const normalizedKey = cleanName.toLowerCase().replace(/[^a-z]/g, "")
      if (normalizedKey.length < 3 || addedNames.has(normalizedKey)) return

      addedNames.add(normalizedKey)
      speakers.push({
        name: cleanName,
        role,
        phone: directPhone || findSpeakerPhone(cleanName),
        email: directEmail
      })
    }

    // 1. Check faculty_name field first (has direct phone)
    if (s.faculty_name) {
      addPerson(s.faculty_name, "Faculty", s.faculty_phone, s.faculty_email || undefined)
    }

    // 2. Parse from _text fields with contact details (preferred)
    if (s.speakers_text) {
      s.speakers_text.split(" | ").forEach(entry => {
        const { name, phone, email } = parseContactFromText(entry)
        addPerson(name, "Speaker", phone || null, email)
      })
    } else if (s.speakers) {
      s.speakers.split(/[,;\/\n]+/).forEach(name => addPerson(name, "Speaker"))
    }

    if (s.moderators_text) {
      s.moderators_text.split(" | ").forEach(entry => {
        const { name, phone, email } = parseContactFromText(entry)
        addPerson(name, "Moderator", phone || null, email)
      })
    } else if (s.moderators) {
      s.moderators.split(/[,;\/\n]+/).forEach(name => addPerson(name, "Moderator"))
    }

    if (s.chairpersons_text) {
      s.chairpersons_text.split(" | ").forEach(entry => {
        const { name, phone, email } = parseContactFromText(entry)
        addPerson(name, "Chairperson", phone || null, email)
      })
    } else if (s.chairpersons) {
      s.chairpersons.split(/[,;\/\n]+/).forEach(name => addPerson(name, "Chairperson"))
    }

    // 3. Smart parse from description
    if (s.description) {
      const desc = s.description

      // Pattern 1: "Name (Role)" format
      const pattern1 = /([A-Z][a-zA-Z\s.]+?)\s*\(([^)]+)\)/g
      let match
      while ((match = pattern1.exec(desc)) !== null) {
        const name = match[1].trim()
        const roleText = match[2].trim()
        addPerson(name, detectRole(roleText) || roleText)
      }

      // Pattern 2: "Role: Name" or "Role - Name" format
      const pattern2 = /(chair(?:person)?|moderator|speaker|panelist|faculty|presenter|convener)[\s:–-]+([A-Z][a-zA-Z\s.]+?)(?=[,;]|$)/gi
      while ((match = pattern2.exec(desc)) !== null) {
        const role = detectRole(match[1])
        const name = match[2].trim()
        addPerson(name, role)
      }

      // Pattern 3: Comma-separated names (if no matches found yet)
      if (speakers.length === 0) {
        desc.split(/[,;]+/).forEach(part => {
          const trimmed = part.trim()
          // Check if it's "Name (Role)" format
          const withRole = trimmed.match(/^([^(]+?)\s*\(([^)]+)\)$/)
          if (withRole) {
            addPerson(withRole[1], detectRole(withRole[2]) || withRole[2])
          } else if (trimmed.length >= 3 && trimmed.length <= 50 && /^[A-Z]/.test(trimmed)) {
            // Looks like a name starting with capital
            addPerson(trimmed, "Speaker")
          }
        })
      }

      // Pattern 4: Dr./Prof. prefixed names anywhere in text
      const pattern4 = /((?:Dr\.?|Prof\.?)\s+[A-Z][a-zA-Z\s.]+?)(?=[,;()]|$)/gi
      while ((match = pattern4.exec(desc)) !== null) {
        addPerson(match[1], "Speaker")
      }
    }

    // 4. Also check session_name for speaker info (e.g., "Keynote by Dr. Smith")
    if (s.session_name) {
      const byMatch = s.session_name.match(/(?:by|with|featuring)\s+([A-Z][a-zA-Z\s.]+?)$/i)
      if (byMatch) {
        addPerson(byMatch[1], detectRole(s.session_name) || "Speaker")
      }
    }

    return speakers
  }, [findSpeakerPhone, parseContactFromText])

  // Actions
  const handleStatus = (s: Session, status: string) => {
    updateMutation.mutate({ id: s.id, updates: { coordinator_status: status } })
    toast.success(SESSION_STATUS.find(st => st.value === status)?.label || "Updated")
  }

  const handleChecklist = (s: Session, key: string) => {
    const current = s.coordinator_checklist || {}
    updateMutation.mutate({ id: s.id, updates: { coordinator_checklist: { ...current, [key]: !current[key] } } })
  }

  const reportIssue = () => {
    if (!selectedIssueType) return
    const info = ISSUE_TYPES.find(i => i.value === selectedIssueType)
    const issue: Issue = {
      id: crypto.randomUUID(),
      type: selectedIssueType,
      description: issueDescription,
      priority: info?.priority || "medium",
      status: "reported",
      session_id: currentSession?.id,
      created_at: new Date().toISOString(),
    }
    setLocalIssues(prev => [issue, ...prev])

    const msg = `🚨 *${coordinator?.hall_name} - ISSUE*\n\n⚠️ *${info?.label}*\n📍 Priority: ${info?.priority?.toUpperCase()}\n👥 Team: ${info?.team}\n${issueDescription ? `📝 ${issueDescription}\n` : ""}🎤 Session: ${currentSession?.session_name || "N/A"}\n⏰ ${currentTime.toLocaleTimeString()}\n👤 ${coordinator?.coordinator_name}`
    navigator.clipboard.writeText(msg)
    toast.success("Issue reported! Message copied for WhatsApp")
    setIssueDialogOpen(false)
    setSelectedIssueType(null)
    setIssueDescription("")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-500/30 rounded-full animate-spin border-t-blue-500" />
            <Zap className="absolute inset-0 m-auto h-8 w-8 text-blue-500" />
          </div>
          <p className="mt-4 text-white/60">Initializing Control Center...</p>
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
          <p className="text-white/50">Invalid portal link</p>
        </div>
      </div>
    )
  }

  const openIssues = localIssues.filter(i => i.status !== "resolved").length

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      {/* Top Bar */}
      <div className="relative z-50 bg-black/40 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500 animate-pulse" : "bg-red-500")}>
              <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500 animate-ping" : "bg-red-500")} />
            </div>
            <span className="text-xs text-white/50 font-mono">
              {currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {openIssues > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 rounded-full animate-pulse">
                <AlertTriangle className="h-3 w-3 text-red-400" />
                <span className="text-xs text-red-400 font-semibold">{openIssues}</span>
              </div>
            )}
            <button onClick={() => refetch()} disabled={loadingSessions} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              <RefreshCw className={cn("h-4 w-4 text-white/50", loadingSessions && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {/* Hero Header */}
      <div className="relative z-10">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg shadow-blue-500/25">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                    {coordinator.hall_name}
                  </h1>
                  <p className="text-sm text-white/40">{coordinator.coordinator_name} • {coordinator.event?.short_name || coordinator.event?.name}</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black font-mono tracking-tighter text-white">
                {currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-sm text-white/40">
                {currentTime.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <Target className="h-5 w-5 text-blue-400" />
                <span className="text-xs text-white/40">Total</span>
              </div>
              <p className="text-3xl font-black text-white">{stats.total}</p>
              <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: "100%" }} />
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 backdrop-blur-xl rounded-2xl p-4 border border-emerald-500/20">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                <span className="text-xs text-emerald-400/60">Done</span>
              </div>
              <p className="text-3xl font-black text-emerald-400">{stats.completed}</p>
              <div className="mt-2 h-1 bg-emerald-500/20 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${stats.progress}%` }} />
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 backdrop-blur-xl rounded-2xl p-4 border border-green-500/20 relative overflow-hidden">
              {stats.live > 0 && <div className="absolute inset-0 bg-green-500/10 animate-pulse" />}
              <div className="relative flex items-center justify-between mb-2">
                <Radio className="h-5 w-5 text-green-400" />
                <span className="text-xs text-green-400/60">Live</span>
              </div>
              <p className="relative text-3xl font-black text-green-400">{stats.live}</p>
              {stats.live > 0 && (
                <div className="mt-2 flex items-center gap-1">
                  <CircleDot className="h-3 w-3 text-green-400 animate-pulse" />
                  <span className="text-xs text-green-400">ON AIR</span>
                </div>
              )}
            </div>
            <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 backdrop-blur-xl rounded-2xl p-4 border border-amber-500/20">
              <div className="flex items-center justify-between mb-2">
                <Clock className="h-5 w-5 text-amber-400" />
                <span className="text-xs text-amber-400/60">Pending</span>
              </div>
              <p className="text-3xl font-black text-amber-400">{stats.pending}</p>
              <div className="mt-2 h-1 bg-amber-500/20 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${100 - stats.progress}%` }} />
              </div>
            </div>
          </div>

          {/* Day Selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            {dayGroups.map((day, _i) => (
              <button
                key={day.date}
                onClick={() => setSelectedDay(day.date)}
                className={cn(
                  "flex flex-col items-center px-4 py-2 rounded-xl transition-all min-w-[70px]",
                  selectedDay === day.date
                    ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25"
                    : "bg-white/5 text-white/50 hover:bg-white/10"
                )}
              >
                <span className="text-[10px] uppercase font-semibold opacity-60">{day.weekday}</span>
                <span className="text-xl font-black">{day.day}</span>
                <span className="text-[10px] uppercase opacity-60">{day.month}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Current Session Card */}
      {currentSession && (
        <div className="relative z-10 max-w-6xl mx-auto px-4 mb-6">
          <div className="relative bg-gradient-to-br from-green-500/20 via-emerald-500/10 to-teal-500/20 backdrop-blur-xl rounded-3xl border border-green-500/30 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse" />
                    <div className="absolute inset-0 w-4 h-4 bg-green-500 rounded-full animate-ping" />
                  </div>
                  <span className="text-sm font-bold text-green-400 uppercase tracking-wider">Live Now</span>
                  {timeInfo?.isOvertime && (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/50 animate-pulse">OVERTIME</Badge>
                  )}
                </div>
                <div className="text-right">
                  <p className={cn("text-2xl font-black font-mono", timeInfo?.isOvertime ? "text-red-400" : "text-green-400")}>
                    {timeInfo?.isOvertime ? `+${Math.abs(timeInfo.remaining)}m` : `${timeInfo?.remaining}m`}
                  </p>
                  <p className="text-xs text-white/40">remaining</p>
                </div>
              </div>

              <h2 className="text-xl font-bold text-white mb-2">{currentSession.session_name}</h2>
              <p className="text-sm text-white/50 mb-4">{formatTime(currentSession.start_time)} - {formatTime(currentSession.end_time)}</p>

              {/* Progress Bar */}
              <div className="h-2 bg-black/30 rounded-full overflow-hidden mb-6">
                <div
                  className={cn("h-full rounded-full transition-all duration-1000", timeInfo?.isOvertime ? "bg-red-500" : "bg-gradient-to-r from-green-500 to-emerald-400")}
                  style={{ width: `${Math.min(100, timeInfo?.progress || 0)}%` }}
                />
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { status: "in_progress", icon: PlayCircle, label: "Live", color: "green" },
                  { status: "delayed", icon: Timer, label: "Delayed", color: "amber" },
                  { status: "completed", icon: CheckCheck, label: "Done", color: "emerald" },
                  { status: "speaker_absent", icon: UserX, label: "No Show", color: "red" },
                ].map(({ status, icon: Icon, label, color }) => (
                  <button
                    key={status}
                    onClick={() => handleStatus(currentSession, status)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-xl transition-all",
                      currentSession.coordinator_status === status
                        ? `bg-${color}-500 text-white shadow-lg shadow-${color}-500/30`
                        : "bg-white/5 text-white/50 hover:bg-white/10"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Next Session */}
      {nextSession && !currentSession && (
        <div className="relative z-10 max-w-6xl mx-auto px-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500/20 via-indigo-500/10 to-purple-500/20 backdrop-blur-xl rounded-3xl border border-blue-500/30 p-6">
            <div className="flex items-center gap-2 mb-4">
              <SkipForward className="h-5 w-5 text-blue-400" />
              <span className="text-sm font-bold text-blue-400 uppercase tracking-wider">Next Up</span>
              <span className="text-sm text-white/40">at {formatTime(nextSession.start_time)}</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-4">{nextSession.session_name}</h2>

            {/* Checklist */}
            <div className="grid grid-cols-5 gap-2">
              {CHECKLIST_ITEMS.map(({ key, label, icon: Icon, color }) => {
                const checked = nextSession.coordinator_checklist?.[key]
                return (
                  <button
                    key={key}
                    onClick={() => handleChecklist(nextSession, key)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-xl transition-all",
                      checked ? `bg-${color}-500/20 text-${color}-400 border border-${color}-500/50` : "bg-white/5 text-white/30 hover:bg-white/10"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] font-semibold">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Quick Issue Panel */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 mb-6">
        <div className="bg-gradient-to-r from-red-500/10 via-orange-500/10 to-amber-500/10 backdrop-blur-xl rounded-2xl border border-red-500/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-red-400" />
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Quick Report</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {ISSUE_TYPES.slice(0, 6).map(issue => {
              const Icon = issue.icon
              return (
                <button
                  key={issue.value}
                  onClick={() => { setSelectedIssueType(issue.value); setIssueDialogOpen(true) }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                    issue.priority === "critical" ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30" :
                    issue.priority === "high" ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30" :
                    "bg-white/5 text-white/60 hover:bg-white/10 border border-white/10"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {issue.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 mb-4">
        <div className="flex gap-1 p-1 bg-white/5 backdrop-blur-xl rounded-xl">
          {[
            { id: "control", label: "Control", icon: LayoutDashboard },
            { id: "schedule", label: "Schedule", icon: List },
            { id: "contacts", label: "Contacts", icon: PhoneCall },
            { id: "issues", label: "Issues", icon: AlertTriangle, badge: openIssues },
          ].map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all",
                  activeTab === tab.id ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.badge ? (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full">{tab.badge}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 pb-8">
        {/* Control Tab */}
        {activeTab === "control" && (
          <div className="space-y-4">
            {/* Upcoming Sessions */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider">Upcoming Sessions</h3>
                {cascadeDelay > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse text-xs">
                    <Timer className="h-3 w-3 mr-1" />
                    +{cascadeDelay}m delay
                  </Badge>
                )}
              </div>
              {upcomingSessions.length === 0 && !currentSession && !nextSession ? (
                <div className="text-center py-8">
                  <Sparkles className="h-12 w-12 mx-auto text-white/20 mb-3" />
                  <p className="text-white/40">No more sessions today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(nextSession ? [nextSession, ...upcomingSessions.filter(s => s.id !== nextSession.id)] : upcomingSessions).slice(0, 5).map((session, _i) => {
                    const status = getStatusInfo(session.coordinator_status)
                    const checklist = session.coordinator_checklist || {}
                    const _checkCount = Object.values(checklist).filter(Boolean).length
                    const hasDelay = cascadeDelay > 0
                    return (
                      <div
                        key={session.id}
                        onClick={() => { setSelectedSession(session); setSessionDialogOpen(true) }}
                        className={cn(
                          "flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all group",
                          hasDelay ? "bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20" : "bg-white/5 hover:bg-white/10"
                        )}
                      >
                        <div className="text-center min-w-[70px]">
                          {hasDelay ? (
                            <>
                              <p className="text-xs text-white/30 line-through">{formatTime(session.start_time)}</p>
                              <p className="text-lg font-bold text-amber-400">{formatAdjustedTime(session.start_time, cascadeDelay)}</p>
                              <p className="text-[10px] text-amber-400/60">~{formatAdjustedTime(session.end_time, cascadeDelay)}</p>
                            </>
                          ) : (
                            <>
                              <p className="text-lg font-bold text-white">{formatTime(session.start_time)}</p>
                              <p className="text-[10px] text-white/40">{formatTime(session.end_time)}</p>
                            </>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{session.session_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={cn("text-[10px] bg-gradient-to-r", status.color, "text-white border-0")}>
                              {status.label}
                            </Badge>
                            {hasDelay && (
                              <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-0">
                                Pushed +{cascadeDelay}m
                              </Badge>
                            )}
                            <div className="flex gap-0.5">
                              {CHECKLIST_ITEMS.map(item => (
                                <div key={item.key} className={cn("w-1.5 h-1.5 rounded-full", checklist[item.key] ? "bg-green-500" : "bg-white/20")} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-white/20 group-hover:text-white/50 transition-colors" />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Speakers */}
            {(currentSession || nextSession) && (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
                <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">
                  {currentSession ? "Current" : "Next"} Session Faculty
                </h3>
                {parseSpeakers(currentSession || nextSession!).length > 0 ? (
                  <div className="space-y-2">
                    {parseSpeakers(currentSession || nextSession!).map((speaker, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                          {speaker.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{speaker.name}</p>
                          <p className="text-xs text-white/40">{speaker.role}</p>
                        </div>
                        {speaker.phone ? (
                          <div className="flex gap-2">
                            <a href={`tel:${speaker.phone}`} className="p-2 bg-green-500 rounded-xl text-white hover:bg-green-600 transition-colors">
                              <Phone className="h-5 w-5" />
                            </a>
                            <a
                              href={`https://wa.me/${speaker.phone.replace(/\D/g, "")}?text=Hi ${speaker.name}`}
                              target="_blank"
                              className="p-2 bg-[#25D366] rounded-xl text-white hover:bg-[#128C7E] transition-colors"
                            >
                              <MessageCircle className="h-5 w-5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-white/30">No contact</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/40 text-center py-4">No speaker info available</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === "schedule" && (
          <div className="space-y-2">
            {/* Delay Banner */}
            {cascadeDelay > 0 && (
              <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4">
                <Timer className="h-5 w-5 text-amber-400 animate-pulse" />
                <div>
                  <p className="text-sm font-semibold text-amber-400">Schedule Running +{cascadeDelay} min Behind</p>
                  <p className="text-xs text-amber-400/70">Adjusted times shown for upcoming sessions</p>
                </div>
              </div>
            )}
            {todaySessions.length === 0 ? (
              <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
                <Calendar className="h-12 w-12 mx-auto text-white/20 mb-3" />
                <p className="text-white/40">No sessions scheduled</p>
              </div>
            ) : (
              todaySessions.map(session => {
                const timing = getSessionTiming(session)
                const status = getStatusInfo(session.coordinator_status)
                const StatusIcon = status.icon
                const isUpcoming = timing === "upcoming" || timing === "starting_soon"
                const showAdjusted = cascadeDelay > 0 && isUpcoming
                return (
                  <div
                    key={session.id}
                    onClick={() => { setSelectedSession(session); setSessionDialogOpen(true) }}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all",
                      timing === "current" ? "bg-green-500/10 border-green-500/30" :
                      timing === "starting_soon" ? "bg-blue-500/10 border-blue-500/30" :
                      timing === "past" ? "bg-white/5 border-white/10 opacity-50" :
                      showAdjusted ? "bg-amber-500/5 border-amber-500/20" :
                      "bg-white/5 border-white/10 hover:bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "text-center min-w-[70px] p-2 rounded-xl",
                      timing === "current" ? "bg-green-500/20" :
                      timing === "starting_soon" ? "bg-blue-500/20" :
                      showAdjusted ? "bg-amber-500/10" : "bg-white/5"
                    )}>
                      {showAdjusted ? (
                        <>
                          <p className="text-xs text-white/30 line-through">{formatTime(session.start_time)}</p>
                          <p className="text-lg font-bold text-amber-400">{formatAdjustedTime(session.start_time, cascadeDelay)}</p>
                        </>
                      ) : (
                        <p className={cn(
                          "text-lg font-bold",
                          timing === "current" ? "text-green-400" :
                          timing === "starting_soon" ? "text-blue-400" : "text-white"
                        )}>
                          {formatTime(session.start_time)}
                        </p>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{session.session_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={cn("text-[10px] bg-gradient-to-r", status.color, "text-white border-0")}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                        {showAdjusted && (
                          <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-0">
                            +{cascadeDelay}m
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-white/30" />
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Contacts Tab */}
        {activeTab === "contacts" && (
          <div className="space-y-4">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
              <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Control Room</h3>
              <div className="space-y-2">
                {CONTROL_CONTACTS.map((contact, i) => {
                  const Icon = contact.icon
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                      <div className="p-2 bg-blue-500/20 rounded-xl">
                        <Icon className="h-6 w-6 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-white">{contact.name}</p>
                        <p className="text-xs text-white/40">{contact.role}</p>
                      </div>
                      <div className="flex gap-2">
                        <a href={`tel:${contact.phone}`} className="p-2 bg-green-500 rounded-xl text-white">
                          <Phone className="h-5 w-5" />
                        </a>
                        <a href={`https://wa.me/${contact.phone.replace(/\D/g, "")}`} target="_blank" className="p-2 bg-[#25D366] rounded-xl text-white">
                          <MessageCircle className="h-5 w-5" />
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
              <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">Today's Speakers</h3>
              <div className="space-y-2">
                {todaySessions.flatMap(s => parseSpeakers(s)).filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i).map((speaker, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                      {speaker.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{speaker.name}</p>
                      <p className="text-xs text-white/40">{speaker.role}</p>
                    </div>
                    {speaker.phone ? (
                      <div className="flex gap-2">
                        <a href={`tel:${speaker.phone}`} className="p-2 bg-green-500 rounded-xl text-white">
                          <Phone className="h-4 w-4" />
                        </a>
                        <a href={`https://wa.me/${speaker.phone.replace(/\D/g, "")}`} target="_blank" className="p-2 bg-[#25D366] rounded-xl text-white">
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-white/30">No contact</span>
                    )}
                  </div>
                ))}
                {todaySessions.flatMap(s => parseSpeakers(s)).length === 0 && (
                  <p className="text-white/40 text-center py-4">No speakers for today</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Issues Tab */}
        {activeTab === "issues" && (
          <div className="space-y-4">
            <button
              onClick={() => setIssueDialogOpen(true)}
              className="w-full flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl text-white font-bold hover:shadow-lg hover:shadow-red-500/30 transition-all"
            >
              <AlertTriangle className="h-5 w-5" />
              Report New Issue
            </button>

            {localIssues.length === 0 ? (
              <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500/50 mb-3" />
                <p className="text-white/60 font-semibold">All Clear</p>
                <p className="text-white/40 text-sm">No issues reported</p>
              </div>
            ) : (
              <div className="space-y-2">
                {localIssues.map(issue => {
                  const info = ISSUE_TYPES.find(i => i.value === issue.type)
                  const Icon = info?.icon || AlertTriangle
                  return (
                    <div
                      key={issue.id}
                      className={cn(
                        "p-4 rounded-2xl border",
                        issue.status === "resolved" ? "bg-white/5 border-white/10 opacity-50" :
                        issue.priority === "critical" ? "bg-red-500/10 border-red-500/30" :
                        issue.priority === "high" ? "bg-orange-500/10 border-orange-500/30" :
                        "bg-white/5 border-white/10"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-xl",
                          issue.priority === "critical" ? "bg-red-500/20" :
                          issue.priority === "high" ? "bg-orange-500/20" : "bg-white/10"
                        )}>
                          <Icon className={cn(
                            "h-5 w-5",
                            issue.priority === "critical" ? "text-red-400" :
                            issue.priority === "high" ? "text-orange-400" : "text-white/60"
                          )} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-white">{info?.label}</p>
                            <Badge className={cn(
                              "text-[10px]",
                              issue.priority === "critical" ? "bg-red-500/20 text-red-400" :
                              issue.priority === "high" ? "bg-orange-500/20 text-orange-400" : "bg-white/10 text-white/60"
                            )}>
                              {issue.priority}
                            </Badge>
                          </div>
                          {issue.description && <p className="text-sm text-white/50 mb-2">{issue.description}</p>}
                          <p className="text-xs text-white/30">
                            {new Date(issue.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} • {info?.team}
                          </p>
                        </div>
                        {issue.status !== "resolved" && (
                          <button
                            onClick={() => setLocalIssues(prev => prev.map(i => i.id === issue.id ? { ...i, status: "resolved" } : i))}
                            className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs font-semibold hover:bg-green-500/30"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Session Dialog */}
      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent className="max-w-lg bg-[#0a0a0f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl">Session Control</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-6">
              <div className="bg-white/5 rounded-xl p-4">
                <h4 className="font-bold text-lg">{selectedSession.session_name}</h4>
                <p className="text-sm text-white/50">{formatTime(selectedSession.start_time)} - {formatTime(selectedSession.end_time)}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-white/60 mb-3 block">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {SESSION_STATUS.slice(0, 6).map(status => {
                    const Icon = status.icon
                    const isActive = selectedSession.coordinator_status === status.value
                    return (
                      <button
                        key={status.value}
                        onClick={() => { handleStatus(selectedSession, status.value); setSelectedSession({ ...selectedSession, coordinator_status: status.value }) }}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-xl text-sm transition-all",
                          isActive ? `bg-gradient-to-r ${status.color} text-white` : "bg-white/5 text-white/50 hover:bg-white/10"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {status.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-white/60 mb-3 block">Checklist</label>
                <div className="grid grid-cols-5 gap-2">
                  {CHECKLIST_ITEMS.map(item => {
                    const Icon = item.icon
                    const checked = selectedSession.coordinator_checklist?.[item.key]
                    return (
                      <button
                        key={item.key}
                        onClick={() => { handleChecklist(selectedSession, item.key); setSelectedSession({ ...selectedSession, coordinator_checklist: { ...selectedSession.coordinator_checklist, [item.key]: !checked } }) }}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-xl transition-all",
                          checked ? "bg-green-500 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-[10px]">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-white/60 mb-2 block">Audience Count</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={selectedSession.audience_count || ""}
                    onChange={e => setSelectedSession({ ...selectedSession, audience_count: parseInt(e.target.value) || 0 })}
                    onBlur={() => updateMutation.mutate({ id: selectedSession.id, updates: { audience_count: selectedSession.audience_count } })}
                    className="bg-white/5 border-white/10 text-white text-center text-xl font-bold"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-white/60 mb-2 block">Notes</label>
                <Textarea
                  value={selectedSession.coordinator_notes || ""}
                  onChange={e => setSelectedSession({ ...selectedSession, coordinator_notes: e.target.value })}
                  onBlur={() => updateMutation.mutate({ id: selectedSession.id, updates: { coordinator_notes: selectedSession.coordinator_notes } })}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="Add notes..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionDialogOpen(false)} className="border-white/10 text-white hover:bg-white/10">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Dialog */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="max-w-lg bg-[#0a0a0f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Report Issue
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {ISSUE_TYPES.map(issue => {
                const Icon = issue.icon
                const selected = selectedIssueType === issue.value
                return (
                  <button
                    key={issue.value}
                    onClick={() => setSelectedIssueType(issue.value)}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl text-sm transition-all border",
                      selected
                        ? issue.priority === "critical" ? "bg-red-500/20 border-red-500 text-red-400" :
                          issue.priority === "high" ? "bg-orange-500/20 border-orange-500 text-orange-400" :
                          "bg-blue-500/20 border-blue-500 text-blue-400"
                        : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {issue.label}
                  </button>
                )
              })}
            </div>
            <Textarea
              value={issueDescription}
              onChange={e => setIssueDescription(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
              placeholder="Additional details..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialogOpen(false)} className="border-white/10">Cancel</Button>
            <Button onClick={reportIssue} disabled={!selectedIssueType} className="bg-red-500 hover:bg-red-600">
              <Send className="h-4 w-4 mr-2" />
              Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center">
          <p className="text-white/30 text-xs">
            {coordinator.hall_name} Control Center • {coordinator.event?.name}
          </p>
        </div>
      </footer>

      {/* Floating Layout - shows LayoutDashboard icon */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}

const LayoutDashboard = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
  </svg>
)
