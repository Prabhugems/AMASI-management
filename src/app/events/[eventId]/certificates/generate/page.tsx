"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Award,
  Loader2,
  Download,
  Search,
  CheckCircle,
  Clock,
  Users,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Attendee = {
  id: string
  attendee_name: string
  attendee_email: string
  attendee_designation?: string
  status: string
  certificate_generated_at: string | null
  custom_fields: {
    certificate_generated?: boolean
    certificate_url?: string
  } | null
}

export default function GenerateCertificatesPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "pending" | "generated">("all")
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set())
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [generating, setGenerating] = useState(false)

  // Fetch attendees
  const { data: attendees, isLoading: attendeesLoading } = useQuery({
    queryKey: ["certificate-attendees", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, attendee_designation, status, certificate_generated_at, custom_fields")
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .order("attendee_name")

      return (data || []) as Attendee[]
    },
  })

  // Fetch templates via API route (bypasses RLS)
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["certificate-templates-active", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/certificate-templates?event_id=${eventId}`, { cache: "no-store" })
      if (!res.ok) return []
      const allTemplates = await res.json()
      // Filter to only active templates
      return allTemplates.filter((t: any) => t.is_active !== false) as { id: string; name: string }[]
    },
    retry: 2,
    staleTime: 0,
    refetchOnMount: "always",
  })

  // Filter attendees
  const filteredAttendees = useMemo(() => {
    if (!attendees) return []
    return attendees.filter(a => {
      const matchesSearch =
        a.attendee_name.toLowerCase().includes(search.toLowerCase()) ||
        a.attendee_email.toLowerCase().includes(search.toLowerCase())

      const generated = !!a.certificate_generated_at
      const matchesFilter =
        filter === "all" ||
        (filter === "pending" && !generated) ||
        (filter === "generated" && generated)

      return matchesSearch && matchesFilter
    })
  }, [attendees, search, filter])

  // Stats
  const stats = useMemo(() => {
    if (!attendees) return { total: 0, generated: 0, pending: 0 }
    const generated = attendees.filter(a => !!a.certificate_generated_at).length
    return {
      total: attendees.length,
      generated,
      pending: attendees.length - generated,
    }
  }, [attendees])

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedAttendees)
    if (newSelection.has(id)) newSelection.delete(id)
    else newSelection.add(id)
    setSelectedAttendees(newSelection)
  }

  const selectAllPending = () => {
    const pending = filteredAttendees.filter(a => !a.certificate_generated_at)
    setSelectedAttendees(new Set(pending.map(a => a.id)))
  }

  const generateCertificates = async () => {
    if (selectedAttendees.size === 0) {
      toast.error("Select attendees first")
      return
    }
    if (!selectedTemplate) {
      toast.error("Select a template first")
      return
    }

    setGenerating(true)
    try {
      const registrationIds = Array.from(selectedAttendees)

      // Call the certificate generation API
      const response = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          template_id: selectedTemplate,
          registration_ids: registrationIds,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to generate certificates")
      }

      // Download the generated PDF
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `certificates-${eventId.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Mark registrations as certificate generated
      const now = new Date().toISOString()
      for (const id of registrationIds) {
        await (supabase as any)
          .from("registrations")
          .update({
            certificate_generated_at: now,
            custom_fields: {
              ...(attendees?.find(a => a.id === id)?.custom_fields || {}),
              certificate_generated: true,
              certificate_generated_at: now,
            },
          })
          .eq("id", id)
      }

      queryClient.invalidateQueries({ queryKey: ["certificate-attendees", eventId] })
      toast.success(`Generated and downloaded ${selectedAttendees.size} certificates`)
      setSelectedAttendees(new Set())
    } catch (error: any) {
      toast.error(error.message || "Failed to generate certificates")
    } finally {
      setGenerating(false)
    }
  }

  if (attendeesLoading || templatesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Generate Certificates</h1>
        <p className="text-muted-foreground">Bulk generate certificates for attendees</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "all" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("all")}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total Attendees</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "generated" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("generated")}
        >
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Generated</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.generated}</p>
        </div>
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "pending" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("pending")}
        >
          <div className="flex items-center gap-2 text-amber-500">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Pending</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.pending}</p>
        </div>
      </div>

      {/* No templates warning */}
      {templates?.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">No active templates</p>
            <p className="text-sm text-amber-600">Create and activate a certificate template before generating.</p>
          </div>
        </div>
      )}

      {/* Actions */}
      {selectedAttendees.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Award className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-800">{selectedAttendees.size} selected</span>
          <div className="flex-1" />
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              {templates?.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => setSelectedAttendees(new Set())}>
            Clear
          </Button>
          <Button size="sm" onClick={generateCertificates} disabled={generating || !selectedTemplate}>
            <Download className="h-4 w-4 mr-2" />
            {generating ? "Generating..." : "Generate"}
          </Button>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search attendees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="sm" onClick={selectAllPending}>
          Select Pending ({stats.pending})
        </Button>
      </div>

      {/* Attendees Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedAttendees.size === filteredAttendees.length && filteredAttendees.length > 0}
                  onCheckedChange={() => {
                    if (selectedAttendees.size === filteredAttendees.length) {
                      setSelectedAttendees(new Set())
                    } else {
                      setSelectedAttendees(new Set(filteredAttendees.map(a => a.id)))
                    }
                  }}
                />
              </TableHead>
              <TableHead>Attendee</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Certificate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAttendees.map((attendee) => {
              const generated = !!attendee.certificate_generated_at

              return (
                <TableRow key={attendee.id} className={cn(!generated && "bg-amber-50/30")}>
                  <TableCell>
                    <Checkbox
                      checked={selectedAttendees.has(attendee.id)}
                      onCheckedChange={() => toggleSelection(attendee.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{attendee.attendee_name}</p>
                    <p className="text-xs text-muted-foreground">{attendee.attendee_email}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {attendee.attendee_designation || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-green-50 text-green-600">
                      Confirmed
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {generated ? (
                      <Badge className="bg-green-500 text-white">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Generated
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-500">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
