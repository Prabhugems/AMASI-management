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
  const invitationType = searchParams.get("type") // "speaker" to use speaker invitation settings
  const speakerName = searchParams.get("name")
  const speakerEmail = searchParams.get("email")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createAdminClient()) as any

  try {
    const { data: event, error } = await supabase
      .from("events")
      .select(
        "id, name, short_name, tagline, description, start_date, end_date, venue_name, city, state, scientific_chairman, organizing_chairman, organized_by, signatory_title, signature_image_url, logo_url, event_type, edition, settings"
      )
      .eq("id", eventId)
      .single()

    if (error || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Fetch attendee info
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
    } else if (speakerEmail) {
      // Look up by email
      const { data: reg } = await supabase
        .from("registrations")
        .select("attendee_name, attendee_designation, attendee_institution, registration_number")
        .eq("event_id", eventId)
        .ilike("attendee_email", speakerEmail)
        .maybeSingle()
      if (reg) {
        attendee = {
          name: reg.attendee_name,
          designation: reg.attendee_designation || "Speaker",
          institution: reg.attendee_institution,
          registration_number: reg.registration_number,
        }
      } else if (speakerName) {
        attendee = { name: speakerName, designation: "Speaker" }
      }
    } else if (speakerName) {
      attendee = { name: speakerName, designation: "Speaker" }
    }

    // Fetch speaker sessions if type=speaker
    let speakerSessions: { session_name: string; session_date: string; start_time: string; end_time: string; hall: string; role: string }[] = []
    if (invitationType === "speaker" && speakerEmail) {
      const { data: assignments } = await supabase
        .from("faculty_assignments")
        .select("session_name, session_date, start_time, end_time, hall, role")
        .eq("event_id", eventId)
        .ilike("faculty_email", speakerEmail)
        .in("status", ["confirmed", "pending", "invited"])
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })

      if (assignments?.length) {
        speakerSessions = assignments
      } else {
        // Fallback: check sessions table for speaker name
        const nameToSearch = speakerName || attendee?.name
        if (nameToSearch) {
          const { data: sessions } = await supabase
            .from("sessions")
            .select("session_name, session_date, start_time, end_time, hall, speakers")
            .eq("event_id", eventId)
            .ilike("speakers", `%${nameToSearch}%`)
            .order("session_date", { ascending: true })
            .order("start_time", { ascending: true })

          if (sessions?.length) {
            speakerSessions = sessions.map((s: any) => ({
              ...s,
              role: "Speaker",
            }))
          }
        }
      }

      // If no attendee but we have speaker info from params
      if (!attendee && speakerName) {
        attendee = { name: speakerName, designation: "Speaker" }
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
    let y = 0

    // Colors
    const primary: [number, number, number] = [37, 99, 235]      // Blue-600
    const primaryDark: [number, number, number] = [29, 78, 216]   // Blue-700
    const dark: [number, number, number] = [15, 23, 42]           // Slate-900
    const body: [number, number, number] = [51, 65, 85]           // Slate-600
    const muted: [number, number, number] = [100, 116, 139]       // Slate-500
    const light: [number, number, number] = [148, 163, 184]       // Slate-400

    // === HEADER BAND ===
    const headerHeight = 35
    // Gradient effect with two rectangles
    doc.setFillColor(...primaryDark)
    doc.rect(0, 0, pageWidth, headerHeight, "F")
    doc.setFillColor(...primary)
    doc.rect(0, 0, pageWidth, headerHeight - 3, "F")

    // Event title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    const eventTitle = event.name || "Event"
    const titleLines = doc.splitTextToSize(eventTitle, contentWidth - 10)
    const titleStartY = titleLines.length > 1 ? 12 : 15
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

    y = headerHeight + 8

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

    y += 10

    // === ADDRESSEE ===
    if (attendee) {
      doc.setTextColor(...dark)
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.text("To,", margin, y)
      y += 5
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...body)
      doc.setFontSize(9.5)
      doc.text(attendee.name, margin, y)
      y += 5
      if (attendee.designation) {
        doc.text(attendee.designation, margin, y)
        y += 4.5
      }
      if (attendee.institution) {
        doc.text(attendee.institution, margin, y)
        y += 4.5
      }
      y += 4
    }

    // === SALUTATION ===
    doc.setTextColor(...dark)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    const salutation = attendee ? `Dear ${attendee.name},` : "Dear Sir/Madam,"
    doc.text(salutation, margin, y)

    y += 8

    // === BODY PARAGRAPH ===
    const orgName = event.organized_by || event.short_name || "the organizing committee"
    const editionText = event.edition ? ` (${event.edition} Edition)` : ""
    let invitePhrase: string
    let bodyText: string
    if (invitationType === "speaker" && speakerSessions.length > 0) {
      invitePhrase = `We are pleased to invite you as a distinguished Speaker/Faculty`
      bodyText = `${invitePhrase} at "${event.name}"${editionText}, organized by ${orgName}. Your sessions are listed below. We request you to kindly make necessary arrangements to attend and deliver your presentations. Any assistance required for travel and accommodation will be provided by the organizing committee.`
    } else {
      invitePhrase = attendee
        ? `We are pleased to confirm your participation in`
        : `We are pleased to invite you to attend`
      bodyText = `${invitePhrase} "${event.name}"${editionText}, organized by ${orgName}. This ${event.event_type || "event"} brings together professionals, academicians, and researchers for knowledge exchange and collaborative learning.`
    }

    doc.setFontSize(9.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...body)
    const bodyLines = doc.splitTextToSize(bodyText, contentWidth)
    doc.text(bodyLines, margin, y, { lineHeightFactor: 1.4 })
    y += bodyLines.length * 5 + 8

    // === EVENT DETAILS BOX ===
    const labelX = margin + 6
    const valueX = margin + 30
    const rowHeight = 7

    // Count detail rows
    let detailRows = 2 // Date + Venue always
    const location = [event.city, event.state].filter(Boolean).join(", ")
    if (location) detailRows++
    if (attendee?.registration_number) detailRows++

    const boxPadding = 5
    const boxHeaderHeight = 9
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
    doc.setFontSize(9.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...primary)
    doc.text("Event Details", labelX, boxContentY + 4)

    let detailY = boxContentY + boxHeaderHeight + 2

    doc.setFontSize(9)

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

    y += boxHeight + 8

    // === SPEAKER SESSIONS TABLE ===
    if (speakerSessions.length > 0) {
      doc.setFontSize(9.5)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...primary)
      doc.text("Your Sessions", margin, y)
      y += 8

      // Table header
      const colWidths = [80, 22, 28, 30]
      const headers = ["Topic", "Date", "Time", "Hall"]
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.rect(margin, y - 4, contentWidth, 8, "FD")
      doc.setFontSize(8)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...dark)
      let hx = margin + 2
      headers.forEach((h, i) => {
        doc.text(h, hx, y)
        hx += colWidths[i]
      })
      y += 6

      // Table rows
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      for (const session of speakerSessions) {
        if (y > pageHeight - 50) { doc.addPage(); y = 25 }

        doc.setDrawColor(240, 240, 240)
        doc.line(margin, y - 3, margin + contentWidth, y - 3)

        doc.setTextColor(...body)
        let rx = margin + 2

        // Topic
        const topicLines = doc.splitTextToSize(session.session_name || "", colWidths[0] - 4)
        doc.text(topicLines[0] || "", rx, y)
        rx += colWidths[0]

        // Date
        const sessionDate = session.session_date ? new Date(session.session_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""
        doc.text(sessionDate, rx, y)
        rx += colWidths[1]

        // Time (combine start-end, format to 12hr)
        const formatTime = (t: string) => {
          if (!t) return ""
          const parts = t.split(":")
          const h = parseInt(parts[0])
          const m = parts[1] || "00"
          const ampm = h >= 12 ? "PM" : "AM"
          const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
          return `${h12}:${m} ${ampm}`
        }
        const timeStr = session.start_time ? `${formatTime(session.start_time)} - ${formatTime(session.end_time)}` : ""
        doc.text(timeStr, rx, y)
        rx += colWidths[2]

        // Hall
        doc.text(session.hall || "-", rx, y)

        y += 6
      }

      y += 8
    }

    // === CLOSING ===
    doc.setTextColor(...body)
    doc.setFontSize(9.5)
    doc.setFont("helvetica", "normal")
    doc.text("We look forward to your esteemed presence and participation.", margin, y)
    y += 5
    doc.text("Kindly make necessary arrangements to attend.", margin, y)

    y += 12

    // === SIGNATURE ===
    // Determine signer details: use speaker_invitation settings if type=speaker and settings exist
    const speakerInvitation = event.settings?.speaker_invitation as
      | { signer_name?: string; signer_title?: string; signature_url?: string }
      | undefined
    const useSpeakerSigner =
      invitationType === "speaker" &&
      speakerInvitation &&
      (speakerInvitation.signer_name || speakerInvitation.signature_url)

    const signerName = useSpeakerSigner && speakerInvitation.signer_name
      ? speakerInvitation.signer_name
      : event.organizing_chairman || event.scientific_chairman || null
    const signerTitle = useSpeakerSigner && speakerInvitation.signer_title
      ? speakerInvitation.signer_title
      : event.signatory_title || "Course Convenor"
    const signerImageUrl = useSpeakerSigner && speakerInvitation.signature_url
      ? speakerInvitation.signature_url
      : event.signature_image_url

    doc.setTextColor(...body)
    doc.setFontSize(9.5)
    doc.text("With warm regards,", margin, y)
    y += 6

    // Signature image (if uploaded)
    if (signerImageUrl) {
      try {
        const sigRes = await fetch(signerImageUrl)
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

    if (signerName) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.setTextColor(...dark)
      doc.text(signerName, margin, y)
      y += 5
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(...muted)
      doc.text(signerTitle, margin, y)
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
