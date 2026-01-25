import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // Fetch event details
    const { data: event } = await supabase
      .from("events")
      .select("name")
      .eq("id", eventId)
      .single()

    // Fetch sessions
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("event_id", eventId)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json(
        { error: "No sessions found for this event" },
        { status: 404 }
      )
    }

    // Parse faculty info from description
    const parseFacultyInfo = (description: string | null) => {
      if (!description) return { name: "", email: "", phone: "" }
      const parts = description.split(" | ")
      return {
        name: parts[0] || "",
        email: parts[1] || "",
        phone: parts[2] || "",
      }
    }

    // Format date for CSV (DD/MM/YYYY)
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr)
      const day = date.getDate().toString().padStart(2, "0")
      const month = (date.getMonth() + 1).toString().padStart(2, "0")
      const year = date.getFullYear()
      return `${day}/${month}/${year}`
    }

    // Format time for CSV (HH:MM)
    const formatTime = (timeStr: string, dateStr: string) => {
      if (!timeStr) return ""
      const [hours, minutes] = timeStr.split(":")
      return `${formatDate(dateStr)} ${hours}:${minutes}`
    }

    // Build CSV header
    const headers = [
      "S.No",
      "Date",
      "Starting Time",
      "Ending Time",
      "Topic",
      "Hall",
      "Duration (Minutes)",
      "Session",
      "Full Name",
      "Mobile Number",
      "email",
    ]

    // Build CSV rows
    const rows = sessions.map((session: any, index: number) => {
      const faculty = parseFacultyInfo(session.description)
      return [
        index + 1,
        formatDate(session.session_date),
        formatTime(session.start_time, session.session_date),
        formatTime(session.end_time, session.session_date),
        session.session_name,
        session.hall || "",
        session.duration_minutes || "",
        session.specialty_track || "",
        faculty.name,
        faculty.phone,
        faculty.email,
      ]
    })

    // Escape CSV values
    const escapeCSV = (value: any) => {
      const str = String(value ?? "")
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Build CSV content
    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n")

    // Add BOM for Excel compatibility
    const bom = "\uFEFF"
    const csvWithBom = bom + csvContent

    // Generate filename
    const eventName = (event as any)?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "Program"
    const filename = `${eventName}_Program.csv`

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error("Export error:", error)
    return NextResponse.json(
      { error: error.message || "Export failed" },
      { status: 500 }
    )
  }
}
