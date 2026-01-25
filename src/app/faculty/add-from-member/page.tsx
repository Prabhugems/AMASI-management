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
  Users,
  UserCheck,
  IdCard,
  RefreshCw,
  Vote,
  Mail,
  Phone,
  MapPin,
  ArrowLeft,
  GraduationCap,
  Building2,
  Briefcase,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  UserPlus,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  SlideOver,
  SlideOverSection,
  SlideOverFooter,
} from "@/components/ui/slide-over"

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

const SALUTATION_OPTIONS = [
  { value: "", label: "None" },
  { value: "Dr.", label: "Dr." },
  { value: "Prof.", label: "Prof." },
  { value: "Mr.", label: "Mr." },
  { value: "Mrs.", label: "Mrs." },
  { value: "Ms.", label: "Ms." },
]

export default function AddFacultyFromMemberPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)

  // Conversion modal state
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false)
  const [salutation, setSalutation] = useState("")
  const [specialty, setSpecialty] = useState("")

  const supabase = createClient()
  const queryClient = useQueryClient()
  const router = useRouter()

  // Fetch members with filters
  const { data: members, isLoading, refetch } = useQuery({
    queryKey: ["members-for-faculty", search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("members")
        .select("*")
        .order("name", { ascending: true })
        .limit(100)

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,email.ilike.%${search}%,institution.ilike.%${search}%,amasi_number.eq.${parseInt(search) || 0}`
        )
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return (data as Member[]) || []
    },
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["members-faculty-stats"],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
      const { count: active } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
      return { total: total || 0, active: active || 0 }
    },
  })

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

      // Build full name with salutation
      const fullName = selectedMember.name || "Unknown"

      // Create faculty record
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
    onSuccess: (data) => {
      toast.success(`${selectedMember?.name} has been added as faculty`)
      queryClient.invalidateQueries({ queryKey: ["faculty"] })
      setIsConvertModalOpen(false)
      setSelectedMember(null)
      setSalutation("")
      setSpecialty("")
      // Navigate to faculty page
      router.push("/faculty")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleConvertClick = async () => {
    if (!selectedMember?.email) {
      toast.error("This member has no email address")
      return
    }

    // Check if already exists
    const existing = await checkExistingFaculty(selectedMember.email)
    if (existing) {
      toast.error(`Faculty already exists with this email: ${existing.name}`)
      return
    }

    setIsConvertModalOpen(true)
  }

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
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/faculty">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Faculty
                  </Link>
                </Button>
                <div className="h-6 w-px bg-border" />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Add Faculty from Members</h1>
                  <p className="text-sm text-muted-foreground">
                    Select an AMASI member to add as faculty
                  </p>
                </div>
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
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Members</p>
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
            </div>

            {/* Search & Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, institution, or AMASI number..."
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
                    onClick={() => setSelectedMember(member)}
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
                        {member.institution || member.email || "—"}
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
              <span className="text-xs">Click on a member to view details and convert to faculty</span>
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
              <div className="flex-1 overflow-y-auto">
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
                        Voting
                      </Badge>
                    )}
                  </div>
                </SlideOverSection>

                {/* AMASI Number */}
                <SlideOverSection>
                  <div className="p-4 rounded-xl bg-primary/5 text-center">
                    <p className="text-3xl font-bold text-primary font-mono">
                      #{selectedMember.amasi_number || "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">AMASI Membership Number</p>
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

                {/* Professional Information */}
                {(selectedMember.institution || selectedMember.designation) && (
                  <SlideOverSection title="Professional Information">
                    <div className="space-y-3">
                      {selectedMember.institution && (
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
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
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
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

                {/* Data that will be transferred */}
                <SlideOverSection title="Data to be Transferred">
                  <div className="p-3 rounded-lg bg-secondary/50 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{selectedMember.name || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium truncate ml-4">{selectedMember.email || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone</span>
                      <span className="font-medium">{selectedMember.phone || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Institution</span>
                      <span className="font-medium truncate ml-4">{selectedMember.institution || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Designation</span>
                      <span className="font-medium">{selectedMember.designation || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location</span>
                      <span className="font-medium">
                        {[selectedMember.city, selectedMember.state].filter(Boolean).join(", ") || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AMASI Link</span>
                      <span className="font-medium font-mono">#{selectedMember.amasi_number || "—"}</span>
                    </div>
                  </div>
                </SlideOverSection>
              </div>

              <SlideOverFooter>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleConvertClick}
                  disabled={!selectedMember.email}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Convert to Faculty
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                {!selectedMember.email && (
                  <p className="text-xs text-destructive text-center mt-2">
                    This member has no email address and cannot be converted
                  </p>
                )}
              </SlideOverFooter>
            </>
          )}
        </SlideOver>
      </div>

      {/* Convert to Faculty Modal */}
      <Dialog open={isConvertModalOpen} onOpenChange={setIsConvertModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Convert to Faculty
            </DialogTitle>
            <DialogDescription>
              Add additional details before creating the faculty record
            </DialogDescription>
          </DialogHeader>

          {selectedMember && (
            <div className="space-y-4">
              {/* Member Info */}
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  {getInitials(selectedMember.name)}
                </div>
                <div>
                  <p className="font-medium">{selectedMember.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedMember.email}</p>
                </div>
                <Badge variant="outline" className="ml-auto font-mono">
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
                      <SelectItem key={option.value} value={option.value}>
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
                <p className="text-xs text-muted-foreground">
                  This helps in categorizing faculty for events
                </p>
              </div>

              {/* Summary */}
              <div className="p-3 rounded-lg border bg-card">
                <p className="text-sm font-medium mb-2">Faculty record will be created with:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Name: {salutation ? `${salutation} ` : ""}{selectedMember.name}</li>
                  <li>• Email: {selectedMember.email}</li>
                  <li>• Institution: {selectedMember.institution || "Not set"}</li>
                  <li>• AMASI Link: #{selectedMember.amasi_number}</li>
                  {specialty && <li>• Specialty: {specialty}</li>}
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConvertModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => convertToFaculty.mutate()}
              disabled={convertToFaculty.isPending}
            >
              {convertToFaculty.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
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
