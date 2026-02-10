import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { jsPDF } from "jspdf"
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "@/lib/rate-limit"

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): string {
  if (!startDate) return "-"
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : null

  const startStr = start.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  if (!end || start.toDateString() === end.toDateString()) return startStr

  // Same month+year: "10 - 12 February 2026"
  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    return `${start.getDate()} - ${end.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`
  }

  return `${startStr} - ${end.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params

  // Rate limit
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`invitation-pdf:${clientIp}`, "public")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  // Optional: personalize for a specific registration
  const { searchParams } = new URL(request.url)
  const registrationId = searchParams.get("registration_id")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createAdminClient()) as any

  try {
    const { data: event, error } = await supabase
      .from("events")
      .select(
        "id, name, short_name, tagline, description, start_date, end_date, venue_name, city, state, scientific_chairman, organizing_chairman, logo_url, event_type, edition"
      )
      .eq("id", eventId)
      .single()

    if (error || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Fetch attendee info if registration_id is provided
    let attendee: { name: string; designation?: string; institution?: string; registration_number?: string } | null = null
    if (registrationId) {
      const { data: reg } = await supabase
        .from("registrations")
        .select("attendee_name, attendee_designation, attendee_institution, registration_number")
        .eq("id", registrationId)
        .eq("event_id", eventId)
        .single()
      if (reg) {
        attendee = {
          name: reg.attendee_name,
          designation: reg.attendee_designation,
          institution: reg.attendee_institution,
          registration_number: reg.registration_number,
        }
      }
    }

    // Create PDF
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const contentWidth = pageWidth - 2 * margin
    let y = 20

    // Colors
    const primaryColor: [number, number, number] = [59, 130, 246]
    const darkColor: [number, number, number] = [31, 41, 55]
    const grayColor: [number, number, number] = [107, 114, 128]

    // === HEADER ===
    doc.setFillColor(...primaryColor)
    doc.rect(0, 0, pageWidth, 45, "F")

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont("helvetica", "bold")
    const eventTitle = event.name || "Event"
    const titleLines = doc.splitTextToSize(eventTitle, contentWidth)
    doc.text(titleLines, pageWidth / 2, 18, { align: "center" })

    y = 18 + titleLines.length * 8

    if (event.tagline) {
      doc.setFontSize(11)
      doc.setFont("helvetica", "italic")
      const taglineLines = doc.splitTextToSize(event.tagline, contentWidth)
      doc.text(taglineLines, pageWidth / 2, y, { align: "center" })
      y += taglineLines.length * 5
    }

    if (event.edition) {
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.text(`${event.edition} Edition`, pageWidth / 2, y + 2, {
        align: "center",
      })
    }

    y = 55

    // === DATE (when the PDF was generated) ===
    doc.setTextColor(...grayColor)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    const today = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    doc.text(`Date: ${today}`, margin, y)

    y += 15

    // === ADDRESSEE (if personalized) ===
    if (attendee) {
      doc.setTextColor(...darkColor)
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text("To,", margin, y)
      y += 6
      doc.setFont("helvetica", "normal")
      doc.text(attendee.name, margin, y)
      y += 5
      if (attendee.designation) {
        doc.setFontSize(10)
        doc.text(attendee.designation, margin, y)
        y += 5
      }
      if (attendee.institution) {
        doc.setFontSize(10)
        doc.text(attendee.institution, margin, y)
        y += 5
      }
      y += 5
    }

    // === SALUTATION ===
    doc.setTextColor(...darkColor)
    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    const salutation = attendee ? `Dear ${attendee.name},` : "Dear Sir/Madam,"
    doc.text(salutation, margin, y)

    y += 10

    // === BODY ===
    const orgName = event.short_name || "the organizing committee"
    const editionText = event.edition ? ` (${event.edition} Edition)` : ""
    const invitePhrase = attendee
      ? `We are pleased to confirm your participation in`
      : `We are pleased to invite you to attend`
    const bodyText = `${invitePhrase} "${event.name}"${editionText}, organized by ${orgName}. This ${event.event_type || "event"} brings together professionals, academicians, and researchers for knowledge exchange and collaborative learning.`

    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    const bodyLines = doc.splitTextToSize(bodyText, contentWidth)
    doc.text(bodyLines, margin, y)
    y += bodyLines.length * 5.5 + 8

    // === EVENT DETAILS BOX ===
    const detailBoxY = y
    doc.setFillColor(245, 247, 250)
    doc.setDrawColor(200, 210, 225)

    // Calculate box height dynamically
    let detailLines = 3 // Date, Venue, City always present
    if (attendee?.registration_number) detailLines++
    const boxPadding = 6
    const lineHeight = 8
    const boxHeight = boxPadding * 2 + detailLines * lineHeight + 4

    doc.roundedRect(margin, detailBoxY, contentWidth, boxHeight, 3, 3, "FD")

    y = detailBoxY + boxPadding + 4

    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...primaryColor)
    doc.text("Event Details", margin + 6, y)
    y += 8

    doc.setFontSize(10)

    // Date
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...darkColor)
    doc.text("Date:", margin + 6, y)
    doc.setFont("helvetica", "normal")
    doc.text(
      formatDateRange(event.start_date, event.end_date),
      margin + 30,
      y
    )
    y += lineHeight

    // Venue
    doc.setFont("helvetica", "bold")
    doc.text("Venue:", margin + 6, y)
    doc.setFont("helvetica", "normal")
    doc.text(event.venue_name || "To be announced", margin + 30, y)
    y += lineHeight

    // City
    const location = [event.city, event.state].filter(Boolean).join(", ")
    if (location) {
      doc.setFont("helvetica", "bold")
      doc.text("Location:", margin + 6, y)
      doc.setFont("helvetica", "normal")
      doc.text(location, margin + 30, y)
      y += lineHeight
    }

    // Registration number (if personalized)
    if (attendee?.registration_number) {
      doc.setFont("helvetica", "bold")
      doc.text("Reg. No:", margin + 6, y)
      doc.setFont("helvetica", "normal")
      doc.text(attendee.registration_number, margin + 30, y)
      y += lineHeight
    }

    y = detailBoxY + boxHeight + 10

    // === DESCRIPTION (if available) ===
    if (event.description) {
      doc.setTextColor(...darkColor)
      doc.setFontSize(11)
      doc.setFont("helvetica", "normal")

      // Truncate long descriptions
      let desc = event.description
      if (desc.length > 600) {
        desc = desc.substring(0, 597) + "..."
      }

      const descLines = doc.splitTextToSize(desc, contentWidth)
      // Check if we need a new page
      if (y + descLines.length * 5.5 > pageHeight - 60) {
        doc.addPage()
        y = 20
      }
      doc.text(descLines, margin, y)
      y += descLines.length * 5.5 + 8
    }

    // === CLOSING ===
    if (y > pageHeight - 80) {
      doc.addPage()
      y = 20
    }

    doc.setTextColor(...darkColor)
    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    doc.text(
      "We look forward to your esteemed presence and participation.",
      margin,
      y
    )
    y += 8
    doc.text(
      "Kindly make necessary arrangements to attend.",
      margin,
      y
    )

    y += 15

    // === SIGNATURE ===
    doc.text("With warm regards,", margin, y)
    y += 10

    const chairmanName =
      event.organizing_chairman || event.scientific_chairman || null
    if (chairmanName) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.text(chairmanName, margin, y)
      y += 6
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.setTextColor(...grayColor)
      doc.text("Course Convenor", margin, y)
      y += 5
    }

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(...grayColor)
    doc.text(event.short_name || event.name || "", margin, y)

    // === FOOTER ===
    const footerY = pageHeight - 12
    doc.setDrawColor(229, 231, 235)
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5)

    doc.setTextColor(...grayColor)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text(
      `This is a computer-generated invitation. | Generated on ${today}`,
      margin,
      footerY
    )

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"))
    const namePart = attendee
      ? `${attendee.name.replace(/[^a-zA-Z0-9]/g, "_")}-`
      : ""
    const filename = `Invitation-${namePart}${(event.name || "Event").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Invitation PDF generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate invitation PDF" },
      { status: 500 }
    )
  }
}
