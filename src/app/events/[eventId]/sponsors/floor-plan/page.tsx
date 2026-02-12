"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Grid3X3,
  Loader2,
  ZoomIn,
  ZoomOut,
  Building2,
  Search,
  X,
  MapPin,
  RotateCcw,
  Check,
  Clock,
  Pencil,
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
  sponsors?: Sponsor | null
}

const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; label: string; icon: any }> = {
  available: {
    bg: "bg-emerald-50",
    border: "border-emerald-400",
    text: "text-emerald-700",
    label: "Available",
    icon: Check
  },
  reserved: {
    bg: "bg-amber-50",
    border: "border-amber-400",
    text: "text-amber-700",
    label: "Reserved",
    icon: Clock
  },
  assigned: {
    bg: "bg-blue-50",
    border: "border-blue-400",
    text: "text-blue-700",
    label: "Assigned",
    icon: Building2
  },
  setup_complete: {
    bg: "bg-purple-50",
    border: "border-purple-400",
    text: "text-purple-700",
    label: "Setup Done",
    icon: Check
  },
}

const LOCATIONS = ["All", "Hall A", "Hall B", "Hall C", "Outdoor", "Lobby"]

export default function FloorPlanPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [selectedLocation, setSelectedLocation] = useState("All")
  const [zoom, setZoom] = useState(1)
  const [selectedStall, setSelectedStall] = useState<Stall | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch stalls
  const { data: stallsRaw, isLoading } = useQuery({
    queryKey: ["stalls-floor-plan", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("stalls")
        .select("*")
        .eq("event_id", eventId)
        .order("stall_number")
      return (data || []) as (Omit<Stall, 'sponsors'> & { sponsor_id: string | null })[]
    },
  })

  // Fetch sponsors
  const { data: sponsorsData } = useQuery({
    queryKey: ["sponsors-for-floor-plan", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sponsors")
        .select("id, name, logo_url, tier_id")
        .eq("event_id", eventId)
      return (data || []) as Sponsor[]
    },
  })

  // Fetch sponsor tiers for color mapping
  const { data: tiers } = useQuery({
    queryKey: ["sponsor-tiers", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sponsor_tiers")
        .select("id, name, color")
        .eq("event_id", eventId)
      return (data || []) as { id: string; name: string; color: string }[]
    },
  })

  // Map sponsors by ID
  const sponsorMap = useMemo(() => {
    if (!sponsorsData) return {}
    return sponsorsData.reduce((acc, s) => {
      acc[s.id] = s
      return acc
    }, {} as Record<string, Sponsor>)
  }, [sponsorsData])

  // Map tier info
  const tierMap = useMemo(() => {
    if (!tiers) return {}
    return tiers.reduce((acc, t) => {
      acc[t.id] = { name: t.name, color: t.color }
      return acc
    }, {} as Record<string, { name: string; color: string }>)
  }, [tiers])

  // Combine stalls with sponsor data
  const stalls = useMemo(() => {
    if (!stallsRaw) return []
    return stallsRaw.map(stall => ({
      ...stall,
      sponsors: stall.sponsor_id ? sponsorMap[stall.sponsor_id] || null : null
    })) as Stall[]
  }, [stallsRaw, sponsorMap])

  // Filter by location and search
  const filteredStalls = useMemo(() => {
    if (!stalls) return []
    let result = stalls

    if (selectedLocation !== "All") {
      result = result.filter(s => s.location === selectedLocation)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(s =>
        s.stall_number.toLowerCase().includes(query) ||
        s.sponsors?.name.toLowerCase().includes(query)
      )
    }

    return result
  }, [stalls, selectedLocation, searchQuery])

  // Group by location
  const stallsByLocation = useMemo(() => {
    const grouped: Record<string, Stall[]> = {}
    filteredStalls.forEach(stall => {
      const loc = stall.location || "Unassigned"
      if (!grouped[loc]) grouped[loc] = []
      grouped[loc].push(stall)
    })
    return grouped
  }, [filteredStalls])

  // Stats
  const stats = useMemo(() => {
    const total = filteredStalls.length
    const available = filteredStalls.filter(s => s.status === "available").length
    const reserved = filteredStalls.filter(s => s.status === "reserved").length
    const assigned = filteredStalls.filter(s => s.status === "assigned" || s.sponsor_id).length
    const setupComplete = filteredStalls.filter(s => s.status === "setup_complete").length
    return { total, available, reserved, assigned, setupComplete }
  }, [filteredStalls])

  // Update stall status
  const updateStatus = useMutation({
    mutationFn: async ({ stallId, status }: { stallId: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("stalls")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", stallId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stalls-floor-plan", eventId] })
      toast.success("Status updated")
    },
    onError: () => {
      toast.error("Failed to update status")
    },
  })

  // Assign sponsor
  const assignSponsor = useMutation({
    mutationFn: async ({ stallId, sponsorId }: { stallId: string; sponsorId: string | null }) => {
      const { error } = await (supabase as any)
        .from("stalls")
        .update({
          sponsor_id: sponsorId,
          status: sponsorId ? "assigned" : "available",
          updated_at: new Date().toISOString()
        })
        .eq("id", stallId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stalls-floor-plan", eventId] })
      toast.success("Stall updated")
    },
    onError: () => {
      toast.error("Failed to assign sponsor")
    },
  })

  const getStallDimensions = (size: string | null) => {
    if (!size) return { width: 100, height: 80 }
    const parts = size.split("x")
    const w = parseInt(parts[0]) || 3
    const h = parseInt(parts[1]) || 3
    return {
      width: Math.max(100, (w / 3) * 100),
      height: Math.max(80, (h / 3) * 80)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Floor Plan</h1>
          <p className="text-muted-foreground">Interactive exhibition layout</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stall or sponsor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Location Filter */}
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[140px]">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCATIONS.map(loc => (
                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 border rounded-lg bg-background">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm font-medium min-w-[50px] text-center">
              {(zoom * 100).toFixed(0)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(Math.min(2, zoom + 0.25))}
              disabled={zoom >= 2}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(1)}
              disabled={zoom === 1}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* Edit Layout */}
          <Link href={`/events/${eventId}/sponsors/floor-plan/editor`}>
            <Button>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Layout
            </Button>
          </Link>
        </div>
      </div>

      {/* Legend & Stats */}
      <div className="flex items-center justify-between p-4 bg-card rounded-xl border">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-muted-foreground">Legend:</span>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <div className={cn("w-5 h-5 rounded border-2", config.bg, config.border)} />
              <span className="text-sm">{config.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Total: <strong className="text-foreground">{stats.total}</strong>
          </span>
          <span className="text-emerald-600">
            Available: <strong>{stats.available}</strong>
          </span>
          <span className="text-blue-600">
            Assigned: <strong>{stats.assigned}</strong>
          </span>
        </div>
      </div>

      {/* Floor Plan Grid */}
      <div className="flex gap-6">
        {/* Main Floor Plan Area */}
        <div className={cn(
          "flex-1 overflow-auto bg-slate-50 rounded-xl border min-h-[500px] p-6",
          selectedStall ? "mr-80" : ""
        )}>
          {Object.keys(stallsByLocation).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <Grid3X3 className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Stalls Found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {stalls?.length === 0
                  ? "Create stalls in the Stalls page first to see them here"
                  : "No stalls match your current filters"}
              </p>
            </div>
          ) : (
            <div
              className="space-y-8 transition-transform origin-top-left"
              style={{ transform: `scale(${zoom})` }}
            >
              {Object.entries(stallsByLocation).map(([location, locationStalls]) => (
                <div key={location} className="bg-white rounded-xl border shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Grid3X3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{location}</h3>
                      <p className="text-xs text-muted-foreground">{locationStalls.length} stalls</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {locationStalls.map((stall) => {
                      const dims = getStallDimensions(stall.size)
                      const statusConfig = STATUS_CONFIG[stall.status] || STATUS_CONFIG.available
                      const isSelected = selectedStall?.id === stall.id
                      const tierInfo = stall.sponsors?.tier_id ? tierMap[stall.sponsors.tier_id] : null

                      return (
                        <div
                          key={stall.id}
                          className={cn(
                            "relative rounded-lg border-2 cursor-pointer transition-all duration-200",
                            statusConfig.bg,
                            statusConfig.border,
                            isSelected
                              ? "ring-2 ring-primary ring-offset-2 shadow-lg scale-105"
                              : "hover:shadow-md hover:scale-[1.02]"
                          )}
                          style={{
                            width: `${dims.width}px`,
                            minHeight: `${dims.height}px`,
                          }}
                          onClick={() => setSelectedStall(isSelected ? null : stall)}
                        >
                          {/* Stall Header */}
                          <div className="flex items-center justify-between px-2 pt-2">
                            <span className="font-mono font-bold text-sm">{stall.stall_number}</span>
                            <span className="text-[10px] text-muted-foreground bg-white/60 px-1.5 py-0.5 rounded">
                              {stall.size}
                            </span>
                          </div>

                          {/* Stall Content */}
                          <div className="flex flex-col items-center justify-center p-2 text-center min-h-[50px]">
                            {stall.sponsors ? (
                              <>
                                {stall.sponsors.logo_url ? (
                                  <img
                                    src={stall.sponsors.logo_url}
                                    alt={stall.sponsors.name}
                                    className="w-10 h-10 object-contain rounded bg-white p-1 shadow-sm mb-1"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none'
                                      e.currentTarget.nextElementSibling?.classList.remove('hidden')
                                    }}
                                  />
                                ) : null}
                                <div className={cn(
                                  "w-10 h-10 rounded bg-white shadow-sm flex items-center justify-center mb-1",
                                  stall.sponsors.logo_url ? "hidden" : ""
                                )}>
                                  <Building2 className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <p className="text-xs font-medium truncate w-full px-1">
                                  {stall.sponsors.name}
                                </p>
                                {tierInfo && (
                                  <span
                                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5"
                                    style={{
                                      backgroundColor: `${tierInfo.color}20`,
                                      color: tierInfo.color
                                    }}
                                  >
                                    {tierInfo.name}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className={cn("text-xs font-medium", statusConfig.text)}>
                                {statusConfig.label}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Stall Details Panel */}
        {selectedStall && (
          <div className="fixed right-6 top-[180px] w-72 bg-card rounded-xl border shadow-xl overflow-hidden">
            {/* Panel Header */}
            <div className="bg-primary text-primary-foreground p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-80">Selected Stall</p>
                  <h4 className="text-xl font-bold">{selectedStall.stall_number}</h4>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary-foreground hover:bg-white/20"
                  onClick={() => setSelectedStall(null)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Panel Content */}
            <div className="p-4 space-y-4">
              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Size</p>
                  <p className="font-semibold">{selectedStall.size || "N/A"}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Location</p>
                  <p className="font-semibold">{selectedStall.location || "N/A"}</p>
                </div>
              </div>

              {/* Status */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Status</p>
                <Select
                  value={selectedStall.status}
                  onValueChange={(value) => {
                    updateStatus.mutate({ stallId: selectedStall.id, status: value })
                    setSelectedStall({ ...selectedStall, status: value })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-3 h-3 rounded", config.bg, config.border, "border")} />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned Sponsor */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Assigned Sponsor</p>
                {selectedStall.sponsors ? (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    {selectedStall.sponsors.logo_url ? (
                      <img
                        src={selectedStall.sponsors.logo_url}
                        alt=""
                        className="w-10 h-10 object-contain rounded border bg-white"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                    ) : null}
                    <div className={cn(
                      "w-10 h-10 rounded border bg-white flex items-center justify-center",
                      selectedStall.sponsors.logo_url ? "hidden" : ""
                    )}>
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{selectedStall.sponsors.name}</p>
                      {selectedStall.sponsors.tier_id && tierMap[selectedStall.sponsors.tier_id] && (
                        <p
                          className="text-xs"
                          style={{ color: tierMap[selectedStall.sponsors.tier_id].color }}
                        >
                          {tierMap[selectedStall.sponsors.tier_id].name}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => {
                        assignSponsor.mutate({ stallId: selectedStall.id, sponsorId: null })
                        setSelectedStall({ ...selectedStall, sponsor_id: null, sponsors: null })
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Select
                    value=""
                    onValueChange={(sponsorId) => {
                      const sponsor = sponsorMap[sponsorId]
                      assignSponsor.mutate({ stallId: selectedStall.id, sponsorId })
                      setSelectedStall({
                        ...selectedStall,
                        sponsor_id: sponsorId,
                        sponsors: sponsor,
                        status: "assigned"
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Assign a sponsor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sponsorsData?.map(sponsor => (
                        <SelectItem key={sponsor.id} value={sponsor.id}>
                          <div className="flex items-center gap-2">
                            {sponsor.logo_url ? (
                              <img
                                src={sponsor.logo_url}
                                className="w-5 h-5 object-contain rounded"
                                onError={(e) => e.currentTarget.style.display = 'none'}
                              />
                            ) : (
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            )}
                            {sponsor.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
