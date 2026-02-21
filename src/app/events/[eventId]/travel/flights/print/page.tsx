"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PrintButton } from "@/components/ui/print-layout"
import { cn } from "@/lib/utils"
import { Loader2, PlaneTakeoff, PlaneLanding, ArrowLeft } from "lucide-react"
import Link from "next/link"

type Guest = {
  id: string
  attendee_name: string
  attendee_phone: string | null
  custom_fields: {
    booking?: {
      onward_pnr?: string
      onward_airline?: string
      onward_flight_number?: string
      onward_departure_date?: string
      onward_departure_time?: string
      onward_arrival_time?: string
      onward_from_city?: string
      onward_to_city?: string
      onward_seat?: string
      onward_status?: string
      return_pnr?: string
      return_airline?: string
      return_flight_number?: string
      return_departure_date?: string
      return_departure_time?: string
      return_arrival_time?: string
      return_from_city?: string
      return_to_city?: string
      return_seat?: string
      return_status?: string
      hotel_name?: string
    }
    travel_details?: {
      from_city?: string
      onward_from_city?: string
      onward_to_city?: string
      onward_date?: string
      arrival_date?: string
      return_from_city?: string
      return_to_city?: string
      return_date?: string
      departure_date?: string
      pickup_required?: boolean
      drop_required?: boolean
      special_requirements?: string
    }
    needs_travel?: boolean
  } | null
}

export default function FlightsPrintPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState("arrivals")

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event-print", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("events")
        .select("id, name, short_name, start_date, end_date")
        .eq("id", eventId)
        .single()
      return data as { id: string; name: string; short_name: string | null; start_date: string; end_date: string } | null
    },
  })

  // Fetch guests with travel/booking data
  const { data: guests, isLoading } = useQuery({
    queryKey: ["flight-guests-print", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_phone, custom_fields")
        .eq("event_id", eventId)
        .order("attendee_name")

      return (data || []).filter((g: Guest) =>
        g.custom_fields?.needs_travel ||
        g.custom_fields?.travel_details?.from_city ||
        g.custom_fields?.travel_details?.onward_from_city ||
        g.custom_fields?.booking?.onward_status
      ) as Guest[]
    },
  })

  const buildRemarks = (
    booking: NonNullable<Guest["custom_fields"]>["booking"],
    travel: NonNullable<Guest["custom_fields"]>["travel_details"],
    arrivalTime?: string,
    arrivalDate?: string,
    depTime?: string
  ) => {
    const parts: string[] = []
    // Auto-flag early arrivals (before 12 noon = needs previous day hotel booking)
    if (arrivalTime && arrivalTime !== "-" && arrivalDate && depTime) {
      const arrHour = parseInt(arrivalTime.split(":")[0], 10)
      const depHour = parseInt(depTime.split(":")[0], 10)
      if (!isNaN(arrHour) && arrHour < 12) {
        const actualArrival = new Date(arrivalDate)
        // Overnight flight: departure time is later than arrival time
        if (!isNaN(depHour) && depHour > arrHour) {
          actualArrival.setDate(actualArrival.getDate() + 1)
        }
        const checkin = new Date(actualArrival)
        checkin.setDate(checkin.getDate() - 1)
        const checkinStr = checkin.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
        const arrStr = actualArrival.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
        parts.push(`Early check-in ${arrStr} (book from ${checkinStr})`)
      }
    }
    if (booking?.hotel_name) parts.push(booking.hotel_name)
    if (travel?.pickup_required) parts.push("Pickup")
    if (travel?.drop_required) parts.push("Drop")
    if (travel?.special_requirements) parts.push(travel.special_requirements)
    return parts.join(" | ") || "-"
  }

  const formatPhone = (phone: string | null) => {
    if (!phone) return "-"
    const digits = phone.replace(/^\+?91[\s-]?/, "").replace(/\D/g, "")
    if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`
    return digits || "-"
  }

  // Build arrival rows (onward flights sorted by arrival time, then date)
  const arrivals = useMemo(() => {
    if (!guests) return []
    return guests
      .filter((g) => {
        const status = g.custom_fields?.booking?.onward_status
        return status && status !== "not_required" && status !== "cancelled"
      })
      .map((g) => {
        const b = g.custom_fields?.booking || {}
        const t = g.custom_fields?.travel_details || {}
        const arrTime = b.onward_arrival_time || "-"
        const depTimeVal = b.onward_departure_time || "-"
        const arrDate = b.onward_departure_date || t.onward_date || t.arrival_date || ""
        const remarks = buildRemarks(b, t, arrTime, arrDate, depTimeVal)
        return {
          name: g.attendee_name,
          phone: formatPhone(g.attendee_phone),
          from: b.onward_from_city || t.onward_from_city || t.from_city || "-",
          flight: b.onward_flight_number || "-",
          date: b.onward_departure_date || t.onward_date || t.arrival_date || "",
          dep: b.onward_departure_time || "-",
          arr: arrTime,
          seat: b.onward_seat || "-",
          remarks,
        }
      })
      .sort((a, b) => {
        // Sort by date first, then by arrival time
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return (a.arr || "").localeCompare(b.arr || "")
      })
  }, [guests])

  // Build departure rows (return flights sorted by departure time, then date)
  const departures = useMemo(() => {
    if (!guests) return []
    return guests
      .filter((g) => {
        const status = g.custom_fields?.booking?.return_status
        return status && status !== "not_required" && status !== "cancelled"
      })
      .map((g) => {
        const b = g.custom_fields?.booking || {}
        const t = g.custom_fields?.travel_details || {}
        const remarks = buildRemarks(b, t)
        return {
          name: g.attendee_name,
          phone: formatPhone(g.attendee_phone),
          to: b.return_to_city || t.return_to_city || t.from_city || "-",
          flight: b.return_flight_number || "-",
          date: b.return_departure_date || t.return_date || t.departure_date || "",
          dep: b.return_departure_time || "-",
          arr: b.return_arrival_time || "-",
          seat: b.return_seat || "-",
          remarks,
        }
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return (a.dep || "").localeCompare(b.dep || "")
      })
  }, [guests])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { font-size: 11px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { padding: 4px 6px !important; font-size: 11px !important; }
          th { font-size: 10px !important; text-transform: uppercase; letter-spacing: 0.5px; }
        }
      `}</style>
      <div className="max-w-[1200px] mx-auto p-6 print:p-0 print:max-w-none text-sm">
      {/* Screen-only controls */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href={`/events/${eventId}/travel/flights`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Flights
          </Button>
        </Link>
        <PrintButton label="Print" />
      </div>

      {/* Tabs - hidden on print */}
      <div className="print:hidden mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="arrivals" className="gap-2">
              <PlaneLanding className="h-4 w-4" />
              Arrivals ({arrivals.length})
            </TabsTrigger>
            <TabsTrigger value="departures" className="gap-2">
              <PlaneTakeoff className="h-4 w-4" />
              Departures ({departures.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Arrivals Section */}
      <div className={cn(activeTab !== "arrivals" && "hidden print:hidden")}>
        {/* Header */}
        <div className="mb-3 text-center">
          <h1 className="text-lg font-bold">{event?.name || "Event"}</h1>
          <h2 className="text-base font-semibold mt-0.5">Arrivals</h2>
          {event?.start_date && (
            <p className="text-sm text-muted-foreground print:text-black">
              {new Date(event.start_date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {event.end_date && event.end_date !== event.start_date && (
                <>
                  {" - "}
                  {new Date(event.end_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </>
              )}
            </p>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px] text-center py-2">#</TableHead>
              <TableHead className="py-2">Guest</TableHead>
              <TableHead className="py-2">Mobile</TableHead>
              <TableHead className="py-2">From</TableHead>
              <TableHead className="py-2">Flight</TableHead>
              <TableHead className="py-2">Date</TableHead>
              <TableHead className="py-2">DEP</TableHead>
              <TableHead className="py-2">ARR</TableHead>
              <TableHead className="py-2">Seat</TableHead>
              <TableHead className="py-2">Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {arrivals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No arrival bookings found
                </TableCell>
              </TableRow>
            ) : (
              arrivals.map((row, i) => (
                <TableRow key={i} className="text-sm">
                  <TableCell className="text-center text-muted-foreground py-1.5">{i + 1}</TableCell>
                  <TableCell className="font-medium py-1.5 whitespace-nowrap">{row.name}</TableCell>
                  <TableCell className="font-mono py-1.5 whitespace-nowrap">{row.phone}</TableCell>
                  <TableCell className="py-1.5 whitespace-nowrap">{row.from}</TableCell>
                  <TableCell className="font-mono py-1.5 whitespace-nowrap">{row.flight}</TableCell>
                  <TableCell className="py-1.5 whitespace-nowrap">{formatDate(row.date)}</TableCell>
                  <TableCell className="font-mono py-1.5">{row.dep}</TableCell>
                  <TableCell className="font-mono py-1.5 font-semibold">{row.arr}</TableCell>
                  <TableCell className="py-1.5">{row.seat}</TableCell>
                  <TableCell className="text-xs py-1.5 max-w-[200px]">{row.remarks}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground mt-2 text-right print:text-black">
          Total: {arrivals.length} guest{arrivals.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Departures Section */}
      <div className={cn(activeTab !== "departures" && "hidden print:hidden")}>
        {/* Header */}
        <div className="mb-3 text-center">
          <h1 className="text-lg font-bold">{event?.name || "Event"}</h1>
          <h2 className="text-base font-semibold mt-0.5">Departures</h2>
          {event?.start_date && (
            <p className="text-sm text-muted-foreground print:text-black">
              {new Date(event.start_date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {event.end_date && event.end_date !== event.start_date && (
                <>
                  {" - "}
                  {new Date(event.end_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </>
              )}
            </p>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px] text-center py-2">#</TableHead>
              <TableHead className="py-2">Guest</TableHead>
              <TableHead className="py-2">Mobile</TableHead>
              <TableHead className="py-2">To</TableHead>
              <TableHead className="py-2">Flight</TableHead>
              <TableHead className="py-2">Date</TableHead>
              <TableHead className="py-2">DEP</TableHead>
              <TableHead className="py-2">ARR</TableHead>
              <TableHead className="py-2">Seat</TableHead>
              <TableHead className="py-2">Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No departure bookings found
                </TableCell>
              </TableRow>
            ) : (
              departures.map((row, i) => (
                <TableRow key={i} className="text-sm">
                  <TableCell className="text-center text-muted-foreground py-1.5">{i + 1}</TableCell>
                  <TableCell className="font-medium py-1.5 whitespace-nowrap">{row.name}</TableCell>
                  <TableCell className="font-mono py-1.5 whitespace-nowrap">{row.phone}</TableCell>
                  <TableCell className="py-1.5 whitespace-nowrap">{row.to}</TableCell>
                  <TableCell className="font-mono py-1.5 whitespace-nowrap">{row.flight}</TableCell>
                  <TableCell className="py-1.5 whitespace-nowrap">{formatDate(row.date)}</TableCell>
                  <TableCell className="font-mono py-1.5 font-semibold">{row.dep}</TableCell>
                  <TableCell className="font-mono py-1.5">{row.arr}</TableCell>
                  <TableCell className="py-1.5">{row.seat}</TableCell>
                  <TableCell className="text-xs py-1.5 max-w-[200px]">{row.remarks}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground mt-2 text-right print:text-black">
          Total: {departures.length} guest{departures.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
    </>
  )
}
