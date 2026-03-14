"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  CalendarDays,
  Loader2,
  CheckCircle,
  Users,
  ListFilter,
  Grid3X3,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Abstract {
  id: string
  abstract_number: string
  title: string
  presenting_author_name: string
  presenting_author_email: string
  accepted_as: string
  status: string
  category?: { name: string }
  session_id?: string
  session_date?: string
  session_time?: string
  session_location?: string
}

interface Session {
  id: string
  title: string
  session_name: string
  session_type: string
  session_date: string
  start_time: string
  end_time: string
  location: string
  hall: string
  specialty_track: string
  slots: any[]
  slot_count: number
}

export default function SchedulingPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [selectedAbstracts, setSelectedAbstracts] = useState<string[]>([])
  const [showCreateSession, setShowCreateSession] = useState(false)
  const [showBulkSchedule, setShowBulkSchedule] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")

  // Session form state
  const [sessionForm, setSessionForm] = useState({
    title: "",
    session_date: "",
    start_time: "09:00",
    end_time: "12:00",
    hall: "",
    location: "",
    specialty_track: "",
  })

  // Bulk schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    session_id: "",
    presentation_date: "",
    start_time: "09:00",
    duration_minutes: 10,
    hall_name: "",
    room_number: "",
  })

  // Fetch accepted abstracts
  const { data: abstracts = [], isLoading: loadingAbstracts } = useQuery({
    queryKey: ["abstracts-for-scheduling", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstracts?event_id=${eventId}&status=accepted`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json() as Promise<Abstract[]>
    },
  })

  // Fetch sessions
  const { data: sessionsData, isLoading: loadingSessions } = useQuery({
    queryKey: ["abstract-sessions", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-sessions?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
  })

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["abstract-categories", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-categories?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
  })

  const sessions = sessionsData?.sessions || []
  const unassignedSlots = sessionsData?.unassigned_slots || []

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/abstract-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, event_id: eventId }),
      })
      if (!res.ok) throw new Error("Failed to create session")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-sessions", eventId] })
      setShowCreateSession(false)
      setSessionForm({
        title: "",
        session_date: "",
        start_time: "09:00",
        end_time: "12:00",
        hall: "",
        location: "",
        specialty_track: "",
      })
      toast.success("Session created successfully")
    },
    onError: () => {
      toast.error("Failed to create session")
    },
  })

  // Bulk schedule mutation
  const bulkScheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/abstracts/bulk/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to schedule")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["abstracts-for-scheduling", eventId] })
      queryClient.invalidateQueries({ queryKey: ["abstract-sessions", eventId] })
      setShowBulkSchedule(false)
      setSelectedAbstracts([])
      toast.success(`${data.scheduled} abstracts scheduled successfully`)
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to schedule abstracts")
    },
  })

  // Filter abstracts
  const filteredAbstracts = abstracts.filter((a) => {
    if (categoryFilter !== "all" && a.category?.name !== categoryFilter) return false
    if (typeFilter !== "all" && a.accepted_as !== typeFilter) return false
    return true
  })

  // Split into scheduled and unscheduled
  const scheduledAbstracts = filteredAbstracts.filter((a) => a.session_date)
  const unscheduledAbstracts = filteredAbstracts.filter((a) => !a.session_date)

  const toggleSelect = (id: string) => {
    setSelectedAbstracts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = (abstracts: Abstract[]) => {
    const ids = abstracts.map((a) => a.id)
    const allSelected = ids.every((id) => selectedAbstracts.includes(id))
    if (allSelected) {
      setSelectedAbstracts((prev) => prev.filter((id) => !ids.includes(id)))
    } else {
      setSelectedAbstracts((prev) => [...new Set([...prev, ...ids])])
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
  }

  const formatTime = (time: string) => {
    if (!time) return ""
    const [h, m] = time.split(":")
    const hour = parseInt(h)
    const ampm = hour >= 12 ? "PM" : "AM"
    const hour12 = hour % 12 || 12
    return `${hour12}:${m} ${ampm}`
  }

  // Stats
  const stats = {
    total: abstracts.length,
    scheduled: scheduledAbstracts.length,
    unscheduled: unscheduledAbstracts.length,
    oral: abstracts.filter((a) => a.accepted_as === "oral").length,
    poster: abstracts.filter((a) => a.accepted_as === "poster").length,
    sessions: sessions.length,
  }

  if (loadingAbstracts || loadingSessions) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Session Scheduling</h1>
          <p className="text-muted-foreground">
            Assign accepted abstracts to presentation sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showCreateSession} onOpenChange={setShowCreateSession}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Session</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Session Title</Label>
                  <Input
                    value={sessionForm.title}
                    onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                    placeholder="e.g., Oral Presentations - Track A"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={sessionForm.session_date}
                      onChange={(e) => setSessionForm({ ...sessionForm, session_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Specialty Track</Label>
                    <Input
                      value={sessionForm.specialty_track}
                      onChange={(e) => setSessionForm({ ...sessionForm, specialty_track: e.target.value })}
                      placeholder="e.g., Cardiology"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={sessionForm.start_time}
                      onChange={(e) => setSessionForm({ ...sessionForm, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={sessionForm.end_time}
                      onChange={(e) => setSessionForm({ ...sessionForm, end_time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Hall</Label>
                    <Input
                      value={sessionForm.hall}
                      onChange={(e) => setSessionForm({ ...sessionForm, hall: e.target.value })}
                      placeholder="e.g., Hall A"
                    />
                  </div>
                  <div>
                    <Label>Location/Room</Label>
                    <Input
                      value={sessionForm.location}
                      onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })}
                      placeholder="e.g., Room 101"
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => createSessionMutation.mutate(sessionForm)}
                  disabled={!sessionForm.title || !sessionForm.session_date || createSessionMutation.isPending}
                >
                  {createSessionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Create Session
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Accepted</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-green-600">Scheduled</div>
            <div className="text-2xl font-bold text-green-600">{stats.scheduled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-orange-600">Unscheduled</div>
            <div className="text-2xl font-bold text-orange-600">{stats.unscheduled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Oral</div>
            <div className="text-2xl font-bold">{stats.oral}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Poster</div>
            <div className="text-2xl font-bold">{stats.poster}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Sessions</div>
            <div className="text-2xl font-bold">{stats.sessions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <ListFilter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat: any) => (
              <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="oral">Oral</SelectItem>
            <SelectItem value="poster">Poster</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="eposter">E-Poster</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 border rounded-md p-1">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <ListFilter className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedAbstracts.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
          <span className="text-sm font-medium">{selectedAbstracts.length} selected</span>
          <Dialog open={showBulkSchedule} onOpenChange={setShowBulkSchedule}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Calendar className="h-4 w-4" />
                Schedule Selected
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule {selectedAbstracts.length} Abstracts</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Session (Optional)</Label>
                  <Select
                    value={scheduleForm.session_id}
                    onValueChange={(v) => setScheduleForm({ ...scheduleForm, session_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a session" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Session</SelectItem>
                      {sessions.map((session: Session) => (
                        <SelectItem key={session.id} value={session.id}>
                          {session.title} - {formatDate(session.session_date)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Presentation Date</Label>
                    <Input
                      type="date"
                      value={scheduleForm.presentation_date}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, presentation_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={scheduleForm.start_time}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Duration (minutes)</Label>
                    <Input
                      type="number"
                      value={scheduleForm.duration_minutes}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, duration_minutes: parseInt(e.target.value) || 10 })}
                    />
                  </div>
                  <div>
                    <Label>Hall</Label>
                    <Input
                      value={scheduleForm.hall_name}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, hall_name: e.target.value })}
                      placeholder="e.g., Hall A"
                    />
                  </div>
                </div>
                <div>
                  <Label>Room Number</Label>
                  <Input
                    value={scheduleForm.room_number}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, room_number: e.target.value })}
                    placeholder="e.g., Room 101"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Presentations will be auto-sequenced starting from the start time with {scheduleForm.duration_minutes} minutes each.
                </p>
                <Button
                  className="w-full"
                  onClick={() => bulkScheduleMutation.mutate({
                    abstract_ids: selectedAbstracts,
                    ...scheduleForm,
                  })}
                  disabled={!scheduleForm.presentation_date || !scheduleForm.start_time || bulkScheduleMutation.isPending}
                >
                  {bulkScheduleMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Schedule {selectedAbstracts.length} Abstracts
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="ghost" onClick={() => setSelectedAbstracts([])}>
            Clear
          </Button>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="unscheduled">
        <TabsList>
          <TabsTrigger value="unscheduled" className="gap-2">
            <Clock className="h-4 w-4" />
            Unscheduled ({unscheduledAbstracts.length})
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Scheduled ({scheduledAbstracts.length})
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Sessions ({sessions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unscheduled" className="mt-4">
          {unscheduledAbstracts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p>All accepted abstracts have been scheduled!</p>
            </div>
          ) : (
            <div className="bg-card border rounded-xl overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={unscheduledAbstracts.every((a) => selectedAbstracts.includes(a.id))}
                        onCheckedChange={() => toggleSelectAll(unscheduledAbstracts)}
                      />
                    </TableHead>
                    <TableHead>Abstract #</TableHead>
                    <TableHead className="min-w-[250px]">Title</TableHead>
                    <TableHead>Presenter</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unscheduledAbstracts.map((abstract) => (
                    <TableRow key={abstract.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedAbstracts.includes(abstract.id)}
                          onCheckedChange={() => toggleSelect(abstract.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{abstract.abstract_number}</TableCell>
                      <TableCell>
                        <p className="font-medium truncate max-w-[250px]">{abstract.title}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{abstract.presenting_author_name}</p>
                        <p className="text-xs text-muted-foreground">{abstract.presenting_author_email}</p>
                      </TableCell>
                      <TableCell>{abstract.category?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{abstract.accepted_as}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="scheduled" className="mt-4">
          {scheduledAbstracts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4" />
              <p>No abstracts scheduled yet</p>
            </div>
          ) : (
            <div className="bg-card border rounded-xl overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Abstract #</TableHead>
                    <TableHead className="min-w-[250px]">Title</TableHead>
                    <TableHead>Presenter</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledAbstracts.map((abstract) => (
                    <TableRow key={abstract.id}>
                      <TableCell className="font-mono">{abstract.abstract_number}</TableCell>
                      <TableCell>
                        <p className="font-medium truncate max-w-[250px]">{abstract.title}</p>
                      </TableCell>
                      <TableCell>{abstract.presenting_author_name}</TableCell>
                      <TableCell>{abstract.session_date ? formatDate(abstract.session_date) : "—"}</TableCell>
                      <TableCell>{abstract.session_time ? formatTime(abstract.session_time) : "—"}</TableCell>
                      <TableCell>{abstract.session_location || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mx-auto mb-4" />
              <p className="mb-4">No sessions created yet</p>
              <Button onClick={() => setShowCreateSession(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create First Session
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions.map((session: Session) => (
                <Card key={session.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{session.title || session.session_name}</CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(session.session_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formatTime(session.start_time)} - {formatTime(session.end_time)}
                          </span>
                          {(session.hall || session.location) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {session.hall} {session.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {session.slot_count} presentations
                      </Badge>
                    </div>
                  </CardHeader>
                  {session.slots && session.slots.length > 0 && (
                    <CardContent>
                      <div className="space-y-2">
                        {session.slots.slice(0, 5).map((slot: any, i: number) => (
                          <div key={slot.id} className="flex items-center gap-3 text-sm py-2 border-b last:border-0">
                            <span className="text-muted-foreground w-16">
                              {formatTime(slot.start_time)}
                            </span>
                            <span className="font-mono text-xs w-16">{slot.abstract?.abstract_number}</span>
                            <span className="flex-1 truncate">{slot.abstract?.title}</span>
                            <span className="text-muted-foreground">{slot.abstract?.presenting_author_name}</span>
                          </div>
                        ))}
                        {session.slots.length > 5 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            + {session.slots.length - 5} more presentations
                          </p>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
