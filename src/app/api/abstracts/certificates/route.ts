import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import QRCode from "qrcode"

export const dynamic = "force-dynamic"

// Allowed URL domains for template images (prevent SSRF)
const ALLOWED_IMAGE_DOMAINS = [
  "supabase.co",
  "supabase.com",
  "collegeofmas.org.in",
  "vercel-storage.com",
  "amazonaws.com",
]

// Validate template image URL to prevent SSRF
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

// Certificate sizes in points
const CERTIFICATE_SIZES: Record<string, { width: number; height: number }> = {
  "A4-landscape": { width: 842, height: 595 },
  "A4-portrait": { width: 595, height: 842 },
  "Letter-landscape": { width: 792, height: 612 },
}

// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0, g: 0, b: 0 }
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || ""
}

// Replace placeholders for abstracts
function replacePlaceholders(text: string, abstract: any, event: any): string {
  if (!text) return ""

  let result = text

  // Abstract placeholders
  result = result.replace(/\{\{name\}\}/g, abstract.presenting_author_name || "")
  result = result.replace(/\{\{author_name\}\}/g, abstract.presenting_author_name || "")
  result = result.replace(/\{\{abstract_number\}\}/g, abstract.abstract_number || "")
  result = result.replace(/\{\{abstract_title\}\}/g, abstract.title || "")
  result = result.replace(/\{\{presentation_type\}\}/g, formatPresentationType(abstract.accepted_as) || "")
  result = result.replace(/\{\{category\}\}/g, abstract.category?.name || "")
  result = result.replace(/\{\{institution\}\}/g, abstract.presenting_author_affiliation || "")
  result = result.replace(/\{\{email\}\}/g, abstract.presenting_author_email || "")

  // Event placeholders
  result = result.replace(/\{\{event_name\}\}/g, event?.name || "")
  result = result.replace(/\{\{event_short_name\}\}/g, event?.short_name || "")

  // Date placeholders
  if (event?.start_date && event?.end_date) {
    const start = new Date(event.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    const end = new Date(event.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    result = result.replace(/\{\{event_date\}\}/g, `${start} - ${end}`)
  } else {
    result = result.replace(/\{\{event_date\}\}/g, "")
  }

  // Session placeholders
  if (abstract.session_date) {
    const sessionDate = new Date(abstract.session_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    result = result.replace(/\{\{session_date\}\}/g, sessionDate)
  } else {
    result = result.replace(/\{\{session_date\}\}/g, "")
  }
  result = result.replace(/\{\{session_time\}\}/g, formatTime(abstract.session_time) || "")
  result = result.replace(/\{\{session_location\}\}/g, abstract.session_location || "")

  // Issue date
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
  result = result.replace(/\{\{issue_date\}\}/g, today)
  result = result.replace(/\{\{today\}\}/g, today)
  result = result.replace(/\{\{year\}\}/g, new Date().getFullYear().toString())

  // Verification URL
  const verificationUrl = `${getBaseUrl()}/verify/abstract/${abstract.abstract_number}`
  result = result.replace(/\{\{verification_url\}\}/g, verificationUrl)

  return result
}

function formatPresentationType(type: string | null): string {
  if (!type) return ""
  const labels: Record<string, string> = {
    oral: "Oral Presentation",
    poster: "Poster Presentation",
    video: "Video Presentation",
    eposter: "E-Poster Presentation",
  }
  return labels[type.toLowerCase()] || type
}

function formatTime(time: string | null): string {
  if (!time) return ""
  const [hours, minutes] = time.split(":")
  const hour = parseInt(hours)
  if (isNaN(hour)) return time
  const ampm = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

// POST /api/abstracts/certificates - Generate presenter certificates
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    const body = await request.json()
    const { event_id, abstract_ids, template_id } = body

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    if (!abstract_ids || !Array.isArray(abstract_ids) || abstract_ids.length === 0) {
      return NextResponse.json({ error: "abstract_ids are required" }, { status: 400 })
    }

    if (abstract_ids.length > 200) {
      return NextResponse.json({ error: "Cannot generate more than 200 certificates at once" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Fetch event
    const { data: event } = await (supabase as any)
      .from("events")
      .select("id, name, short_name, logo_url, start_date, end_date, city, venue")
      .eq("id", event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Check if we should require presentation_completed
    const requirePresented = body.require_presented !== false // Default true

    // Fetch abstracts
    let query = (supabase as any)
      .from("abstracts")
      .select(`
        id,
        abstract_number,
        title,
        status,
        accepted_as,
        presenting_author_name,
        presenting_author_email,
        presenting_author_affiliation,
        session_date,
        session_time,
        session_location,
        presentation_completed,
        presentation_completed_at,
        category:abstract_categories(name)
      `)
      .in("id", abstract_ids)
      .eq("status", "accepted")

    // If require_presented is true, only get those who have presented
    if (requirePresented) {
      query = query.eq("presentation_completed", true)
    }

    const { data: abstracts, error: absError } = await query

    if (absError || !abstracts || abstracts.length === 0) {
      const errorMsg = requirePresented
        ? "No presenters found who have completed their presentation. Presenters must be checked in via podium scanner before certificates can be generated."
        : "No accepted abstracts found"
      return NextResponse.json({ error: errorMsg }, { status: 404 })
    }

    // Fetch template if provided, otherwise use default design
    let template: any = null
    if (template_id) {
      const { data: t } = await (supabase as any)
        .from("certificate_templates")
        .select("*")
        .eq("id", template_id)
        .single()
      template = t
    }

    // Create PDF
    const certSize = CERTIFICATE_SIZES["A4-landscape"]
    const pdfDoc = await PDFDocument.create()
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman)
    const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)

    // Generate certificate for each abstract
    for (const abstract of abstracts) {
      const page = pdfDoc.addPage([certSize.width, certSize.height])
      const { width, height } = page.getSize()

      if (template && template.template_data) {
        // Use template elements
        await drawTemplateElements(page, pdfDoc, template, abstract, event, helvetica, helveticaBold)
      } else {
        // Use default certificate design
        await drawDefaultCertificate(page, pdfDoc, abstract, event, width, height, helvetica, helveticaBold, timesRoman, timesItalic)
      }
    }

    const pdfBytes = await pdfDoc.save()

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="presenter-certificates-${event.short_name || "event"}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error("Error generating presenter certificates:", error)
    return NextResponse.json({ error: "Failed to generate certificates" }, { status: 500 })
  }
}

// Draw default certificate design
async function drawDefaultCertificate(
  page: any,
  pdfDoc: any,
  abstract: any,
  event: any,
  width: number,
  height: number,
  helvetica: any,
  helveticaBold: any,
  timesRoman: any,
  timesItalic: any
) {
  // Background - elegant gradient effect with border
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.98, 0.98, 0.99),
  })

  // Border
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderColor: rgb(0.1, 0.2, 0.4),
    borderWidth: 3,
  })

  // Inner decorative border
  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderColor: rgb(0.7, 0.6, 0.3),
    borderWidth: 1,
  })

  // Header line
  page.drawRectangle({
    x: 50,
    y: height - 80,
    width: width - 100,
    height: 2,
    color: rgb(0.1, 0.2, 0.4),
  })

  // Certificate Title
  const title = "CERTIFICATE OF PRESENTATION"
  const titleWidth = helveticaBold.widthOfTextAtSize(title, 28)
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y: height - 120,
    size: 28,
    font: helveticaBold,
    color: rgb(0.1, 0.2, 0.4),
  })

  // "This is to certify that"
  const certifyText = "This is to certify that"
  const certifyWidth = timesItalic.widthOfTextAtSize(certifyText, 14)
  page.drawText(certifyText, {
    x: (width - certifyWidth) / 2,
    y: height - 170,
    size: 14,
    font: timesItalic,
    color: rgb(0.3, 0.3, 0.3),
  })

  // Author Name
  const authorName = abstract.presenting_author_name || "Presenter"
  const nameWidth = helveticaBold.widthOfTextAtSize(authorName, 32)
  page.drawText(authorName, {
    x: (width - nameWidth) / 2,
    y: height - 220,
    size: 32,
    font: helveticaBold,
    color: rgb(0.1, 0.15, 0.3),
  })

  // Affiliation
  if (abstract.presenting_author_affiliation) {
    const affWidth = timesItalic.widthOfTextAtSize(abstract.presenting_author_affiliation, 12)
    page.drawText(abstract.presenting_author_affiliation, {
      x: (width - affWidth) / 2,
      y: height - 245,
      size: 12,
      font: timesItalic,
      color: rgb(0.4, 0.4, 0.4),
    })
  }

  // Presentation text
  const presentedText = "presented a paper entitled"
  const presentedWidth = timesRoman.widthOfTextAtSize(presentedText, 14)
  page.drawText(presentedText, {
    x: (width - presentedWidth) / 2,
    y: height - 280,
    size: 14,
    font: timesRoman,
    color: rgb(0.3, 0.3, 0.3),
  })

  // Abstract Title (wrapped if needed)
  const abstractTitle = `"${abstract.title}"`
  const maxTitleWidth = width - 120
  const titleFontSize = 16
  const words = abstractTitle.split(" ")
  let lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const testWidth = helveticaBold.widthOfTextAtSize(testLine, titleFontSize)
    if (testWidth > maxTitleWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)

  let titleY = height - 320
  for (const line of lines.slice(0, 3)) {
    const lineWidth = helveticaBold.widthOfTextAtSize(line, titleFontSize)
    page.drawText(line, {
      x: (width - lineWidth) / 2,
      y: titleY,
      size: titleFontSize,
      font: helveticaBold,
      color: rgb(0.1, 0.2, 0.4),
    })
    titleY -= 22
  }

  // Presentation type
  const presType = formatPresentationType(abstract.accepted_as)
  if (presType) {
    const typeText = `as ${presType}`
    const typeWidth = timesRoman.widthOfTextAtSize(typeText, 14)
    page.drawText(typeText, {
      x: (width - typeWidth) / 2,
      y: titleY - 10,
      size: 14,
      font: timesRoman,
      color: rgb(0.3, 0.3, 0.3),
    })
  }

  // Event info
  const atText = "at"
  const atWidth = timesRoman.widthOfTextAtSize(atText, 12)
  page.drawText(atText, {
    x: (width - atWidth) / 2,
    y: height - 420,
    size: 12,
    font: timesRoman,
    color: rgb(0.4, 0.4, 0.4),
  })

  const eventName = event.name || "Conference"
  const eventWidth = helveticaBold.widthOfTextAtSize(eventName, 18)
  page.drawText(eventName, {
    x: (width - eventWidth) / 2,
    y: height - 445,
    size: 18,
    font: helveticaBold,
    color: rgb(0.1, 0.2, 0.4),
  })

  // Event date and location
  let eventDetails = ""
  if (event.start_date) {
    const start = new Date(event.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    eventDetails = start
  }
  if (event.city) {
    eventDetails += eventDetails ? ` | ${event.city}` : event.city
  }

  if (eventDetails) {
    const detailsWidth = timesRoman.widthOfTextAtSize(eventDetails, 12)
    page.drawText(eventDetails, {
      x: (width - detailsWidth) / 2,
      y: height - 470,
      size: 12,
      font: timesRoman,
      color: rgb(0.4, 0.4, 0.4),
    })
  }

  // Abstract number badge
  const absNum = `Abstract #${abstract.abstract_number}`
  const absNumWidth = helvetica.widthOfTextAtSize(absNum, 10)
  page.drawRectangle({
    x: (width - absNumWidth - 20) / 2,
    y: height - 510,
    width: absNumWidth + 20,
    height: 20,
    color: rgb(0.9, 0.9, 0.92),
    borderColor: rgb(0.7, 0.7, 0.75),
    borderWidth: 0.5,
  })
  page.drawText(absNum, {
    x: (width - absNumWidth) / 2,
    y: height - 505,
    size: 10,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.35),
  })

  // Footer line
  page.drawRectangle({
    x: 50,
    y: 80,
    width: width - 100,
    height: 1,
    color: rgb(0.7, 0.6, 0.3),
  })

  // Signature placeholders
  page.drawRectangle({
    x: 100,
    y: 100,
    width: 150,
    height: 1,
    color: rgb(0.3, 0.3, 0.3),
  })
  const sig1 = "Organizing Secretary"
  page.drawText(sig1, {
    x: 100 + (150 - helvetica.widthOfTextAtSize(sig1, 10)) / 2,
    y: 85,
    size: 10,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  })

  page.drawRectangle({
    x: width - 250,
    y: 100,
    width: 150,
    height: 1,
    color: rgb(0.3, 0.3, 0.3),
  })
  const sig2 = "President"
  page.drawText(sig2, {
    x: width - 250 + (150 - helvetica.widthOfTextAtSize(sig2, 10)) / 2,
    y: 85,
    size: 10,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  })

  // QR Code
  try {
    const qrContent = `${getBaseUrl()}/verify/abstract/${abstract.abstract_number}`
    const qrDataUrl = await QRCode.toDataURL(qrContent, { width: 100, margin: 1, errorCorrectionLevel: "M" })
    const qrBase64 = qrDataUrl.split(",")[1]
    const qrBytes = Uint8Array.from(atob(qrBase64), (c) => c.charCodeAt(0))
    const qrImage = await pdfDoc.embedPng(qrBytes)
    page.drawImage(qrImage, {
      x: width / 2 - 25,
      y: 45,
      width: 50,
      height: 50,
    })
  } catch (e) {
    console.error("Failed to generate QR:", e)
  }
}

// Draw template elements (when using custom template)
async function drawTemplateElements(
  page: any,
  pdfDoc: any,
  template: any,
  abstract: any,
  event: any,
  helvetica: any,
  helveticaBold: any
) {
  const templateData = template.template_data || {}
  const elements = templateData.elements || []
  const scaleFactor = 72 / 96
  const { width: pageWidth, height: pageHeight } = page.getSize()

  // Draw background (with URL validation to prevent SSRF)
  if (template.template_image_url && isAllowedImageUrl(template.template_image_url)) {
    try {
      const response = await fetch(template.template_image_url)
      const imageBytes = await response.arrayBuffer()
      const uint8Array = new Uint8Array(imageBytes)
      const isPNG = uint8Array[0] === 0x89 && uint8Array[1] === 0x50
      const isJPG = uint8Array[0] === 0xFF && uint8Array[1] === 0xD8

      let image: any = null
      if (isPNG) image = await pdfDoc.embedPng(imageBytes)
      else if (isJPG) image = await pdfDoc.embedJpg(imageBytes)

      if (image) {
        page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight })
      }
    } catch (e) {
      console.error("Failed to load background:", e)
    }
  }

  // Draw elements
  for (const element of elements) {
    const x = element.x * scaleFactor
    const y = pageHeight - (element.y * scaleFactor) - (element.height * scaleFactor)
    const width = element.width * scaleFactor
    const height = element.height * scaleFactor

    if (element.type === "text" && element.content) {
      const text = replacePlaceholders(element.content, abstract, event)
      const color = hexToRgb(element.color || "#000000")
      const fontSize = (element.fontSize || 14) * scaleFactor
      const font = element.fontWeight === "bold" ? helveticaBold : helvetica

      const textWidth = font.widthOfTextAtSize(text, fontSize)
      let textX = x
      if (element.align === "center") textX = x + (width - textWidth) / 2
      else if (element.align === "right") textX = x + width - textWidth

      page.drawText(text, {
        x: textX,
        y: y + (height - fontSize) / 2,
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
      })
    }

    if (element.type === "qr_code") {
      const qrContent = replacePlaceholders(element.content || "{{verification_url}}", abstract, event)
      try {
        const qrDataUrl = await QRCode.toDataURL(qrContent, { width: Math.round(width * 2), margin: 1 })
        const qrBase64 = qrDataUrl.split(",")[1]
        const qrBytes = Uint8Array.from(atob(qrBase64), (c) => c.charCodeAt(0))
        const qrImage = await pdfDoc.embedPng(qrBytes)
        const qrSize = Math.min(width, height)
        page.drawImage(qrImage, {
          x: x + (width - qrSize) / 2,
          y: y + (height - qrSize) / 2,
          width: qrSize,
          height: qrSize,
        })
      } catch (e) {
        console.error("Failed to generate QR:", e)
      }
    }
  }
}

// GET /api/abstracts/certificates - Get certificate generation status/info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get count of accepted abstracts
    const { count: acceptedCount } = await (supabase as any)
      .from("abstracts")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "accepted")

    // Get certificate templates
    const { data: templates } = await (supabase as any)
      .from("certificate_templates")
      .select("id, name, is_active")
      .eq("event_id", eventId)
      .eq("is_active", true)

    return NextResponse.json({
      accepted_count: acceptedCount || 0,
      templates: templates || [],
      available_placeholders: [
        "{{name}}", "{{author_name}}", "{{abstract_number}}", "{{abstract_title}}",
        "{{presentation_type}}", "{{category}}", "{{institution}}", "{{email}}",
        "{{event_name}}", "{{event_date}}", "{{session_date}}", "{{session_time}}",
        "{{session_location}}", "{{issue_date}}", "{{year}}", "{{verification_url}}",
      ],
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
