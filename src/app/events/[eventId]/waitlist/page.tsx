"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ListOrdered,
  Loader2,
  MoreHorizontal,
  Search,
  Download,
  Bell,
  UserCheck,
  Trash2,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type WaitlistEntry = {
  id: string
  name: string
  email: string
  phone: string | null
  position: number
  status: string
  notified_at: string | null
  converted_at: string | null
  registration_id: string | null
  ticket_type_id: string | null
  created_at: string
  ticket_types?: { id: string; name: string } | null
}

const STATUS_OPTIONS = [
  { value: "waiting", label: "Waiting", color: "bg-amber-500", icon: Clock },
  { value: "notified", label: "Notified", color: "bg-blue-500", icon: Bell },
  { value: "converted", label: "Converted", color: "bg-green-500", icon: CheckCircle },
  { value: "cancelled", label: "Cancelled", color: "bg-red-500", icon: XCircle },
]

export default function WaitlistPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [deleteEntry, setDeleteEntry] = useState<WaitlistEntry | null>(null)

  const { data: entries, isLoading } = useQuery({
    queryKey: ["waitlist", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/waitlist`)
      if (!res.ok) throw new Error("Failed to fetch waitlist")
      return res.json() as Promise<WaitlistEntry[]>
    },
  })

  const notifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${eventId}/waitlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "notified" }),
      })
      if (!res.ok) throw new Error("Failed to notify")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Entry marked as notified")
      queryClient.invalidateQueries({ queryKey: ["waitlist", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const promoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${eventId}/waitlist/${id}/promote`, {
        method: "POST",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to promote")
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message || "Promoted to registration")
      queryClient.invalidateQueries({ queryKey: ["waitlist", eventId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${eventId}/waitlist/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Entry removed")
      queryClient.invalidateQueries({ queryKey: ["waitlist", eventId] })
      setDeleteEntry(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const filtered = useMemo(() => {
    if (!entries) return []
    return entries.filter((e) => {
      const matchesSearch =
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = filterStatus === "all" || e.status === filterStatus
      return matchesSearch && matchesStatus
    })
  }, [entries, search, filterStatus])

  const stats = useMemo(() => {
    if (!entries) return { waiting: 0, notified: 0, converted: 0, total: 0 }
    return {
      waiting: entries.filter((e) => e.status === "waiting").length,
      notified: entries.filter((e) => e.status === "notified").length,
      converted: entries.filter((e) => e.status === "converted").length,
      total: entries.length,
    }
  }, [entries])

  const exportWaitlist = () => {
    const headers = ["Position", "Name", "Email", "Phone", "Ticket Type", "Status", "Joined Date"]
    const rows = filtered.map((e) => [
      e.position,
      e.name,
      e.email,
      e.phone || "",
      e.ticket_types?.name || "",
      e.status,
      new Date(e.created_at).toLocaleDateString("en-IN"),
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `waitlist-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Waitlist exported")
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
          <h1 className="text-xl sm:text-2xl font-bold">Waitlist</h1>
          <p className="text-muted-foreground">Manage event waitlist entries</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/events/${eventId}/waitlist/instructions`}>
            <Button variant="outline" size="sm">
              <BookOpen className="h-4 w-4 mr-2" />
              How to Use
            </Button>
          </Link>
          <Button variant="outline" onClick={exportWaitlist}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Waiting</p>
          <p className="text-2xl font-bold text-amber-600">{stats.waiting}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Notified</p>
          <p className="text-2xl font-bold text-blue-600">{stats.notified}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Converted</p>
          <p className="text-2xl font-bold text-green-600">{stats.converted}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <ListOrdered className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Waitlist Entries</h3>
          <p className="text-sm text-muted-foreground">
            {entries?.length === 0
              ? "No one has joined the waitlist yet"
              : "No entries match your filters"}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Ticket Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => {
                const statusInfo = STATUS_OPTIONS.find((s) => s.value === entry.status)

                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono font-medium">{entry.position}</TableCell>
                    <TableCell className="font-medium">{entry.name}</TableCell>
                    <TableCell className="text-sm">{entry.email}</TableCell>
                    <TableCell className="text-sm">{entry.phone || "-"}</TableCell>
                    <TableCell>
                      {entry.ticket_types ? (
                        <Badge variant="outline">{entry.ticket_types.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-white", statusInfo?.color)}>
                        {statusInfo?.label || entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(entry.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {entry.status === "waiting" && (
                            <DropdownMenuItem
                              onClick={() => notifyMutation.mutate(entry.id)}
                              disabled={notifyMutation.isPending}
                            >
                              <Bell className="h-4 w-4 mr-2" />
                              Mark Notified
                            </DropdownMenuItem>
                          )}
                          {(entry.status === "waiting" || entry.status === "notified") && (
                            <DropdownMenuItem
                              onClick={() => promoteMutation.mutate(entry.id)}
                              disabled={promoteMutation.isPending}
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Promote to Registration
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteEntry(entry)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
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

      {/* Delete Confirmation */}
      <Dialog open={!!deleteEntry} onOpenChange={(open) => !open && setDeleteEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Remove from Waitlist
            </DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to remove <strong>{deleteEntry?.name}</strong> from the waitlist?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEntry(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteEntry && deleteMutation.mutate(deleteEntry.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
