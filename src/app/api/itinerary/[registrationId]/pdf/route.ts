import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { jsPDF } from "jspdf"

// Format date
function formatDate(dateStr: string | null | undefined, includeDay = true): string {
  if (!dateStr) return "-"
  const options: Intl.DateTimeFormatOptions = includeDay
    ? { weekday: "short", day: "numeric", month: "short", year: "numeric" }
    : { day: "numeric", month: "short", year: "numeric" }
  return new Date(dateStr).toLocaleDateString("en-IN", options)
}

// Format time
function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "-"
  const [hours, minutes] = timeStr.split(":")
  const h = parseInt(hours)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  const { registrationId } = await params
  const supabaseClient = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = supabaseClient as any

  try {
    // Fetch registration with event details
    const { data: registration, error: regError } = await supabase
      .from("registrations")
      .select(`
        *,
        events (
          id,
          name,
          start_date,
          end_date,
          venue_name,
          venue_address
        )
      `)
      .eq("id", registrationId)
      .single()

    if (regError || !registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    // Fetch speaker's sessions
    const { data: sessions } = await supabase
      .from("sessions")
      .select(`
        id,
        session_name,
        session_date,
        start_time,
        end_time,
        hall,
        session_speakers!inner (
          faculty:faculty_id (
            email
          )
        )
      `)
      .eq("event_id", registration.events.id)
      .order("session_date")
      .order("start_time")

    // Filter sessions for this speaker
    const speakerSessions = sessions?.filter((s: any) =>
      s.session_speakers?.some((ss: any) =>
        ss.faculty?.email?.toLowerCase() === registration.attendee_email?.toLowerCase()
      )
    ) || []

    const event = registration.events
    const booking = registration.custom_fields?.booking || {}
    const travel = registration.custom_fields?.travel_details || {}

    // Create PDF
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15
    let y = 20

    // Colors
    const primaryColor: [number, number, number] = [59, 130, 246] // Blue
    const grayColor: [number, number, number] = [107, 114, 128]
    const darkColor: [number, number, number] = [31, 41, 55]

    // Header
    doc.setFillColor(...primaryColor)
    doc.rect(0, 0, pageWidth, 40, "F")

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.setFont("helvetica", "bold")
    doc.text("Travel Itinerary", margin, 18)

    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.text(event.name, margin, 28)

    doc.setFontSize(10)
    doc.text(`${formatDate(event.start_date, false)} - ${formatDate(event.end_date, false)}`, margin, 35)

    y = 50

    // Speaker Info Box
    doc.setFillColor(249, 250, 251)
    doc.roundedRect(margin, y, pageWidth - 2 * margin, 25, 3, 3, "F")

    doc.setTextColor(...darkColor)
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text(registration.attendee_name, margin + 5, y + 10)

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...grayColor)
    doc.text(registration.attendee_email, margin + 5, y + 17)
    if (registration.attendee_phone) {
      doc.text(registration.attendee_phone, margin + 100, y + 17)
    }

    y += 35

    // Helper function for section header
    const drawSectionHeader = (title: string, icon: string) => {
      doc.setFillColor(...primaryColor)
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 8, 2, 2, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text(`${icon}  ${title}`, margin + 4, y + 5.5)
      y += 12
    }

    // Helper for detail row
    const drawDetailRow = (label: string, value: string, isLast = false) => {
      doc.setTextColor(...grayColor)
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.text(label, margin + 5, y)

      doc.setTextColor(...darkColor)
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.text(value || "-", margin + 45, y)

      y += isLast ? 8 : 6
    }

    // Onward Journey
    if (booking.onward_pnr || booking.onward_flight_number || travel.onward_date) {
      drawSectionHeader("ONWARD JOURNEY", "✈")

      doc.setFillColor(239, 246, 255)
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 40, 2, 2, "F")
      y += 6

      drawDetailRow("Date", formatDate(booking.onward_departure_date || travel.onward_date))
      drawDetailRow("Route", `${booking.onward_from_city || travel.onward_from_city || "-"} → ${booking.onward_to_city || travel.onward_to_city || "-"}`)
      drawDetailRow("Flight", `${booking.onward_airline || ""} ${booking.onward_flight_number || "-"}`.trim())
      drawDetailRow("PNR", booking.onward_pnr || "-")
      drawDetailRow("Time", `Dep: ${formatTime(booking.onward_departure_time)} | Arr: ${formatTime(booking.onward_arrival_time)}`, true)

      y += 5
    }

    // Return Journey
    if (booking.return_pnr || booking.return_flight_number || travel.return_date) {
      drawSectionHeader("RETURN JOURNEY", "✈")

      doc.setFillColor(254, 243, 199)
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 40, 2, 2, "F")
      y += 6

      drawDetailRow("Date", formatDate(booking.return_departure_date || travel.return_date))
      drawDetailRow("Route", `${booking.return_from_city || travel.return_from_city || "-"} → ${booking.return_to_city || travel.return_to_city || "-"}`)
      drawDetailRow("Flight", `${booking.return_airline || ""} ${booking.return_flight_number || "-"}`.trim())
      drawDetailRow("PNR", booking.return_pnr || "-")
      drawDetailRow("Time", `Dep: ${formatTime(booking.return_departure_time)} | Arr: ${formatTime(booking.return_arrival_time)}`, true)

      y += 5
    }

    // Hotel
    if (booking.hotel_name || travel.hotel_required) {
      drawSectionHeader("ACCOMMODATION", "🏨")

      doc.setFillColor(236, 253, 245)
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 30, 2, 2, "F")
      y += 6

      drawDetailRow("Hotel", booking.hotel_name || "To be confirmed")
      drawDetailRow("Check-in", formatDate(booking.hotel_checkin || travel.hotel_check_in))
      drawDetailRow("Check-out", formatDate(booking.hotel_checkout || travel.hotel_check_out))
      if (booking.hotel_confirmation) {
        drawDetailRow("Confirmation", booking.hotel_confirmation, true)
      }

      y += 5
    }

    // Sessions
    if (speakerSessions.length > 0) {
      // Check if we need a new page
      if (y > 220) {
        doc.addPage()
        y = 20
      }

      drawSectionHeader("YOUR SESSIONS", "🎤")

      for (const session of speakerSessions) {
        if (y > 270) {
          doc.addPage()
          y = 20
        }

        doc.setFillColor(249, 250, 251)
        doc.roundedRect(margin, y, pageWidth - 2 * margin, 18, 2, 2, "F")

        doc.setTextColor(...darkColor)
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.text(session.session_name, margin + 5, y + 6)

        doc.setTextColor(...grayColor)
        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        const sessionInfo = `${formatDate(session.session_date)} | ${formatTime(session.start_time)} - ${formatTime(session.end_time)}${session.hall ? ` | ${session.hall}` : ""}`
        doc.text(sessionInfo, margin + 5, y + 13)

        y += 22
      }
    }

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 15
    doc.setDrawColor(229, 231, 235)
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5)

    doc.setTextColor(...grayColor)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text(`Generated on ${new Date().toLocaleDateString("en-IN")} | ${event.name}`, margin, footerY)

    if (event.venue_name) {
      doc.text(`Venue: ${event.venue_name}`, pageWidth - margin - 60, footerY)
    }

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"))

    // Return PDF
    const filename = `Itinerary_${registration.attendee_name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("PDF generation error:", error)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
