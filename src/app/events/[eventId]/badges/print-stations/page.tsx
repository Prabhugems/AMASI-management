"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Printer,
  Loader2,
  Search,
  CheckCircle,
  Clock,
  Users,
  Plus,
  Zap,
  QrCode,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Registration = {
  id: string
  attendee_name: string
  attendee_email: string
  attendee_designation?: string
  status: string
  badge_printed: boolean
  checked_in: boolean
}

export default function PrintStationsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "pending" | "printed">("pending")
  const [printing, setPrinting] = useState<string | null>(null)

  // Fetch registrations
  const { data: registrations, isLoading } = useQuery({
    queryKey: ["print-station-registrations", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, attendee_designation, status, badge_printed, checked_in")
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .order("attendee_name")

      return (data || []) as Registration[]
    },
  })

  // Filter registrations
  const filteredRegistrations = useMemo(() => {
    if (!registrations) return []
    return registrations.filter(r => {
      const matchesSearch =
        r.attendee_name.toLowerCase().includes(search.toLowerCase()) ||
        r.attendee_email.toLowerCase().includes(search.toLowerCase())

      const matchesFilter =
        filter === "all" ||
        (filter === "pending" && !r.badge_printed) ||
        (filter === "printed" && r.badge_printed)

      return matchesSearch && matchesFilter
    })
  }, [registrations, search, filter])

  // Stats
  const stats = useMemo(() => {
    if (!registrations) return { total: 0, printed: 0, pending: 0, checkedIn: 0 }
    const printed = registrations.filter(r => r.badge_printed).length
    const checkedIn = registrations.filter(r => r.checked_in).length
    return {
      total: registrations.length,
      printed,
      pending: registrations.length - printed,
      checkedIn,
    }
  }, [registrations])

  // Print badge mutation
  const printMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      setPrinting(registrationId)
      // TODO: Implement actual printing logic (connect to printer API)
      await new Promise(resolve => setTimeout(resolve, 1500))

      const { error } = await (supabase as any)
        .from("registrations")
        .update({ badge_printed: true })
        .eq("id", registrationId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-station-registrations", eventId] })
      toast.success("Badge printed")
    },
    onError: () => {
      toast.error("Failed to print badge")
    },
    onSettled: () => {
      setPrinting(null)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Print Stations</h1>
          <p className="text-muted-foreground">On-site badge printing for attendees</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "all" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("all")}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "printed" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("printed")}
        >
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Printed</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.printed}</p>
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
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-500">
            <Zap className="h-4 w-4" />
            <span className="text-sm">Checked In</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.checkedIn}</p>
        </div>
      </div>

      {/* Quick Print Mode Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <QrCode className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-800">Quick Print Mode</h3>
            <p className="text-sm text-blue-600 mt-1">
              Search for attendee or scan their QR code to quickly print their badge.
              Badges are automatically marked as printed.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 text-lg h-12"
          autoFocus
        />
      </div>

      {/* Attendees Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Attendee</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRegistrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  {search ? "No attendees found" : "No pending badges to print"}
                </TableCell>
              </TableRow>
            ) : (
              filteredRegistrations.map((reg) => (
                <TableRow key={reg.id} className={cn(reg.badge_printed && "bg-green-50/50")}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{reg.attendee_name}</p>
                        <p className="text-xs text-muted-foreground">{reg.attendee_email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {reg.attendee_designation || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {reg.badge_printed ? (
                        <Badge className="bg-green-500 text-white">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Printed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-500">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                      {reg.checked_in && (
                        <Badge variant="outline" className="text-blue-500">
                          <Zap className="h-3 w-3 mr-1" />
                          Checked In
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => printMutation.mutate(reg.id)}
                      disabled={printing === reg.id}
                      variant={reg.badge_printed ? "outline" : "default"}
                    >
                      {printing === reg.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Printing...
                        </>
                      ) : (
                        <>
                          <Printer className="h-4 w-4 mr-2" />
                          {reg.badge_printed ? "Reprint" : "Print Badge"}
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
