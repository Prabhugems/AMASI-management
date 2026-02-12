"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
} from "@/components/ui/dialog"
import {
  Sheet,
  ResizableSheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Building2,
  Plus,
  Loader2,
  MoreHorizontal,
  Edit,
  Trash2,
  Search,
  Download,
  Globe,
  Phone,
  Mail,
  AlertTriangle,
  UserPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Tier = {
  id: string
  name: string
  color: string
}

type Contact = {
  id: string
  name: string
  designation: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
}

type Sponsor = {
  id: string
  name: string
  logo_url: string | null
  website: string | null
  description: string | null
  company_address: string | null
  company_phone: string | null
  company_email: string | null
  status: string
  amount_agreed: number
  amount_paid: number
  payment_status: string
  tier_id: string | null
  notes: string | null
  confirmed_at: string | null
  created_at: string
  sponsor_tiers?: Tier | null
  sponsor_contacts?: Contact[]
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: "bg-amber-500" },
  { value: "confirmed", label: "Confirmed", color: "bg-green-500" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-500" },
]

export default function SponsorsListPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [filterTier, setFilterTier] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [showDialog, setShowDialog] = useState(false)
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null)
  const [deleteSponsor, setDeleteSponsor] = useState<Sponsor | null>(null)
  const [viewSponsor, setViewSponsor] = useState<Sponsor | null>(null)
  const [showContactDialog, setShowContactDialog] = useState(false)

  const [form, setForm] = useState({
    name: "",
    logo_url: "",
    website: "",
    description: "",
    company_address: "",
    company_phone: "",
    company_email: "",
    tier_id: "",
    status: "pending",
    amount_agreed: 0,
    amount_paid: 0,
    payment_status: "pending",
    notes: "",
  })

  const [contactForm, setContactForm] = useState({
    name: "",
    designation: "",
    email: "",
    phone: "",
    is_primary: false,
  })

  // Fetch tiers
  const { data: tiers } = useQuery({
    queryKey: ["sponsor-tiers", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sponsor_tiers")
        .select("id, name, color")
        .eq("event_id", eventId)
        .order("display_order")
      return (data || []) as Tier[]
    },
  })

  // Fetch sponsors (raw)
  const { data: sponsorsRaw, isLoading } = useQuery({
    queryKey: ["sponsors-raw", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sponsors")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
      return (data || []) as Sponsor[]
    },
  })

  // Fetch sponsor contacts
  const { data: contacts } = useQuery({
    queryKey: ["sponsor-contacts", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sponsor_contacts")
        .select("*")
      return (data || []) as any[]
    },
  })

  // Map tier info
  const tierMap = useMemo(() => {
    if (!tiers) return {}
    return tiers.reduce((acc, t) => {
      acc[t.id] = { id: t.id, name: t.name, color: t.color }
      return acc
    }, {} as Record<string, Tier>)
  }, [tiers])

  // Map contacts by sponsor_id
  const contactsMap = useMemo(() => {
    if (!contacts) return {}
    return contacts.reduce((acc, c) => {
      if (!acc[c.sponsor_id]) acc[c.sponsor_id] = []
      acc[c.sponsor_id].push(c)
      return acc
    }, {} as Record<string, any[]>)
  }, [contacts])

  // Combine sponsors with tier and contacts data
  const sponsors = useMemo(() => {
    if (!sponsorsRaw) return []
    return sponsorsRaw.map(s => ({
      ...s,
      sponsor_tiers: s.tier_id ? tierMap[s.tier_id] || null : null,
      sponsor_contacts: contactsMap[s.id] || []
    })) as Sponsor[]
  }, [sponsorsRaw, tierMap, contactsMap])

  // Create sponsor
  const createSponsor = useMutation({
    mutationFn: async (data: typeof form) => {
      const { error } = await (supabase as any)
        .from("sponsors")
        .insert({
          event_id: eventId,
          name: data.name,
          logo_url: data.logo_url || null,
          website: data.website || null,
          description: data.description || null,
          company_address: data.company_address || null,
          company_phone: data.company_phone || null,
          company_email: data.company_email || null,
          tier_id: data.tier_id || null,
          status: data.status,
          amount_agreed: data.amount_agreed,
          amount_paid: data.amount_paid,
          payment_status: data.payment_status,
          notes: data.notes || null,
        })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Sponsor added")
      queryClient.invalidateQueries({ queryKey: ["sponsors", eventId] })
      setShowDialog(false)
      resetForm()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Update sponsor
  const updateSponsor = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof form }) => {
      const { error } = await (supabase as any)
        .from("sponsors")
        .update({
          name: data.name,
          logo_url: data.logo_url || null,
          website: data.website || null,
          description: data.description || null,
          company_address: data.company_address || null,
          company_phone: data.company_phone || null,
          company_email: data.company_email || null,
          tier_id: data.tier_id || null,
          status: data.status,
          amount_agreed: data.amount_agreed,
          amount_paid: data.amount_paid,
          payment_status: data.payment_status,
          notes: data.notes || null,
          confirmed_at: data.status === "confirmed" ? new Date().toISOString() : null,
        })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Sponsor updated")
      queryClient.invalidateQueries({ queryKey: ["sponsors", eventId] })
      setShowDialog(false)
      setEditingSponsor(null)
      resetForm()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Delete sponsor
  const deleteSponsorMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("sponsors")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Sponsor deleted")
      queryClient.invalidateQueries({ queryKey: ["sponsors", eventId] })
      setDeleteSponsor(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Add contact
  const addContact = useMutation({
    mutationFn: async ({ sponsorId, data }: { sponsorId: string; data: typeof contactForm }) => {
      const { error } = await (supabase as any)
        .from("sponsor_contacts")
        .insert({
          sponsor_id: sponsorId,
          name: data.name,
          designation: data.designation || null,
          email: data.email || null,
          phone: data.phone || null,
          is_primary: data.is_primary,
        })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Contact added")
      queryClient.invalidateQueries({ queryKey: ["sponsors", eventId] })
      setShowContactDialog(false)
      setContactForm({ name: "", designation: "", email: "", phone: "", is_primary: false })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Delete contact
  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("sponsor_contacts")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Contact removed")
      queryClient.invalidateQueries({ queryKey: ["sponsors", eventId] })
    },
  })

  const resetForm = () => {
    setForm({
      name: "",
      logo_url: "",
      website: "",
      description: "",
      company_address: "",
      company_phone: "",
      company_email: "",
      tier_id: "",
      status: "pending",
      amount_agreed: 0,
      amount_paid: 0,
      payment_status: "pending",
      notes: "",
    })
  }

  const openEditDialog = (sponsor: Sponsor) => {
    setForm({
      name: sponsor.name,
      logo_url: sponsor.logo_url || "",
      website: sponsor.website || "",
      description: sponsor.description || "",
      company_address: sponsor.company_address || "",
      company_phone: sponsor.company_phone || "",
      company_email: sponsor.company_email || "",
      tier_id: sponsor.tier_id || "",
      status: sponsor.status,
      amount_agreed: sponsor.amount_agreed,
      amount_paid: sponsor.amount_paid,
      payment_status: sponsor.payment_status,
      notes: sponsor.notes || "",
    })
    setEditingSponsor(sponsor)
    setShowDialog(true)
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Company name is required")
      return
    }
    if (editingSponsor) {
      updateSponsor.mutate({ id: editingSponsor.id, data: form })
    } else {
      createSponsor.mutate(form)
    }
  }

  // Filter sponsors
  const filteredSponsors = useMemo(() => {
    if (!sponsors) return []
    return sponsors.filter(s => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.company_email?.toLowerCase().includes(search.toLowerCase())
      const matchesTier = filterTier === "all" || s.tier_id === filterTier
      const matchesStatus = filterStatus === "all" || s.status === filterStatus
      return matchesSearch && matchesTier && matchesStatus
    })
  }, [sponsors, search, filterTier, filterStatus])

  // Export
  const exportSponsors = () => {
    const headers = ["Name", "Tier", "Status", "Confirmed Date", "Email", "Phone", "Amount Agreed", "Amount Paid", "Created At"]
    const rows = filteredSponsors.map(s => [
      s.name,
      s.sponsor_tiers?.name || "",
      s.status,
      s.confirmed_at ? new Date(s.confirmed_at).toLocaleDateString("en-IN") : "",
      s.company_email || "",
      s.company_phone || "",
      s.amount_agreed,
      s.amount_paid,
      s.created_at ? new Date(s.created_at).toLocaleDateString("en-IN") : "",
    ])
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `sponsors-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Sponsors exported")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Sponsors</h1>
          <p className="text-muted-foreground">Manage event sponsors</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportSponsors}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => { resetForm(); setEditingSponsor(null); setShowDialog(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Sponsor
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sponsors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterTier} onValueChange={setFilterTier}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            {tiers?.map(tier => (
              <SelectItem key={tier.id} value={tier.id}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded" style={{ backgroundColor: tier.color }} />
                  {tier.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredSponsors.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Sponsors Found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {sponsors?.length === 0 ? "Start adding sponsors for your event" : "No sponsors match your filters"}
          </p>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Sponsor
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Sponsor</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSponsors.map((sponsor) => {
                const statusInfo = STATUS_OPTIONS.find(s => s.value === sponsor.status)
                const primaryContact = sponsor.sponsor_contacts?.find(c => c.is_primary) || sponsor.sponsor_contacts?.[0]

                return (
                  <TableRow
                    key={sponsor.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setViewSponsor(sponsor)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {sponsor.logo_url ? (
                          <img
                            src={sponsor.logo_url}
                            alt={sponsor.name}
                            className="w-10 h-10 object-contain rounded border bg-white"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{sponsor.name}</p>
                          {sponsor.website && (
                            <a
                              href={sponsor.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Globe className="h-3 w-3" />
                              Website
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {sponsor.sponsor_tiers ? (
                        <Badge style={{ backgroundColor: sponsor.sponsor_tiers.color }} className="text-white">
                          {sponsor.sponsor_tiers.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {primaryContact ? (
                        <div>
                          <p className="text-sm">{primaryContact.name}</p>
                          {primaryContact.email && (
                            <p className="text-xs text-muted-foreground">{primaryContact.email}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No contact</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-mono font-medium">₹{Number(sponsor.amount_agreed).toLocaleString()}</p>
                      {sponsor.amount_paid > 0 && (
                        <p className="text-xs text-green-600">Paid: ₹{Number(sponsor.amount_paid).toLocaleString()}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-0.5">
                        <Badge className={cn("text-white", statusInfo?.color)}>
                          {statusInfo?.label}
                        </Badge>
                        {sponsor.status === "confirmed" && sponsor.confirmed_at && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(sponsor.confirmed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(sponsor)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setViewSponsor(sponsor); setShowContactDialog(true) }}>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add Contact
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteSponsor(sponsor)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Sponsor Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setEditingSponsor(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSponsor ? "Edit Sponsor" : "Add Sponsor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Company Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Sponsor Company Name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Tier</Label>
                <Select value={form.tier_id} onValueChange={(v) => setForm({ ...form, tier_id: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiers?.map(tier => (
                      <SelectItem key={tier.id} value={tier.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: tier.color }} />
                          {tier.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Logo URL</Label>
                <Input
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Website</Label>
                <Input
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description..."
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Contact Information</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    value={form.company_email}
                    onChange={(e) => setForm({ ...form, company_email: e.target.value })}
                    placeholder="contact@company.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={form.company_phone}
                    onChange={(e) => setForm({ ...form, company_phone: e.target.value })}
                    placeholder="+91..."
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Label>Address</Label>
                <Textarea
                  value={form.company_address}
                  onChange={(e) => setForm({ ...form, company_address: e.target.value })}
                  placeholder="Company address..."
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Sponsorship Details</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Amount Agreed (₹)</Label>
                  <Input
                    type="number"
                    value={form.amount_agreed || ""}
                    onChange={(e) => setForm({ ...form, amount_agreed: parseFloat(e.target.value) || 0 })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Amount Paid (₹)</Label>
                  <Input
                    type="number"
                    value={form.amount_paid || ""}
                    onChange={(e) => setForm({ ...form, amount_paid: parseFloat(e.target.value) || 0 })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Payment Status</Label>
                  <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Internal notes..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createSponsor.isPending || updateSponsor.isPending}
            >
              {(createSponsor.isPending || updateSponsor.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingSponsor ? "Update" : "Add"} Sponsor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Sponsor Sheet */}
      <Sheet open={!!viewSponsor && !showContactDialog} onOpenChange={(open) => !open && setViewSponsor(null)}>
        <ResizableSheetContent defaultWidth={500} minWidth={400} maxWidth={800} storageKey="sponsors-sheet-width" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Sponsor Details</SheetTitle>
          </SheetHeader>
          {viewSponsor && (
            <div className="space-y-6 py-6">
              {/* Logo & Name */}
              <div className="flex items-center gap-4">
                {viewSponsor.logo_url ? (
                  <img
                    src={viewSponsor.logo_url}
                    alt={viewSponsor.name}
                    className="w-16 h-16 object-contain rounded border bg-white"
                  />
                ) : (
                  <div className="w-16 h-16 rounded border bg-muted flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold">{viewSponsor.name}</h3>
                  {viewSponsor.sponsor_tiers && (
                    <Badge style={{ backgroundColor: viewSponsor.sponsor_tiers.color }} className="text-white mt-1">
                      {viewSponsor.sponsor_tiers.name}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                {viewSponsor.website && (
                  <a
                    href={viewSponsor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    <Globe className="h-4 w-4" />
                    {viewSponsor.website}
                  </a>
                )}
                {viewSponsor.company_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {viewSponsor.company_email}
                  </div>
                )}
                {viewSponsor.company_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {viewSponsor.company_phone}
                  </div>
                )}
              </div>

              {/* Financials */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-3">Sponsorship</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Agreed</p>
                    <p className="text-lg font-bold">₹{Number(viewSponsor.amount_agreed).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Paid</p>
                    <p className="text-lg font-bold text-green-600">₹{Number(viewSponsor.amount_paid).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Contacts */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Contacts</h4>
                  <Button size="sm" variant="outline" onClick={() => setShowContactDialog(true)}>
                    <UserPlus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                {viewSponsor.sponsor_contacts?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contacts added</p>
                ) : (
                  <div className="space-y-2">
                    {viewSponsor.sponsor_contacts?.map(contact => (
                      <div key={contact.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{contact.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {contact.designation} {contact.is_primary && "(Primary)"}
                          </p>
                          {contact.email && <p className="text-xs">{contact.email}</p>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => deleteContact.mutate(contact.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" className="flex-1" onClick={() => { openEditDialog(viewSponsor); setViewSponsor(null) }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </div>
          )}
        </ResizableSheetContent>
      </Sheet>

      {/* Add Contact Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact Person</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                placeholder="Contact name"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Designation</Label>
              <Input
                value={contactForm.designation}
                onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })}
                placeholder="e.g., Marketing Manager"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="email@company.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  placeholder="+91..."
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactDialog(false)}>Cancel</Button>
            <Button
              onClick={() => viewSponsor && addContact.mutate({ sponsorId: viewSponsor.id, data: contactForm })}
              disabled={addContact.isPending || !contactForm.name.trim()}
            >
              {addContact.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteSponsor} onOpenChange={(open) => !open && setDeleteSponsor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Sponsor
            </DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete <strong>{deleteSponsor?.name}</strong>?
            This will also remove all contacts and stall assignments.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSponsor(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteSponsor && deleteSponsorMutation.mutate(deleteSponsor.id)}
              disabled={deleteSponsorMutation.isPending}
            >
              {deleteSponsorMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
