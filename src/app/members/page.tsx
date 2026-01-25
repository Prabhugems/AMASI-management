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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Search,
  Plus,
  Upload,
  Download,
  Users,
  UserCheck,
  IdCard,
  RefreshCw,
  Vote,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Shield,
  History,
  GraduationCap,
  Loader2,
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

const SALUTATION_OPTIONS = [
  { value: "", label: "None" },
  { value: "Dr.", label: "Dr." },
  { value: "Prof.", label: "Prof." },
  { value: "Mr.", label: "Mr." },
  { value: "Mrs.", label: "Mrs." },
  { value: "Ms.", label: "Ms." },
]

type Member = {
  id: string
  amasi_number: number | null
  name: string | null
  email: string | null
  phone: number | null
  membership_type: string | null
  status: string | null
  voting_eligible: boolean | null
  city: string | null
  state: string | null
  country: string | null
  institution: string | null
  designation: string | null
  joined_date: string | null
  expiry_date: string | null
  created_at: string | null
}

export default function MembersPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [votingFilter, setVotingFilter] = useState("all")
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [activeTab, setActiveTab] = useState("details")

  // Make Faculty modal state
  const [isMakeFacultyModalOpen, setIsMakeFacultyModalOpen] = useState(false)
  const [salutation, setSalutation] = useState("")
  const [specialty, setSpecialty] = useState("")

  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch members with filters
  const { data: members, isLoading, refetch } = useQuery({
    queryKey: ["members", search, statusFilter, votingFilter],
    queryFn: async () => {
      let query = supabase
        .from("members")
        .select("*")
        .order("amasi_number", { ascending: true })
        .limit(100)

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,email.ilike.%${search}%,amasi_number.eq.${parseInt(search) || 0}`
        )
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }
      if (votingFilter !== "all") {
        // Filter by voting_eligible (Life Members have voting rights)
        query = query.eq("voting_eligible", votingFilter === "yes")
      }

      const { data, error } = await query
      if (error) throw error
      return (data as Member[]) || []
    },
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["members-stats"],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
      // Life Members have voting rights
      const { count: voting } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("voting_eligible", true)
      const { count: active } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
      return { total: total || 0, voting: voting || 0, active: active || 0 }
    },
  })

  // Export to CSV
  const handleExport = async () => {
    const { data } = await supabase.from("members").select("*").csv()
    const blob = new Blob([data || ""], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `amasi_members_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  // Check if member already exists as faculty
  const checkExistingFaculty = async (email: string) => {
    const { data } = await (supabase as any)
      .from("faculty")
      .select("id, name, email")
      .eq("email", email)
      .single()
    return data as { id: string; name: string; email: string } | null
  }

  // Convert member to faculty mutation
  const convertToFaculty = useMutation({
    mutationFn: async () => {
      if (!selectedMember || !selectedMember.email) {
        throw new Error("No member selected or member has no email")
      }

      // Check if already exists
      const existing = await checkExistingFaculty(selectedMember.email)
      if (existing) {
        throw new Error(`Faculty already exists with this email: ${existing.name}`)
      }

      const fullName = selectedMember.name || "Unknown"

      const { data, error } = await (supabase as any)
        .from("faculty")
        .insert({
          title: salutation || null,
          name: fullName,
          email: selectedMember.email,
          phone: selectedMember.phone?.toString() || null,
          designation: selectedMember.designation || null,
          institution: selectedMember.institution || null,
          city: selectedMember.city || null,
          state: selectedMember.state || null,
          country: selectedMember.country || "India",
          specialty: specialty || null,
          status: "active",
          amasi_member_id: selectedMember.amasi_number?.toString() || null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success(`${selectedMember?.name} has been added as faculty`)
      queryClient.invalidateQueries({ queryKey: ["faculty"] })
      setIsMakeFacultyModalOpen(false)
      setSalutation("")
      setSpecialty("")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Handle make faculty button click
  const handleMakeFacultyClick = async () => {
    if (!selectedMember?.email) {
      toast.error("This member has no email address")
      return
    }

    const existing = await checkExistingFaculty(selectedMember.email)
    if (existing) {
      toast.error(`Faculty already exists with this email: ${existing.name}`)
      return
    }

    setIsMakeFacultyModalOpen(true)
  }

  const tabs = [
    { id: "details", label: "Details" },
    { id: "payments", label: "Payments" },
    { id: "activity", label: "Activity" },
  ]

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "active":
        return "bg-success/20 text-success"
      case "expired":
        return "bg-destructive/20 text-destructive"
      case "inactive":
        return "bg-warning/20 text-warning"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-5 w-5 text-success" />
      case "expired":
        return <XCircle className="h-5 w-5 text-destructive" />
      case "inactive":
        return <AlertCircle className="h-5 w-5 text-warning" />
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getMembershipTypeLabel = (type: string | null) => {
    switch (type?.toLowerCase()) {
      case "lifetime":
        return "Lifetime Member"
      case "annual":
        return "Annual Member"
      case "student":
        return "Student Member"
      case "honorary":
        return "Honorary Member"
      default:
        return type || "Standard"
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return "?"
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-6rem)]">
        {/* Left Panel - Members List */}
        <div className={cn(
          "flex flex-col overflow-hidden transition-all duration-300",
          selectedMember ? "flex-1" : "flex-1"
        )}>
          {/* Header */}
          <div className="flex-shrink-0 p-6 border-b border-border bg-background">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Members</h1>
                <p className="text-sm text-muted-foreground">
                  Manage AMASI membership database
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/members/import">
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/members/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Member
                  </Link>
                </Button>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <IdCard className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stats?.total || 0}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                </div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stats?.active || 0}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active</p>
                </div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Vote className="h-4 w-4 text-violet-500" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stats?.voting || 0}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Life/Voting</p>
                </div>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or AMASI number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Select value={votingFilter} onValueChange={setVotingFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Voting" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  <SelectItem value="yes">Life Members (Voting)</SelectItem>
                  <SelectItem value="no">Non-Life Members</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 w-9 p-0">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Members List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : members?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Users className="h-12 w-12 mb-3 opacity-20" />
                <p>No members found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {members?.map((member) => (
                  <div
                    key={member.id}
                    onClick={() => {
                      setSelectedMember(member)
                      setActiveTab("details")
                    }}
                    className={cn(
                      "flex items-center gap-4 p-4 cursor-pointer transition-all hover:bg-secondary/50",
                      selectedMember?.id === member.id && "bg-primary/5 border-l-2 border-l-primary"
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
                          {member.name || "Unknown"}
                        </p>
                        {member.voting_eligible && (
                          <Vote className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {member.email || member.institution || "—"}
                      </p>
                    </div>

                    {/* AMASI Number */}
                    <div className="flex-shrink-0 hidden sm:block">
                      <span className="font-mono text-sm font-medium text-primary">
                        #{member.amasi_number || "—"}
                      </span>
                    </div>

                    {/* Membership Type & Status */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-[10px] bg-secondary border-0 hidden md:inline-flex">
                        {member.membership_type || "Standard"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-medium border-0", getStatusColor(member.status))}
                      >
                        {member.status || "Unknown"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-secondary/30">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{members?.length || 0} members showing</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Bulk Email
              </Button>
            </div>
          </div>
        </div>

        {/* Right Panel - Member Details Slide Over */}
        <SlideOver
          open={!!selectedMember}
          onClose={() => setSelectedMember(null)}
          title={selectedMember?.name || "Member Details"}
          subtitle={selectedMember?.amasi_number ? `AMASI #${selectedMember.amasi_number}` : undefined}
          width="lg"
          showOverlay={false}
        >
          {selectedMember && (
            <>
              <SlideOverTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />

              <div className="flex-1 overflow-y-auto">
                {activeTab === "details" && (
                  <>
                    {/* Status Card */}
                    <SlideOverSection>
                      <div className="p-4 rounded-xl bg-secondary/50 flex items-center gap-4">
                        {getStatusIcon(selectedMember.status)}
                        <div className="flex-1">
                          <p className="font-medium text-foreground capitalize">
                            {selectedMember.status || "Unknown"} Member
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {getMembershipTypeLabel(selectedMember.membership_type)}
                          </p>
                        </div>
                        {selectedMember.voting_eligible && (
                          <Badge className="bg-violet-500/20 text-violet-600 border-0">
                            <Vote className="h-3 w-3 mr-1" />
                            Voting Eligible
                          </Badge>
                        )}
                      </div>
                    </SlideOverSection>

                    {/* Quick Stats */}
                    <SlideOverSection>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-secondary/50 text-center">
                          <p className="text-2xl font-bold text-primary font-mono">
                            #{selectedMember.amasi_number || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">AMASI Number</p>
                        </div>
                        <div className="p-3 rounded-xl bg-secondary/50 text-center">
                          <p className="text-lg font-bold text-foreground">
                            {selectedMember.joined_date
                              ? new Date(selectedMember.joined_date).getFullYear()
                              : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">Member Since</p>
                        </div>
                      </div>
                    </SlideOverSection>

                    {/* Contact Information */}
                    <SlideOverSection title="Contact Information">
                      <div className="space-y-3">
                        {selectedMember.email && (
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                              <p className="text-sm font-medium text-foreground truncate">{selectedMember.email}</p>
                            </div>
                          </div>
                        )}
                        {selectedMember.phone && (
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                              <p className="text-sm font-medium text-foreground">{selectedMember.phone}</p>
                            </div>
                          </div>
                        )}
                        {(selectedMember.city || selectedMember.state) && (
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground mb-0.5">Location</p>
                              <p className="text-sm font-medium text-foreground">
                                {[selectedMember.city, selectedMember.state, selectedMember.country].filter(Boolean).join(", ") || "—"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </SlideOverSection>

                    {/* Membership Details */}
                    <SlideOverSection title="Membership Details">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground mb-0.5">Membership Type</p>
                            <p className="text-sm font-medium text-foreground">
                              {getMembershipTypeLabel(selectedMember.membership_type)}
                            </p>
                          </div>
                        </div>
                        {selectedMember.joined_date && (
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground mb-0.5">Joined Date</p>
                              <p className="text-sm font-medium text-foreground">
                                {new Date(selectedMember.joined_date).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                          </div>
                        )}
                        {selectedMember.expiry_date && (
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground mb-0.5">Expiry Date</p>
                              <p className="text-sm font-medium text-foreground">
                                {new Date(selectedMember.expiry_date).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </SlideOverSection>

                    {/* Professional Info */}
                    {(selectedMember.institution || selectedMember.designation) && (
                      <SlideOverSection title="Professional Information">
                        <div className="space-y-3">
                          {selectedMember.institution && (
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                                <IdCard className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground mb-0.5">Institution</p>
                                <p className="text-sm font-medium text-foreground">{selectedMember.institution}</p>
                              </div>
                            </div>
                          )}
                          {selectedMember.designation && (
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                                <UserCheck className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground mb-0.5">Designation</p>
                                <p className="text-sm font-medium text-foreground">{selectedMember.designation}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </SlideOverSection>
                    )}
                  </>
                )}

                {activeTab === "payments" && (
                  <SlideOverSection>
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <CreditCard className="h-12 w-12 mb-3 opacity-20" />
                      <p className="font-medium">Payment History</p>
                      <p className="text-sm">Coming soon</p>
                    </div>
                  </SlideOverSection>
                )}

                {activeTab === "activity" && (
                  <SlideOverSection>
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mb-3 opacity-20" />
                      <p className="font-medium">Activity Log</p>
                      <p className="text-sm">Coming soon</p>
                    </div>
                  </SlideOverSection>
                )}
              </div>

              <SlideOverFooter>
                {/* Make Faculty Button - Prominent */}
                <Button
                  className="w-full mb-3 bg-primary"
                  size="sm"
                  onClick={handleMakeFacultyClick}
                  disabled={!selectedMember.email}
                >
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Make Faculty
                </Button>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/members/${selectedMember.id}/edit`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Renew
                  </Button>
                </div>
                {selectedMember.status === "active" && (
                  <Button variant="ghost" size="sm" className="w-full mt-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                    <XCircle className="h-4 w-4 mr-2" />
                    Deactivate Member
                  </Button>
                )}
              </SlideOverFooter>
            </>
          )}
        </SlideOver>
      </div>

      {/* Make Faculty Modal */}
      <Dialog open={isMakeFacultyModalOpen} onOpenChange={setIsMakeFacultyModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Make Faculty
            </DialogTitle>
            <DialogDescription>
              Convert this member to a faculty record
            </DialogDescription>
          </DialogHeader>

          {selectedMember && (
            <div className="space-y-4">
              {/* Member Info */}
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  {getInitials(selectedMember.name)}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{selectedMember.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedMember.email}</p>
                </div>
                <Badge variant="outline" className="font-mono">
                  #{selectedMember.amasi_number}
                </Badge>
              </div>

              {/* Salutation */}
              <div className="space-y-2">
                <Label>Salutation / Title</Label>
                <Select value={salutation} onValueChange={setSalutation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select salutation (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {SALUTATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value || "none"}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Specialty */}
              <div className="space-y-2">
                <Label>Specialty / Area of Expertise</Label>
                <Input
                  placeholder="e.g., Hospital Administration, Healthcare Management"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                />
              </div>

              {/* Summary */}
              <div className="p-3 rounded-lg border bg-card text-sm">
                <p className="font-medium mb-2">Faculty record will include:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>Name: {salutation && salutation !== "none" ? `${salutation} ` : ""}{selectedMember.name}</li>
                  <li>Email: {selectedMember.email}</li>
                  <li>Institution: {selectedMember.institution || "Not set"}</li>
                  <li>AMASI Link: #{selectedMember.amasi_number}</li>
                  {specialty && <li>Specialty: {specialty}</li>}
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMakeFacultyModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => convertToFaculty.mutate()}
              disabled={convertToFaculty.isPending}
            >
              {convertToFaculty.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Create Faculty
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
