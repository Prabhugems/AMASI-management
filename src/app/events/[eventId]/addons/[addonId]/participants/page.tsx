"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Search,
  Loader2,
  GraduationCap,
  Award,
  Download,
  MoreVertical,
  Send,
  Check,
  Users,
  IndianRupee,
} from "lucide-react"
import { format } from "date-fns"

interface Participant {
  id: string
  registration_id: string
  addon_id: string
  quantity: number
  unit_price: number
  total_price: number
  certificate_issued: boolean
  certificate_issued_at: string | null
  certificate_url: string | null
  created_at: string
  registration: {
    id: string
    registration_number: string
    attendee_name: string
    attendee_email: string
    attendee_phone: string | null
    status: string
  }
}

interface Addon {
  id: string
  name: string
  description: string | null
  price: number
  is_course: boolean
  certificate_template_id: string | null
  course_instructor: string | null
  course_duration: string | null
  course_description: string | null
}

export default function CourseParticipantsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const addonId = params.addonId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Fetch addon details
  const { data: addon, isLoading: addonLoading } = useQuery({
    queryKey: ["addon-details", addonId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("addons")
        .select("*")
        .eq("id", addonId)
        .single()
      if (error) throw error
      return data as Addon
    },
    enabled: !!addonId,
  })

  // Fetch participants (registrations that purchased this addon)
  const { data: participants, isLoading: participantsLoading } = useQuery({
    queryKey: ["addon-participants", addonId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("registration_addons")
        .select(`
          id,
          registration_id,
          addon_id,
          quantity,
          price,
          created_at,
          registration:registrations(
            id, registration_number, attendee_name, attendee_email, attendee_phone, status
          )
        `)
        .eq("addon_id", addonId)
        .order("created_at", { ascending: false })

      if (error) throw error
      // Map price to unit_price/total_price for UI compatibility
      return (data || []).map((item: any) => {
        const qty = item.quantity || 1
        const totalPrice = item.price || 0
        return {
          ...item,
          unit_price: qty > 0 ? totalPrice / qty : 0,
          total_price: totalPrice,
          certificate_issued: false,
          certificate_issued_at: null,
          certificate_url: null,
        }
      }) as Participant[]
    },
    enabled: !!addonId,
  })

  // Filter participants by search
  const filteredParticipants = participants?.filter(p => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      p.registration?.attendee_name?.toLowerCase().includes(search) ||
      p.registration?.attendee_email?.toLowerCase().includes(search) ||
      p.registration?.registration_number?.toLowerCase().includes(search)
    )
  })

  // Issue certificate mutation
  const issueCertificate = useMutation({
    mutationFn: async (participantIds: string[]) => {
      // TODO: Implement certificate generation
      // For now, just mark as issued
      for (const id of participantIds) {
        await (supabase as any)
          .from("registration_addons")
          .update({
            certificate_issued: true,
            certificate_issued_at: new Date().toISOString(),
          })
          .eq("id", id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addon-participants", addonId] })
      setSelectedIds([])
      toast.success("Certificates issued successfully")
    },
    onError: () => {
      toast.error("Failed to issue certificates")
    },
  })

  // Stats
  const stats = {
    total: participants?.length || 0,
    certificatesIssued: participants?.filter(p => p.certificate_issued).length || 0,
    totalRevenue: participants?.reduce((sum, p) => sum + (p.total_price || 0), 0) || 0,
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredParticipants?.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredParticipants?.map(p => p.id) || [])
    }
  }

  const isLoading = addonLoading || participantsLoading

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-blue-500" />
            <h1 className="text-2xl font-bold text-foreground">
              {addon?.name || "Course"} - Participants
            </h1>
          </div>
          {addon?.course_instructor && (
            <p className="text-muted-foreground mt-1">
              Instructor: {addon.course_instructor}
              {addon.course_duration && ` • ${addon.course_duration}`}
            </p>
          )}
        </div>
        {selectedIds.length > 0 && addon?.certificate_template_id && (
          <Button
            onClick={() => issueCertificate.mutate(selectedIds)}
            disabled={issueCertificate.isPending}
          >
            {issueCertificate.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Award className="h-4 w-4 mr-2" />
            )}
            Issue Certificate ({selectedIds.length})
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Participants</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Award className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.certificatesIssued}</p>
              <p className="text-xs text-muted-foreground">Certificates Issued</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <IndianRupee className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{stats.totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or registration number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Participants Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredParticipants?.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
          <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No participants yet</h3>
          <p className="text-muted-foreground">
            Participants will appear here when they purchase this course addon
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.length === filteredParticipants?.length && filteredParticipants.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Registration</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Purchased</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Certificate</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParticipants?.map((participant) => (
                <TableRow key={participant.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(participant.id)}
                      onCheckedChange={() => toggleSelect(participant.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/events/${eventId}/registrations?id=${participant.registration?.id}`}
                      className="font-mono text-sm text-primary hover:underline"
                    >
                      {participant.registration?.registration_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{participant.registration?.attendee_name}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{participant.registration?.attendee_email}</p>
                    {participant.registration?.attendee_phone && (
                      <p className="text-xs text-muted-foreground">
                        {participant.registration.attendee_phone}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(participant.created_at), "d MMM yyyy")}
                    </p>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">₹{participant.total_price?.toLocaleString() || 0}</span>
                  </TableCell>
                  <TableCell>
                    {participant.certificate_issued ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <Check className="h-3 w-3 mr-1" />
                        Issued
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!participant.certificate_issued && addon?.certificate_template_id && (
                          <DropdownMenuItem
                            onClick={() => issueCertificate.mutate([participant.id])}
                          >
                            <Award className="h-4 w-4 mr-2" />
                            Issue Certificate
                          </DropdownMenuItem>
                        )}
                        {participant.certificate_issued && participant.certificate_url && (
                          <DropdownMenuItem asChild>
                            <a href={participant.certificate_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4 mr-2" />
                              Download Certificate
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem>
                          <Send className="h-4 w-4 mr-2" />
                          Send Email
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* No certificate template warning */}
      {addon && !addon.certificate_template_id && (
        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <Award className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-medium text-amber-700">No certificate template linked</p>
              <p className="text-sm text-amber-600">
                Link a certificate template to this course to issue certificates to participants.
                <Link href={`/events/${eventId}/addons`} className="ml-1 underline">
                  Edit addon settings
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
