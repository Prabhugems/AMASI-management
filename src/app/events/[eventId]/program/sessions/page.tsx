"use client"

import React, { useState, useMemo, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  ColumnOrderState,
  VisibilityState,
  SortingState,
  RowSelectionState,
} from "@tanstack/react-table"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core"
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Sheet,
  ResizableSheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Presentation,
  Loader2,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Clock,
  MapPin,
  Users,
  User,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Video,
  Mic,
  Coffee,
  Award,
  BookOpen,
  MessageSquare,
  GripVertical,
  Columns3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Save,
  Download,
  Copy,
} from "lucide-react"
import { toast } from "sonner"

type Session = {
  id: string
  session_name: string
  description?: string
  session_type: string
  session_date?: string
  start_time?: string
  end_time?: string
  duration_minutes?: number
  hall?: string
  specialty_track?: string
  speakers?: string
  speakers_text?: string
  chairpersons?: string
  chairpersons_text?: string
  moderators?: string
  moderators_text?: string
}

type FacultyAssignment = {
  id: string
  session_id: string
  faculty_id: string
  faculty_name: string
  faculty_email: string
  role: string
  status: string
}

const SESSION_TYPES = [
  { value: "lecture", label: "Lecture", color: "bg-blue-100 text-blue-700 border-blue-200", icon: BookOpen },
  { value: "keynote", label: "Keynote", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Award },
  { value: "panel", label: "Panel Discussion", color: "bg-amber-100 text-amber-700 border-amber-200", icon: MessageSquare },
  { value: "live_surgery", label: "Live Surgery", color: "bg-red-100 text-red-700 border-red-200", icon: Video },
  { value: "workshop", label: "Workshop", color: "bg-green-100 text-green-700 border-green-200", icon: Users },
  { value: "ceremony", label: "Ceremony", color: "bg-pink-100 text-pink-700 border-pink-200", icon: Award },
  { value: "break", label: "Break", color: "bg-gray-100 text-gray-600 border-gray-200", icon: Coffee },
  { value: "exam", label: "Exam", color: "bg-orange-100 text-orange-700 border-orange-200", icon: BookOpen },
  { value: "session", label: "Session", color: "bg-slate-100 text-slate-700 border-slate-200", icon: Mic },
  { value: "other", label: "Other", color: "bg-gray-100 text-gray-600 border-gray-200", icon: Presentation },
]

const getSessionTypeConfig = (type: string) => {
  return SESSION_TYPES.find(t => t.value === type) || SESSION_TYPES[SESSION_TYPES.length - 1]
}

// Natural sort comparator for strings with numbers (Session 1, Session 2, Session 10, etc.)
const naturalSort = (a: string, b: string): number => {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

// Status config for speakers
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  confirmed: { label: "Accepted", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  pending: { label: "Pending", color: "bg-gray-100 text-gray-600", icon: Clock },
  invited: { label: "Invited", color: "bg-blue-100 text-blue-700", icon: Mail },
  declined: { label: "Declined", color: "bg-red-100 text-red-700", icon: AlertCircle },
  change_requested: { label: "Change Req.", color: "bg-amber-100 text-amber-700", icon: MessageSquare },
}

// Assigned Speakers Section Component
function AssignedSpeakersSection({
  sessionId,
  eventId,
  assignments,
  onPersonClick,
}: {
  sessionId: string
  eventId: string
  assignments: FacultyAssignment[] | undefined
  onPersonClick: (person: { name: string; email?: string; phone?: string; role: string }) => void
}) {
  const queryClient = useQueryClient()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const sessionAssignments = assignments?.filter(a => a.session_id === sessionId) || []

  const updateStatus = async (assignmentId: string, newStatus: string) => {
    setUpdatingId(assignmentId)
    try {
      const res = await fetch(`/api/events/${eventId}/program/faculty/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["session-assignments", eventId] })
        toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`)
      } else {
        toast.error("Failed to update status")
      }
    } catch {
      toast.error("Failed to update status")
    } finally {
      setUpdatingId(null)
    }
  }

  if (sessionAssignments.length === 0) {
    return (
      <div>
        <Label>Assigned Speakers</Label>
        <p className="text-sm text-muted-foreground mt-2">No speakers assigned yet</p>
      </div>
    )
  }

  return (
    <div>
      <Label>Assigned Speakers ({sessionAssignments.length})</Label>
      <div className="mt-2 space-y-2">
        {sessionAssignments.map((assignment) => {
          const statusConfig = STATUS_CONFIG[assignment.status] || STATUS_CONFIG.pending
          const StatusIcon = statusConfig.icon

          return (
            <div
              key={assignment.id}
              className="p-3 bg-muted rounded-lg space-y-2"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => onPersonClick({
                    name: assignment.faculty_name,
                    email: assignment.faculty_email,
                    role: assignment.role || "Speaker",
                  })}
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <User className="h-4 w-4" />
                  {assignment.faculty_name}
                </button>
                <Badge className={cn("text-xs", statusConfig.color)}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>

              {/* Admin actions */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-muted-foreground mr-1">Set status:</span>
                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                  <button
                    key={status}
                    onClick={() => updateStatus(assignment.id, status)}
                    disabled={assignment.status === status || updatingId === assignment.id}
                    className={cn(
                      "text-xs px-2 py-1 rounded border transition-colors",
                      assignment.status === status
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "hover:bg-gray-100 cursor-pointer",
                      updatingId === assignment.id && "opacity-50"
                    )}
                  >
                    {config.label}
                  </button>
                ))}
              </div>

              {/* Email link */}
              {assignment.faculty_email && (
                <a
                  href={`mailto:${assignment.faculty_email}`}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-blue-600"
                >
                  <Mail className="h-3 w-3" />
                  {assignment.faculty_email}
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Draggable header component
function DraggableHeader({ header, children }: { header: any; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: header.id })

  const canResize = header.column.getCanResize()
  const isSelectColumn = header.id === "select"

  return (
    <th
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.8 : 1,
        width: header.getSize(),
        minWidth: header.column.columnDef.minSize,
        position: "relative",
        backgroundColor: isDragging ? "#e0f2fe" : undefined,
      }}
      className="px-3 py-3 text-left text-sm font-medium text-muted-foreground bg-muted/50 border-b select-none group"
    >
      <div className="flex items-center gap-2">
        {/* Drag handle - using div to avoid nested buttons */}
        {!isSelectColumn && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-gray-200 rounded touch-none"
            role="button"
            tabIndex={0}
          >
            <GripVertical className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </div>
        )}
        {children}
      </div>
      {/* Resize handle */}
      {canResize && (
        <div
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            header.getResizeHandler()(e)
          }}
          onTouchStart={(e) => {
            e.stopPropagation()
            header.getResizeHandler()(e)
          }}
          onDoubleClick={() => header.column.resetSize()}
          className={cn(
            "absolute right-0 top-0 h-full w-4 cursor-col-resize flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            header.column.getIsResizing() && "opacity-100"
          )}
          style={{ userSelect: "none", touchAction: "none" }}
        >
          <div
            className={cn(
              "w-1 h-8 rounded bg-gray-300 hover:bg-blue-500 transition-colors",
              header.column.getIsResizing() && "bg-blue-500"
            )}
          />
        </div>
      )}
    </th>
  )
}

export default function SessionsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [globalFilter, setGlobalFilter] = useState("")
  const [trackFilter, setTrackFilter] = useState<string>("all")
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  // Bulk action states
  const [showBulkTypeDialog, setShowBulkTypeDialog] = useState(false)
  const [showBulkTrackDialog, setShowBulkTrackDialog] = useState(false)
  const [showBulkVenueDialog, setShowBulkVenueDialog] = useState(false)
  const [bulkType, setBulkType] = useState("")
  const [bulkTrack, setBulkTrack] = useState("")
  const [bulkVenue, setBulkVenue] = useState("")

  // Date filter state
  const [dateFilter, setDateFilter] = useState<string>("all")

  // Edit panel state
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [editFormData, setEditFormData] = useState<Partial<Session>>({})

  // Person contact sidebar
  const [selectedPerson, setSelectedPerson] = useState<{ name: string; email?: string; phone?: string; role: string } | null>(null)

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null)

  // Drag sensors - using MouseSensor and TouchSensor for better control
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 3 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  // Parse person contact
  const _parsePersonContact = (formatted: string, role: string = "Speaker") => {
    const match = formatted.match(/^(.+?)\s*\(([^)]+)\)$/)
    if (match) {
      const name = match[1].trim()
      const contacts = match[2].split(",").map(c => c.trim())
      const email = contacts.find(c => c.includes("@"))
      const phone = contacts.find(c => !c.includes("@") && /\d/.test(c))
      return { name, email, phone, role }
    }
    return { name: formatted.trim(), role }
  }

  // Fetch sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions-list", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sessions")
        .select("*")
        .eq("event_id", eventId)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
      return (data || []) as Session[]
    },
  })

  // Get unique tracks with natural sorting
  const uniqueTracks = useMemo(() => {
    if (!sessions) return []
    const tracks = [...new Set(sessions.map(s => s.specialty_track).filter(Boolean))] as string[]
    return tracks.sort(naturalSort)
  }, [sessions])

  // Get unique dates
  const uniqueDates = useMemo(() => {
    if (!sessions) return []
    const dates = [...new Set(sessions.map(s => s.session_date).filter(Boolean))] as string[]
    return dates.sort()
  }, [sessions])

  // Get unique venues
  const uniqueVenues = useMemo(() => {
    if (!sessions) return []
    const venues = [...new Set(sessions.map(s => s.hall).filter(Boolean))] as string[]
    return venues.sort(naturalSort)
  }, [sessions])

  // Format date for tabs
  const formatDateTab = (dateStr: string, index: number) => {
    try {
      const date = new Date(dateStr)
      return {
        label: `Day ${index + 1}`,
        sublabel: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      }
    } catch {
      return { label: dateStr, sublabel: "" }
    }
  }

  // Export to CSV function
  const exportToCSV = () => {
    const dataToExport = selectedCount > 0
      ? filteredByTrack.filter(s => selectedIds.includes(s.id))
      : filteredByTrack

    const headers = ["Session Name", "Type", "Date", "Start Time", "End Time", "Venue", "Track", "Speakers"]
    const rows = dataToExport.map(s => [
      s.session_name || "",
      SESSION_TYPES.find(t => t.value === s.session_type)?.label || s.session_type || "",
      s.session_date || "",
      s.start_time || "",
      s.end_time || "",
      s.hall || "",
      s.specialty_track || "",
      s.speakers_text || s.speakers || "",
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `sessions_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    toast.success(`Exported ${dataToExport.length} sessions to CSV`)
  }

  // Duplicate session function
  const duplicateSession = async (session: Session) => {
    const { error } = await (supabase as any)
      .from("sessions")
      .insert({
        event_id: eventId,
        session_name: `${session.session_name} (Copy)`,
        description: session.description,
        session_type: session.session_type,
        session_date: session.session_date,
        start_time: session.start_time,
        end_time: session.end_time,
        hall: session.hall,
        specialty_track: session.specialty_track,
      })

    if (error) {
      toast.error("Failed to duplicate session")
    } else {
      queryClient.invalidateQueries({ queryKey: ["sessions-list", eventId] })
      toast.success("Session duplicated")
    }
  }

  // Fetch faculty assignments for confirmation status
  const { data: assignments } = useQuery({
    queryKey: ["session-assignments", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/program/faculty`)
      if (!res.ok) return []
      return (await res.json()) as FacultyAssignment[]
    },
  })

  // Get confirmation status for a session
  const getSessionStatus = useCallback((sessionId: string) => {
    const sessionAssignments = assignments?.filter(a => a.session_id === sessionId) || []
    if (sessionAssignments.length === 0) return null

    const confirmed = sessionAssignments.filter(a => a.status === 'confirmed').length
    const total = sessionAssignments.length
    const hasDeclined = sessionAssignments.some(a => a.status === 'declined')
    const hasChangeRequested = sessionAssignments.some(a => a.status === 'change_requested')

    if (confirmed === total) return { status: 'confirmed', label: 'All Confirmed', color: 'bg-green-100 text-green-700' }
    if (hasDeclined) return { status: 'declined', label: 'Has Declined', color: 'bg-red-100 text-red-700' }
    if (hasChangeRequested) return { status: 'change', label: 'Change Requested', color: 'bg-amber-100 text-amber-700' }
    if (confirmed > 0) return { status: 'partial', label: `${confirmed}/${total} Confirmed`, color: 'bg-blue-100 text-blue-700' }
    return { status: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-600' }
  }, [assignments])

  // Format helpers
  const formatTime = (timeStr: string | undefined) => {
    if (!timeStr) return "-"
    if (timeStr.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
      const [hours, minutes] = timeStr.split(":")
      return `${hours.padStart(2, "0")}:${minutes}`
    }
    try {
      return new Date(timeStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    } catch {
      return timeStr.substring(0, 5)
    }
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-"
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short"
      })
    } catch {
      return dateStr
    }
  }

  const getDuration = (start?: string, end?: string) => {
    if (!start || !end) return null
    try {
      const [sh, sm] = start.split(":").map(Number)
      const [eh, em] = end.split(":").map(Number)
      const duration = (eh * 60 + em) - (sh * 60 + sm)
      if (duration <= 0) return null
      if (duration < 60) return `${duration}m`
      const hours = Math.floor(duration / 60)
      const mins = duration % 60
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    } catch {
      return null
    }
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Session>) => {
      if (!editingSession) return
      const { error } = await (supabase as any)
        .from("sessions")
        .update({
          session_name: data.session_name,
          description: data.description,
          session_type: data.session_type,
          session_date: data.session_date,
          start_time: data.start_time,
          end_time: data.end_time,
          hall: data.hall,
          specialty_track: data.specialty_track,
        })
        .eq("id", editingSession.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions-list", eventId] })
      toast.success("Session updated")
      setEditingSession(null)
      setEditFormData({})
    },
    onError: () => {
      toast.error("Failed to save session")
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("sessions")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions-list", eventId] })
      toast.success("Session deleted")
      setEditingSession(null)
    },
  })

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Delete faculty assignments first
      for (const id of ids) {
        await (supabase as any)
          .from("faculty_assignments")
          .delete()
          .eq("session_id", id)
      }
      // Then delete sessions
      const { error } = await (supabase as any)
        .from("sessions")
        .delete()
        .in("id", ids)
      if (error) throw error
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["sessions-list", eventId] })
      queryClient.invalidateQueries({ queryKey: ["session-assignments", eventId] })
      toast.success(`${ids.length} sessions deleted`)
      setRowSelection({})
    },
    onError: () => {
      toast.error("Failed to delete sessions")
    },
  })

  // Bulk type change mutation
  const bulkTypeChangeMutation = useMutation({
    mutationFn: async ({ ids, type }: { ids: string[]; type: string }) => {
      const { error } = await (supabase as any)
        .from("sessions")
        .update({ session_type: type })
        .in("id", ids)
      if (error) throw error
    },
    onSuccess: (_, { ids, type }) => {
      queryClient.invalidateQueries({ queryKey: ["sessions-list", eventId] })
      const typeLabel = SESSION_TYPES.find(t => t.value === type)?.label || type
      toast.success(`${ids.length} sessions changed to ${typeLabel}`)
      setRowSelection({})
      setShowBulkTypeDialog(false)
      setBulkType("")
    },
    onError: () => {
      toast.error("Failed to change session types")
    },
  })

  // Bulk track change mutation
  const bulkTrackChangeMutation = useMutation({
    mutationFn: async ({ ids, track }: { ids: string[]; track: string }) => {
      const { error } = await (supabase as any)
        .from("sessions")
        .update({ specialty_track: track })
        .in("id", ids)
      if (error) throw error
    },
    onSuccess: (_, { ids, track }) => {
      queryClient.invalidateQueries({ queryKey: ["sessions-list", eventId] })
      toast.success(`${ids.length} sessions moved to ${track}`)
      setRowSelection({})
      setShowBulkTrackDialog(false)
      setBulkTrack("")
    },
    onError: () => {
      toast.error("Failed to change track")
    },
  })

  // Bulk venue change mutation
  const bulkVenueChangeMutation = useMutation({
    mutationFn: async ({ ids, venue }: { ids: string[]; venue: string }) => {
      const { error } = await (supabase as any)
        .from("sessions")
        .update({ hall: venue })
        .in("id", ids)
      if (error) throw error
    },
    onSuccess: (_, { ids, venue }) => {
      queryClient.invalidateQueries({ queryKey: ["sessions-list", eventId] })
      toast.success(`${ids.length} sessions moved to ${venue}`)
      setRowSelection({})
      setShowBulkVenueDialog(false)
      setBulkVenue("")
    },
    onError: () => {
      toast.error("Failed to change venue")
    },
  })

  // Get selected session IDs
  const selectedIds = Object.keys(rowSelection).filter(id => rowSelection[id])
  const selectedCount = selectedIds.length

  // Open edit panel
  const openEditPanel = (session: Session) => {
    setEditingSession(session)
    setEditFormData({ ...session })
  }

  // Column definitions
  const columns: ColumnDef<Session>[] = useMemo(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      size: 40,
      minSize: 40,
      enableResizing: false,
      enableSorting: false,
    },
    {
      id: "session_name",
      accessorKey: "session_name",
      header: "Session",
      size: 300,
      minSize: 150,
      cell: ({ row }) => {
        const session = row.original
        return (
          <div>
            <button
              onClick={() => openEditPanel(session)}
              className="font-medium text-left hover:text-blue-600 hover:underline"
            >
              {session.session_name}
            </button>
            {(session.speakers_text || session.speakers) && (
              <div className="flex items-center gap-1 mt-1">
                <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  {(session.speakers_text || session.speakers || "").split(" | ").slice(0, 2).map((speaker, i) => (
                    <span key={i}>{speaker.split("(")[0].trim()}{i < 1 ? "," : ""}</span>
                  ))}
                  {(session.speakers_text || session.speakers || "").split(" | ").length > 2 && (
                    <span>+{(session.speakers_text || session.speakers || "").split(" | ").length - 2}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      },
    },
    {
      id: "session_type",
      accessorKey: "session_type",
      header: "Type",
      size: 130,
      minSize: 100,
      cell: ({ row }) => {
        const typeConfig = getSessionTypeConfig(row.original.session_type)
        const TypeIcon = typeConfig.icon
        return (
          <Badge className={cn("border capitalize text-xs", typeConfig.color)}>
            <TypeIcon className="h-3 w-3 mr-1" />
            {typeConfig.label}
          </Badge>
        )
      },
    },
    {
      id: "session_date",
      accessorKey: "session_date",
      header: "Date",
      size: 110,
      minSize: 90,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          {formatDate(row.original.session_date)}
        </div>
      ),
    },
    {
      id: "time",
      accessorFn: (row) => `${row.start_time || ""}-${row.end_time || ""}`,
      header: "Time",
      size: 120,
      minSize: 90,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span>{formatTime(row.original.start_time)} - {formatTime(row.original.end_time)}</span>
        </div>
      ),
    },
    {
      id: "duration",
      accessorFn: (row) => {
        if (!row.start_time || !row.end_time) return 0
        try {
          const [sh, sm] = row.start_time.split(":").map(Number)
          const [eh, em] = row.end_time.split(":").map(Number)
          return (eh * 60 + em) - (sh * 60 + sm)
        } catch {
          return 0
        }
      },
      header: "Duration",
      size: 80,
      minSize: 60,
      cell: ({ row }) => {
        const duration = getDuration(row.original.start_time, row.original.end_time)
        return duration ? (
          <span className="text-sm text-muted-foreground">{duration}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      },
    },
    {
      id: "hall",
      accessorKey: "hall",
      header: "Venue",
      size: 120,
      minSize: 80,
      cell: ({ row }) => row.original.hall ? (
        <div className="flex items-center gap-1 text-sm">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          {row.original.hall}
        </div>
      ) : <span className="text-muted-foreground">-</span>,
    },
    {
      id: "specialty_track",
      accessorKey: "specialty_track",
      header: "Track",
      size: 140,
      minSize: 100,
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.specialty_track || ""
        const b = rowB.original.specialty_track || ""
        return naturalSort(a, b)
      },
      cell: ({ row }) => row.original.specialty_track ? (
        <span className="text-sm">{row.original.specialty_track}</span>
      ) : <span className="text-muted-foreground">-</span>,
    },
    {
      id: "status",
      header: "Status",
      size: 130,
      minSize: 100,
      cell: ({ row }) => {
        const status = getSessionStatus(row.original.id)
        return status ? (
          <Badge className={cn("text-xs", status.color)}>
            {status.status === 'confirmed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {status.label}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">No speakers</span>
        )
      },
    },
    {
      id: "actions",
      header: "",
      size: 50,
      minSize: 50,
      enableResizing: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditPanel(row.original)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => duplicateSession(row.original)}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (confirm("Delete this session?")) {
                  deleteMutation.mutate(row.original.id)
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [getSessionStatus])

  // Initialize column order
  const defaultColumnOrder = columns.map(c => c.id as string)
  const currentColumnOrder = columnOrder.length ? columnOrder : defaultColumnOrder

  // Filter sessions by track and date
  const filteredByTrack = useMemo(() => {
    if (!sessions) return []
    return sessions.filter(s => {
      const matchesTrack = trackFilter === "all" || s.specialty_track === trackFilter
      const matchesDate = dateFilter === "all" || s.session_date === dateFilter
      return matchesTrack && matchesDate
    })
  }, [sessions, trackFilter, dateFilter])

  // Table instance
  const table = useReactTable({
    data: filteredByTrack,
    columns,
    state: {
      globalFilter,
      sorting,
      columnVisibility,
      columnOrder: currentColumnOrder,
      rowSelection,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    enableRowSelection: true,
    getRowId: (row) => row.id,
  })

  // Handle column reorder - use ref to avoid stale closure
  const columnOrderRef = useRef(currentColumnOrder)
  columnOrderRef.current = currentColumnOrder

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (active && over && active.id !== over.id) {
      const order = columnOrderRef.current
      const oldIndex = order.indexOf(active.id as string)
      const newIndex = order.indexOf(over.id as string)
      setColumnOrder(arrayMove(order, oldIndex, newIndex))
    }
  }, [])

  // Get column label for drag overlay
  const getColumnLabel = (id: string) => {
    const labels: Record<string, string> = {
      select: "",
      session_name: "Session",
      session_type: "Type",
      session_date: "Date",
      time: "Time",
      duration: "Duration",
      hall: "Venue",
      specialty_track: "Track",
      status: "Status",
      actions: "",
    }
    return labels[id] || id
  }

  // Stats
  const stats = useMemo(() => {
    if (!sessions || !assignments) return null

    const sessionIds = new Set(sessions.map(s => s.id))
    const relevantAssignments = assignments.filter(a => sessionIds.has(a.session_id))
    const sessionsWithAssignments = new Set(relevantAssignments.map(a => a.session_id))
    const confirmedSessions = sessions.filter(s => {
      const status = getSessionStatus(s.id)
      return status?.status === 'confirmed'
    }).length

    return {
      total: sessions.length,
      withSpeakers: sessionsWithAssignments.size,
      confirmed: confirmedSessions,
      pending: sessionsWithAssignments.size - confirmedSessions,
    }
  }, [sessions, assignments, getSessionStatus])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Main table area */}
      <div className={cn("flex-1 p-6 space-y-4 overflow-auto", editingSession && "pr-0")}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Sessions</h1>
            <p className="text-muted-foreground">Manage program sessions - drag columns to reorder</p>
          </div>
          <Button onClick={() => {
            const newSession: Session = {
              id: "new",
              session_name: "",
              session_type: "session",
            }
            openEditPanel(newSession)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Session
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Presentation className="h-4 w-4" />
                <span className="text-sm">Total</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-sm">With Speakers</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold mt-1">{stats.withSpeakers}</p>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">Confirmed</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold mt-1 text-green-600">{stats.confirmed}</p>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Pending</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold mt-1 text-amber-600">{stats.pending}</p>
            </div>
          </div>
        )}

        {/* Date Tabs */}
        {uniqueDates.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Button
              variant={dateFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setDateFilter("all")}
            >
              All Days
            </Button>
            {uniqueDates.map((date, index) => {
              const { label, sublabel } = formatDateTab(date, index)
              return (
                <Button
                  key={date}
                  variant={dateFilter === date ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter(date)}
                  className="flex flex-col items-center py-1 h-auto"
                >
                  <span className="text-xs font-medium">{label}</span>
                  <span className="text-xs opacity-70">{sublabel}</span>
                </Button>
              )
            })}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Track filter dropdown */}
          {uniqueTracks.length > 0 && (
            <Select value={trackFilter} onValueChange={setTrackFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Track" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tracks ({uniqueTracks.length})</SelectItem>
                {uniqueTracks.map(track => (
                  <SelectItem key={track} value={track}>{track}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Column visibility dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table.getAllLeafColumns().filter(col => col.id !== "actions").map(column => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id === "session_name" ? "Session" :
                   column.id === "session_type" ? "Type" :
                   column.id === "session_date" ? "Date" :
                   column.id === "time" ? "Time" :
                   column.id === "duration" ? "Duration" :
                   column.id === "specialty_track" ? "Track" :
                   column.id === "hall" ? "Venue" :
                   column.id === "status" ? "Status" :
                   column.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export button */}
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </Button>

          {(globalFilter || trackFilter !== "all" || dateFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setGlobalFilter("")
                setTrackFilter("all")
                setDateFilter("all")
              }}
            >
              Clear filters
            </Button>
          )}

          <div className="text-sm text-muted-foreground ml-auto">
            {table.getFilteredRowModel().rows.length} of {sessions?.length || 0} sessions
            {dateFilter !== "all" && ` (${formatDateTab(dateFilter, uniqueDates.indexOf(dateFilter)).label})`}
            {trackFilter !== "all" && ` - ${trackFilter}`}
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={true}
                onCheckedChange={() => setRowSelection({})}
              />
              <span className="font-medium text-blue-900">
                {selectedCount} session{selectedCount > 1 ? "s" : ""} selected
              </span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkTypeDialog(true)}
              >
                Change Type
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkTrackDialog(true)}
              >
                Change Track
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkVenueDialog(true)}
              >
                Change Venue
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm(`Delete ${selectedCount} session${selectedCount > 1 ? "s" : ""}? This cannot be undone.`)) {
                    bulkDeleteMutation.mutate(selectedIds)
                  }
                }}
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRowSelection({})}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToHorizontalAxis]}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <table className="w-full" style={{ width: table.getCenterTotalSize() }}>
                <thead>
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      <SortableContext
                        items={currentColumnOrder}
                        strategy={horizontalListSortingStrategy}
                      >
                        {headerGroup.headers.map(header => (
                          <DraggableHeader key={header.id} header={header}>
                            {header.column.getCanSort() ? (
                              <button
                                className="flex items-center gap-1 hover:text-foreground"
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {header.column.getIsSorted() === "asc" && <ArrowUp className="h-3 w-3" />}
                                {header.column.getIsSorted() === "desc" && <ArrowDown className="h-3 w-3" />}
                                {!header.column.getIsSorted() && (
                                  <ArrowUpDown className="h-3 w-3 opacity-30" />
                                )}
                              </button>
                            ) : (
                              flexRender(header.column.columnDef.header, header.getContext())
                            )}
                          </DraggableHeader>
                        ))}
                      </SortableContext>
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="text-center py-12">
                        <Presentation className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No sessions found</h3>
                        <p className="text-muted-foreground">Add your first session or adjust filters</p>
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map(row => (
                      <tr
                        key={row.id}
                        className={cn(
                          "border-b hover:bg-muted/30 transition-colors",
                          editingSession?.id === row.original.id && "bg-blue-50"
                        )}
                      >
                        {row.getVisibleCells().map(cell => (
                          <td
                            key={cell.id}
                            style={{ width: cell.column.getSize() }}
                            className="px-3 py-3 align-top"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Drag overlay */}
              <DragOverlay>
                {activeId ? (
                  <div className="px-4 py-2 bg-white border-2 border-blue-500 rounded shadow-lg font-medium text-sm">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-blue-500" />
                      {getColumnLabel(activeId)}
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      </div>

      {/* Side-by-side Edit Panel */}
      {editingSession && (
        <div className="w-[400px] border-l bg-card flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">
              {editingSession.id === "new" ? "New Session" : "Edit Session"}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setEditingSession(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <Label>Session Name *</Label>
              <Input
                value={editFormData.session_name || ""}
                onChange={(e) => setEditFormData({ ...editFormData, session_name: e.target.value })}
                placeholder="Enter session name"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={editFormData.description || ""}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                placeholder="Brief description"
                rows={3}
              />
            </div>

            <div>
              <Label>Type</Label>
              <Select
                value={editFormData.session_type || "session"}
                onValueChange={(v) => setEditFormData({ ...editFormData, session_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={editFormData.session_date || ""}
                onChange={(e) => setEditFormData({ ...editFormData, session_date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={editFormData.start_time || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={editFormData.end_time || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, end_time: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Venue/Hall</Label>
              <Input
                value={editFormData.hall || ""}
                onChange={(e) => setEditFormData({ ...editFormData, hall: e.target.value })}
                placeholder="Hall A, Room 101, etc."
              />
            </div>

            <div>
              <Label>Track</Label>
              <Input
                value={editFormData.specialty_track || ""}
                onChange={(e) => setEditFormData({ ...editFormData, specialty_track: e.target.value })}
                placeholder="GI Surgery, Hepatobiliary, etc."
              />
            </div>

            {/* Show assigned speakers with status */}
            {editingSession.id !== "new" && (
              <AssignedSpeakersSection
                sessionId={editingSession.id}
                eventId={eventId}
                assignments={assignments}
                onPersonClick={setSelectedPerson}
              />
            )}
          </div>

          <div className="p-4 border-t flex gap-2">
            {editingSession.id !== "new" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Delete this session?")) {
                    deleteMutation.mutate(editingSession.id)
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setEditingSession(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingSession.id === "new") {
                  // Create new session
                  (supabase as any)
                    .from("sessions")
                    .insert({
                      event_id: eventId,
                      session_name: editFormData.session_name,
                      description: editFormData.description,
                      session_type: editFormData.session_type || "session",
                      session_date: editFormData.session_date,
                      start_time: editFormData.start_time,
                      end_time: editFormData.end_time,
                      hall: editFormData.hall,
                      specialty_track: editFormData.specialty_track,
                    })
                    .then(({ error }: any) => {
                      if (error) {
                        toast.error("Failed to create session")
                      } else {
                        queryClient.invalidateQueries({ queryKey: ["sessions-list", eventId] })
                        toast.success("Session created")
                        setEditingSession(null)
                        setEditFormData({})
                      }
                    })
                } else {
                  saveMutation.mutate(editFormData)
                }
              }}
              disabled={!editFormData.session_name?.trim() || saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* Person Contact Sheet */}
      <Sheet open={!!selectedPerson} onOpenChange={() => setSelectedPerson(null)}>
        <ResizableSheetContent defaultWidth={400} minWidth={320} maxWidth={700} storageKey="sessions-sheet-width" className="">
          {selectedPerson && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {selectedPerson.name}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <Badge variant="secondary">{selectedPerson.role}</Badge>
                <div className="space-y-4 mt-6">
                  {selectedPerson.email && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium">Email</p>
                        <a href={`mailto:${selectedPerson.email}`} className="text-blue-600 hover:underline font-medium">
                          {selectedPerson.email}
                        </a>
                      </div>
                    </div>
                  )}
                  {selectedPerson.phone && (
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium">Phone</p>
                        <a href={`tel:${selectedPerson.phone}`} className="text-green-600 hover:underline font-medium">
                          {selectedPerson.phone}
                        </a>
                      </div>
                    </div>
                  )}
                  {!selectedPerson.email && !selectedPerson.phone && (
                    <p className="text-muted-foreground text-sm">No contact information available</p>
                  )}
                </div>
              </div>
            </>
          )}
        </ResizableSheetContent>
      </Sheet>

      {/* Bulk Type Change Dialog */}
      <Dialog open={showBulkTypeDialog} onOpenChange={setShowBulkTypeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Session Type</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Change the type for {selectedCount} selected session{selectedCount > 1 ? "s" : ""}.
            </p>
            <Select value={bulkType} onValueChange={setBulkType}>
              <SelectTrigger>
                <SelectValue placeholder="Select new type" />
              </SelectTrigger>
              <SelectContent>
                {SESSION_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkTypeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => bulkTypeChangeMutation.mutate({ ids: selectedIds, type: bulkType })}
              disabled={!bulkType || bulkTypeChangeMutation.isPending}
            >
              {bulkTypeChangeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Change Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Track Change Dialog */}
      <Dialog open={showBulkTrackDialog} onOpenChange={setShowBulkTrackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Track</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Move {selectedCount} selected session{selectedCount > 1 ? "s" : ""} to a different track.
            </p>
            <Select value={bulkTrack} onValueChange={setBulkTrack}>
              <SelectTrigger>
                <SelectValue placeholder="Select track" />
              </SelectTrigger>
              <SelectContent>
                {uniqueTracks.map(track => (
                  <SelectItem key={track} value={track}>
                    {track}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Or enter a new track name:
            </p>
            <Input
              value={bulkTrack}
              onChange={(e) => setBulkTrack(e.target.value)}
              placeholder="New track name"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkTrackDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => bulkTrackChangeMutation.mutate({ ids: selectedIds, track: bulkTrack })}
              disabled={!bulkTrack || bulkTrackChangeMutation.isPending}
            >
              {bulkTrackChangeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Change Track
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Venue Change Dialog */}
      <Dialog open={showBulkVenueDialog} onOpenChange={setShowBulkVenueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Venue</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Move {selectedCount} selected session{selectedCount > 1 ? "s" : ""} to a different venue.
            </p>
            <Select value={bulkVenue} onValueChange={setBulkVenue}>
              <SelectTrigger>
                <SelectValue placeholder="Select venue" />
              </SelectTrigger>
              <SelectContent>
                {uniqueVenues.map(venue => (
                  <SelectItem key={venue} value={venue}>
                    {venue}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Or enter a new venue name:
            </p>
            <Input
              value={bulkVenue}
              onChange={(e) => setBulkVenue(e.target.value)}
              placeholder="New venue name"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkVenueDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => bulkVenueChangeMutation.mutate({ ids: selectedIds, venue: bulkVenue })}
              disabled={!bulkVenue || bulkVenueChangeMutation.isPending}
            >
              {bulkVenueChangeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Change Venue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
