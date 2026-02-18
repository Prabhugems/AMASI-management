import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { jsPDF } from "jspdf"

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

function formatTime(time: string) {
  if (!time || !time.includes(":")) return time || ""
  const [hours, minutes] = time.split(":")
  const h = parseInt(hours)
  if (isNaN(h)) return time
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes || "00"} ${ampm}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ facultyId: string }> }
) {
  const { facultyId } = await params

  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")

  if (!eventId) {
    return NextResponse.json(
      { error: "event_id query parameter is required" },
      { status: 400 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createAdminClient()) as any

  try {
    // 1. Fetch faculty
    const { data: faculty, error: facultyError } = await supabase
      .from("faculty")
      .select(
        "id, name, title, designation, institution, city, state, department"
      )
      .eq("id", facultyId)
      .single()

    if (facultyError || !faculty) {
      return NextResponse.json(
        { error: "Faculty not found" },
        { status: 404 }
      )
    }

    // 2. Fetch event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(
        "id, name, short_name, tagline, description, start_date, end_date, venue_name, city, state, scientific_chairman, organizing_chairman, organized_by, signatory_title, signature_image_url, event_type, edition"
      )
      .eq("id", eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // 3. Fetch assignments for this faculty + event
    const { data: assignments, error: assignError } = await supabase
      .from("faculty_assignments")
      .select("*")
      .eq("faculty_id", facultyId)
      .eq("event_id", eventId)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true })

    if (assignError) {
      return NextResponse.json(
        { error: "Failed to fetch assignments" },
        { status: 500 }
      )
    }

    if (!assignments || assignments.length === 0) {
      return NextResponse.json(
        { error: "No assignments found for this faculty at this event" },
        { status: 404 }
      )
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
    const primary: [number, number, number] = [37, 99, 235] // Blue-600
    const primaryDark: [number, number, number] = [29, 78, 216] // Blue-700
    const dark: [number, number, number] = [15, 23, 42] // Slate-900
    const body: [number, number, number] = [51, 65, 85] // Slate-600
    const muted: [number, number, number] = [100, 116, 139] // Slate-500
    const light: [number, number, number] = [148, 163, 184] // Slate-400

    // Helper to check page overflow and add new page
    function checkPageBreak(needed: number) {
      if (y + needed > pageHeight - 30) {
        doc.addPage()
        y = 25
      }
    }

    // === HEADER BAND ===
    const headerHeight = 50
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
    doc.text(titleLines, pageWidth / 2, titleStartY, {
      align: "center",
      lineHeightFactor: 1.3,
    })

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
    doc.setTextColor(...dark)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text("To,", margin, y)
    y += 7
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...body)
    const facultyFullName = faculty.title
      ? `${faculty.title} ${faculty.name}`
      : faculty.name
    doc.text(facultyFullName, margin, y)
    y += 6
    if (faculty.designation) {
      doc.setFontSize(10)
      doc.text(faculty.designation, margin, y)
      y += 5.5
    }
    if (faculty.institution) {
      doc.setFontSize(10)
      doc.text(faculty.institution, margin, y)
      y += 5.5
    }
    const facultyLocation = [faculty.city, faculty.state]
      .filter(Boolean)
      .join(", ")
    if (facultyLocation) {
      doc.setFontSize(10)
      doc.text(facultyLocation, margin, y)
      y += 5.5
    }

    y += 8

    // === SALUTATION ===
    doc.setTextColor(...dark)
    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    doc.text(`Dear ${facultyFullName},`, margin, y)

    y += 12

    // === BODY PARAGRAPH ===
    // Build role summary from assignments
    const roles = [...new Set(assignments.map((a: { role: string }) => a.role))] as string[]
    const roleLabels = roles.map(
      (r) => r.charAt(0).toUpperCase() + r.slice(1)
    )
    const roleText =
      roleLabels.length === 1
        ? roleLabels[0]
        : roleLabels.slice(0, -1).join(", ") +
          " and " +
          roleLabels[roleLabels.length - 1]

    const orgName =
      event.organized_by || event.short_name || "the organizing committee"
    const editionText = event.edition ? ` (${event.edition} Edition)` : ""
    const bodyText = `We are pleased to invite you as a ${roleText} at "${event.name}"${editionText}, organized by ${orgName}. This ${event.event_type || "event"} brings together professionals, academicians, and researchers for knowledge exchange and collaborative learning.`

    doc.setFontSize(10.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...body)
    const bodyLines = doc.splitTextToSize(bodyText, contentWidth)
    doc.text(bodyLines, margin, y, { lineHeightFactor: 1.5 })
    y += bodyLines.length * 6 + 12

    // === YOUR ASSIGNMENT DETAILS BOX ===
    checkPageBreak(60)

    const labelX = margin + 8
    const valueX = margin + 42

    // Calculate box height based on assignments
    const boxPadding = 8
    const boxHeaderHeight = 14
    const rowHeight = 7
    let totalContentHeight = 0
    for (let i = 0; i < assignments.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = assignments[i] as any
      let rows = 2 // Role + Session always
      if (a.topic_title) rows++
      if (a.session_date) rows++
      if (a.start_time) rows++
      if (a.hall) rows++
      if (a.duration_minutes) rows++
      totalContentHeight += rows * rowHeight + 4 // 4mm padding per assignment
      if (i < assignments.length - 1) totalContentHeight += 4 // divider space
    }
    const assignBoxHeight =
      boxPadding * 2 + boxHeaderHeight + totalContentHeight

    // Check if box fits on current page
    if (y + assignBoxHeight > pageHeight - 30) {
      doc.addPage()
      y = 25
    }

    // Box background
    doc.setFillColor(248, 250, 252) // Slate-50
    doc.setDrawColor(226, 232, 240) // Slate-200
    doc.roundedRect(margin, y, contentWidth, assignBoxHeight, 2, 2, "FD")

    // Left accent bar
    doc.setFillColor(...primary)
    doc.rect(margin, y, 3, assignBoxHeight, "F")

    const boxStartY = y
    let detailY = y + boxPadding

    // "Your Assignment Details" header
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...primary)
    doc.text("Your Assignment Details", labelX, detailY + 4)
    detailY += boxHeaderHeight + 2

    doc.setFontSize(9.5)

    for (let i = 0; i < assignments.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = assignments[i] as any
      const roleLabel = a.role.charAt(0).toUpperCase() + a.role.slice(1)

      // Role
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...dark)
      doc.text("Role:", labelX, detailY)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...primary)
      doc.text(roleLabel, valueX, detailY)
      detailY += rowHeight

      // Session
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...dark)
      doc.text("Session:", labelX, detailY)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...body)
      const sessionText = a.session_name || "To be confirmed"
      const sessionLines = doc.splitTextToSize(sessionText, contentWidth - 50)
      doc.text(sessionLines[0], valueX, detailY)
      detailY += rowHeight

      // Topic
      if (a.topic_title) {
        doc.setFont("helvetica", "bold")
        doc.setTextColor(...dark)
        doc.text("Topic:", labelX, detailY)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...body)
        const topicLines = doc.splitTextToSize(a.topic_title, contentWidth - 50)
        doc.text(topicLines[0], valueX, detailY)
        detailY += rowHeight
      }

      // Date
      if (a.session_date) {
        doc.setFont("helvetica", "bold")
        doc.setTextColor(...dark)
        doc.text("Date:", labelX, detailY)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...body)
        doc.text(formatDate(a.session_date), valueX, detailY)
        detailY += rowHeight
      }

      // Time
      if (a.start_time) {
        doc.setFont("helvetica", "bold")
        doc.setTextColor(...dark)
        doc.text("Time:", labelX, detailY)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...body)
        const timeStr = a.end_time
          ? `${formatTime(a.start_time)} - ${formatTime(a.end_time)}`
          : formatTime(a.start_time)
        doc.text(timeStr, valueX, detailY)
        detailY += rowHeight
      }

      // Hall
      if (a.hall) {
        doc.setFont("helvetica", "bold")
        doc.setTextColor(...dark)
        doc.text("Hall:", labelX, detailY)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...body)
        doc.text(a.hall, valueX, detailY)
        detailY += rowHeight
      }

      // Duration
      if (a.duration_minutes) {
        doc.setFont("helvetica", "bold")
        doc.setTextColor(...dark)
        doc.text("Duration:", labelX, detailY)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...body)
        doc.text(`${a.duration_minutes} minutes`, valueX, detailY)
        detailY += rowHeight
      }

      detailY += 4

      // Divider between assignments
      if (i < assignments.length - 1) {
        doc.setDrawColor(203, 213, 225) // Slate-300
        doc.setLineWidth(0.3)
        doc.line(labelX, detailY - 2, margin + contentWidth - 8, detailY - 2)
        detailY += 4
      }
    }

    y = boxStartY + assignBoxHeight + 14

    // === EVENT DETAILS BOX ===
    checkPageBreak(50)

    let eventDetailRows = 2 // Date + Venue always
    const eventLocation = [event.city, event.state].filter(Boolean).join(", ")
    if (eventLocation) eventDetailRows++

    const evtBoxPadding = 8
    const evtBoxHeaderHeight = 12
    const evtRowHeight = 9
    const evtBoxHeight =
      evtBoxPadding * 2 + evtBoxHeaderHeight + eventDetailRows * evtRowHeight + 2

    doc.setFillColor(248, 250, 252) // Slate-50
    doc.setDrawColor(226, 232, 240) // Slate-200
    doc.roundedRect(margin, y, contentWidth, evtBoxHeight, 2, 2, "FD")

    // Left accent bar
    doc.setFillColor(...primary)
    doc.rect(margin, y, 3, evtBoxHeight, "F")

    let evtDetailY = y + evtBoxPadding

    // "Event Details" header
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...primary)
    doc.text("Event Details", labelX, evtDetailY + 4)
    evtDetailY += evtBoxHeaderHeight + 2

    doc.setFontSize(10)

    // Date
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...dark)
    doc.text("Date:", labelX, evtDetailY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...body)
    doc.text(
      formatDateRange(event.start_date, event.end_date),
      valueX,
      evtDetailY
    )
    evtDetailY += evtRowHeight

    // Venue
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...dark)
    doc.text("Venue:", labelX, evtDetailY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...body)
    doc.text(event.venue_name || "To be announced", valueX, evtDetailY)
    evtDetailY += evtRowHeight

    // Location
    if (eventLocation) {
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...dark)
      doc.text("Location:", labelX, evtDetailY)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...body)
      doc.text(eventLocation, valueX, evtDetailY)
    }

    y += evtBoxHeight + 14

    // === CLOSING ===
    checkPageBreak(85)

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

    // Signature image
    if (event.signature_image_url) {
      try {
        const sigRes = await fetch(event.signature_image_url)
        if (sigRes.ok) {
          const sigBuffer = await sigRes.arrayBuffer()
          const sigBase64 = Buffer.from(sigBuffer).toString("base64")
          const contentType = sigRes.headers.get("content-type") || "image/png"
          const imgFormat = contentType.includes("png") ? "PNG" : "JPEG"
          const sigDataUri = `data:${contentType};base64,${sigBase64}`
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
    const totalPages = doc.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
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
    }

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"))
    const namePart = faculty.name.replace(/[^a-zA-Z0-9]/g, "_")
    const eventPart = (event.name || "Event").replace(/[^a-zA-Z0-9]/g, "_")
    const filename = `Faculty-Invitation-${namePart}-${eventPart}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Faculty invitation PDF generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate faculty invitation PDF" },
      { status: 500 }
    )
  }
}
