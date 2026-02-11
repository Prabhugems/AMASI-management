"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Search,
  Plus,
  Upload,
  Download,
  GraduationCap,
  UserCheck,
  RefreshCw,
  Mail,
  Building2,
  Award,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Star,
  Edit,
  Send,
  Ban,
  CheckCircle,
  Clock,
  X,
  Loader2,
  Ticket,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { toast } from "sonner"
import {
  SlideOver,
  SlideOverSection,
  SlideOverTabs,
  SlideOverFooter,
} from "@/components/ui/slide-over"

type Faculty = {
  id: string
  title: string | null
  name: string
  email: string
  phone: string | null
  designation: string | null
  department: string | null
  institution: string | null
  specialty: string | null
  city: string | null
  state: string | null
  country: string | null
  status: string | null
  total_events: number
  total_sessions: number
  is_reviewer: boolean | null
  created_at: string | null
}

type Event = {
  id: string
  name: string
  start_date: string
  status: string
}

type TicketType = {
  id: string
  name: string
  price: number
}

const FACULTY_ROLES = [
  { value: "Speaker", label: "Speaker" },
  { value: "Chairperson", label: "Chairperson" },
  { value: "Moderator", label: "Moderator" },
  { value: "Panelist", label: "Panelist" },
  { value: "Faculty", label: "Faculty" },
]

export default function FacultyPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [specialtyFilter, setSpecialtyFilter] = useState("all")
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null)
  const [activeTab, setActiveTab] = useState("profile")

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteEventId, setInviteEventId] = useState("")
  const [inviteTicketId, setInviteTicketId] = useState("")
  const [inviteRole, setInviteRole] = useState("Speaker")
  const [inviteTopic, setInviteTopic] = useState("")

  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch faculty with filters
  const { data: faculty, isLoading, refetch } = useQuery({
    queryKey: ["faculty", search, statusFilter, specialtyFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from("faculty")
        .select("id, title, name, email, phone, designation, department, institution, specialty, city, state, country, status, total_events, total_sessions, is_reviewer, created_at")
        .order("name", { ascending: true })
        .limit(100)

      if (search.trim()) {
        query = query.or(
          `name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,institution.ilike.%${search.trim()}%`
        )
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }
      if (specialtyFilter !== "all") {
        query = query.eq("specialty", specialtyFilter)
      }

      const { data, error } = await query
      if (error) {
        console.error("Faculty fetch error:", error)
        throw error
      }
      return (data as Faculty[]) || []
    },
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["faculty-stats"],
    queryFn: async () => {
      const { count: total } = await (supabase as any)
        .from("faculty")
        .select("*", { count: "exact", head: true })
      const { count: active } = await (supabase as any)
        .from("faculty")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
      const { count: reviewers } = await (supabase as any)
        .from("faculty")
        .select("*", { count: "exact", head: true })
        .eq("is_reviewer", true)
      return { total: total || 0, active: active || 0, reviewers: reviewers || 0 }
    },
  })

  // Fetch unique specialties for filter dropdown
  const { data: specialties } = useQuery({
    queryKey: ["faculty-specialties"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("faculty")
        .select("specialty")
        .not("specialty", "is", null)
      const typedData = data as { specialty: string | null }[] | null
      const uniqueSpecialties = [...new Set(typedData?.map(f => f.specialty).filter(Boolean))]
      return uniqueSpecialties as string[]
    },
  })

  // Fetch active events for invite modal
  const { data: events } = useQuery({
    queryKey: ["events-for-invite"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("events")
        .select("id, name, start_date, status")
        .in("status", ["draft", "published", "active"])
        .order("start_date", { ascending: false })
        .limit(50)
      return (data || []) as Event[]
    },
    enabled: isInviteModalOpen,
  })

  // Fetch ticket types for selected event (Speaker/Faculty tickets)
  const { data: ticketTypes } = useQuery({
    queryKey: ["ticket-types-for-invite", inviteEventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ticket_types")
        .select("id, name, price")
        .eq("event_id", inviteEventId)
        .or("name.ilike.%speaker%,name.ilike.%faculty%,name.ilike.%chairperson%,name.ilike.%moderator%,name.ilike.%panelist%")
        .order("name")
      return (data || []) as TicketType[]
    },
    enabled: !!inviteEventId,
  })

  // Fetch faculty commitments (event registrations)
  const { data: facultyCommitments } = useQuery({
    queryKey: ["faculty-commitments", selectedFaculty?.email],
    queryFn: async () => {
      if (!selectedFaculty?.email) return []
      const { data } = await (supabase as any)
        .from("registrations")
        .select(`
          id,
          registration_number,
          attendee_designation,
          status,
          created_at,
          custom_fields,
          event:events(id, name, start_date, end_date, venue_name, city),
          ticket_type:ticket_types(name)
        `)
        .eq("attendee_email", selectedFaculty.email)
        .order("created_at", { ascending: false })
      return data || []
    },
    enabled: !!selectedFaculty?.email,
  })

  // Invite faculty mutation
  const inviteFaculty = useMutation({
    mutationFn: async () => {
      if (!selectedFaculty || !inviteEventId || !inviteTicketId) {
        throw new Error("Missing required fields")
      }

      // Check if already registered
      const { data: existing } = await (supabase as any)
        .from("registrations")
        .select("id")
        .eq("event_id", inviteEventId)
        .eq("attendee_email", selectedFaculty.email)
        .maybeSingle()

      if (existing) {
        throw new Error("Faculty is already registered for this event")
      }

      // Generate registration number
      const date = new Date()
      const dateStr = date.getFullYear().toString() +
        (date.getMonth() + 1).toString().padStart(2, "0") +
        date.getDate().toString().padStart(2, "0")
      const random = Math.floor(1000 + Math.random() * 9000)
      const registrationNumber = `FAC-${dateStr}-${random}`

      // Create registration
      const fullName = selectedFaculty.title
        ? `${selectedFaculty.title} ${selectedFaculty.name}`
        : selectedFaculty.name

      const { error } = await (supabase as any)
        .from("registrations")
        .insert({
          event_id: inviteEventId,
          ticket_type_id: inviteTicketId,
          registration_number: registrationNumber,
          attendee_name: fullName,
          attendee_email: selectedFaculty.email,
          attendee_phone: selectedFaculty.phone || null,
          attendee_institution: selectedFaculty.institution || null,
          attendee_designation: inviteRole,
          attendee_city: selectedFaculty.city || null,
          attendee_state: selectedFaculty.state || null,
          attendee_country: selectedFaculty.country || "India",
          quantity: 1,
          unit_price: 0,
          tax_amount: 0,
          discount_amount: 0,
          total_amount: 0,
          status: "confirmed",
          payment_status: "completed",
          confirmed_at: new Date().toISOString(),
          custom_fields: inviteTopic ? { topic: inviteTopic } : null,
        })

      if (error) throw error
    },
    onSuccess: () => {
      toast.success(`${selectedFaculty?.name} invited as ${inviteRole}`)
      queryClient.invalidateQueries({ queryKey: ["faculty-commitments", selectedFaculty?.email] })
      setIsInviteModalOpen(false)
      setInviteEventId("")
      setInviteTicketId("")
      setInviteRole("Speaker")
      setInviteTopic("")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Export to CSV
  const handleExport = async () => {
    const { data } = await supabase.from("faculty").select("*").csv()
    const blob = new Blob([data || ""], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `faculty_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "commitments", label: "Commitments", count: facultyCommitments?.length || 0 },
  ]

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "active":
        return "bg-success/20 text-success"
      case "blacklisted":
        return "bg-destructive/20 text-destructive"
      case "inactive":
        return "bg-muted text-muted-foreground"
      default:
        return "bg-success/20 text-success"
    }
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-6rem)]">
        {/* Left Panel - Faculty List */}
        <div className={cn(
          "flex flex-col overflow-hidden transition-all duration-300",
          selectedFaculty ? "flex-1" : "flex-1"
        )}>
          {/* Header */}
          <div className="flex-shrink-0 p-6 border-b border-border bg-background">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Faculty</h1>
                <p className="text-sm text-muted-foreground">
                  Master faculty database
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/faculty/import">
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                  <Link href="/faculty/add-from-member">
                    <UserCheck className="h-4 w-4 mr-2" />
                    From Members
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/faculty/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Faculty
                  </Link>
                </Button>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-4 sm:gap-6 mb-4 overflow-x-auto">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stats?.total || 0}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                </div>
              </div>
              <div className="h-8 w-px bg-border flex-shrink-0" />
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <UserCheck className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stats?.active || 0}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active</p>
                </div>
              </div>
              <div className="h-8 w-px bg-border flex-shrink-0" />
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Award className="h-4 w-4 text-violet-500" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stats?.reviewers || 0}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Reviewers</p>
                </div>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or institution..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[130px] h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="blacklisted">Blacklisted</SelectItem>
                </SelectContent>
              </Select>
              <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                <SelectTrigger className="w-full sm:w-[160px] h-9">
                  <SelectValue placeholder="Specialty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Specialties</SelectItem>
                  {specialties?.map((specialty) => (
                    <SelectItem key={specialty} value={specialty}>
                      {specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 w-9 p-0">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Faculty List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : faculty?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <GraduationCap className="h-12 w-12 mb-3 opacity-20" />
                <p>No faculty found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {faculty?.map((member) => (
                  <div
                    key={member.id}
                    onClick={() => {
                      setSelectedFaculty(member)
                      setActiveTab("profile")
                    }}
                    className={cn(
                      "flex items-center gap-4 p-4 cursor-pointer transition-all hover:bg-secondary/50",
                      selectedFaculty?.id === member.id && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                  >
                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                      {getInitials(member.name)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-foreground truncate">
                          {member.title ? `${member.title} ` : ""}{member.name}
                        </p>
                        {member.is_reviewer && (
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {member.institution || member.designation || member.email}
                      </p>
                    </div>

                    {/* Status & Specialty */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {member.specialty && (
                        <Badge variant="outline" className="text-[10px] bg-secondary border-0 hidden sm:inline-flex">
                          {member.specialty}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-medium border-0", getStatusColor(member.status))}
                      >
                        {member.status ? member.status.charAt(0).toUpperCase() + member.status.slice(1) : "Active"}
                      </Badge>
                    </div>

                    {/* Event Count */}
                    <div className="text-right flex-shrink-0 hidden md:block">
                      <p className="text-sm font-semibold text-foreground">{member.total_events || 0}</p>
                      <p className="text-[10px] text-muted-foreground">events</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-secondary/30">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{faculty?.length || 0} faculty showing</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  const emails = faculty?.map((f) => f.email).filter(Boolean).join(",")
                  if (emails) {
                    window.open(`mailto:${emails}`)
                  } else {
                    toast.error("No faculty emails found")
                  }
                }}
              >
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Bulk Email
              </Button>
            </div>
          </div>
        </div>

        {/* Right Panel - Faculty Details Slide Over */}
        <SlideOver
          open={!!selectedFaculty}
          onClose={() => setSelectedFaculty(null)}
          title={selectedFaculty ? `${selectedFaculty.title || ""} ${selectedFaculty.name}`.trim() : ""}
          subtitle={selectedFaculty?.institution || selectedFaculty?.email}
          width="lg"
          showOverlay={false}
        >
          {selectedFaculty && (
            <>
              <SlideOverTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />

              <div className="flex-1 overflow-y-auto">
                {activeTab === "profile" && (
                  <>
                    {/* Quick Info Cards */}
                    <SlideOverSection>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-secondary/50 text-center">
                          <p className="text-2xl font-bold text-foreground">{selectedFaculty.total_events || 0}</p>
                          <p className="text-xs text-muted-foreground">Events</p>
                        </div>
                        <div className="p-3 rounded-xl bg-secondary/50 text-center">
                          <p className="text-2xl font-bold text-foreground">{selectedFaculty.total_sessions || 0}</p>
                          <p className="text-xs text-muted-foreground">Sessions</p>
                        </div>
                        <div className="p-3 rounded-xl bg-secondary/50 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {selectedFaculty.is_reviewer ? (
                              <CheckCircle className="h-5 w-5 text-success" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">Reviewer</p>
                        </div>
                      </div>
                    </SlideOverSection>

                    {/* Contact Information */}
                    <SlideOverSection title="Contact Information">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                            <p className="text-sm font-medium text-foreground truncate">{selectedFaculty.email}</p>
                          </div>
                        </div>
                        {selectedFaculty.phone && (
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                              <p className="text-sm font-medium text-foreground">{selectedFaculty.phone}</p>
                            </div>
                          </div>
                        )}
                        {(selectedFaculty.city || selectedFaculty.state) && (
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground mb-0.5">Location</p>
                              <p className="text-sm font-medium text-foreground">
                                {[selectedFaculty.city, selectedFaculty.state, selectedFaculty.country].filter(Boolean).join(", ")}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </SlideOverSection>

                    {/* Professional Information */}
                    <SlideOverSection title="Professional Information">
                      <div className="space-y-3">
                        {selectedFaculty.institution && (
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground mb-0.5">Institution</p>
                              <p className="text-sm font-medium text-foreground">{selectedFaculty.institution}</p>
                            </div>
                          </div>
                        )}
                        {selectedFaculty.designation && (
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                              <Briefcase className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground mb-0.5">Designation</p>
                              <p className="text-sm font-medium text-foreground">{selectedFaculty.designation}</p>
                            </div>
                          </div>
                        )}
                        {selectedFaculty.department && (
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                              <GraduationCap className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground mb-0.5">Department</p>
                              <p className="text-sm font-medium text-foreground">{selectedFaculty.department}</p>
                            </div>
                          </div>
                        )}
                        {selectedFaculty.specialty && (
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                              <Award className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground mb-0.5">Specialty</p>
                              <p className="text-sm font-medium text-foreground">{selectedFaculty.specialty}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </SlideOverSection>

                    {/* Member Since */}
                    {selectedFaculty.created_at && (
                      <SlideOverSection>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Added {new Date(selectedFaculty.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}</span>
                        </div>
                      </SlideOverSection>
                    )}
                  </>
                )}

                {activeTab === "commitments" && (
                  <SlideOverSection title="Event Commitments">
                    {facultyCommitments?.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Calendar className="h-12 w-12 mb-3 opacity-20" />
                        <p className="font-medium">No commitments yet</p>
                        <p className="text-sm">Invite this faculty to events</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {facultyCommitments?.map((commitment: any) => (
                          <div
                            key={commitment.id}
                            className="p-3 rounded-lg border bg-card hover:bg-secondary/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {commitment.event?.name || "Unknown Event"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {commitment.event?.start_date && new Date(commitment.event.start_date).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                  {commitment.event?.venue_name && ` • ${commitment.event.venue_name}`}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] flex-shrink-0",
                                  commitment.status === "confirmed" ? "bg-success/20 text-success border-0" : "bg-amber-500/20 text-amber-600 border-0"
                                )}
                              >
                                {commitment.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {commitment.attendee_designation || commitment.ticket_type?.name || "Faculty"}
                              </Badge>
                              {commitment.custom_fields?.topic && (
                                <span className="text-xs text-muted-foreground truncate">
                                  Topic: {commitment.custom_fields.topic}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </SlideOverSection>
                )}
              </div>

              <SlideOverFooter>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/faculty/${selectedFaculty.id}/edit`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setIsInviteModalOpen(true)}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Invite
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(`mailto:${selectedFaculty.email}`)}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                </div>
                {selectedFaculty.status !== "blacklisted" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={async () => {
                      if (!confirm(`Blacklist ${selectedFaculty.name}? They will be excluded from future invitations.`)) return
                      const { error } = await (supabase as any)
                        .from("faculty")
                        .update({ status: "blacklisted" })
                        .eq("id", selectedFaculty.id)
                      if (error) {
                        toast.error("Failed to blacklist faculty")
                      } else {
                        toast.success(`${selectedFaculty.name} has been blacklisted`)
                        setSelectedFaculty(null)
                        queryClient.invalidateQueries({ queryKey: ["faculty"] })
                      }
                    }}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Blacklist Faculty
                  </Button>
                )}
              </SlideOverFooter>
            </>
          )}
        </SlideOver>
      </div>

      {/* Invite Faculty Modal */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Invite to Event
            </DialogTitle>
          </DialogHeader>

          {selectedFaculty && (
            <div className="space-y-4">
              {/* Faculty Info */}
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  {selectedFaculty.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">
                    {selectedFaculty.title ? `${selectedFaculty.title} ` : ""}{selectedFaculty.name}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedFaculty.email}</p>
                </div>
              </div>

              {/* Event Selection */}
              <div className="space-y-2">
                <Label>Select Event</Label>
                <Select value={inviteEventId} onValueChange={(value) => {
                  setInviteEventId(value)
                  setInviteTicketId("") // Reset ticket when event changes
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events?.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {FACULTY_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ticket Selection */}
              {inviteEventId && (
                <div className="space-y-2">
                  <Label>Ticket Type</Label>
                  <Select value={inviteTicketId} onValueChange={setInviteTicketId}>
                    <SelectTrigger>
                      <SelectValue placeholder={ticketTypes?.length ? "Choose a ticket" : "No speaker tickets found"} />
                    </SelectTrigger>
                    <SelectContent>
                      {ticketTypes?.map((ticket) => (
                        <SelectItem key={ticket.id} value={ticket.id}>
                          {ticket.name} {ticket.price > 0 ? `(₹${ticket.price})` : "(Free)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {ticketTypes?.length === 0 && (
                    <p className="text-xs text-amber-600">
                      No Speaker/Faculty ticket found. Please create one in the event tickets page.
                    </p>
                  )}
                </div>
              )}

              {/* Topic/Session */}
              <div className="space-y-2">
                <Label>Topic / Session (Optional)</Label>
                <Input
                  placeholder="e.g., Laparoscopic Surgery Techniques"
                  value={inviteTopic}
                  onChange={(e) => setInviteTopic(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The topic or session this faculty will present
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => inviteFaculty.mutate()}
              disabled={!inviteEventId || !inviteTicketId || inviteFaculty.isPending}
            >
              {inviteFaculty.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Inviting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Invite
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
