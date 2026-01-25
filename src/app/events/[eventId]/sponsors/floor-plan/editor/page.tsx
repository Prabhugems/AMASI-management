"use client"

import { useState, useRef, useMemo, useCallback, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Grid3X3,
  Loader2,
  ZoomIn,
  ZoomOut,
  Building2,
  Save,
  X,
  RotateCcw,
  Download,
  Plus,
  Trash2,
  ArrowLeft,
  Lock,
  Unlock,
  Layers,
  LayoutGrid,
  DoorOpen,
  Camera,
  Ticket,
  Info,
  Mic2,
  Coffee,
  Utensils,
  Sparkles,
  Copy,
  Rows3,
  Edit3,
  Trash,
  CheckSquare,
  Square,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Sponsor = {
  id: string
  name: string
  logo_url: string | null
  tier_id: string | null
}

type Stall = {
  id: string
  stall_number: string
  stall_name: string | null
  size: string | null
  location: string | null
  status: string
  sponsor_id: string | null
  position_x: number
  position_y: number
  width: number
  height: number
  sponsors?: Sponsor | null
}

type SpecialElement = {
  id: string
  type: "entry" | "exit" | "photo_booth" | "tickets" | "info" | "stage" | "food" | "coffee"
  label: string
  x: number
  y: number
  width: number
  height: number
}

const GRID_SIZE = 20
const STALL_UNIT = 3

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  available: { bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-700" },
  reserved: { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-700" },
  assigned: { bg: "bg-sky-50", border: "border-sky-400", text: "text-sky-700" },
  setup_complete: { bg: "bg-violet-50", border: "border-violet-400", text: "text-violet-700" },
}

const SPECIAL_ELEMENTS_CONFIG: Record<string, { icon: any; bg: string; border: string; label: string }> = {
  entry: { icon: DoorOpen, bg: "bg-green-100", border: "border-green-500", label: "Entry" },
  exit: { icon: DoorOpen, bg: "bg-red-100", border: "border-red-500", label: "Exit" },
  photo_booth: { icon: Camera, bg: "bg-pink-100", border: "border-pink-500", label: "Photo Booth" },
  tickets: { icon: Ticket, bg: "bg-purple-100", border: "border-purple-500", label: "Tickets" },
  info: { icon: Info, bg: "bg-blue-100", border: "border-blue-500", label: "Info Desk" },
  stage: { icon: Mic2, bg: "bg-orange-100", border: "border-orange-500", label: "Stage" },
  food: { icon: Utensils, bg: "bg-yellow-100", border: "border-yellow-500", label: "Food Court" },
  coffee: { icon: Coffee, bg: "bg-amber-100", border: "border-amber-600", label: "Cafe" },
}

const STALL_SIZES = ["3x3", "6x3", "9x3", "6x6", "9x6"]
const LOCATIONS = ["Exhibition Hall", "Hall A", "Hall B", "Hall C", "Outdoor", "Lobby"]

export default function FloorPlanEditorPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()
  const floorPlanRef = useRef<HTMLDivElement>(null)

  // State
  const [zoom, setZoom] = useState(1)
  const [selectedStalls, setSelectedStalls] = useState<Set<string>>(new Set())
  const [draggedStall, setDraggedStall] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [lockedStalls, setLockedStalls] = useState<Set<string>>(new Set())
  const [selectedLocation, setSelectedLocation] = useState("All")

  // Special elements
  const [specialElements, setSpecialElements] = useState<SpecialElement[]>([])
  const [selectedElement, setSelectedElement] = useState<SpecialElement | null>(null)
  const [draggedElement, setDraggedElement] = useState<string | null>(null)

  // Dialogs
  const [showRowGenerator, setShowRowGenerator] = useState(false)
  const [showAddElement, setShowAddElement] = useState(false)
  const [showLayoutGenerator, setShowLayoutGenerator] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEditStall, setShowEditStall] = useState(false)

  // Edit stall form
  const [editForm, setEditForm] = useState({
    stall_number: "",
    size: "3x3",
    location: "Exhibition Hall",
    status: "available",
  })

  // Row generator form
  const [rowForm, setRowForm] = useState({
    prefix: "A",
    startNum: 1,
    count: 10,
    size: "3x3",
    location: "Hall A",
  })

  // Layout generator form
  const [layoutForm, setLayoutForm] = useState({
    totalStalls: 50,
    columns: 10,
    shape: "square" as "square" | "u-shape" | "l-shape" | "rectangle",
    size: "3x3",
    location: "Exhibition Hall",
    startNum: 1,
  })

  // Fetch stalls
  const { data: stallsRaw, isLoading } = useQuery({
    queryKey: ["stalls-editor", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("stalls")
        .select("*")
        .eq("event_id", eventId)
        .order("stall_number")
      return (data || []) as Stall[]
    },
  })

  // Fetch sponsors
  const { data: sponsorsData } = useQuery({
    queryKey: ["sponsors-editor", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sponsors")
        .select("id, name, logo_url, tier_id")
        .eq("event_id", eventId)
      return (data || []) as Sponsor[]
    },
  })

  // Fetch tiers
  const { data: tiers } = useQuery({
    queryKey: ["sponsor-tiers", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sponsor_tiers")
        .select("id, name, color")
        .eq("event_id", eventId)
      return (data || []) as { id: string; name: string; color: string }[]
    },
  })

  // Map sponsors and tiers
  const sponsorMap = useMemo(() => {
    if (!sponsorsData) return {}
    return sponsorsData.reduce((acc, s) => { acc[s.id] = s; return acc }, {} as Record<string, Sponsor>)
  }, [sponsorsData])

  const tierMap = useMemo(() => {
    if (!tiers) return {}
    return tiers.reduce((acc, t) => { acc[t.id] = { name: t.name, color: t.color }; return acc }, {} as Record<string, { name: string; color: string }>)
  }, [tiers])

  // Combine stalls
  const stalls = useMemo(() => {
    if (!stallsRaw) return []
    return stallsRaw.map(stall => ({
      ...stall,
      sponsors: stall.sponsor_id ? sponsorMap[stall.sponsor_id] || null : null
    })) as Stall[]
  }, [stallsRaw, sponsorMap])

  // Get selected stall (first one if multiple)
  const selectedStall = useMemo(() => {
    if (selectedStalls.size === 0) return null
    const firstId = Array.from(selectedStalls)[0]
    return stalls.find(s => s.id === firstId) || null
  }, [selectedStalls, stalls])

  // Locations
  const locations = useMemo(() => {
    const locs = new Set(stalls.map(s => s.location || "Unassigned"))
    return ["All", ...Array.from(locs)]
  }, [stalls])

  // Filter stalls
  const filteredStalls = useMemo(() => {
    if (selectedLocation === "All") return stalls
    return stalls.filter(s => (s.location || "Unassigned") === selectedLocation)
  }, [stalls, selectedLocation])

  // Initialize positions
  useEffect(() => {
    if (stalls.length > 0 && Object.keys(positions).length === 0) {
      const initialPositions: Record<string, { x: number; y: number }> = {}
      stalls.forEach((stall) => {
        initialPositions[stall.id] = {
          x: stall.position_x * GRID_SIZE,
          y: stall.position_y * GRID_SIZE
        }
      })
      setPositions(initialPositions)
    }
  }, [stalls])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedStalls.size > 0 && !showEditStall) {
          e.preventDefault()
          setShowDeleteConfirm(true)
        }
      }
      if (e.key === "Escape") {
        setSelectedStalls(new Set())
        setSelectedElement(null)
      }
      if (e.key === "a" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSelectedStalls(new Set(filteredStalls.map(s => s.id)))
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedStalls, filteredStalls, showEditStall])

  // Save positions
  const savePositions = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(positions).map(([id, pos]) => ({
        id,
        position_x: Math.round(pos.x / GRID_SIZE),
        position_y: Math.round(pos.y / GRID_SIZE),
      }))
      for (const update of updates) {
        await (supabase as any).from("stalls").update({
          position_x: update.position_x,
          position_y: update.position_y,
          updated_at: new Date().toISOString()
        }).eq("id", update.id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stalls-editor", eventId] })
      setHasChanges(false)
      toast.success("Layout saved!")
    },
    onError: () => toast.error("Failed to save"),
  })

  // Delete selected stalls
  const deleteStalls = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await (supabase as any).from("stalls").delete().eq("id", id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stalls-editor", eventId] })
      setSelectedStalls(new Set())
      setShowDeleteConfirm(false)
      toast.success("Stalls deleted!")
    },
    onError: () => toast.error("Failed to delete"),
  })

  // Clear all stalls
  const clearAllStalls = useMutation({
    mutationFn: async () => {
      await (supabase as any).from("stalls").delete().eq("event_id", eventId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stalls-editor", eventId] })
      setPositions({})
      setSelectedStalls(new Set())
      setShowClearConfirm(false)
      toast.success("All stalls cleared!")
    },
    onError: () => toast.error("Failed to clear stalls"),
  })

  // Update stall
  const updateStall = useMutation({
    mutationFn: async (data: { id: string; stall_number: string; size: string; location: string; status: string }) => {
      const { error } = await (supabase as any).from("stalls").update({
        stall_number: data.stall_number,
        size: data.size,
        location: data.location,
        status: data.status,
        updated_at: new Date().toISOString()
      }).eq("id", data.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stalls-editor", eventId] })
      setShowEditStall(false)
      toast.success("Stall updated!")
    },
    onError: () => toast.error("Failed to update stall"),
  })

  // Duplicate stall
  const duplicateStall = useMutation({
    mutationFn: async (stall: Stall) => {
      const pos = positions[stall.id] || { x: 100, y: 100 }
      const { error } = await (supabase as any).from("stalls").insert({
        event_id: eventId,
        stall_number: `${stall.stall_number}-copy`,
        size: stall.size,
        location: stall.location,
        status: "available",
        position_x: Math.round((pos.x + 140) / GRID_SIZE),
        position_y: Math.round(pos.y / GRID_SIZE),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stalls-editor", eventId] })
      toast.success("Stall duplicated!")
    },
    onError: () => toast.error("Failed to duplicate"),
  })

  // Create row of stalls
  const createStallRow = useMutation({
    mutationFn: async () => {
      const stallsToCreate = []
      const stallWidth = 120
      const stallHeight = 96
      const spacing = 20

      for (let i = 0; i < rowForm.count; i++) {
        const num = rowForm.startNum + i
        const stallNumber = `${rowForm.prefix}${num}`
        const posX = 100 + i * (stallWidth + spacing)
        const posY = 150

        stallsToCreate.push({
          event_id: eventId,
          stall_number: stallNumber,
          size: rowForm.size,
          location: rowForm.location,
          status: "available",
          position_x: Math.round(posX / GRID_SIZE),
          position_y: Math.round(posY / GRID_SIZE),
        })
      }

      const { error } = await (supabase as any).from("stalls").insert(stallsToCreate)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stalls-editor", eventId] })
      setShowRowGenerator(false)
      setPositions({})
      toast.success(`Created ${rowForm.count} stalls!`)
      setRowForm(prev => ({
        ...prev,
        prefix: String.fromCharCode(prev.prefix.charCodeAt(0) + 1),
        startNum: 1,
      }))
    },
    onError: () => toast.error("Failed to create stalls"),
  })

  // Generate entire layout
  const generateLayout = useMutation({
    mutationFn: async () => {
      const stallsToCreate: any[] = []
      const stallWidth = 120
      const stallHeight = 96
      const spacing = 20
      const startX = 100
      const startY = 150

      const cols = layoutForm.columns
      let stallNum = layoutForm.startNum

      if (layoutForm.shape === "square" || layoutForm.shape === "rectangle") {
        const rows = Math.ceil(layoutForm.totalStalls / cols)
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            if (stallNum >= layoutForm.startNum + layoutForm.totalStalls) break
            stallsToCreate.push({
              event_id: eventId,
              stall_number: `${stallNum}`,
              size: layoutForm.size,
              location: layoutForm.location,
              status: "available",
              position_x: Math.round((startX + col * (stallWidth + spacing)) / GRID_SIZE),
              position_y: Math.round((startY + row * (stallHeight + spacing)) / GRID_SIZE),
            })
            stallNum++
          }
        }
      } else if (layoutForm.shape === "u-shape") {
        const sideRows = Math.max(2, Math.floor(layoutForm.totalStalls / (cols + 2)))
        // Left column
        for (let row = 0; row < sideRows && stallNum < layoutForm.startNum + layoutForm.totalStalls; row++) {
          stallsToCreate.push({
            event_id: eventId, stall_number: `${stallNum}`, size: layoutForm.size, location: layoutForm.location, status: "available",
            position_x: Math.round(startX / GRID_SIZE), position_y: Math.round((startY + row * (stallHeight + spacing)) / GRID_SIZE),
          })
          stallNum++
        }
        // Bottom row
        for (let col = 0; col < cols && stallNum < layoutForm.startNum + layoutForm.totalStalls; col++) {
          stallsToCreate.push({
            event_id: eventId, stall_number: `${stallNum}`, size: layoutForm.size, location: layoutForm.location, status: "available",
            position_x: Math.round((startX + col * (stallWidth + spacing)) / GRID_SIZE), position_y: Math.round((startY + sideRows * (stallHeight + spacing)) / GRID_SIZE),
          })
          stallNum++
        }
        // Right column
        for (let row = sideRows - 1; row >= 0 && stallNum < layoutForm.startNum + layoutForm.totalStalls; row--) {
          stallsToCreate.push({
            event_id: eventId, stall_number: `${stallNum}`, size: layoutForm.size, location: layoutForm.location, status: "available",
            position_x: Math.round((startX + (cols - 1) * (stallWidth + spacing)) / GRID_SIZE), position_y: Math.round((startY + row * (stallHeight + spacing)) / GRID_SIZE),
          })
          stallNum++
        }
      } else if (layoutForm.shape === "l-shape") {
        const verticalCount = Math.floor(layoutForm.totalStalls / 2)
        // Left column
        for (let row = 0; row < verticalCount && stallNum < layoutForm.startNum + layoutForm.totalStalls; row++) {
          stallsToCreate.push({
            event_id: eventId, stall_number: `${stallNum}`, size: layoutForm.size, location: layoutForm.location, status: "available",
            position_x: Math.round(startX / GRID_SIZE), position_y: Math.round((startY + row * (stallHeight + spacing)) / GRID_SIZE),
          })
          stallNum++
        }
        // Bottom row
        for (let col = 1; col < cols && stallNum < layoutForm.startNum + layoutForm.totalStalls; col++) {
          stallsToCreate.push({
            event_id: eventId, stall_number: `${stallNum}`, size: layoutForm.size, location: layoutForm.location, status: "available",
            position_x: Math.round((startX + col * (stallWidth + spacing)) / GRID_SIZE), position_y: Math.round((startY + (verticalCount - 1) * (stallHeight + spacing)) / GRID_SIZE),
          })
          stallNum++
        }
      }

      const { error } = await (supabase as any).from("stalls").insert(stallsToCreate)
      if (error) throw error
      return stallsToCreate.length
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["stalls-editor", eventId] })
      setShowLayoutGenerator(false)
      setPositions({})
      toast.success(`Created ${count} stalls!`)
    },
    onError: () => toast.error("Failed to generate layout"),
  })

  // Snap to grid
  const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE

  // Handle stall click
  const handleStallClick = (e: React.MouseEvent, stall: Stall) => {
    if (e.shiftKey) {
      // Multi-select with shift
      setSelectedStalls(prev => {
        const newSet = new Set(prev)
        if (newSet.has(stall.id)) newSet.delete(stall.id)
        else newSet.add(stall.id)
        return newSet
      })
    } else {
      setSelectedStalls(new Set([stall.id]))
    }
    setSelectedElement(null)
  }

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent, stall: Stall) => {
    if (lockedStalls.has(stall.id)) return
    e.preventDefault()
    const pos = positions[stall.id] || { x: 0, y: 0 }
    setDraggedStall(stall.id)
    if (!selectedStalls.has(stall.id)) {
      setSelectedStalls(new Set([stall.id]))
    }
    setSelectedElement(null)
    setDragOffset({ x: e.clientX - pos.x * zoom, y: e.clientY - pos.y * zoom })
  }

  const handleDrag = useCallback((e: MouseEvent) => {
    if (draggedStall) {
      const newX = snapToGrid((e.clientX - dragOffset.x) / zoom)
      const newY = snapToGrid((e.clientY - dragOffset.y) / zoom)
      setPositions(prev => ({ ...prev, [draggedStall]: { x: Math.max(0, newX), y: Math.max(0, newY) } }))
      setHasChanges(true)
    }
    if (draggedElement) {
      const newX = snapToGrid((e.clientX - dragOffset.x) / zoom)
      const newY = snapToGrid((e.clientY - dragOffset.y) / zoom)
      setSpecialElements(prev => prev.map(el =>
        el.id === draggedElement ? { ...el, x: Math.max(0, newX), y: Math.max(0, newY) } : el
      ))
    }
  }, [draggedStall, draggedElement, dragOffset, zoom])

  const handleDragEnd = useCallback(() => {
    setDraggedStall(null)
    setDraggedElement(null)
  }, [])

  useEffect(() => {
    if (draggedStall || draggedElement) {
      window.addEventListener("mousemove", handleDrag)
      window.addEventListener("mouseup", handleDragEnd)
      return () => {
        window.removeEventListener("mousemove", handleDrag)
        window.removeEventListener("mouseup", handleDragEnd)
      }
    }
  }, [draggedStall, draggedElement, handleDrag, handleDragEnd])

  // Special element handlers
  const handleElementDragStart = (e: React.MouseEvent, element: SpecialElement) => {
    e.preventDefault()
    setDraggedElement(element.id)
    setSelectedElement(element)
    setSelectedStalls(new Set())
    setDragOffset({ x: e.clientX - element.x * zoom, y: e.clientY - element.y * zoom })
  }

  const addSpecialElement = (type: keyof typeof SPECIAL_ELEMENTS_CONFIG) => {
    const config = SPECIAL_ELEMENTS_CONFIG[type]
    setSpecialElements(prev => [...prev, {
      id: `element-${Date.now()}`,
      type: type as SpecialElement["type"],
      label: config.label,
      x: 60, y: 60,
      width: type === "stage" ? 300 : 120,
      height: type === "stage" ? 100 : 80,
    }])
    setShowAddElement(false)
  }

  const deleteElement = (id: string) => {
    setSpecialElements(prev => prev.filter(el => el.id !== id))
    setSelectedElement(null)
  }

  // Get stall dimensions
  const getStallPixelSize = (stall: Stall) => {
    const size = stall.size || "3x3"
    const [w, h] = size.split("x").map(Number)
    return { width: (w / STALL_UNIT) * 100, height: (h / STALL_UNIT) * 80 }
  }

  // Auto-arrange
  const autoArrange = () => {
    const newPositions: Record<string, { x: number; y: number }> = {}
    let currentX = 100, currentY = 150, maxHeight = 0
    const canvasWidth = 1400

    filteredStalls.forEach(stall => {
      const size = getStallPixelSize(stall)
      if (currentX + size.width > canvasWidth) {
        currentX = 100
        currentY += maxHeight + 20
        maxHeight = 0
      }
      newPositions[stall.id] = { x: currentX, y: currentY }
      currentX += size.width + 16
      maxHeight = Math.max(maxHeight, size.height)
    })

    setPositions(prev => ({ ...prev, ...newPositions }))
    setHasChanges(true)
    toast.success("Stalls arranged!")
  }

  // Export to PNG
  const exportToPNG = async () => {
    if (!floorPlanRef.current) return
    try {
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(floorPlanRef.current, { backgroundColor: "#fafaf9", scale: 2 })
      const link = document.createElement("a")
      link.download = `floor-plan-${eventId}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      toast.success("Exported!")
    } catch { toast.error("Export failed") }
  }

  // Open edit dialog
  const openEditDialog = (stall: Stall) => {
    setEditForm({
      stall_number: stall.stall_number,
      size: stall.size || "3x3",
      location: stall.location || "Exhibition Hall",
      status: stall.status,
    })
    setShowEditStall(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-stone-100">
      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/events/${eventId}/sponsors/floor-plan`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="h-5 w-px bg-border" />
          <h1 className="font-semibold text-lg">Floor Plan Editor</h1>
          {hasChanges && <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">Unsaved</Badge>}
        </div>

        <div className="flex items-center gap-2">
          {/* Generate Layout */}
          <Button size="sm" onClick={() => setShowLayoutGenerator(true)}>
            <LayoutGrid className="h-4 w-4 mr-1" />
            Generate Layout
          </Button>

          <Button variant="outline" size="sm" onClick={() => setShowRowGenerator(true)}>
            <Rows3 className="h-4 w-4 mr-1" />
            Add Row
          </Button>

          <Popover open={showAddElement} onOpenChange={setShowAddElement}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Element
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end">
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(SPECIAL_ELEMENTS_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => addSpecialElement(key as any)}
                    className={cn("flex items-center gap-2 p-2 rounded-lg text-sm hover:opacity-80 text-left", config.bg)}
                  >
                    <config.icon className="h-4 w-4" />
                    {config.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="h-5 w-px bg-border" />

          {/* Clear All */}
          <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash className="h-4 w-4 mr-1" />
            Clear All
          </Button>

          <div className="h-5 w-px bg-border" />

          <Button variant={showGrid ? "secondary" : "ghost"} size="sm" onClick={() => setShowGrid(!showGrid)}>
            <Grid3X3 className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" onClick={autoArrange}>
            <LayoutGrid className="h-4 w-4" />
          </Button>

          {/* Zoom */}
          <div className="flex items-center bg-muted rounded-lg">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-medium w-10 text-center">{(zoom * 100).toFixed(0)}%</span>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="h-5 w-px bg-border" />

          <Button variant="ghost" size="sm" onClick={exportToPNG}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>

          <Button size="sm" onClick={() => savePositions.mutate()} disabled={!hasChanges || savePositions.isPending}>
            {savePositions.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      {/* Location tabs + Selection info */}
      <div className="bg-white border-b px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {locations.map(loc => (
            <button
              key={loc}
              onClick={() => setSelectedLocation(loc)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg transition-colors",
                selectedLocation === loc ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {loc}
            </button>
          ))}
        </div>

        {selectedStalls.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{selectedStalls.size} selected</Badge>
            <Button variant="ghost" size="sm" onClick={() => setSelectedStalls(new Set())}>
              <X className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-6" onClick={(e) => { if (e.target === e.currentTarget) { setSelectedStalls(new Set()); setSelectedElement(null) } }}>
        <div
          ref={floorPlanRef}
          className={cn(
            "relative bg-stone-50 rounded-2xl border-2 border-dashed border-stone-300 min-h-[900px] min-w-[1500px]",
            showGrid && "bg-[linear-gradient(to_right,#e7e5e4_1px,transparent_1px),linear-gradient(to_bottom,#e7e5e4_1px,transparent_1px)] bg-[size:20px_20px]"
          )}
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
        >
          {/* Special Elements */}
          {specialElements.map(element => {
            const config = SPECIAL_ELEMENTS_CONFIG[element.type]
            if (!config) return null
            const isSelected = selectedElement?.id === element.id

            return (
              <div
                key={element.id}
                className={cn(
                  "absolute flex flex-col items-center justify-center rounded-xl border-2 cursor-move transition-shadow",
                  config.bg, config.border,
                  isSelected && "ring-2 ring-primary ring-offset-2"
                )}
                style={{ left: element.x, top: element.y, width: element.width, height: element.height, zIndex: 10 }}
                onMouseDown={(e) => handleElementDragStart(e, element)}
              >
                <config.icon className="h-6 w-6 mb-1 opacity-70" />
                <span className="text-xs font-semibold">{element.label}</span>
                {isSelected && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteElement(element.id) }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}

          {/* Stalls */}
          {filteredStalls.map(stall => {
            const pos = positions[stall.id] || { x: stall.position_x * GRID_SIZE, y: stall.position_y * GRID_SIZE }
            const size = getStallPixelSize(stall)
            const statusColors = STATUS_COLORS[stall.status] || STATUS_COLORS.available
            const isSelected = selectedStalls.has(stall.id)
            const isDragging = draggedStall === stall.id
            const isLocked = lockedStalls.has(stall.id)
            const tierInfo = stall.sponsors?.tier_id ? tierMap[stall.sponsors.tier_id] : null

            return (
              <div
                key={stall.id}
                className={cn(
                  "absolute rounded-xl border-2 transition-all select-none",
                  statusColors.bg, statusColors.border,
                  isSelected && "ring-2 ring-primary ring-offset-2 shadow-lg",
                  isDragging && "shadow-2xl opacity-95 cursor-grabbing scale-105",
                  !isDragging && !isLocked && "cursor-grab hover:shadow-lg",
                  isLocked && "cursor-not-allowed opacity-60"
                )}
                style={{ left: pos.x, top: pos.y, width: size.width, height: size.height, zIndex: isDragging ? 100 : isSelected ? 50 : 1 }}
                onMouseDown={(e) => handleDragStart(e, stall)}
                onClick={(e) => handleStallClick(e, stall)}
                onDoubleClick={() => openEditDialog(stall)}
              >
                {isLocked && (
                  <div className="absolute -top-2 -right-2 bg-slate-600 rounded-full p-1">
                    <Lock className="h-3 w-3 text-white" />
                  </div>
                )}

                <div className="flex flex-col items-center justify-center h-full p-2 text-center">
                  <span className="font-bold text-sm tracking-tight">{stall.stall_number}</span>
                  {stall.sponsors ? (
                    <>
                      {stall.sponsors.logo_url ? (
                        <img
                          src={stall.sponsors.logo_url}
                          alt=""
                          className="w-8 h-8 object-contain rounded bg-white p-0.5 shadow-sm mt-1"
                          draggable={false}
                          onError={(e) => e.currentTarget.style.display = 'none'}
                        />
                      ) : (
                        <Building2 className="h-5 w-5 text-muted-foreground mt-1" />
                      )}
                      <p className="text-[9px] font-medium truncate w-full mt-0.5">{stall.sponsors.name}</p>
                    </>
                  ) : (
                    <span className={cn("text-[10px] mt-1", statusColors.text)}>{stall.size}</span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Empty state */}
          {filteredStalls.length === 0 && specialElements.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Sparkles className="h-16 w-16 text-stone-300 mb-4" />
              <h3 className="text-xl font-semibold text-stone-400">Start Building Your Floor Plan</h3>
              <p className="text-stone-400 mt-1 mb-4">Click "Generate Layout" to create stalls instantly</p>
              <Button onClick={() => setShowLayoutGenerator(true)}>
                <LayoutGrid className="h-4 w-4 mr-2" />
                Generate Layout
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Side Panel */}
      {selectedStall && selectedStalls.size === 1 && (
        <div className="absolute right-6 top-32 w-72 bg-white rounded-xl border shadow-xl overflow-hidden">
          <div className="p-3 bg-muted/50 border-b flex items-center justify-between">
            <h3 className="font-semibold">Stall {selectedStall.stall_number}</h3>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedStalls(new Set())}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/50 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground uppercase">Size</p>
                <p className="font-semibold">{selectedStall.size}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground uppercase">Location</p>
                <p className="font-semibold">{selectedStall.location || "N/A"}</p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground uppercase">Status</p>
              <p className={cn("font-semibold capitalize", STATUS_COLORS[selectedStall.status]?.text)}>{selectedStall.status.replace("_", " ")}</p>
            </div>

            {selectedStall.sponsors && (
              <div className="flex items-center gap-2 p-2 bg-sky-50 rounded-lg border border-sky-200">
                {selectedStall.sponsors.logo_url ? (
                  <img
                    src={selectedStall.sponsors.logo_url}
                    className="w-8 h-8 object-contain rounded bg-white"
                    onError={(e) => e.currentTarget.style.display = 'none'}
                  />
                ) : (
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                )}
                <span className="text-sm font-medium truncate">{selectedStall.sponsors.name}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedStall)}>
                <Edit3 className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => duplicateStall.mutate(selectedStall)}>
                <Copy className="h-4 w-4 mr-1" />
                Duplicate
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setLockedStalls(prev => {
                  const newSet = new Set(prev)
                  if (newSet.has(selectedStall.id)) newSet.delete(selectedStall.id)
                  else newSet.add(selectedStall.id)
                  return newSet
                })
              }}
            >
              {lockedStalls.has(selectedStall.id) ? <><Unlock className="h-4 w-4 mr-2" />Unlock</> : <><Lock className="h-4 w-4 mr-2" />Lock Position</>}
            </Button>

            <Button variant="destructive" size="sm" className="w-full" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Stall
            </Button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur rounded-xl border shadow-lg p-3">
        <div className="flex items-center gap-4 text-xs">
          {Object.entries(STATUS_COLORS).map(([status, colors]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={cn("w-4 h-4 rounded border-2", colors.bg, colors.border)} />
              <span className="capitalize">{status.replace("_", " ")}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Tip: Shift+Click to multi-select • Delete key to remove • Double-click to edit</p>
      </div>

      {/* Clear All Confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Clear All Stalls?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {stalls.length} stalls from this event. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => clearAllStalls.mutate()} className="bg-red-500 hover:bg-red-600">
              {clearAllStalls.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete All Stalls
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Selected Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedStalls.size} stall{selectedStalls.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected stall{selectedStalls.size > 1 ? "s" : ""}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteStalls.mutate(Array.from(selectedStalls))} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Stall Dialog */}
      <Dialog open={showEditStall} onOpenChange={setShowEditStall}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stall</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Stall Number</Label>
              <Input value={editForm.stall_number} onChange={(e) => setEditForm(prev => ({ ...prev, stall_number: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Size</Label>
                <Select value={editForm.size} onValueChange={(v) => setEditForm(prev => ({ ...prev, size: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STALL_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <Select value={editForm.location} onValueChange={(v) => setEditForm(prev => ({ ...prev, location: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditStall(false)}>Cancel</Button>
            <Button onClick={() => selectedStall && updateStall.mutate({ id: selectedStall.id, ...editForm })}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Row Generator Dialog */}
      <Dialog open={showRowGenerator} onOpenChange={setShowRowGenerator}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Rows3 className="h-5 w-5" />Quick Add Row</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Row Prefix</Label>
                <Input value={rowForm.prefix} onChange={(e) => setRowForm(prev => ({ ...prev, prefix: e.target.value.toUpperCase() }))} placeholder="A" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Start Number</Label>
                <Input type="number" value={rowForm.startNum} onChange={(e) => setRowForm(prev => ({ ...prev, startNum: parseInt(e.target.value) || 1 }))} min={1} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Number of Stalls</Label>
                <Input type="number" value={rowForm.count} onChange={(e) => setRowForm(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))} min={1} max={50} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Stall Size</Label>
                <Select value={rowForm.size} onValueChange={(v) => setRowForm(prev => ({ ...prev, size: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{STALL_SIZES.map(size => <SelectItem key={size} value={size}>{size}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Location/Hall</Label>
              <Input value={rowForm.location} onChange={(e) => setRowForm(prev => ({ ...prev, location: e.target.value }))} placeholder="Hall A" className="mt-1" />
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">Preview</p>
              <p className="text-xs text-muted-foreground mt-1">Will create: <strong>{rowForm.prefix}{rowForm.startNum}</strong> to <strong>{rowForm.prefix}{rowForm.startNum + rowForm.count - 1}</strong></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRowGenerator(false)}>Cancel</Button>
            <Button onClick={() => createStallRow.mutate()} disabled={createStallRow.isPending}>
              {createStallRow.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Row
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Layout Generator Dialog */}
      <Dialog open={showLayoutGenerator} onOpenChange={setShowLayoutGenerator}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" />Generate Floor Plan</DialogTitle>
            <DialogDescription>Create an entire stall layout instantly</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs mb-2 block">Layout Shape</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: "square", label: "Square", icon: "▣" },
                  { value: "rectangle", label: "Rectangle", icon: "▭" },
                  { value: "u-shape", label: "U-Shape", icon: "⊔" },
                  { value: "l-shape", label: "L-Shape", icon: "⌐" },
                ].map((shape) => (
                  <button
                    key={shape.value}
                    onClick={() => setLayoutForm(prev => ({ ...prev, shape: shape.value as any }))}
                    className={cn("p-3 rounded-lg border-2 text-center transition-all", layoutForm.shape === shape.value ? "border-primary bg-primary/10" : "border-muted hover:border-muted-foreground/50")}
                  >
                    <div className="text-2xl mb-1">{shape.icon}</div>
                    <div className="text-xs font-medium">{shape.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Total Stalls</Label>
                <Input type="number" value={layoutForm.totalStalls} onChange={(e) => setLayoutForm(prev => ({ ...prev, totalStalls: parseInt(e.target.value) || 1 }))} min={1} max={200} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Columns (per row)</Label>
                <Input type="number" value={layoutForm.columns} onChange={(e) => setLayoutForm(prev => ({ ...prev, columns: parseInt(e.target.value) || 1 }))} min={1} max={20} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Stall Size</Label>
                <Select value={layoutForm.size} onValueChange={(v) => setLayoutForm(prev => ({ ...prev, size: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{STALL_SIZES.map(size => <SelectItem key={size} value={size}>{size}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Start Number</Label>
                <Input type="number" value={layoutForm.startNum} onChange={(e) => setLayoutForm(prev => ({ ...prev, startNum: parseInt(e.target.value) || 1 }))} min={1} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Location Name</Label>
              <Select value={layoutForm.location} onValueChange={(v) => setLayoutForm(prev => ({ ...prev, location: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-2">Preview</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span><strong className="text-foreground">{layoutForm.totalStalls}</strong> stalls</span>
                <span><strong className="text-foreground">{layoutForm.columns}</strong> x <strong className="text-foreground">{Math.ceil(layoutForm.totalStalls / layoutForm.columns)}</strong> grid</span>
                <span><strong className="text-foreground">{layoutForm.size}</strong> each</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Numbered <strong>{layoutForm.startNum}</strong> to <strong>{layoutForm.startNum + layoutForm.totalStalls - 1}</strong> in {layoutForm.location}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLayoutGenerator(false)}>Cancel</Button>
            <Button onClick={() => generateLayout.mutate()} disabled={generateLayout.isPending}>
              {generateLayout.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generate {layoutForm.totalStalls} Stalls
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
