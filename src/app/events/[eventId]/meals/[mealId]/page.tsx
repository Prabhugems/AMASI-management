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
  ArrowLeft,
  Loader2,
  Search,
  Download,
  UserCheck,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type MealPlan = {
  id: string
  name: string
  date: string
  meal_type: string
  venue: string | null
}

type MealRegistration = {
  id: string
  meal_plan_id: string
  registration_id: string
  dietary_preference: string
  allergies: string | null
  special_requests: string | null
  status: string
  checked_in_at: string | null
  registrations: {
    id: string
    attendee_name: string
    attendee_email: string
    attendee_phone: string | null
  }
}

const DIETARY_OPTIONS = [
  { value: "regular", label: "Regular" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "jain", label: "Jain" },
  { value: "halal", label: "Halal" },
]

const STATUS_COLORS: Record<string, string> = {
  registered: "bg-blue-500",
  checked_in: "bg-green-500",
  no_show: "bg-red-500",
  cancelled: "bg-gray-500",
}

export default function MealDetailPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const mealId = params.mealId as string
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [filterDietary, setFilterDietary] = useState<string>("all")

  const { data: meal } = useQuery({
    queryKey: ["meal", eventId, mealId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/meals/${mealId}`)
      if (!res.ok) throw new Error("Failed to fetch meal")
      return res.json() as Promise<MealPlan>
    },
  })

  const { data: registrations, isLoading } = useQuery({
    queryKey: ["meal-registrations", eventId, mealId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/meals/${mealId}/registrations`)
      if (!res.ok) throw new Error("Failed to fetch registrations")
      return res.json() as Promise<MealRegistration[]>
    },
  })

  const bulkRegister = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/meals/${mealId}/registrations`, {
        method: "POST",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to bulk register")
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message || "Attendees registered")
      queryClient.invalidateQueries({ queryKey: ["meal-registrations", eventId, mealId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const checkIn = useMutation({
    mutationFn: async (regId: string) => {
      const res = await fetch(`/api/events/${eventId}/meals/${mealId}/registrations/${regId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "checked_in" }),
      })
      if (!res.ok) throw new Error("Failed to check in")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Checked in")
      queryClient.invalidateQueries({ queryKey: ["meal-registrations", eventId, mealId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const filtered = useMemo(() => {
    if (!registrations) return []
    return registrations.filter((r) => {
      const matchesSearch =
        r.registrations?.attendee_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.registrations?.attendee_email?.toLowerCase().includes(search.toLowerCase())
      const matchesDietary = filterDietary === "all" || r.dietary_preference === filterDietary
      return matchesSearch && matchesDietary
    })
  }, [registrations, search, filterDietary])

  const stats = useMemo(() => {
    if (!registrations) return { total: 0, checkedIn: 0 }
    return {
      total: registrations.length,
      checkedIn: registrations.filter((r) => r.status === "checked_in").length,
    }
  }, [registrations])

  const exportList = () => {
    const headers = ["Name", "Email", "Phone", "Dietary Preference", "Allergies", "Status"]
    const rows = filtered.map((r) => [
      r.registrations?.attendee_name || "",
      r.registrations?.attendee_email || "",
      r.registrations?.attendee_phone || "",
      r.dietary_preference,
      r.allergies || "",
      r.status,
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `meal-${mealId}-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Exported")
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
          <Link href={`/events/${eventId}/meals`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Meals
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold">{meal?.name || "Meal Plan"}</h1>
          <p className="text-muted-foreground">
            {meal?.meal_type && <span className="capitalize">{meal.meal_type}</span>}
            {meal?.date && <> &middot; {new Date(meal.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>}
            {meal?.venue && <> &middot; {meal.venue}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportList}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => bulkRegister.mutate()} disabled={bulkRegister.isPending}>
            {bulkRegister.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
            Register All Attendees
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Registered</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Checked In</p>
          <p className="text-2xl font-bold text-green-600">{stats.checkedIn}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Remaining</p>
          <p className="text-2xl font-bold text-amber-600">{stats.total - stats.checkedIn}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search attendees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterDietary} onValueChange={setFilterDietary}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Dietary" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dietary</SelectItem>
            {DIETARY_OPTIONS.map((d) => (
              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Registrations</h3>
          <p className="text-sm text-muted-foreground">Click &quot;Register All Attendees&quot; to bulk-enroll confirmed attendees</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Dietary</TableHead>
                <TableHead>Allergies</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((reg) => (
                <TableRow key={reg.id}>
                  <TableCell className="font-medium">{reg.registrations?.attendee_name}</TableCell>
                  <TableCell className="text-sm">{reg.registrations?.attendee_email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{reg.dietary_preference}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{reg.allergies || "-"}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-white capitalize", STATUS_COLORS[reg.status] || "bg-gray-500")}>
                      {reg.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {reg.status === "registered" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => checkIn.mutate(reg.id)}
                        disabled={checkIn.isPending}
                      >
                        <UserCheck className="h-4 w-4 mr-1" />
                        Check In
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
