"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  IdCard,
  Loader2,
  Users,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  SlideOver,
  SlideOverSection,
} from "@/components/ui/slide-over"

type Application = {
  id: string
  name: string
  email: string
  phone: string | null
  membership_type: string | null
  status: string
  application_number: string | null
  city: string | null
  state: string | null
  country: string | null
  father_name: string | null
  date_of_birth: string | null
  gender: string | null
  nationality: string | null
  street_address_1: string | null
  street_address_2: string | null
  postal_code: string | null
  mobile_code: string | null
  ug_college: string | null
  ug_university: string | null
  ug_year: string | null
  pg_degree: string | null
  pg_college: string | null
  pg_university: string | null
  pg_year: string | null
  mci_council_number: string | null
  mci_council_state: string | null
  imr_registration_no: string | null
  asi_membership_no: string | null
  asi_state: string | null
  assigned_amasi_number: number | null
  review_notes: string | null
  reviewed_at: string | null
  created_at: string
}

export default function ApplicationsPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("pending")
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [amasiNumber, setAmasiNumber] = useState("")
  const [reviewNotes, setReviewNotes] = useState("")

  const queryClient = useQueryClient()

  const { data: response, isLoading, refetch } = useQuery({
    queryKey: ["membership-applications", statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: statusFilter,
        search,
      })
      const res = await fetch(`/api/membership/applications?${params}`)
      if (!res.ok) throw new Error("Failed to fetch applications")
      return res.json()
    },
  })

  const applications: Application[] = response?.data || []

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedApp || !amasiNumber) throw new Error("AMASI number is required")
      const res = await fetch(`/api/membership/applications/${selectedApp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          amasi_number: amasiNumber,
          review_notes: reviewNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to approve")
      return data
    },
    onSuccess: (data) => {
      toast.success(data.message)
      setApproveModalOpen(false)
      setSelectedApp(null)
      setAmasiNumber("")
      setReviewNotes("")
      queryClient.invalidateQueries({ queryKey: ["membership-applications"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedApp) throw new Error("No application selected")
      const res = await fetch(`/api/membership/applications/${selectedApp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          review_notes: reviewNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to reject")
      return data
    },
    onSuccess: (data) => {
      toast.success(data.message)
      setRejectModalOpen(false)
      setSelectedApp(null)
      setReviewNotes("")
      queryClient.invalidateQueries({ queryKey: ["membership-applications"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-600 border-0"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case "approved":
        return <Badge className="bg-green-500/20 text-green-600 border-0"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-600 border-0"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-6rem)]">
        {/* Left Panel */}
        <div className="flex flex-col overflow-hidden flex-1">
          {/* Header */}
          <div className="flex-shrink-0 p-6 border-b border-border bg-background">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Membership Applications</h1>
                <p className="text-sm text-muted-foreground">
                  Review and process new membership requests
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or application no..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 w-9 p-0">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : applications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Users className="h-12 w-12 mb-3 opacity-20" />
                <p>No applications found</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className={cn(
                      "flex items-center gap-4 p-4 cursor-pointer transition-all hover:bg-secondary/50",
                      selectedApp?.id === app.id && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                      {getInitials(app.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{app.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{app.email}</p>
                    </div>
                    <div className="flex-shrink-0 hidden sm:block">
                      <span className="font-mono text-xs text-muted-foreground">
                        {app.application_number}
                      </span>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(app.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-secondary/30">
            <span className="text-sm text-muted-foreground">{applications.length} applications</span>
          </div>
        </div>

        {/* Right Panel - SlideOver */}
        <SlideOver
          open={!!selectedApp}
          onClose={() => setSelectedApp(null)}
          title={selectedApp?.name || "Application Details"}
          subtitle={selectedApp?.application_number || undefined}
          width="lg"
          showOverlay={false}
        >
          {selectedApp && (
            <div className="flex-1 overflow-y-auto">
              <SlideOverSection>
                <div className="p-4 rounded-xl bg-secondary/50 flex items-center gap-4">
                  {getStatusBadge(selectedApp.status)}
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Applied {new Date(selectedApp.created_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                  {selectedApp.assigned_amasi_number && (
                    <Badge variant="outline" className="font-mono">
                      AMASI #{selectedApp.assigned_amasi_number}
                    </Badge>
                  )}
                </div>
              </SlideOverSection>

              <SlideOverSection title="Personal">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{selectedApp.name}</span></div>
                  {selectedApp.father_name && <div className="flex justify-between"><span className="text-muted-foreground">Father</span><span>{selectedApp.father_name}</span></div>}
                  {selectedApp.date_of_birth && <div className="flex justify-between"><span className="text-muted-foreground">DOB</span><span>{new Date(selectedApp.date_of_birth).toLocaleDateString("en-IN")}</span></div>}
                  {selectedApp.gender && <div className="flex justify-between"><span className="text-muted-foreground">Gender</span><span>{selectedApp.gender}</span></div>}
                  {selectedApp.membership_type && <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{selectedApp.membership_type}</span></div>}
                </div>
              </SlideOverSection>

              <SlideOverSection title="Contact">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span>{selectedApp.email}</span></div>
                  {selectedApp.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{selectedApp.mobile_code || ""} {selectedApp.phone}</span></div>}
                </div>
              </SlideOverSection>

              {(selectedApp.city || selectedApp.state) && (
                <SlideOverSection title="Address">
                  <div className="space-y-1 text-sm">
                    {selectedApp.street_address_1 && <p>{selectedApp.street_address_1}</p>}
                    {selectedApp.street_address_2 && <p>{selectedApp.street_address_2}</p>}
                    <p>{[selectedApp.city, selectedApp.state, selectedApp.postal_code].filter(Boolean).join(", ")}</p>
                    {selectedApp.country && <p>{selectedApp.country}</p>}
                  </div>
                </SlideOverSection>
              )}

              {(selectedApp.ug_college || selectedApp.pg_college) && (
                <SlideOverSection title="Education">
                  <div className="space-y-2 text-sm">
                    {selectedApp.ug_college && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">UG</p>
                        <p>{selectedApp.ug_college} ({selectedApp.ug_year})</p>
                        {selectedApp.ug_university && <p className="text-muted-foreground">{selectedApp.ug_university}</p>}
                      </div>
                    )}
                    {selectedApp.pg_college && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">PG - {selectedApp.pg_degree}</p>
                        <p>{selectedApp.pg_college} ({selectedApp.pg_year})</p>
                        {selectedApp.pg_university && <p className="text-muted-foreground">{selectedApp.pg_university}</p>}
                      </div>
                    )}
                  </div>
                </SlideOverSection>
              )}

              {(selectedApp.mci_council_number || selectedApp.asi_membership_no) && (
                <SlideOverSection title="Professional">
                  <div className="space-y-2 text-sm">
                    {selectedApp.mci_council_number && <div className="flex justify-between"><span className="text-muted-foreground">MCI #</span><span>{selectedApp.mci_council_number} ({selectedApp.mci_council_state})</span></div>}
                    {selectedApp.imr_registration_no && <div className="flex justify-between"><span className="text-muted-foreground">IMR #</span><span>{selectedApp.imr_registration_no}</span></div>}
                    {selectedApp.asi_membership_no && <div className="flex justify-between"><span className="text-muted-foreground">ASI #</span><span>{selectedApp.asi_membership_no} ({selectedApp.asi_state})</span></div>}
                  </div>
                </SlideOverSection>
              )}

              {selectedApp.review_notes && (
                <SlideOverSection title="Review Notes">
                  <p className="text-sm text-muted-foreground">{selectedApp.review_notes}</p>
                </SlideOverSection>
              )}

              {/* Action Buttons */}
              {selectedApp.status === "pending" && (
                <div className="p-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => setApproveModalOpen(true)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setRejectModalOpen(true)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SlideOver>
      </div>

      {/* Approve Modal */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Approve Application
            </DialogTitle>
            <DialogDescription>
              Approve {selectedApp?.name}&apos;s membership application and assign an AMASI number.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>AMASI Number *</Label>
              <Input
                type="number"
                placeholder="Enter AMASI number to assign"
                value={amasiNumber}
                onChange={(e) => setAmasiNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Review Notes (Optional)</Label>
              <Textarea
                placeholder="Add any notes..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveModalOpen(false)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => approveMutation.mutate()}
              disabled={!amasiNumber || approveMutation.isPending}
            >
              {approveMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Approving...</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-2" />Approve & Create Member</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Reject Application
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to reject {selectedApp?.name}&apos;s application?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason for Rejection (Optional)</Label>
              <Textarea
                placeholder="Provide a reason..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Rejecting...</>
              ) : (
                <><XCircle className="h-4 w-4 mr-2" />Reject Application</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
