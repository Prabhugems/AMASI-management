import { NextRequest, NextResponse } from "next/server"
import fs from "node:fs"
import path from "node:path"
import { createAdminClient } from "@/lib/supabase/server"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from "@/lib/rate-limit"

/**
 * AES-8 style faculty invitation PDF.
 *
 * GET /api/events/[eventId]/aes-faculty-pdf?email=<faculty_email>
 *  - or -
 * GET /api/events/[eventId]/aes-faculty-pdf?token=<portal_token>
 *
 * Generates a one-page A4 invitation on the AMASI letterhead with a
 * personalised commitment table built from faculty_assignments.
 */

const LETTERHEAD_PATH = path.join(process.cwd(), "public/amasi/letterhead.png")
const SIGNATURE_PATH = path.join(process.cwd(), "public/amasi/signature-roshan-shetty-flat.png")

let LETTERHEAD_CACHE: string | null = null
let SIGNATURE_CACHE: string | null = null

function loadLetterhead(): string {
  if (!LETTERHEAD_CACHE) LETTERHEAD_CACHE = fs.readFileSync(LETTERHEAD_PATH).toString("base64")
  return LETTERHEAD_CACHE
}
function loadSignature(): string {
  if (!SIGNATURE_CACHE) SIGNATURE_CACHE = fs.readFileSync(SIGNATURE_PATH).toString("base64")
  return SIGNATURE_CACHE
}

function dateOnly(d: string | null): string {
  if (!d) return "-"
  const dt = new Date(d + "T00:00:00")
  const dd = String(dt.getDate()).padStart(2, "0")
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const yy = dt.getFullYear()
  return `${dd}/${mm}/${yy}`
}
function timeOnly(t: string | null): string {
  if (!t) return "-"
  return t.slice(0, 5)
}
function durationMinutes(start: string | null, end: string | null): string {
  if (!start || !end) return "-"
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  return String((eh * 60 + em) - (sh * 60 + sm))
}

function eventDateRange(start: string | null, end: string | null): string {
  if (!start) return "TBA"
  const s = new Date(start + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
  if (!end || start === end) return s
  const e = new Date(end + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
  return `${s} - ${e}`
}

interface Assignment {
  faculty_name: string
  faculty_email: string | null
  role: string
  session_name: string | null
  topic_title: string | null
  session_date: string | null
  start_time: string | null
  end_time: string | null
  hall: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params

  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`aes-faculty-pdf:${clientIp}`, "public")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  const { searchParams } = new URL(request.url)
  let email = searchParams.get("email")
  const token = searchParams.get("token")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createAdminClient()) as any

  // Token resolution: pull email from the registration matching the portal token.
  // Supports both registrations.custom_fields.portal_token and faculty_assignments.invitation_token.
  if (!email && token) {
    const { data: regByToken } = await supabase
      .from("registrations")
      .select("attendee_email")
      .eq("event_id", eventId)
      .filter("custom_fields->>portal_token", "eq", token)
      .maybeSingle()
    if (regByToken?.attendee_email) email = regByToken.attendee_email
    if (!email) {
      const { data: assignByToken } = await supabase
        .from("faculty_assignments")
        .select("faculty_email")
        .eq("event_id", eventId)
        .eq("invitation_token", token)
        .maybeSingle()
      if (assignByToken?.faculty_email) email = assignByToken.faculty_email
    }
  }

  if (!email) {
    return NextResponse.json({ error: "email or token required" }, { status: 400 })
  }

  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("id, name, short_name, start_date, end_date, venue_name, city, state, edition, settings")
    .eq("id", eventId)
    .single()
  if (eventErr || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  const { data: assignmentsRaw } = await supabase
    .from("faculty_assignments")
    .select("faculty_name, faculty_email, role, session_name, topic_title, session_date, start_time, end_time, hall")
    .eq("event_id", eventId)
    .ilike("faculty_email", email)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true })

  const assignments: Assignment[] = assignmentsRaw || []
  if (!assignments.length) {
    return NextResponse.json({ error: "No assignments found for this faculty" }, { status: 404 })
  }

  const facultyName = assignments[0].faculty_name || "Faculty"
  const eventName = event.short_name || event.name || "Event"
  const venueParts = [event.venue_name, event.city].filter(Boolean)
  const venue = venueParts.length ? venueParts.join(", ") : "the venue"
  const dateRange = eventDateRange(event.start_date, event.end_date)

  // Per-event signer override via settings.speaker_invitation
  const speakerInvite = event.settings?.speaker_invitation as
    | { signer_name?: string; signer_title?: string; signature_url?: string }
    | undefined
  const signerName = speakerInvite?.signer_name || "Dr. Roshan Shetty"
  const signerTitle = speakerInvite?.signer_title || "Secretary, AMASI"

  // Build PDF
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // Background letterhead spans the full A4
  doc.addImage(`data:image/png;base64,${loadLetterhead()}`, "PNG", 0, 0, pageW, pageH, undefined, "FAST")

  const margin = 20
  let y = 50

  doc.setTextColor(15, 23, 42)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.text(`Dear Dr. ${facultyName},`, margin, y)
  y += 7

  const intro = `I trust this message finds you in good health. We are delighted to extend an invitation for you to share your expertise at the ${eventName}, scheduled from ${dateRange}, at ${venue}. Your valuable insights will undoubtedly enrich the experience for participants, marking a significant milestone in our journey. We look forward to your presence at this momentous occasion.`
  doc.setFontSize(10.5)
  const introLines = doc.splitTextToSize(intro, pageW - 2 * margin)
  doc.text(introLines, margin, y, { lineHeightFactor: 1.45 })
  y += introLines.length * 5.2 + 4

  doc.text("Hereby your Commitment for the course is follows", margin, y)
  y += 6

  const tableRows = assignments.map((a, i) => {
    const dStr = dateOnly(a.session_date)
    const sessionLabel = a.hall || (a.role === "chairperson" ? "Chairperson" : "Session")
    return [
      String(i + 1),
      sessionLabel,
      `${dStr}\n${timeOnly(a.start_time)}`,
      `${dStr}\n${timeOnly(a.end_time)}`,
      durationMinutes(a.start_time, a.end_time),
      a.topic_title || a.session_name || "-",
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [["S.No", "Session", "Starting Time", "Ending Time", "Duration\n(Minutes)", "Topic"]],
    body: tableRows,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
      lineColor: [180, 180, 180],
      lineWidth: 0.15,
      textColor: [30, 30, 30],
      valign: "middle",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [20, 20, 20],
      fontStyle: "bold",
      halign: "center",
      lineColor: [120, 120, 120],
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { halign: "center", cellWidth: 28, fillColor: [205, 232, 196] },
      2: { halign: "center", cellWidth: 26 },
      3: { halign: "center", cellWidth: 26 },
      4: { halign: "center", cellWidth: 22 },
      5: { halign: "left" },
    },
    bodyStyles: { fillColor: [255, 255, 255] },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterTableY = ((doc as any).lastAutoTable?.finalY ?? y) + 18
  const sigW = 38, sigH = 22
  const sigX = pageW - margin - sigW
  doc.addImage(`data:image/png;base64,${loadSignature()}`, "PNG", sigX, afterTableY, sigW, sigH, undefined, "FAST")
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text(signerName, pageW - margin, afterTableY + sigH + 5, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(signerTitle, pageW - margin, afterTableY + sigH + 10, { align: "right" })

  const pdf = Buffer.from(doc.output("arraybuffer"))
  const safe = facultyName.replace(/[^a-zA-Z0-9]/g, "_")
  const filename = `Invitation-${safe}-${eventName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
