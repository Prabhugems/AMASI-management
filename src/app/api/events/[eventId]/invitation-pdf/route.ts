import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { jsPDF } from "jspdf"
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "@/lib/rate-limit"

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

  const { searchParams } = new URL(request.url)
  const registrationId = searchParams.get("registration_id")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createAdminClient()) as any

  try {
    const { data: event, error } = await supabase
      .from("events")
      .select(
        "id, name, short_name, tagline, description, start_date, end_date, venue_name, city, state, scientific_chairman, organizing_chairman, organized_by, signatory_title, signature_image_url, logo_url, event_type, edition"
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
    const margin = 25
    const contentWidth = pageWidth - 2 * margin
    let y = 0

    // Colors
    const primary: [number, number, number] = [37, 99, 235]      // Blue-600
    const primaryDark: [number, number, number] = [29, 78, 216]   // Blue-700
    const dark: [number, number, number] = [15, 23, 42]           // Slate-900
    const body: [number, number, number] = [51, 65, 85]           // Slate-600
    const muted: [number, number, number] = [100, 116, 139]       // Slate-500
    const light: [number, number, number] = [148, 163, 184]       // Slate-400

    // === HEADER BAND ===
    const headerHeight = 50
    // Gradient effect with two rectangles
    doc.setFillColor(...primaryDark)
    doc.rect(0, 0, pageWidth, headerHeight, "F")
    doc.setFillColor(...primary)
    doc.rect(0, 0, pageWidth, headerHeight - 3, "F")

    // Event title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.setFont("helvetica", "bold")
    const eventTitle = event.name || "Event"
    const titleLines = doc.splitTextToSize(eventTitle, contentWidth - 10)
    const titleStartY = titleLines.length > 1 ? 16 : 20
    doc.text(titleLines, pageWidth / 2, titleStartY, { align: "center", lineHeightFactor: 1.3 })

    y = titleStartY + titleLines.length * 7.5

    // Tagline
    if (event.tagline) {
      doc.setFontSize(10)
      doc.setFont("helvetica", "italic")
      doc.setTextColor(255, 255, 255, 180)
      const taglineLines = doc.splitTextToSize(event.tagline, contentWidth - 10)
      doc.text(taglineLines, pageWidth / 2, y + 2, { align: "center" })
    }

    // Edition badge
    if (event.edition) {
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(255, 255, 255, 160)
      doc.text(`${event.edition} Edition`, pageWidth / 2, headerHeight - 6, {
        align: "center",
      })
    }

    y = headerHeight + 15

    // === DATE LINE ===
    doc.setTextColor(...muted)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    const today = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    doc.text(`Date: ${today}`, margin, y)

    y += 18

    // === ADDRESSEE ===
    if (attendee) {
      doc.setTextColor(...dark)
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text("To,", margin, y)
      y += 7
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...body)
      doc.text(attendee.name, margin, y)
      y += 6
      if (attendee.designation) {
        doc.setFontSize(10)
        doc.text(attendee.designation, margin, y)
        y += 5.5
      }
      if (attendee.institution) {
        doc.setFontSize(10)
        doc.text(attendee.institution, margin, y)
        y += 5.5
      }
      y += 8
    }

    // === SALUTATION ===
    doc.setTextColor(...dark)
    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    const salutation = attendee ? `Dear ${attendee.name},` : "Dear Sir/Madam,"
    doc.text(salutation, margin, y)

    y += 12

    // === BODY PARAGRAPH ===
    const orgName = event.organized_by || event.short_name || "the organizing committee"
    const editionText = event.edition ? ` (${event.edition} Edition)` : ""
    const invitePhrase = attendee
      ? `We are pleased to confirm your participation in`
      : `We are pleased to invite you to attend`
    const bodyText = `${invitePhrase} "${event.name}"${editionText}, organized by ${orgName}. This ${event.event_type || "event"} brings together professionals, academicians, and researchers for knowledge exchange and collaborative learning.`

    doc.setFontSize(10.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...body)
    const bodyLines = doc.splitTextToSize(bodyText, contentWidth)
    doc.text(bodyLines, margin, y, { lineHeightFactor: 1.5 })
    y += bodyLines.length * 6 + 12

    // === EVENT DETAILS BOX ===
    const labelX = margin + 8
    const valueX = margin + 38
    const rowHeight = 9

    // Count detail rows
    let detailRows = 2 // Date + Venue always
    const location = [event.city, event.state].filter(Boolean).join(", ")
    if (location) detailRows++
    if (attendee?.registration_number) detailRows++

    const boxPadding = 8
    const boxHeaderHeight = 12
    const boxHeight = boxPadding * 2 + boxHeaderHeight + detailRows * rowHeight + 2

    // Box background
    doc.setFillColor(248, 250, 252)  // Slate-50
    doc.setDrawColor(226, 232, 240)  // Slate-200
    doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, "FD")

    // Box header accent line
    doc.setFillColor(...primary)
    doc.rect(margin, y, 3, boxHeight, "F")

    const boxContentY = y + boxPadding

    // "Event Details" header
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...primary)
    doc.text("Event Details", labelX, boxContentY + 4)

    let detailY = boxContentY + boxHeaderHeight + 2

    doc.setFontSize(10)

    // Date
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...dark)
    doc.text("Date:", labelX, detailY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...body)
    doc.text(formatDateRange(event.start_date, event.end_date), valueX, detailY)
    detailY += rowHeight

    // Venue
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...dark)
    doc.text("Venue:", labelX, detailY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...body)
    doc.text(event.venue_name || "To be announced", valueX, detailY)
    detailY += rowHeight

    // Location
    if (location) {
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...dark)
      doc.text("Location:", labelX, detailY)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...body)
      doc.text(location, valueX, detailY)
      detailY += rowHeight
    }

    // Registration number
    if (attendee?.registration_number) {
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...dark)
      doc.text("Reg. No:", labelX, detailY)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...body)
      doc.text(attendee.registration_number, valueX, detailY)
    }

    y += boxHeight + 14

    // === DESCRIPTION ===
    if (event.description) {
      doc.setTextColor(...body)
      doc.setFontSize(10.5)
      doc.setFont("helvetica", "normal")

      let desc = event.description
      if (desc.length > 600) {
        desc = desc.substring(0, 597) + "..."
      }

      const descLines = doc.splitTextToSize(desc, contentWidth)
      if (y + descLines.length * 5.5 > pageHeight - 70) {
        doc.addPage()
        y = 25
      }
      doc.text(descLines, margin, y, { lineHeightFactor: 1.5 })
      y += descLines.length * 6 + 10
    }

    // === CLOSING ===
    if (y > pageHeight - 85) {
      doc.addPage()
      y = 25
    }

    doc.setTextColor(...body)
    doc.setFontSize(10.5)
    doc.setFont("helvetica", "normal")
    doc.text(
      "We look forward to your esteemed presence and participation.",
      margin,
      y
    )
    y += 7
    doc.text(
      "Kindly make necessary arrangements to attend.",
      margin,
      y
    )

    y += 18

    // === SIGNATURE ===
    doc.setTextColor(...body)
    doc.setFontSize(10.5)
    doc.text("With warm regards,", margin, y)
    y += 10

    // Signature image (if uploaded)
    if (event.signature_image_url) {
      try {
        const sigRes = await fetch(event.signature_image_url)
        if (sigRes.ok) {
          const sigBuffer = await sigRes.arrayBuffer()
          const sigBase64 = Buffer.from(sigBuffer).toString("base64")
          const contentType = sigRes.headers.get("content-type") || "image/png"
          const imgFormat = contentType.includes("png") ? "PNG" : "JPEG"
          const sigDataUri = `data:${contentType};base64,${sigBase64}`
          // Render signature: ~40mm wide, auto height proportional
          const sigWidth = 40
          const sigHeight = 15
          doc.addImage(sigDataUri, imgFormat, margin, y, sigWidth, sigHeight)
          y += sigHeight + 3
        }
      } catch {
        // Skip signature image if fetch fails
      }
    } else {
      y += 2
    }

    const chairmanName =
      event.organizing_chairman || event.scientific_chairman || null
    if (chairmanName) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.setTextColor(...dark)
      doc.text(chairmanName, margin, y)
      y += 7
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.setTextColor(...muted)
      doc.text(event.signatory_title || "Course Convenor", margin, y)
    }

    // === FOOTER ===
    const footerY = pageHeight - 10
    doc.setDrawColor(226, 232, 240)
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5)

    doc.setTextColor(...light)
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.text(
      `This is a computer-generated invitation.  |  Generated on ${today}`,
      pageWidth / 2,
      footerY,
      { align: "center" }
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
