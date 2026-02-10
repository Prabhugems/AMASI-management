"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  Users,
  Plane,
  Train,
  Car,
  CheckCircle,
  Check,
  CreditCard,
  Route,
  ArrowRight,
  Loader2,
  AlertCircle,
  FileCheck,
  Send,
  Calendar,
  ExternalLink,
  Copy,
  Link2,
  Hotel,
  TrendingUp,
  CircleDot,
  FileSpreadsheet,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { useState } from "react"
import { cn } from "@/lib/utils"

type Guest = {
  id: string
  attendee_name: string
  custom_fields: {
    needs_travel?: boolean
    travel_details?: {
      mode?: string
      arrival_date?: string
      departure_date?: string
      hotel_required?: boolean
      hotel_check_in?: string
      hotel_check_out?: string
      pickup_required?: boolean
      drop_required?: boolean
    }
    travel_id?: {
      id_document_url?: string
      full_name_as_passport?: string
    }
    booking?: {
      onward_status?: string
      onward_cost?: number
      onward_departure_date?: string
      return_status?: string
      return_cost?: number
      pickup_required?: boolean
      pickup_status?: string
      drop_required?: boolean
      drop_status?: string
      voucher_sent?: boolean
      hotel_status?: string
      hotel_cost?: number
    }
    train_bookings?: { cost?: number; status?: string }[]
    assigned_hotel_id?: string
  } | null
}

export default function TravelOverviewPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // State hooks must be at the top
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  // Fetch guests
  const { data: guests, isLoading } = useQuery({
    queryKey: ["travel-overview-guests", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, custom_fields")
        .eq("event_id", eventId)
        .or("attendee_designation.ilike.%speaker%,attendee_designation.ilike.%faculty%,attendee_designation.ilike.%chairperson%,attendee_designation.ilike.%moderator%")

      return (data || []).filter((g: Guest) => g.custom_fields?.needs_travel) as Guest[]
    },
  })

  // Stats
  const stats = useMemo(() => {
    if (!guests) return null

    // Mode breakdown
    const byMode = { flight: 0, train: 0, self: 0 }
    guests.forEach(g => {
      const mode = g.custom_fields?.travel_details?.mode || "flight"
      if (mode === "flight") byMode.flight++
      else if (mode === "train") byMode.train++
      else byMode.self++
    })

    // Booking status
    const onwardPending = guests.filter(g => !g.custom_fields?.booking?.onward_status || g.custom_fields?.booking?.onward_status === "pending").length
    const onwardBooked = guests.filter(g => g.custom_fields?.booking?.onward_status === "booked" || g.custom_fields?.booking?.onward_status === "confirmed").length

    const returnPending = guests.filter(g => {
      const status = g.custom_fields?.booking?.return_status
      return !status || status === "pending"
    }).length
    const returnBooked = guests.filter(g => {
      const status = g.custom_fields?.booking?.return_status
      return status === "booked" || status === "confirmed"
    }).length

    // ID status
    const idSubmitted = guests.filter(g => g.custom_fields?.travel_id?.id_document_url).length
    const idDetailsSubmitted = guests.filter(g => g.custom_fields?.travel_id?.full_name_as_passport).length

    // Transfers - check both travel_details and booking
    const pickupRequired = guests.filter(g =>
      g.custom_fields?.booking?.pickup_required ||
      g.custom_fields?.travel_details?.pickup_required
    ).length
    const pickupArranged = guests.filter(g => {
      const status = g.custom_fields?.booking?.pickup_status
      return status === "arranged" || status === "confirmed"
    }).length
    const dropRequired = guests.filter(g =>
      g.custom_fields?.booking?.drop_required ||
      g.custom_fields?.travel_details?.drop_required
    ).length
    const dropArranged = guests.filter(g => {
      const status = g.custom_fields?.booking?.drop_status
      return status === "arranged" || status === "confirmed"
    }).length

    // Hotel stats
    const hotelRequired = guests.filter(g => g.custom_fields?.travel_details?.hotel_required).length
    const hotelBooked = guests.filter(g => {
      const status = g.custom_fields?.booking?.hotel_status
      return status === "booked" || status === "confirmed"
    }).length
    const hotelAssigned = guests.filter(g => g.custom_fields?.assigned_hotel_id).length

    // Costs
    let flightCost = 0
    let trainCost = 0
    let hotelCost = 0
    guests.forEach(g => {
      const b = g.custom_fields?.booking || {}
      flightCost += (b.onward_cost || 0) + (b.return_cost || 0)
      hotelCost += b.hotel_cost || 0
      g.custom_fields?.train_bookings?.forEach(t => {
        trainCost += t.cost || 0
      })
    })
    const totalCost = flightCost + trainCost + hotelCost

    // Vouchers
    const vouchersSent = guests.filter(g => g.custom_fields?.booking?.voucher_sent).length

    // Response rate - speakers who submitted travel details
    const detailsSubmitted = guests.filter(g =>
      g.custom_fields?.travel_details?.arrival_date ||
      g.custom_fields?.travel_details?.departure_date ||
      g.custom_fields?.travel_details?.mode
    ).length

    // Overall completion
    const totalTasks = guests.length * 4 // ID, onward, return, voucher
    const completedTasks = idSubmitted + onwardBooked + returnBooked + vouchersSent
    const overallCompletion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    return {
      total: guests.length,
      byMode,
      onwardPending,
      onwardBooked,
      returnPending,
      returnBooked,
      idSubmitted,
      idDetailsSubmitted,
      idMissing: guests.length - idSubmitted,
      pickupRequired,
      pickupArranged,
      dropRequired,
      dropArranged,
      hotelRequired,
      hotelBooked,
      hotelAssigned,
      flightCost,
      trainCost,
      hotelCost,
      totalCost,
      avgCostPerPerson: guests.length > 0 ? Math.round(totalCost / guests.length) : 0,
      vouchersSent,
      vouchersPending: guests.length - vouchersSent,
      detailsSubmitted,
      responseRate: guests.length > 0 ? Math.round((detailsSubmitted / guests.length) * 100) : 0,
      overallCompletion,
    }
  }, [guests])

  // Upcoming arrivals (next 7 days)
  const upcomingArrivals = useMemo(() => {
    if (!guests) return []

    const today = new Date()
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    return guests
      .filter(g => {
        const arrival = g.custom_fields?.booking?.onward_departure_date || g.custom_fields?.travel_details?.arrival_date
        if (!arrival) return false
        const date = new Date(arrival)
        return date >= today && date <= weekFromNow
      })
      .sort((a, b) => {
        const dateA = a.custom_fields?.booking?.onward_departure_date || a.custom_fields?.travel_details?.arrival_date || ""
        const dateB = b.custom_fields?.booking?.onward_departure_date || b.custom_fields?.travel_details?.arrival_date || ""
        return dateA.localeCompare(dateB)
      })
      .slice(0, 5)
  }, [guests])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const basePath = `/events/${eventId}/travel`
  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""

  const agentLinks = [
    { key: "travel", label: "Full Travel Agent", desc: "Flights + Trains + Transfers + Hotel", path: `/travel-agent/${eventId}`, color: "indigo", icon: Users },
    { key: "flight", label: "Flight Agent", desc: "Flight bookings only", path: `/flight-agent/${eventId}`, color: "blue", icon: Plane },
    { key: "train", label: "Train Agent", desc: "Train bookings only", path: `/train-agent/${eventId}`, color: "orange", icon: Train },
    { key: "cab", label: "Cab/Transfer Agent", desc: "Pickup & drop only", path: `/cab-agent/${eventId}`, color: "green", icon: Car },
  ]

  const copyLink = (path: string, key: string) => {
    navigator.clipboard.writeText(`${baseUrl}${path}`)
    setCopiedLink(key)
    toast.success("Link copied!")
    setTimeout(() => setCopiedLink(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Travel Overview</h1>
          <p className="text-muted-foreground">Quick summary of travel management</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Export to Sheets
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => window.open(`/api/events/${eventId}/export?type=travel`, "_blank")}>
              <Plane className="h-4 w-4 mr-2" />
              Travel Data
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`/api/events/${eventId}/export?type=transfers`, "_blank")}>
              <Car className="h-4 w-4 mr-2" />
              Transfers List
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.open(`/api/events/${eventId}/export?type=registrations`, "_blank")}>
              <Users className="h-4 w-4 mr-2" />
              All Registrations
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`/api/events/${eventId}/export?type=sessions`, "_blank")}>
              <Calendar className="h-4 w-4 mr-2" />
              Sessions & Speakers
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`/api/events/${eventId}/export?type=attendance`, "_blank")}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Attendance Data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Agent Portal Links */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="h-4 w-4 text-slate-600" />
          <span className="font-semibold text-sm">Share Portal Links with Agents</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {agentLinks.map((link) => {
            const Icon = link.icon
            const colorClasses: Record<string, string> = {
              indigo: "border-indigo-200 bg-indigo-50 hover:bg-indigo-100",
              blue: "border-blue-200 bg-blue-50 hover:bg-blue-100",
              orange: "border-orange-200 bg-orange-50 hover:bg-orange-100",
              green: "border-green-200 bg-green-50 hover:bg-green-100",
            }
            const iconColorClasses: Record<string, string> = {
              indigo: "text-indigo-600",
              blue: "text-blue-600",
              orange: "text-orange-600",
              green: "text-green-600",
            }
            return (
              <div key={link.key} className={cn("rounded-lg border p-3 transition-colors", colorClasses[link.color])}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn("h-4 w-4", iconColorClasses[link.color])} />
                  <span className="font-medium text-sm">{link.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{link.desc}</p>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => copyLink(link.path, link.key)}>
                    {copiedLink === link.key ? <Check className="h-3 w-3 mr-1 text-green-600" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copiedLink === link.key ? "Copied" : "Copy Link"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => window.open(link.path, "_blank")}>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Completion Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Overall Progress Ring */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle cx="40" cy="40" r="32" stroke="#e2e8f0" strokeWidth="8" fill="none" />
                <circle
                  cx="40" cy="40" r="32"
                  stroke="#3b82f6"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(stats?.overallCompletion || 0) * 2.01} 201`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-blue-600">{stats?.overallCompletion || 0}%</span>
              </div>
            </div>
            <div>
              <p className="font-semibold text-blue-800">Overall Progress</p>
              <p className="text-sm text-blue-600">{stats?.total || 0} travelers</p>
            </div>
          </div>
        </div>

        {/* Response Rate */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Response Rate</span>
            <span className="text-sm font-bold">{stats?.responseRate || 0}%</span>
          </div>
          <Progress value={stats?.responseRate || 0} className="h-2 mb-2" />
          <p className="text-xs text-muted-foreground">{stats?.detailsSubmitted || 0} of {stats?.total || 0} submitted details</p>
        </div>

        {/* ID Submission */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">ID Documents</span>
            <span className="text-sm font-bold">{stats?.total ? Math.round((stats.idSubmitted / stats.total) * 100) : 0}%</span>
          </div>
          <Progress value={stats?.total ? (stats.idSubmitted / stats.total) * 100 : 0} className="h-2 mb-2" />
          <p className="text-xs text-muted-foreground">{stats?.idSubmitted || 0} of {stats?.total || 0} submitted</p>
        </div>

        {/* Cost Summary */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CreditCard className="h-4 w-4" />
            <span className="text-sm">Total Cost</span>
          </div>
          <p className="text-2xl font-bold">₹{(stats?.totalCost || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">~₹{(stats?.avgCostPerPerson || 0).toLocaleString()}/person</p>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Link href={`${basePath}/guests`} className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><span className="text-sm">Travelers</span></div>
          <p className="text-3xl font-bold mt-2">{stats?.total || 0}</p>
        </Link>

        <Link href={`${basePath}/flights`} className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-blue-500"><Plane className="h-4 w-4" /><span className="text-sm">By Flight</span></div>
          <p className="text-3xl font-bold mt-2">{stats?.byMode.flight || 0}</p>
        </Link>

        <Link href={`${basePath}/trains`} className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-orange-500"><Train className="h-4 w-4" /><span className="text-sm">By Train</span></div>
          <p className="text-3xl font-bold mt-2">{stats?.byMode.train || 0}</p>
        </Link>

        <Link href={`${basePath}/transfers`} className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-green-500"><Car className="h-4 w-4" /><span className="text-sm">Pickups</span></div>
          <p className="text-3xl font-bold mt-2">{stats?.pickupRequired || 0}</p>
          <p className="text-xs text-muted-foreground">{stats?.pickupArranged || 0} arranged</p>
        </Link>

        <Link href={`${basePath}/transfers`} className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-red-500"><Car className="h-4 w-4" /><span className="text-sm">Drops</span></div>
          <p className="text-3xl font-bold mt-2">{stats?.dropRequired || 0}</p>
          <p className="text-xs text-muted-foreground">{stats?.dropArranged || 0} arranged</p>
        </Link>

        <Link href={`/events/${eventId}/accommodation`} className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-purple-500"><Hotel className="h-4 w-4" /><span className="text-sm">Hotel</span></div>
          <p className="text-3xl font-bold mt-2">{stats?.hotelRequired || 0}</p>
          <p className="text-xs text-muted-foreground">{stats?.hotelBooked || 0} booked</p>
        </Link>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Booking Status with Progress */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Booking Progress
          </h3>
          <div className="space-y-4">
            <Link href={`${basePath}/flights`} className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-sm">Onward Flights</span>
                </div>
                <span className="text-sm font-bold text-blue-600">
                  {stats?.total ? Math.round((stats.onwardBooked / stats.total) * 100) : 0}%
                </span>
              </div>
              <Progress value={stats?.total ? (stats.onwardBooked / stats.total) * 100 : 0} className="h-2 mb-1" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{stats?.onwardBooked || 0} booked</span>
                <span>{stats?.onwardPending || 0} pending</span>
              </div>
            </Link>

            <Link href={`${basePath}/flights`} className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-purple-500" />
                  <span className="font-medium text-sm">Return Flights</span>
                </div>
                <span className="text-sm font-bold text-purple-600">
                  {stats?.total ? Math.round((stats.returnBooked / stats.total) * 100) : 0}%
                </span>
              </div>
              <Progress value={stats?.total ? (stats.returnBooked / stats.total) * 100 : 0} className="h-2 mb-1" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{stats?.returnBooked || 0} booked</span>
                <span>{stats?.returnPending || 0} pending</span>
              </div>
            </Link>

            <Link href={`/events/${eventId}/accommodation`} className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Hotel className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-sm">Hotel Bookings</span>
                </div>
                <span className="text-sm font-bold text-amber-600">
                  {stats?.hotelRequired ? Math.round((stats.hotelBooked / stats.hotelRequired) * 100) : 0}%
                </span>
              </div>
              <Progress value={stats?.hotelRequired ? (stats.hotelBooked / stats.hotelRequired) * 100 : 0} className="h-2 mb-1" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{stats?.hotelBooked || 0} booked</span>
                <span>{(stats?.hotelRequired || 0) - (stats?.hotelBooked || 0)} pending</span>
              </div>
            </Link>

            <Link href={`${basePath}/itineraries`} className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-sm">Itineraries Sent</span>
                </div>
                <span className="text-sm font-bold text-green-600">
                  {stats?.total ? Math.round((stats.vouchersSent / stats.total) * 100) : 0}%
                </span>
              </div>
              <Progress value={stats?.total ? (stats.vouchersSent / stats.total) * 100 : 0} className="h-2 mb-1" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{stats?.vouchersSent || 0} sent</span>
                <span>{stats?.vouchersPending || 0} pending</span>
              </div>
            </Link>
          </div>
        </div>

        {/* ID & Transfer Status */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CircleDot className="h-4 w-4" />
            Requirements & Transfers
          </h3>
          <div className="space-y-4">
            <Link href={`${basePath}/guests?id=missing`} className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-sm">Travel ID Documents</span>
                </div>
                <span className="text-sm font-bold text-blue-600">
                  {stats?.total ? Math.round((stats.idSubmitted / stats.total) * 100) : 0}%
                </span>
              </div>
              <Progress value={stats?.total ? (stats.idSubmitted / stats.total) * 100 : 0} className="h-2 mb-1" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{stats?.idSubmitted || 0} submitted</span>
                <span className={stats?.idMissing ? "text-red-500" : ""}>{stats?.idMissing || 0} missing</span>
              </div>
            </Link>

            <Link href={`${basePath}/transfers`} className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-sm">Airport Pickups</span>
                </div>
                <span className="text-sm font-bold text-green-600">
                  {stats?.pickupRequired ? Math.round((stats.pickupArranged / stats.pickupRequired) * 100) : 0}%
                </span>
              </div>
              <Progress value={stats?.pickupRequired ? (stats.pickupArranged / stats.pickupRequired) * 100 : 0} className="h-2 mb-1" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{stats?.pickupArranged || 0} arranged</span>
                <span>{(stats?.pickupRequired || 0) - (stats?.pickupArranged || 0)} pending of {stats?.pickupRequired || 0}</span>
              </div>
            </Link>

            <Link href={`${basePath}/transfers`} className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-orange-500" />
                  <span className="font-medium text-sm">Airport Drops</span>
                </div>
                <span className="text-sm font-bold text-orange-600">
                  {stats?.dropRequired ? Math.round((stats.dropArranged / stats.dropRequired) * 100) : 0}%
                </span>
              </div>
              <Progress value={stats?.dropRequired ? (stats.dropArranged / stats.dropRequired) * 100 : 0} className="h-2 mb-1" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{stats?.dropArranged || 0} arranged</span>
                <span>{(stats?.dropRequired || 0) - (stats?.dropArranged || 0)} pending of {stats?.dropRequired || 0}</span>
              </div>
            </Link>

            {/* Cost Breakdown Mini */}
            <div className="p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Cost Breakdown</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-sm font-bold">₹{(stats?.flightCost || 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Flights</p>
                </div>
                <div>
                  <p className="text-sm font-bold">₹{(stats?.trainCost || 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Trains</p>
                </div>
                <div>
                  <p className="text-sm font-bold">₹{(stats?.hotelCost || 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Hotels</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts & Upcoming */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Alerts */}
        {((stats?.onwardPending || 0) > 0 || (stats?.idMissing || 0) > 0) ? (
          <div className="bg-card rounded-lg border p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Action Required
            </h3>
            <div className="space-y-2">
              {(stats?.onwardPending || 0) > 0 && (
                <Link href={`${basePath}/flights`} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 hover:bg-amber-100">
                  <span className="text-sm">{stats?.onwardPending} onward flights pending booking</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              {(stats?.idMissing || 0) > 0 && (
                <Link href={`${basePath}/guests?id=missing`} className="flex items-center justify-between p-3 rounded-lg bg-red-50 hover:bg-red-100">
                  <span className="text-sm">{stats?.idMissing} guests missing travel ID</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              {(stats?.vouchersPending || 0) > 0 && (
                <Link href={`${basePath}/itineraries`} className="flex items-center justify-between p-3 rounded-lg bg-purple-50 hover:bg-purple-100">
                  <span className="text-sm">{stats?.vouchersPending} itineraries pending</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-green-50 rounded-lg border border-green-200 p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2 text-green-700">
              <Check className="h-4 w-4" />
              All Good!
            </h3>
            <p className="text-sm text-green-600">All travel bookings are in order.</p>
          </div>
        )}

        {/* Upcoming Arrivals */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Upcoming Arrivals (7 days)
          </h3>
          {upcomingArrivals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No arrivals in the next 7 days</p>
          ) : (
            <div className="space-y-2">
              {upcomingArrivals.map((guest) => {
                const arrival = guest.custom_fields?.booking?.onward_departure_date || guest.custom_fields?.travel_details?.arrival_date
                return (
                  <div key={guest.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium truncate flex-1">{guest.attendee_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {arrival && new Date(arrival).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href={`${basePath}/guests`} className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center">
          <Users className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Guests</p>
          <p className="text-xs text-muted-foreground">Travel requirements</p>
        </Link>

        <Link href={`${basePath}/flights`} className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center">
          <Plane className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Flights</p>
          <p className="text-xs text-muted-foreground">Manage bookings</p>
        </Link>

        <Link href={`${basePath}/transfers`} className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center">
          <Car className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Transfers</p>
          <p className="text-xs text-muted-foreground">Pickup & drop</p>
        </Link>

        <Link href={`${basePath}/reports`} className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center">
          <Route className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Reports</p>
          <p className="text-xs text-muted-foreground">Analytics</p>
        </Link>
      </div>
    </div>
  )
}
