import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { jsPDF } from "jspdf"
import { LETTER_TEMPLATES, renderFields, type LetterEventInfo, type LetterContent } from "@/lib/services/faculty-letter-templates"
import { shouldUseEssurgLetterhead, drawEssurgHeaderJsPdf, drawEssurgFooterJsPdf } from "@/lib/pdf/essurg-letterhead"

// Allowed URL domains for signature images (prevent SSRF) — same list as
// src/app/api/abstracts/certificates/route.ts
const ALLOWED_IMAGE_DOMAINS = [
  "supabase.co",
  "supabase.com",
  "collegeofmas.org.in",
  "vercel-storage.com",
  "amazonaws.com",
]

// Validate signature image URL to prevent SSRF
function isAllowedImageUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    // Only allow HTTPS
    if (url.protocol !== "https:") return false
    // Check against allowed domains
    const hostname = url.hostname.toLowerCase()
    return ALLOWED_IMAGE_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

// Same sentinel-string guard as invitation-pdf/route.ts — registration data
// has occasionally been imported/backfilled with the literal string "None"
// instead of a real null.
function cleanField(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed || ["none", "n/a", "null", "na"].includes(trimmed.toLowerCase())) return undefined
  return trimmed
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "-"
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : null

  const startStr = start.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
  if (!end || start.toDateString() === end.toDateString()) return startStr

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} - ${end.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
  }
  return `${startStr} - ${end.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
}

function buildRef(shortName: string | null, registrationNumber: string | undefined): string {
  const prefix = (shortName || "EVENT").toUpperCase().replace(/[^A-Z0-9]/g, "")
  const serial = registrationNumber || Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${prefix}/FAC/${serial}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params

  const { user, error: authError } = await requireEventAndPermission(eventId, "speakers")
  if (authError) return authError
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const { template_key, registration_id, fields: rawFields } = body as {
      template_key?: string
      registration_id?: string
      fields?: Record<string, string>
    }

    const template = template_key ? LETTER_TEMPLATES[template_key] : undefined
    if (!template) {
      return NextResponse.json({ error: "Unknown template_key" }, { status: 400 })
    }
    if (!registration_id) {
      return NextResponse.json({ error: "registration_id is required" }, { status: 400 })
    }

    for (const f of template.fields) {
      if (!rawFields?.[f.key]) {
        return NextResponse.json({ error: `Missing required field: ${f.label}` }, { status: 400 })
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createAdminClient()) as any

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, short_name, start_date, end_date, venue_name, city, state, contact_email, scientific_chairman, organizing_chairman, signatory_title, edition, settings")
      .eq("id", eventId)
      .single()
    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const { data: registration, error: regError } = await supabase
      .from("registrations")
      .select("attendee_name, attendee_designation, attendee_institution, registration_number")
      .eq("id", registration_id)
      .eq("event_id", eventId)
      .single()
    if (regError || !registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    const recipient = {
      name: registration.attendee_name as string,
      designation: cleanField(registration.attendee_designation),
      institution: cleanField(registration.attendee_institution),
    }

    const fields = renderFields(template, rawFields || {})

    const eventInfo: LetterEventInfo = {
      name: event.name,
      edition: event.edition,
      dateRange: formatDateRange(event.start_date, event.end_date),
      venue: event.venue_name || "To be announced",
      city: event.city || "",
      contactEmail: event.contact_email,
    }

    const content: LetterContent = template.build(fields, eventInfo)
    // Only visa_support uses "consular" mode; its field schema is the one
    // place that guarantees embassyName/embassyCity keys exist.
    const embassyName = content.addresseeMode === "consular" ? fields.embassyName : undefined
    const embassyCity = content.addresseeMode === "consular" ? fields.embassyCity : undefined

    const letterSigners = event.settings?.letter_signers as
      | { scientific?: { title?: string; signature_url?: string }; organizing?: { title?: string; signature_url?: string } }
      | undefined

    const signers: { name: string; title: string; signature_url?: string }[] = []
    if (event.scientific_chairman) {
      signers.push({
        name: event.scientific_chairman,
        title: letterSigners?.scientific?.title || event.signatory_title || "Course Convenor",
        signature_url: letterSigners?.scientific?.signature_url,
      })
    }
    if (event.organizing_chairman) {
      signers.push({
        name: event.organizing_chairman,
        title: letterSigners?.organizing?.title || event.signatory_title || "Course Convenor",
        signature_url: letterSigners?.organizing?.signature_url,
      })
    }

    const pdfBuffer = await renderLetterPdf(
      content,
      recipient,
      eventInfo,
      signers,
      buildRef(event.short_name, registration.registration_number),
      shouldUseEssurgLetterhead(event.id),
      embassyName,
      embassyCity
    )

    const filename = `${template.label.replace(/[^a-zA-Z0-9]/g, "_")}-${recipient.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Faculty letter PDF generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate letter PDF" },
      { status: 500 }
    )
  }
}

async function renderLetterPdf(
  content: LetterContent,
  recipient: { name: string; designation?: string; institution?: string },
  event: LetterEventInfo,
  signers: { name: string; title: string; signature_url?: string }[],
  ref: string,
  useEssurgLetterhead: boolean,
  embassyName?: string,
  embassyCity?: string
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - 2 * margin
  let y = 0
  const pageBreakBottomMargin = useEssurgLetterhead ? 85 : 60

  const primary: [number, number, number] = [37, 99, 235]
  const primaryDark: [number, number, number] = [29, 78, 216]
  const dark: [number, number, number] = [15, 23, 42]
  const body: [number, number, number] = [51, 65, 85]
  const muted: [number, number, number] = [100, 116, 139]
  const light: [number, number, number] = [148, 163, 184]

  // === HEADER BAND — measure before draw, same fix as invitation-pdf/route.ts ===
  const essurgHeaderY = useEssurgLetterhead ? drawEssurgHeaderJsPdf(doc, margin) : null

  if (essurgHeaderY !== null) {
    y = essurgHeaderY
  } else {
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    const titleLines = doc.splitTextToSize(event.name || "Event", contentWidth - 10)
    const titleStartY = titleLines.length > 1 ? 12 : 15
    const afterTitleY = titleStartY + titleLines.length * 7.5
    const editionY = afterTitleY + 6
    const headerHeight = Math.max(35, editionY + 4)

    doc.setFillColor(...primaryDark)
    doc.rect(0, 0, pageWidth, headerHeight, "F")
    doc.setFillColor(...primary)
    doc.rect(0, 0, pageWidth, headerHeight - 3, "F")

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text(titleLines, pageWidth / 2, titleStartY, { align: "center", lineHeightFactor: 1.3 })

    if (event.edition) {
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(226, 232, 240)
      doc.text(`${event.edition} Edition`, pageWidth / 2, editionY, { align: "center" })
    }

    y = headerHeight + 8
  }

  // === DATE + REF ===
  doc.setTextColor(...muted)
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
  doc.text(`Date: ${today}`, margin, y)
  y += 5
  doc.text(`Ref: ${ref}`, margin, y)
  y += 9

  // === ADDRESSEE ===
  doc.setTextColor(...dark)
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("To,", margin, y)
  y += 5
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...body)
  doc.setFontSize(9.5)
  if (content.addresseeMode === "consular") {
    doc.text("The Visa / Consular Officer", margin, y)
    y += 4.5
    if (embassyName) { doc.text(embassyName, margin, y); y += 4.5 }
    if (embassyCity) { doc.text(embassyCity, margin, y); y += 4.5 }
  } else {
    doc.text(recipient.name, margin, y)
    y += 5
    if (recipient.designation) { doc.text(recipient.designation, margin, y); y += 4.5 }
    if (recipient.institution) { doc.text(recipient.institution, margin, y); y += 4.5 }
  }
  y += 6

  // === SUBJECT ===
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9.5)
  doc.setTextColor(...dark)
  const subjectLines = doc.splitTextToSize(`Subject: ${content.subject}`, contentWidth)
  doc.text(subjectLines, margin, y)
  y += subjectLines.length * 4.5 + 6

  // === SALUTATION ===
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(...dark)
  doc.text(content.addresseeMode === "consular" ? "Dear Sir/Madam," : `Dear ${recipient.name},`, margin, y)
  y += 8

  // === PARAGRAPHS ===
  doc.setFontSize(9.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...body)
  for (const para of content.paragraphs) {
    const lines = doc.splitTextToSize(para, contentWidth)
    if (y + lines.length * 5 > pageHeight - pageBreakBottomMargin) { doc.addPage(); y = 25 }
    doc.text(lines, margin, y, { lineHeightFactor: 1.4 })
    y += lines.length * 5 + 6
  }

  // === DETAIL BOX (dynamic rows) ===
  if (content.detailRows.length > 0) {
    const labelX = margin + 6
    const valueX = margin + 55
    const boxPadding = 5
    const rowHeight = 7
    const detailLines: { label: string; lines: string[] }[] = content.detailRows.map((row) => ({
      label: row.label,
      lines: doc.splitTextToSize(row.value || "-", contentWidth - (valueX - margin) - boxPadding),
    }))
    const totalRowUnits = detailLines.reduce((sum, r) => sum + Math.max(1, r.lines.length), 0)
    const boxHeight = boxPadding * 2 + totalRowUnits * rowHeight

    if (y + boxHeight > pageHeight - pageBreakBottomMargin) { doc.addPage(); y = 25 }

    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, "FD")
    doc.setFillColor(...primary)
    doc.rect(margin, y, 3, boxHeight, "F")

    let detailY = y + boxPadding + 4
    doc.setFontSize(9)
    for (const row of detailLines) {
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...dark)
      doc.text(row.label + ":", labelX, detailY)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...body)
      doc.text(row.lines, valueX, detailY)
      detailY += Math.max(1, row.lines.length) * rowHeight
    }
    y += boxHeight + 8
  }

  // === CLOSING PARAGRAPHS ===
  doc.setFontSize(9.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...body)
  for (const para of content.closingParagraphs) {
    const lines = doc.splitTextToSize(para, contentWidth)
    if (y + lines.length * 5 > pageHeight - pageBreakBottomMargin) { doc.addPage(); y = 25 }
    doc.text(lines, margin, y, { lineHeightFactor: 1.4 })
    y += lines.length * 5 + 6
  }

  // === SIGNATURES (one or two, side by side) ===
  if (y > pageHeight - pageBreakBottomMargin) { doc.addPage(); y = 25 }
  doc.setTextColor(...body)
  doc.setFontSize(9.5)
  doc.text("With warm regards,", margin, y)
  y += 6

  const columnWidth = signers.length > 1 ? contentWidth / 2 : contentWidth
  const signatureRowStartY = y
  let maxSignatureY = y

  for (let i = 0; i < signers.length; i++) {
    const signer = signers[i]
    const colX = margin + i * columnWidth
    let colY = signatureRowStartY

    if (signer.signature_url && isAllowedImageUrl(signer.signature_url)) {
      try {
        const sigRes = await fetch(signer.signature_url, { signal: AbortSignal.timeout(5000) })
        if (sigRes.ok) {
          const sigBuffer = await sigRes.arrayBuffer()
          const sigBase64 = Buffer.from(sigBuffer).toString("base64")
          const contentType = sigRes.headers.get("content-type") || "image/png"
          const imgFormat = contentType.includes("png") ? "PNG" : "JPEG"
          doc.addImage(`data:${contentType};base64,${sigBase64}`, imgFormat, colX, colY, 40, 15)
          colY += 18
        } else {
          colY += 5
        }
      } catch {
        colY += 5
      }
    } else {
      colY += 5
    }

    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(...dark)
    doc.text(signer.name, colX, colY)
    colY += 5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...muted)
    doc.text(signer.title, colX, colY)

    maxSignatureY = Math.max(maxSignatureY, colY)
  }
  y = maxSignatureY

  // === FOOTER ===
  const essurgFooterDrawn = useEssurgLetterhead && drawEssurgFooterJsPdf(doc, pageHeight, margin)
  if (!essurgFooterDrawn) {
    const footerY = pageHeight - 10
    doc.setDrawColor(226, 232, 240)
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5)
    doc.setTextColor(...light)
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.text(`This is a computer-generated letter.  |  Generated on ${today}`, pageWidth / 2, footerY, { align: "center" })
  }

  return Buffer.from(doc.output("arraybuffer"))
}
