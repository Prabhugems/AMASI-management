"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  User,
  Play,
  Square,
  RefreshCw,
  AlertTriangle,
  Loader2,
  QrCode,
  Calendar,
} from "lucide-react"

interface Abstract {
  id: string
  abstract_number: string
  title: string
  presenting_author_name: string
  presenting_author_email: string
  accepted_as: string
  session_date: string
  session_time: string
  session_location: string
  registration_verified: boolean
  presenter_checked_in: boolean
  presenter_checked_in_at: string
  presentation_completed: boolean
  presentation_completed_at: string
  registration?: {
    id: string
    registration_number: string
    checked_in: boolean
  }
}

interface Stats {
  total_presenters: number
  checked_in: number
  not_checked_in: number
  presentations_completed: number
  not_registered: number
}

export default function PresenterCheckinPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [abstracts, setAbstracts] = useState<Abstract[]>([])
  const [stats, setStats] = useState<Stats>({
    total_presenters: 0,
    checked_in: 0,
    not_checked_in: 0,
    presentations_completed: 0,
    not_registered: 0,
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterDate, setFilterDate] = useState<string>("today")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [selectedAbstract, setSelectedAbstract] = useState<Abstract | null>(null)
  const [checkinDialogOpen, setCheckinDialogOpen] = useState(false)
  const [checkInLocation, setCheckInLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchAbstracts()
  }, [eventId, filterDate])

  const fetchAbstracts = async () => {
    try {
      setLoading(true)
      const res = await fetch(
        `/api/events/${eventId}/abstracts/presenter-list?date=${filterDate}`
      )
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setAbstracts(data.abstracts || [])
      setStats(data.stats || stats)
    } catch (error) {
      console.error("Error fetching abstracts:", error)
      toast.error("Failed to load presenter list")
    } finally {
      setLoading(false)
    }
  }

  const handleCheckin = async () => {
    if (!selectedAbstract) return

    try {
      setSubmitting(true)
      const res = await fetch(`/api/abstracts/${selectedAbstract.id}/presenter-checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          check_in_location: checkInLocation,
          notes,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to check in")
      }

      toast.success(`${selectedAbstract.presenting_author_name} checked in successfully`)
      setCheckinDialogOpen(false)
      setSelectedAbstract(null)
      setCheckInLocation("")
      setNotes("")
      fetchAbstracts()
    } catch (error) {
      console.error("Check-in error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to check in")
    } finally {
      setSubmitting(false)
    }
  }

  const handlePresentationAction = async (abstractId: string, action: 'start' | 'complete') => {
    try {
      const res = await fetch(`/api/abstracts/${abstractId}/presenter-checkin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || `Failed to ${action} presentation`)
      }

      toast.success(action === 'start' ? 'Presentation started' : 'Presentation completed')
      fetchAbstracts()
    } catch (error) {
      console.error("Presentation action error:", error)
      toast.error(error instanceof Error ? error.message : "Action failed")
    }
  }

  const openCheckinDialog = (abstract: Abstract) => {
    setSelectedAbstract(abstract)
    setCheckinDialogOpen(true)
  }

  const filteredAbstracts = abstracts.filter(a => {
    const matchesSearch = !searchQuery ||
      a.abstract_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.presenting_author_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.presenting_author_email.toLowerCase().includes(searchQuery.toLowerCase())

    let matchesStatus = true
    if (filterStatus === 'checked_in') {
      matchesStatus = a.presenter_checked_in
    } else if (filterStatus === 'not_checked_in') {
      matchesStatus = !a.presenter_checked_in
    } else if (filterStatus === 'completed') {
      matchesStatus = a.presentation_completed
    } else if (filterStatus === 'not_registered') {
      matchesStatus = !a.registration_verified
    }

    return matchesSearch && matchesStatus
  })

  const formatTime = (time: string) => {
    if (!time) return '-'
    return time.substring(0, 5)
  }

  const formatDate = (date: string) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    })
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Presenter Check-in</h1>
          <p className="text-muted-foreground">Track presenter attendance on conference day</p>
        </div>
        <Button onClick={fetchAbstracts} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total_presenters}</div>
            <div className="text-sm text-muted-foreground">Total Presenters</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-700">{stats.checked_in}</div>
            <div className="text-sm text-green-600">Checked In</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-700">{stats.not_checked_in}</div>
            <div className="text-sm text-yellow-600">Awaiting</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-700">{stats.presentations_completed}</div>
            <div className="text-sm text-blue-600">Completed</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-700">{stats.not_registered}</div>
            <div className="text-sm text-red-600">Not Registered</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or abstract number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterDate} onValueChange={setFilterDate}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="all">All Days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="not_checked_in">Not Checked In</SelectItem>
                <SelectItem value="checked_in">Checked In</SelectItem>
                <SelectItem value="completed">Presented</SelectItem>
                <SelectItem value="not_registered">Not Registered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Presenters Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAbstracts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No presenters found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Presenter</TableHead>
                  <TableHead>Abstract</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-center">Registration</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAbstracts.map((abstract) => (
                  <TableRow key={abstract.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{abstract.presenting_author_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {abstract.presenting_author_email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-mono text-sm">{abstract.abstract_number}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {abstract.title}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {abstract.accepted_as}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatDate(abstract.session_date)} {formatTime(abstract.session_time)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {abstract.session_location || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {abstract.registration_verified ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Registered
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Not Registered
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {abstract.presentation_completed ? (
                        <Badge className="bg-blue-100 text-blue-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Presented
                        </Badge>
                      ) : abstract.presenter_checked_in ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Checked In
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                          <Clock className="h-3 w-3 mr-1" />
                          Awaiting
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!abstract.presenter_checked_in ? (
                          <Button
                            size="sm"
                            onClick={() => openCheckinDialog(abstract)}
                            disabled={!abstract.registration_verified}
                          >
                            Check In
                          </Button>
                        ) : !abstract.presentation_completed ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePresentationAction(abstract.id, 'complete')}
                          >
                            <Square className="h-3 w-3 mr-1" />
                            Mark Complete
                          </Button>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600">Done</Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Check-in Dialog */}
      <Dialog open={checkinDialogOpen} onOpenChange={setCheckinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Presenter Check-in</DialogTitle>
            <DialogDescription>
              Check in {selectedAbstract?.presenting_author_name} for their presentation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Presenter Info */}
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Abstract:</span>
                <span className="font-mono">{selectedAbstract?.abstract_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <Badge variant="outline" className="capitalize">
                  {selectedAbstract?.accepted_as}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Schedule:</span>
                <span>
                  {formatDate(selectedAbstract?.session_date || '')} at {formatTime(selectedAbstract?.session_time || '')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Location:</span>
                <span>{selectedAbstract?.session_location || '-'}</span>
              </div>
            </div>

            {/* Check-in Location */}
            <div className="space-y-2">
              <Label>Check-in Location</Label>
              <Input
                placeholder="e.g., Registration Desk, Hall A entrance"
                value={checkInLocation}
                onChange={(e) => setCheckInLocation(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any notes about this check-in..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckinDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckin} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirm Check-in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
