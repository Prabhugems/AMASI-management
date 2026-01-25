import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Convert data to CSV format
function toCSV(headers: string[], rows: string[][]): string {
  const escapeCSV = (value: string | number | boolean | null | undefined): string => {
    if (value === null || value === undefined) return ""
    const str = String(value)
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const headerRow = headers.map(escapeCSV).join(",")
  const dataRows = rows.map(row => row.map(escapeCSV).join(","))
  return [headerRow, ...dataRows].join("\n")
}

// Format date for display
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get("type") || "travel" // travel, registrations, sessions, attendance

  try {
    // Fetch event details
    const { data: event } = await supabase
      .from("events")
      .select("id, name")
      .eq("id", eventId)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    let csv = ""
    let filename = ""

    switch (type) {
      case "travel": {
        // Export travel data
        const { data: guests } = await supabase
          .from("registrations")
          .select("*")
          .eq("event_id", eventId)
          .or("attendee_designation.ilike.%speaker%,attendee_designation.ilike.%faculty%,attendee_designation.ilike.%chairperson%,attendee_designation.ilike.%moderator%")
          .order("attendee_name")

        const headers = [
          "Name",
          "Email",
          "Phone",
          "Designation",
          "Travel Mode",
          "Needs Travel",
          "Onward From",
          "Onward To",
          "Onward Date",
          "Onward Status",
          "Onward PNR",
          "Onward Flight",
          "Return From",
          "Return To",
          "Return Date",
          "Return Status",
          "Return PNR",
          "Return Flight",
          "Hotel Required",
          "Hotel Check-in",
          "Hotel Check-out",
          "Hotel Status",
          "Hotel Name",
          "Pickup Required",
          "Drop Required",
          "ID Submitted",
          "Total Cost",
        ]

        const rows = (guests || []).map((g: any) => {
          const t = g.custom_fields?.travel_details || {}
          const b = g.custom_fields?.booking || {}
          const id = g.custom_fields?.travel_id || {}

          const onwardCost = b.onward_cost || 0
          const returnCost = b.return_cost || 0
          const hotelCost = b.hotel_cost || 0
          const totalCost = onwardCost + returnCost + hotelCost

          return [
            g.attendee_name,
            g.attendee_email,
            g.attendee_phone || "",
            g.attendee_designation || "",
            t.mode || "flight",
            g.custom_fields?.needs_travel ? "Yes" : "No",
            t.onward_from_city || t.from_city || "",
            t.onward_to_city || "",
            formatDate(t.onward_date || t.arrival_date),
            b.onward_status || "pending",
            b.onward_pnr || "",
            b.onward_flight_number || "",
            t.return_from_city || "",
            t.return_to_city || t.from_city || "",
            formatDate(t.return_date || t.departure_date),
            b.return_status || "pending",
            b.return_pnr || "",
            b.return_flight_number || "",
            t.hotel_required ? "Yes" : "No",
            formatDate(t.hotel_check_in || b.hotel_checkin),
            formatDate(t.hotel_check_out || b.hotel_checkout),
            b.hotel_status || "pending",
            b.hotel_name || "",
            (t.pickup_required || b.pickup_required) ? "Yes" : "No",
            (t.drop_required || b.drop_required) ? "Yes" : "No",
            id.id_document_url ? "Yes" : "No",
            totalCost.toString(),
          ]
        })

        csv = toCSV(headers, rows)
        filename = `${event.name}_Travel_Data.csv`
        break
      }

      case "registrations": {
        // Export all registrations
        const { data: registrations } = await supabase
          .from("registrations")
          .select("*, ticket_types(name)")
          .eq("event_id", eventId)
          .order("created_at", { ascending: false })

        const headers = [
          "Registration #",
          "Name",
          "Email",
          "Phone",
          "Institution",
          "Designation",
          "Ticket Type",
          "Status",
          "Registered On",
          "Confirmed On",
        ]

        const rows = (registrations || []).map((r: any) => [
          r.registration_number,
          r.attendee_name,
          r.attendee_email,
          r.attendee_phone || "",
          r.attendee_institution || "",
          r.attendee_designation || "",
          r.ticket_types?.name || "",
          r.status,
          formatDate(r.created_at),
          r.confirmed_at ? formatDate(r.confirmed_at) : "",
        ])

        csv = toCSV(headers, rows)
        filename = `${event.name}_Registrations.csv`
        break
      }

      case "sessions": {
        // Export sessions with speakers
        const { data: sessions } = await supabase
          .from("sessions")
          .select(`
            *,
            session_speakers (
              role,
              faculty:faculty_id (
                name,
                email
              )
            )
          `)
          .eq("event_id", eventId)
          .order("session_date")
          .order("start_time")

        const headers = [
          "Date",
          "Start Time",
          "End Time",
          "Session Name",
          "Hall",
          "Track",
          "Speakers",
          "Description",
        ]

        const rows = (sessions || []).map((s: any) => {
          const speakers = s.session_speakers
            ?.map((ss: any) => `${ss.faculty?.name || ""} (${ss.role || "Speaker"})`)
            .filter(Boolean)
            .join("; ")

          return [
            formatDate(s.session_date),
            s.start_time || "",
            s.end_time || "",
            s.session_name,
            s.hall || "",
            s.specialty_track || "",
            speakers || "",
            s.description || "",
          ]
        })

        csv = toCSV(headers, rows)
        filename = `${event.name}_Sessions.csv`
        break
      }

      case "attendance": {
        // Export check-in data
        const { data: checkins } = await supabase
          .from("registrations")
          .select("*")
          .eq("event_id", eventId)
          .not("custom_fields->checked_in_at", "is", null)
          .order("custom_fields->checked_in_at", { ascending: false })

        const headers = [
          "Registration #",
          "Name",
          "Email",
          "Phone",
          "Designation",
          "Check-in Time",
          "Checked In By",
        ]

        const rows = (checkins || []).map((c: any) => [
          c.registration_number,
          c.attendee_name,
          c.attendee_email,
          c.attendee_phone || "",
          c.attendee_designation || "",
          c.custom_fields?.checked_in_at
            ? new Date(c.custom_fields.checked_in_at).toLocaleString("en-IN")
            : "",
          c.custom_fields?.checked_in_by || "",
        ])

        csv = toCSV(headers, rows)
        filename = `${event.name}_Attendance.csv`
        break
      }

      case "transfers": {
        // Export transfer/pickup data
        const { data: guests } = await supabase
          .from("registrations")
          .select("*")
          .eq("event_id", eventId)
          .order("attendee_name")

        const transferGuests = (guests || []).filter((g: any) => {
          const t = g.custom_fields?.travel_details || {}
          const b = g.custom_fields?.booking || {}
          return t.pickup_required || t.drop_required || b.pickup_required || b.drop_required
        })

        const headers = [
          "Name",
          "Phone",
          "Email",
          "Pickup Required",
          "Pickup Status",
          "Pickup Details",
          "Arrival Date",
          "Arrival Time",
          "Arrival Flight/Train",
          "Drop Required",
          "Drop Status",
          "Drop Details",
          "Departure Date",
          "Departure Time",
          "Departure Flight/Train",
        ]

        const rows = transferGuests.map((g: any) => {
          const t = g.custom_fields?.travel_details || {}
          const b = g.custom_fields?.booking || {}

          return [
            g.attendee_name,
            g.attendee_phone || "",
            g.attendee_email,
            (t.pickup_required || b.pickup_required) ? "Yes" : "No",
            b.pickup_status || "pending",
            b.pickup_details || "",
            formatDate(b.onward_departure_date || t.onward_date || t.arrival_date),
            b.onward_arrival_time || "",
            b.onward_flight_number || "",
            (t.drop_required || b.drop_required) ? "Yes" : "No",
            b.drop_status || "pending",
            b.drop_details || "",
            formatDate(b.return_departure_date || t.return_date || t.departure_date),
            b.return_departure_time || "",
            b.return_flight_number || "",
          ]
        })

        csv = toCSV(headers, rows)
        filename = `${event.name}_Transfers.csv`
        break
      }

      default:
        return NextResponse.json({ error: "Invalid export type" }, { status: 400 })
    }

    // Sanitize filename
    filename = filename.replace(/[^a-zA-Z0-9_.-]/g, "_")

    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 })
  }
}
