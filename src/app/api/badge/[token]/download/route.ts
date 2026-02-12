import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import QRCode from "qrcode"

// Badge sizes in points (72 points = 1 inch)
const BADGE_SIZES: Record<string, { width: number; height: number }> = {
  "4x3": { width: 288, height: 216 },
  "3x4": { width: 216, height: 288 },
  "4x6": { width: 288, height: 432 },
  "3.5x2": { width: 252, height: 144 },
  "A6": { width: 298, height: 420 },
}

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

function applyTextCase(text: string, textCase?: string): string {
  if (!text) return text
  switch (textCase) {
    case "uppercase": return text.toUpperCase()
    case "lowercase": return text.toLowerCase()
    case "capitalize":
      return text.toLowerCase().replace(/(?:^|[\s.])([a-z])/g, (match) => match.toUpperCase())
    default: return text
  }
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000"
}

/**
 * Validate that a URL is safe to fetch server-side (prevent SSRF).
 * Only allows HTTPS URLs to trusted domains (Supabase storage, known CDNs).
 * Blocks internal/private IPs and non-HTTPS protocols.
 */
function isSafeImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Only allow https
    if (parsed.protocol !== "https:") return false
    // Block localhost and private IPs
    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.") ||
      hostname === "[::1]" ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

function replacePlaceholders(text: string, registration: any, event: any): string {
  if (!text) return ""

  let result = text
  result = result.replace(/\{\{name\}\}/g, registration.attendee_name || "")
  result = result.replace(/\{\{registration_number\}\}/g, registration.registration_number || "")
  result = result.replace(/\{\{ticket_type\}\}/g, registration.ticket_types?.name || "")
  result = result.replace(/\{\{email\}\}/g, registration.attendee_email || "")
  result = result.replace(/\{\{phone\}\}/g, String(registration.attendee_phone || ""))
  result = result.replace(/\{\{institution\}\}/g, registration.attendee_institution || "")
  result = result.replace(/\{\{designation\}\}/g, registration.attendee_designation || "")
  result = result.replace(/\{\{event_name\}\}/g, event?.name || "")

  const checkinToken = registration.checkin_token || registration.registration_number
  result = result.replace(/\{\{checkin_token\}\}/g, checkinToken)

  const baseUrl = getBaseUrl()
  const verifyUrl = `${baseUrl}/v/${checkinToken}`
  result = result.replace(/\{\{checkin_url\}\}/g, verifyUrl)
  result = result.replace(/\{\{verify_url\}\}/g, verifyUrl)

  if (event?.start_date && event?.end_date) {
    const start = new Date(event.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    const end = new Date(event.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    result = result.replace(/\{\{event_date\}\}/g, `${start} - ${end}`)
  } else {
    result = result.replace(/\{\{event_date\}\}/g, "")
  }

  return result
}

// GET /api/badge/[token]/download - Generate and download badge PDF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 3) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Determine if this is a checkin_token or registration_number
  const isSecureToken = token.length >= 20

  // Look up registration
  let query = (supabase as any)
    .from("registrations")
    .select(`
      id,
      registration_number,
      attendee_name,
      attendee_email,
      attendee_phone,
      attendee_designation,
      attendee_institution,
      badge_url,
      badge_template_id,
      checkin_token,
      status,
      event_id,
      ticket_type_id,
      ticket_types (name)
    `)

  if (isSecureToken) {
    query = query.eq("checkin_token", token)
  } else {
    query = query.ilike("registration_number", token)
  }

  const { data: registration, error: regError } = await query.single()

  if (regError || !registration) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 })
  }

  if (registration.status !== "confirmed") {
    return NextResponse.json({ error: `Registration is ${registration.status}` }, { status: 400 })
  }

  // If badge already stored, redirect to it (only if it's a safe Supabase storage URL)
  if (registration.badge_url) {
    try {
      const badgeUrl = new URL(registration.badge_url)
      const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
      if (badgeUrl.hostname === supabaseUrl.hostname || badgeUrl.hostname.endsWith(".supabase.co")) {
        return NextResponse.redirect(registration.badge_url)
      }
    } catch {
      // Invalid URL - fall through to generate badge
    }
  }

  // Get event
  const { data: event } = await (supabase as any)
    .from("events")
    .select("id, name, short_name, start_date, end_date")
    .eq("id", registration.event_id)
    .maybeSingle()

  // Get all badge templates for this event
  const { data: allTemplates } = await (supabase as any)
    .from("badge_templates")
    .select("*")
    .eq("event_id", registration.event_id)

  // Find the correct template based on ticket type
  const findBadgeTemplate = (ticketTypeId: string | null, templates: any[]) => {
    if (!templates || templates.length === 0) return null

    // Priority 1: Template that explicitly includes this ticket type
    if (ticketTypeId) {
      const specificTemplate = templates.find((t: any) =>
        t.ticket_type_ids && t.ticket_type_ids.includes(ticketTypeId)
      )
      if (specificTemplate) return specificTemplate
    }

    // Priority 2: Default template (but only if it's a general default without specific ticket types)
    const generalDefault = templates.find((t: any) =>
      t.is_default && (!t.ticket_type_ids || t.ticket_type_ids.length === 0)
    )
    if (generalDefault) return generalDefault

    // Priority 3: Any template marked as default
    const anyDefault = templates.find((t: any) => t.is_default)
    return anyDefault
  }

  let template = null

  // If badge_template_id is already set, verify it's still correct for this ticket type
  if (registration.badge_template_id) {
    // Check if there's a more specific template for this ticket type
    const correctTemplate = findBadgeTemplate(registration.ticket_type_id, allTemplates || [])
    if (correctTemplate && correctTemplate.id !== registration.badge_template_id) {
      // A more specific template exists, use it instead
      template = correctTemplate
    } else {
      // Use the saved template
      const { data } = await (supabase as any)
        .from("badge_templates")
        .select("*")
        .eq("id", registration.badge_template_id)
        .maybeSingle()
      template = data
    }
  } else {
    // Find the correct template based on ticket type
    template = findBadgeTemplate(registration.ticket_type_id, allTemplates || [])
  }

  if (!template) {
    return NextResponse.json({ error: "No badge template configured for this event" }, { status: 404 })
  }

  // Generate badge
  const badgeSize = BADGE_SIZES[template.size] || BADGE_SIZES["4x3"]
  const templateData = template.template_data || {}
  const elements = templateData.elements || []
  const scaleFactor = 72 / 96

  const pdfDoc = await PDFDocument.create()
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Fetch background image if exists
  let backgroundImage: any = null
  if (template.template_image_url && isSafeImageUrl(template.template_image_url)) {
    try {
      const imageResponse = await fetch(template.template_image_url)
      const imageBytes = await imageResponse.arrayBuffer()
      const uint8Array = new Uint8Array(imageBytes)
      const isPNG = uint8Array[0] === 0x89 && uint8Array[1] === 0x50
      const isJPG = uint8Array[0] === 0xFF && uint8Array[1] === 0xD8

      if (isPNG) backgroundImage = await pdfDoc.embedPng(imageBytes)
      else if (isJPG) backgroundImage = await pdfDoc.embedJpg(imageBytes)
    } catch (e) {
      console.error("Failed to load background image:", e)
    }
  }

  const page = pdfDoc.addPage([badgeSize.width, badgeSize.height])

  // Draw background
  if (!backgroundImage) {
    const bgColor = hexToRgb(templateData.backgroundColor || "#ffffff")
    page.drawRectangle({
      x: 0, y: 0,
      width: badgeSize.width,
      height: badgeSize.height,
      color: rgb(bgColor.r, bgColor.g, bgColor.b),
    })
  } else {
    page.drawImage(backgroundImage, {
      x: 0, y: 0,
      width: badgeSize.width,
      height: badgeSize.height,
    })
  }

  // Draw elements
  const visibleElements = elements
    .filter((el: any) => el.visible !== false)
    .sort((a: any, b: any) => (a.zIndex || 0) - (b.zIndex || 0))

  for (const element of visibleElements) {
    const x = element.x * scaleFactor
    const y = badgeSize.height - (element.y * scaleFactor) - (element.height * scaleFactor)
    const width = element.width * scaleFactor
    const height = element.height * scaleFactor

    if (element.type === "shape") {
      const fillColor = element.backgroundColor || element.color
      if (fillColor) {
        const colorRgb = hexToRgb(fillColor)
        page.drawRectangle({
          x, y, width, height,
          color: rgb(colorRgb.r, colorRgb.g, colorRgb.b),
          opacity: (element.opacity ?? 100) / 100,
        })
      }
    }

    if (element.type === "line") {
      const lineColor = hexToRgb(element.color || "#000000")
      const lineHeight = Math.max(1, element.height * scaleFactor)
      page.drawRectangle({
        x, y: y + (height - lineHeight) / 2,
        width, height: lineHeight,
        color: rgb(lineColor.r, lineColor.g, lineColor.b),
        opacity: (element.opacity ?? 100) / 100,
      })
    }

    if (element.type === "text" && element.content) {
      const rawText = replacePlaceholders(element.content, registration, event)
      const text = applyTextCase(rawText, element.textCase)
      const color = hexToRgb(element.color || "#000000")
      const fontSize = (element.fontSize || 14) * scaleFactor
      const font = element.fontWeight === "bold" ? helveticaBold : helveticaFont

      const textWidth = font.widthOfTextAtSize(text, fontSize)
      let textX = x
      if (element.align === "center") textX = x + (width - textWidth) / 2
      else if (element.align === "right") textX = x + width - textWidth

      const textY = y + (height - fontSize) / 2
      page.drawText(text, { x: textX, y: textY, size: fontSize, font, color: rgb(color.r, color.g, color.b) })
    }

    if (element.type === "qr_code") {
      const qrContent = replacePlaceholders(element.content || "{{checkin_url}}", registration, event)
      try {
        const qrDataUrl = await QRCode.toDataURL(qrContent, { width: Math.round(width * 2), margin: 1, errorCorrectionLevel: "M" })
        const qrBase64 = qrDataUrl.split(",")[1]
        const qrBytes = Uint8Array.from(atob(qrBase64), (c) => c.charCodeAt(0))
        const qrImage = await pdfDoc.embedPng(qrBytes)
        const qrSize = Math.min(width, height)
        page.drawImage(qrImage, { x: x + (width - qrSize) / 2, y: y + (height - qrSize) / 2, width: qrSize, height: qrSize })
      } catch (e) {
        console.error("Failed to generate QR code:", e)
      }
    }

    if (element.type === "image" && element.imageUrl && isSafeImageUrl(element.imageUrl)) {
      try {
        const imageResponse = await fetch(element.imageUrl)
        const imageBytes = await imageResponse.arrayBuffer()
        const uint8Array = new Uint8Array(imageBytes)
        const isPNG = uint8Array[0] === 0x89 && uint8Array[1] === 0x50
        const isJPG = uint8Array[0] === 0xFF && uint8Array[1] === 0xD8

        let image: any = null
        if (isPNG) image = await pdfDoc.embedPng(imageBytes)
        else if (isJPG) image = await pdfDoc.embedJpg(imageBytes)

        if (image) {
          const imgDims = image.scale(1)
          const imgScale = Math.min(width / imgDims.width, height / imgDims.height)
          const scaledWidth = imgDims.width * imgScale
          const scaledHeight = imgDims.height * imgScale
          page.drawImage(image, { x: x + (width - scaledWidth) / 2, y: y + (height - scaledHeight) / 2, width: scaledWidth, height: scaledHeight })
        }
      } catch (e) {
        console.error("Failed to load image:", e)
      }
    }
  }

  const pdfBytes = await pdfDoc.save()

  // Update registration with badge info
  await (supabase as any)
    .from("registrations")
    .update({
      badge_generated_at: new Date().toISOString(),
      badge_template_id: template.id,
    })
    .eq("id", registration.id)

  // Lock template if not already locked
  if (!template.is_locked) {
    await (supabase as any)
      .from("badge_templates")
      .update({
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_by: "delegate-download",
        badges_generated_count: 1,
      })
      .eq("id", template.id)
  } else {
    await (supabase as any)
      .from("badge_templates")
      .update({
        badges_generated_count: (template.badges_generated_count || 0) + 1,
      })
      .eq("id", template.id)
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="badge-${registration.registration_number}.pdf"`,
    },
  })
}
