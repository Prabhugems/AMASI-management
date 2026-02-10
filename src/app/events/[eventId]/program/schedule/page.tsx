"use client"

import { useState, useMemo, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Calendar,
  Clock,
  Plus,
  Upload,
  MoreVertical,
  Edit,
  Trash2,
  MapPin,
  Search,
  Download,
  Printer,
  Layers,
  ExternalLink,
  Globe,
  LayoutGrid,
  List,
  X,
  Phone,
  Mail,
  Building,
  CheckSquare,
  Users,
  Video,
  Coffee,
  Award,
  Mic2,
  BookOpen,
  Wrench,
  CalendarDays,
  AlignLeft,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { CSVImportWizard } from "@/components/program/csv-import-wizard"

type Session = {
  id: string
  event_id: string
  session_code: string | null
  session_name: string
  session_type: string
  day_number: number | null
  session_date: string
  start_time: string
  end_time: string
  duration_minutes: number | null
  hall: string | null
  floor: string | null
  description: string | null
  topics: string | null
  specialty_track: string | null
  status: string
}

type Event = {
  id: string
  name: string
  start_date: string
  end_date: string
}

const SESSION_TYPES = [
  { value: "plenary", label: "Plenary", color: "bg-purple-500", icon: Mic2 },
  { value: "symposium", label: "Symposium", color: "bg-blue-500", icon: Users },
  { value: "panel", label: "Panel", color: "bg-green-500", icon: Users },
  { value: "workshop", label: "Workshop", color: "bg-orange-500", icon: Wrench },
  { value: "hands_on", label: "Hands-on", color: "bg-red-500", icon: Wrench },
  { value: "video", label: "Video", color: "bg-pink-500", icon: Video },
  { value: "lecture", label: "Lecture", color: "bg-teal-500", icon: BookOpen },
  { value: "break", label: "Break", color: "bg-gray-500", icon: Coffee },
  { value: "inauguration", label: "Inauguration", color: "bg-amber-500", icon: Award },
  { value: "valedictory", label: "Valedictory", color: "bg-indigo-500", icon: Award },
]

// Hall/Track configuration for side-by-side view
const TRACK_CONFIG: Record<string, { name: string; color: string; bgColor: string }> = {
  common: { name: "Common Sessions", color: "bg-purple-600", bgColor: "bg-purple-50" },
  surgery: { name: "Surgery", color: "bg-blue-600", bgColor: "bg-blue-50" },
  gynecology: { name: "Gynecology", color: "bg-pink-600", bgColor: "bg-pink-50" },
  general: { name: "General", color: "bg-gray-600", bgColor: "bg-gray-50" },
}

// Detect track type from session hall/specialty_track
const getTrackType = (session: Session): string => {
  const hall = session.hall?.toLowerCase() || ""
  const track = session.specialty_track?.toLowerCase() || ""

  // Check for "Only" suffix first (more specific)
  if (hall.includes("surgery only") || hall.includes("surgeons only")) return "surgery"
  if (hall.includes("gynecology only") || hall.includes("gyne only") || hall.includes("gynec")) return "gynecology"

  // Check for common/both
  if (hall.includes("common") || hall.includes("both")) return "common"

  // Fallback checks
  if (hall.includes("surgery") || hall.includes("surgeon")) return "surgery"
  if (hall.includes("gyne")) return "gynecology"

  // Check specialty_track field
  if (track.includes("gyne")) return "gynecology"
  if (track.includes("surgery") || track.includes("surgeon")) return "surgery"

  return "general"
}

export default function ProgramPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"list" | "grid" | "table">("list")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingSession, setDeletingSession] = useState<Session | null>(null)
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null) // Side panel

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Resizable columns
  const [columnWidths, setColumnWidths] = useState({
    checkbox: 40,
    time: 90,
    type: 90,
    session: 500,
    faculty: 200,
    hall: 150,
    actions: 50,
  })
  const resizingColumn = useRef<string | null>(null)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent, column: string) => {
    e.preventDefault()
    resizingColumn.current = column
    startX.current = e.clientX
    startWidth.current = columnWidths[column as keyof typeof columnWidths]
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [columnWidths])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn.current) return
    const diff = e.clientX - startX.current
    const newWidth = Math.max(50, startWidth.current + diff)
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn.current!]: newWidth,
    }))
  }, [])

  const handleMouseUp = useCallback(() => {
    resizingColumn.current = null
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }, [handleMouseMove])

  // Form state
  const [formData, setFormData] = useState({
    session_name: "",
    session_type: "lecture",
    session_date: "",
    start_time: "",
    end_time: "",
    hall: "",
    description: "",
    duration_minutes: 30,
    topics: "",
    specialty_track: "",
  })

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, start_date, end_date")
        .eq("id", eventId)
        .single()
      return data as Event | null
    },
  })

  // Fetch sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("event_id", eventId)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
      return (data || []) as Session[]
    },
  })

  // Get unique dates from sessions
  const sessionDates = sessions
    ? [...new Set(sessions.map((s) => s.session_date))].sort()
    : []

  // Set default selected date
  if (!selectedDate && sessionDates.length > 0) {
    setSelectedDate(sessionDates[0])
  }

  // Generate date range from event
  const getEventDates = () => {
    if (!event?.start_date || !event?.end_date) return []
    const dates: string[] = []
    const start = new Date(event.start_date)
    const end = new Date(event.end_date)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0])
    }
    return dates
  }

  const eventDates = getEventDates()

  // Use session dates if event dates not available
  const displayDates = eventDates.length > 0 ? eventDates : sessionDates

  // Get unique tracks from sessions
  const uniqueTracks = sessions
    ? [...new Set(sessions.map((s) => s.specialty_track).filter(Boolean))]
    : []

  // Filter sessions by selected date, track, type, and search
  // When searching, ignore date filter to show results across all dates
  const filteredSessions = useMemo(() => {
    return sessions?.filter((session) => {
      const matchesDate = !selectedDate || searchQuery || session.session_date === selectedDate
      const matchesTrack = !selectedTrack || session.specialty_track === selectedTrack
      const matchesType = !selectedType || session.session_type === selectedType
      const matchesSearch =
        !searchQuery ||
        session.session_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.topics?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.description?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesDate && matchesTrack && matchesType && matchesSearch
    }) || []
  }, [sessions, selectedDate, selectedTrack, selectedType, searchQuery])

  // Stats calculation
  const stats = useMemo(() => {
    if (!sessions) return { total: 0, byType: {}, byTrack: {}, withSpeaker: 0, totalDuration: 0 }

    const byType: Record<string, number> = {}
    const byTrack: Record<string, number> = {}
    let withSpeaker = 0
    let totalDuration = 0

    sessions.forEach((s) => {
      // Count by type
      byType[s.session_type] = (byType[s.session_type] || 0) + 1
      // Count by track
      const track = s.specialty_track || "General"
      byTrack[track] = (byTrack[track] || 0) + 1
      // Count with speaker
      if (s.description && s.description.includes("@")) withSpeaker++
      // Total duration
      totalDuration += s.duration_minutes || 0
    })

    return { total: sessions.length, byType, byTrack, withSpeaker, totalDuration }
  }, [sessions])

  // Bulk selection helpers
  const allSelected = filteredSessions.length > 0 && selectedIds.size === filteredSessions.length
  const _someSelected = selectedIds.size > 0 && selectedIds.size < filteredSessions.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredSessions.map(s => s.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  // Create session mutation
  const createSession = useMutation({
    mutationFn: async (data: typeof formData) => {
      const insertData = {
        event_id: eventId,
        session_name: data.session_name,
        session_type: data.session_type,
        session_date: data.session_date,
        start_time: data.start_time,
        end_time: data.end_time || data.start_time,
        hall: data.hall || null,
        description: data.description || null,
        duration_minutes: data.duration_minutes,
        topics: data.topics || null,
        specialty_track: data.specialty_track || null,
      }
      const sessionsTable = supabase.from("sessions") as any
      const { error } = await sessionsTable.insert(insertData)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", eventId] })
      setIsAddModalOpen(false)
      resetForm()
      toast.success("Session created successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Update session mutation
  const updateSession = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const updateData = {
        session_name: data.session_name,
        session_type: data.session_type,
        session_date: data.session_date,
        start_time: data.start_time,
        end_time: data.end_time || data.start_time,
        hall: data.hall || null,
        description: data.description || null,
        duration_minutes: data.duration_minutes,
        topics: data.topics || null,
        specialty_track: data.specialty_track || null,
      }
      const sessionsTable = supabase.from("sessions") as any
      const { error } = await sessionsTable
        .update(updateData)
        .eq("id", data.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", eventId] })
      setEditingSession(null)
      resetForm()
      toast.success("Session updated successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Delete session mutation
  const deleteSession = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sessions").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", eventId] })
      setIsDeleteDialogOpen(false)
      setDeletingSession(null)
      toast.success("Session deleted successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Clear all sessions mutation
  const clearAllSessions = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("event_id", eventId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", eventId] })
      setIsClearAllDialogOpen(false)
      toast.success("All sessions cleared successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Bulk delete mutation
  const bulkDeleteSessions = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds)
      const { error } = await supabase
        .from("sessions")
        .delete()
        .in("id", ids)
      if (error) throw error
      return ids.length
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["sessions", eventId] })
      setSelectedIds(new Set())
      toast.success(`Deleted ${count} sessions`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Bulk update type mutation
  const bulkUpdateType = useMutation({
    mutationFn: async (sessionType: string) => {
      const ids = Array.from(selectedIds)
      const sessionsTable = supabase.from("sessions") as any
      const { error } = await sessionsTable
        .update({ session_type: sessionType })
        .in("id", ids)
      if (error) throw error
      return ids.length
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["sessions", eventId] })
      setSelectedIds(new Set())
      toast.success(`Updated ${count} sessions`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const resetForm = () => {
    setFormData({
      session_name: "",
      session_type: "lecture",
      session_date: selectedDate || displayDates[0] || "",
      start_time: "",
      end_time: "",
      hall: "",
      description: "",
      duration_minutes: 30,
      topics: "",
      specialty_track: "",
    })
  }

  const openEditModal = (session: Session) => {
    setFormData({
      session_name: session.session_name,
      session_type: session.session_type,
      session_date: session.session_date,
      start_time: session.start_time,
      end_time: session.end_time,
      hall: session.hall || "",
      description: session.description || "",
      duration_minutes: session.duration_minutes || 30,
      topics: session.topics || "",
      specialty_track: session.specialty_track || "",
    })
    setEditingSession(session)
  }

  const handleSubmit = () => {
    if (!formData.session_name || !formData.session_date || !formData.start_time) {
      toast.error("Please fill required fields")
      return
    }

    if (editingSession) {
      updateSession.mutate({ ...formData, id: editingSession.id })
    } else {
      createSession.mutate(formData)
    }
  }

  const formatTime = (time: string) => {
    if (!time) return ""
    const [hours, minutes] = time.split(":")
    const h = parseInt(hours)
    const ampm = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
  }

  const getTypeColor = (type: string) => {
    return SESSION_TYPES.find((t) => t.value === type)?.color || "bg-gray-500"
  }

  // Parse faculty info from description (format: "Name | Email | Phone")
  const parseFacultyInfo = (description: string | null) => {
    if (!description) return { name: "", email: "", phone: "" }
    const parts = description.split(" | ")
    return {
      name: parts[0] || "",
      email: parts[1] || "",
      phone: parts[2] || "",
    }
  }

  // Format full date for side panel
  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading program...</p>
      </div>
    )
  }

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className={cn("flex-1 space-y-6 transition-all", selectedSession && "mr-[400px]")}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Program Schedule</h1>
          <p className="text-muted-foreground">
            {sessions?.length || 0} sessions scheduled
            {uniqueTracks.length > 0 && ` in ${uniqueTracks.length} tracks`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/events/${eventId}/program/public`} target="_blank">
            <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700">
              <Globe className="h-4 w-4 mr-2" />
              Public Page
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
          <Link href={`/events/${eventId}/program/print`}>
            <Button variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </Link>
          <a href={`/api/program/export?event_id=${eventId}`} download>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </a>
          <Button variant="outline" size="sm" onClick={() => setIsImportWizardOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button
            size="sm"
            onClick={() => {
              resetForm()
              setIsAddModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Session
          </Button>
          {/* More Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setIsClearAllDialogOpen(true)}
                disabled={!sessions?.length}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Sessions
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  Change Type
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {SESSION_TYPES.map((type) => (
                  <DropdownMenuItem
                    key={type.value}
                    onClick={() => bulkUpdateType.mutate(type.value)}
                  >
                    <div className={cn("h-2 w-2 rounded-full mr-2", type.color)} />
                    {type.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => {
                if (confirm(`Delete ${selectedIds.size} sessions?`)) {
                  bulkDeleteSessions.mutate()
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto"
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <button
          onClick={() => { setSelectedType(null); setSelectedTrack(null); }}
          className={cn(
            "bg-card rounded-lg border p-3 text-left transition-all hover:shadow-md",
            !selectedType && !selectedTrack && "ring-2 ring-primary"
          )}
        >
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </button>

        {SESSION_TYPES.slice(0, 5).map((type) => {
          const count = stats.byType[type.value] || 0
          if (count === 0) return null
          const TypeIcon = type.icon
          return (
            <button
              key={type.value}
              onClick={() => setSelectedType(selectedType === type.value ? null : type.value)}
              className={cn(
                "bg-card rounded-lg border p-3 text-left transition-all hover:shadow-md",
                selectedType === type.value && "ring-2",
                selectedType === type.value && type.color.replace("bg-", "ring-")
              )}
            >
              <div className="flex items-center gap-2">
                <TypeIcon className={cn("h-4 w-4", type.color.replace("bg-", "text-"))} />
                <span className="text-xs text-muted-foreground">{type.label}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{count}</p>
            </button>
          )
        })}
      </div>

      {/* Session Type Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground mr-1">Type:</span>
        {SESSION_TYPES.map((type) => {
          const count = stats.byType[type.value] || 0
          if (count === 0) return null
          return (
            <button
              key={type.value}
              onClick={() => setSelectedType(selectedType === type.value ? null : type.value)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                selectedType === type.value
                  ? cn(type.color, "text-white")
                  : cn(type.color.replace("bg-", "bg-") + "/10", type.color.replace("bg-", "text-"), "hover:opacity-80")
              )}
            >
              {type.label}
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px]",
                selectedType === type.value ? "bg-white/20" : "bg-black/10"
              )}>
                {count}
              </span>
            </button>
          )
        })}
        {selectedType && (
          <button
            onClick={() => setSelectedType(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {/* Date Tabs */}
      {displayDates.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedDate(null)}
            className={cn(
              "flex flex-col items-center px-4 py-2 rounded-lg border transition-all min-w-[80px]",
              !selectedDate
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:bg-secondary border-border"
            )}
          >
            <span className="text-sm font-medium">All</span>
            <Badge variant="secondary" className="mt-1 text-xs">
              {sessions?.length || 0}
            </Badge>
          </button>
          {displayDates.map((date) => {
            const sessionsOnDate = sessions?.filter((s) => s.session_date === date).length || 0
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "flex flex-col items-center px-4 py-2 rounded-lg border transition-all min-w-[100px]",
                  selectedDate === date
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-secondary border-border"
                )}
              >
                <span className="text-xs opacity-80">
                  {new Date(date).toLocaleDateString("en-IN", { weekday: "short" })}
                </span>
                <span className="text-lg font-bold">
                  {new Date(date).getDate()}
                </span>
                <span className="text-xs opacity-80">
                  {new Date(date).toLocaleDateString("en-IN", { month: "short" })}
                </span>
                {sessionsOnDate > 0 && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {sessionsOnDate}
                  </Badge>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Search and Track Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions, faculty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Track Filter */}
        {uniqueTracks.length > 0 && (
          <Select
            value={selectedTrack || "all"}
            onValueChange={(value) => setSelectedTrack(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-[180px]">
              <Layers className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Tracks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tracks</SelectItem>
              {uniqueTracks.map((track) => (
                <SelectItem key={track} value={track as string}>
                  {track}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Clear filters */}
        {(selectedDate || selectedTrack || selectedType || searchQuery) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedDate(null)
              setSelectedTrack(null)
              setSelectedType(null)
              setSearchQuery("")
            }}
          >
            Clear filters
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""}
          </span>
          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg p-1 bg-muted/50">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
              title="Table View"
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
              title="Side-by-Side View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sessions Display */}
      {filteredSessions?.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No sessions yet</h3>
          <p className="text-muted-foreground mb-4">
            {selectedDate
              ? `No sessions scheduled for ${formatDate(selectedDate)}`
              : "Start building your program by adding sessions or importing a CSV"}
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => setIsImportWizardOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Session
            </Button>
          </div>
        </div>
      ) : viewMode === "table" ? (
        /* Table View with Resizable Columns */
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th style={{ width: columnWidths.checkbox }} className="p-2 text-left relative">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th style={{ width: columnWidths.time }} className="p-2 text-left text-sm font-medium relative group">
                  Time
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-primary/30"
                    onMouseDown={(e) => handleMouseDown(e, 'time')}
                  />
                </th>
                <th style={{ width: columnWidths.type }} className="p-2 text-left text-sm font-medium relative group">
                  Type
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-primary/30"
                    onMouseDown={(e) => handleMouseDown(e, 'type')}
                  />
                </th>
                <th style={{ width: columnWidths.session }} className="p-2 text-left text-sm font-medium relative group">
                  Topic
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-primary/30"
                    onMouseDown={(e) => handleMouseDown(e, 'session')}
                  />
                </th>
                <th style={{ width: columnWidths.faculty }} className="p-2 text-left text-sm font-medium relative group">
                  Faculty
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-primary/30"
                    onMouseDown={(e) => handleMouseDown(e, 'faculty')}
                  />
                </th>
                <th style={{ width: columnWidths.hall }} className="p-2 text-left text-sm font-medium relative group">
                  Hall/Track
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 group-hover:bg-primary/30"
                    onMouseDown={(e) => handleMouseDown(e, 'hall')}
                  />
                </th>
                <th style={{ width: columnWidths.actions }} className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session) => {
                const faculty = parseFacultyInfo(session.description)
                const isSelected = selectedIds.has(session.id)
                return (
                  <tr
                    key={session.id}
                    className={cn(
                      "border-b cursor-pointer hover:bg-muted/50 transition-colors",
                      isSelected && "bg-primary/5"
                    )}
                    onClick={() => setSelectedSession(session)}
                  >
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(session.id)}
                      />
                    </td>
                    <td className="p-2">
                      <div className="text-sm">
                        <div className="font-medium">{formatTime(session.start_time)}</div>
                        <div className="text-xs text-muted-foreground">{formatTime(session.end_time)}</div>
                      </div>
                    </td>
                    <td className="p-2">
                      <Badge className={cn("text-xs text-white", getTypeColor(session.session_type))}>
                        {SESSION_TYPES.find((t) => t.value === session.session_type)?.label || session.session_type}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div>
                        <p className="font-medium text-sm">{session.session_name}</p>
                        {!selectedDate && (
                          <p className="text-xs text-muted-foreground">{formatDate(session.session_date)}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <div>
                        {faculty.name && (
                          <p className="text-sm font-medium">{faculty.name}</p>
                        )}
                        {faculty.email && (
                          <p className="text-xs text-muted-foreground">{faculty.email}</p>
                        )}
                        {faculty.phone && (
                          <p className="text-xs text-muted-foreground">{faculty.phone}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="text-xs">
                        {session.hall && <p>{session.hall}</p>}
                        {session.specialty_track && (
                          <p className="text-muted-foreground">{session.specialty_track}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(session)}>
                            <Edit className="h-4 w-4 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setDeletingSession(session)
                              setIsDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : viewMode === "grid" ? (
        /* Grid/Side-by-Side View */
        (() => {
          // Group sessions by track
          const groupedByTrack: Record<string, Session[]> = {}
          filteredSessions?.forEach((session) => {
            const trackType = getTrackType(session)
            if (!groupedByTrack[trackType]) groupedByTrack[trackType] = []
            groupedByTrack[trackType].push(session)
          })

          // Sort tracks: common first, then surgery, gynecology, general
          const trackOrder = ["common", "surgery", "gynecology", "general"]
          const sortedTracks = Object.keys(groupedByTrack).sort(
            (a, b) => trackOrder.indexOf(a) - trackOrder.indexOf(b)
          )

          // Filter out empty tracks and common if showing parallel
          const parallelTracks = sortedTracks.filter(t => t !== "common" && t !== "general")
          const hasParallel = parallelTracks.length >= 2

          return (
            <div className="space-y-6">
              {/* Common Sessions (full width) */}
              {groupedByTrack["common"]?.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className={cn("px-4 py-2 text-white font-semibold", TRACK_CONFIG.common.color)}>
                    {TRACK_CONFIG.common.name} ({groupedByTrack["common"].length})
                  </div>
                  <div className="divide-y">
                    {groupedByTrack["common"].map((session) => (
                      <div
                        key={session.id}
                        className={cn("p-3 flex items-start gap-3 cursor-pointer hover:bg-purple-100 transition-colors", TRACK_CONFIG.common.bgColor)}
                        onClick={() => setSelectedSession(session)}
                      >
                        <div className="text-xs min-w-[70px]">
                          <div className="font-semibold text-gray-700">{formatTime(session.start_time)}</div>
                          <div className="text-gray-500">{formatTime(session.end_time)}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900">{session.session_name}</div>
                          {session.description && (
                            <div className="text-xs text-gray-600 mt-0.5">{session.description.split(" | ")[0]}</div>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(session)}>
                              <Edit className="h-4 w-4 mr-2" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => { setDeletingSession(session); setIsDeleteDialogOpen(true) }}>
                              <Trash2 className="h-4 w-4 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parallel Tracks (side by side) */}
              {hasParallel && (
                <div className="grid grid-cols-2 gap-4">
                  {parallelTracks.map((trackType) => {
                    const config = TRACK_CONFIG[trackType] || TRACK_CONFIG.general
                    const trackSessions = groupedByTrack[trackType] || []

                    return (
                      <div key={trackType} className="border rounded-lg overflow-hidden">
                        <div className={cn("px-4 py-2 text-white font-semibold", config.color)}>
                          {config.name} ({trackSessions.length})
                        </div>
                        <div className="divide-y max-h-[600px] overflow-auto">
                          {trackSessions.map((session) => (
                            <div
                              key={session.id}
                              className={cn("p-3 flex items-start gap-2 cursor-pointer hover:opacity-80 transition-opacity", config.bgColor)}
                              onClick={() => setSelectedSession(session)}
                            >
                              <div className="text-xs min-w-[60px]">
                                <div className="font-semibold text-gray-700">{formatTime(session.start_time)}</div>
                                <div className="text-gray-500">{formatTime(session.end_time)}</div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-900 line-clamp-2">{session.session_name}</div>
                                {session.description && (
                                  <div className="text-xs text-gray-600 mt-0.5 line-clamp-1">{session.description.split(" | ")[0]}</div>
                                )}
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditModal(session)}>
                                    <Edit className="h-4 w-4 mr-2" />Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive" onClick={() => { setDeletingSession(session); setIsDeleteDialogOpen(true) }}>
                                    <Trash2 className="h-4 w-4 mr-2" />Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* General/Other Sessions (if any) */}
              {groupedByTrack["general"]?.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className={cn("px-4 py-2 text-white font-semibold", TRACK_CONFIG.general.color)}>
                    Other Sessions ({groupedByTrack["general"].length})
                  </div>
                  <div className="divide-y">
                    {groupedByTrack["general"].map((session) => (
                      <div
                        key={session.id}
                        className={cn("p-3 flex items-start gap-3 cursor-pointer hover:bg-gray-100 transition-colors", TRACK_CONFIG.general.bgColor)}
                        onClick={() => setSelectedSession(session)}
                      >
                        <div className="text-xs min-w-[70px]">
                          <div className="font-semibold text-gray-700">{formatTime(session.start_time)}</div>
                          <div className="text-gray-500">{formatTime(session.end_time)}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900">{session.session_name}</div>
                          {session.description && (
                            <div className="text-xs text-gray-600 mt-0.5">{session.description.split(" | ")[0]}</div>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(session)}>
                              <Edit className="h-4 w-4 mr-2" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => { setDeletingSession(session); setIsDeleteDialogOpen(true) }}>
                              <Trash2 className="h-4 w-4 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()
      ) : (
        /* List View */
        <div className="space-y-3">
          {filteredSessions?.map((session) => (
            <div
              key={session.id}
              className="bg-card rounded-lg border p-4 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedSession(session)}
            >
              <div className="flex items-start gap-4">
                {/* Time Column */}
                <div className="flex flex-col items-center min-w-[80px] text-center">
                  <span className="text-lg font-bold">
                    {formatTime(session.start_time)}
                  </span>
                  <span className="text-xs text-muted-foreground">to</span>
                  <span className="text-sm text-muted-foreground">
                    {formatTime(session.end_time)}
                  </span>
                  {session.duration_minutes && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      {session.duration_minutes} min
                    </Badge>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge
                          className={cn(
                            "text-xs text-white",
                            getTypeColor(session.session_type)
                          )}
                        >
                          {SESSION_TYPES.find((t) => t.value === session.session_type)?.label || session.session_type}
                        </Badge>
                        {session.specialty_track && (
                          <Badge variant="outline" className="text-xs">
                            {session.specialty_track}
                          </Badge>
                        )}
                        {session.hall && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.hall}
                          </span>
                        )}
                        {!selectedDate && (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(session.session_date)}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">
                        {session.session_name}
                      </h3>
                      {session.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {session.description}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditModal(session)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setDeletingSession(session)
                            setIsDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Session Modal */}
      <Dialog
        open={isAddModalOpen || !!editingSession}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddModalOpen(false)
            setEditingSession(null)
            resetForm()
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSession ? "Edit Session" : "Add New Session"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Session Details */}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="session_name">Topic / Session Name *</Label>
                <Input
                  id="session_name"
                  value={formData.session_name}
                  onChange={(e) =>
                    setFormData({ ...formData, session_name: e.target.value })
                  }
                  placeholder="Enter session topic"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="session_type">Session Type</Label>
                  <Select
                    value={formData.session_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, session_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="hall">Hall / Room</Label>
                  <Input
                    id="hall"
                    value={formData.hall}
                    onChange={(e) =>
                      setFormData({ ...formData, hall: e.target.value })
                    }
                    placeholder="e.g., Hall A"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="session_date">Date *</Label>
                  <Input
                    id="session_date"
                    type="date"
                    value={formData.session_date}
                    onChange={(e) =>
                      setFormData({ ...formData, session_date: e.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="start_time">Start Time *</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) =>
                      setFormData({ ...formData, start_time: e.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) =>
                      setFormData({ ...formData, end_time: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duration_minutes: parseInt(e.target.value) || 30,
                    })
                  }
                  placeholder="30"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="topics">Speaker / Topics</Label>
                <Textarea
                  id="topics"
                  value={formData.topics}
                  onChange={(e) =>
                    setFormData({ ...formData, topics: e.target.value })
                  }
                  placeholder="Speaker name, topic details..."
                  rows={2}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Additional details about this session..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddModalOpen(false)
                setEditingSession(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createSession.isPending || updateSession.isPending}
            >
              {createSession.isPending || updateSession.isPending
                ? "Saving..."
                : editingSession
                ? "Update Session"
                : "Add Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Wizard */}
      <CSVImportWizard
        open={isImportWizardOpen}
        onOpenChange={setIsImportWizardOpen}
        eventId={eventId}
        existingSessionCount={sessions?.length || 0}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["sessions", eventId] })
          toast.success("Program imported successfully")
        }}
      />

      {/* Delete Confirmation */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete "{deletingSession?.session_name}"? This
            action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deletingSession && deleteSession.mutate(deletingSession.id)
              }
              disabled={deleteSession.isPending}
            >
              {deleteSession.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirmation */}
      <Dialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Sessions</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete all {sessions?.length || 0} sessions? This
            action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsClearAllDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => clearAllSessions.mutate()}
              disabled={clearAllSessions.isPending}
            >
              {clearAllSessions.isPending ? "Clearing..." : "Clear All Sessions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>

      {/* Session Details Side Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-[400px] bg-background border-l shadow-xl z-50 transform transition-transform duration-300 ease-in-out overflow-hidden",
          selectedSession ? "translate-x-0" : "translate-x-full"
        )}
      >
        {selectedSession && (
          <div className="h-full flex flex-col">
            {/* Panel Header */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/30">
              <h2 className="font-semibold text-lg">Session Details</h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedSession(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-auto p-4 space-y-6">
              {/* Session Type Badge */}
              <div className="flex items-center gap-2">
                <Badge className={cn("text-white", getTypeColor(selectedSession.session_type))}>
                  {SESSION_TYPES.find((t) => t.value === selectedSession.session_type)?.label || selectedSession.session_type}
                </Badge>
                {selectedSession.specialty_track && (
                  <Badge variant="outline">{selectedSession.specialty_track}</Badge>
                )}
              </div>

              {/* Topic/Name */}
              <div>
                <h3 className="text-xl font-bold leading-tight">{selectedSession.session_name}</h3>
              </div>

              {/* Time & Date */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{formatFullDate(selectedSession.session_date)}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {formatTime(selectedSession.start_time)} - {formatTime(selectedSession.end_time)}
                    {selectedSession.duration_minutes && (
                      <span className="text-muted-foreground ml-2">({selectedSession.duration_minutes} min)</span>
                    )}
                  </span>
                </div>
                {selectedSession.hall && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedSession.hall}</span>
                  </div>
                )}
              </div>

              {/* Faculty Info */}
              {selectedSession.description && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Faculty / Speaker</h4>
                  {(() => {
                    const faculty = parseFacultyInfo(selectedSession.description)
                    return (
                      <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
                        {faculty.name && (
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                              {faculty.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold">{faculty.name}</p>
                              <p className="text-xs text-muted-foreground">Speaker</p>
                            </div>
                          </div>
                        )}
                        {faculty.email && (
                          <div className="flex items-center gap-3 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <a href={`mailto:${faculty.email}`} className="text-blue-600 hover:underline break-all">
                              {faculty.email}
                            </a>
                          </div>
                        )}
                        {faculty.phone && (
                          <div className="flex items-center gap-3 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <a href={`tel:${faculty.phone}`} className="text-blue-600 hover:underline">
                              {faculty.phone}
                            </a>
                          </div>
                        )}
                        {/* Quick Actions */}
                        {(faculty.email || faculty.phone) && (
                          <div className="flex gap-2 pt-2 border-t">
                            {faculty.email && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => window.open(`mailto:${faculty.email}`, '_blank')}
                              >
                                <Mail className="h-3.5 w-3.5 mr-1.5" />
                                Email
                              </Button>
                            )}
                            {faculty.phone && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  const phone = faculty.phone?.replace(/\D/g, "")
                                  window.open(`https://wa.me/91${phone}`, '_blank')
                                }}
                              >
                                <Phone className="h-3.5 w-3.5 mr-1.5" />
                                WhatsApp
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Topics if any */}
              {selectedSession.topics && (
                <div className="space-y-2 pt-4 border-t">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Topics</h4>
                  <p className="text-sm">{selectedSession.topics}</p>
                </div>
              )}
            </div>

            {/* Panel Footer - Actions */}
            <div className="p-4 border-t bg-muted/30 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  openEditModal(selectedSession)
                  setSelectedSession(null)
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  setDeletingSession(selectedSession)
                  setIsDeleteDialogOpen(true)
                  setSelectedSession(null)
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Overlay when panel is open */}
      {selectedSession && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setSelectedSession(null)}
        />
      )}
    </div>
  )
}
