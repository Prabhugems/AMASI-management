import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import QRCode from "qrcode"
import { logActivity } from "@/lib/activity-logger"

export const dynamic = "force-dynamic"

// Certificate sizes in points (72 points = 1 inch)
const CERTIFICATE_SIZES: Record<string, { width: number; height: number }> = {
  "A4-landscape": { width: 842, height: 595 },
  "A4-portrait": { width: 595, height: 842 },
  "Letter-landscape": { width: 792, height: 612 },
  "Letter-portrait": { width: 612, height: 792 },
  "A3-landscape": { width: 1191, height: 842 },
  "A3-portrait": { width: 842, height: 1191 },
}

// Convert hex color to RGB
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

// Apply text case transformation
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

// Get the base URL for verification links
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return "http://localhost:3000"
}

// Replace placeholders in text
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

  // Verification URL - encodes the registration number into a scannable verification link
  const verificationUrl = `${getBaseUrl()}/v/${encodeURIComponent(registration.registration_number || "")}`
  result = result.replace(/\{\{verification_url\}\}/g, verificationUrl)

  // Event date
  if (event?.start_date && event?.end_date) {
    const start = new Date(event.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    const end = new Date(event.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    result = result.replace(/\{\{event_date\}\}/g, `${start} - ${end}`)
  } else {
    result = result.replace(/\{\{event_date\}\}/g, "")
  }

  // Today's date for certificate
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
  result = result.replace(/\{\{issue_date\}\}/g, today)
  result = result.replace(/\{\{today\}\}/g, today)

  return result
}

// POST /api/certificates/generate - Generate PDF certificates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_id, template_id, registration_ids, single_registration_id } = body

    if (!event_id || !template_id) {
      return NextResponse.json({ error: "event_id and template_id are required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Fetch template
    const { data: template, error: templateError } = await (supabase as any)
      .from("certificate_templates")
      .select("*")
      .eq("id", template_id)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // Fetch event
    const { data: event } = await (supabase as any)
      .from("events")
      .select("id, name, short_name, logo_url, start_date, end_date")
      .eq("id", event_id)
      .single() as { data: { id: string; name: string; short_name: string; logo_url: string | null; start_date: string; end_date: string } | null }

    // Fetch registrations
    let query = (supabase as any)
      .from("registrations")
      .select(`
        id,
        registration_number,
        attendee_name,
        attendee_email,
        attendee_phone,
        attendee_institution,
        attendee_designation,
        ticket_type_id,
        ticket_types (name)
      `)
      .eq("event_id", event_id)

    if (single_registration_id) {
      query = query.eq("id", single_registration_id)
    } else if (registration_ids?.length > 0) {
      query = query.in("id", registration_ids)
    }

    const { data: registrations, error: regError } = await query

    if (regError || !registrations?.length) {
      return NextResponse.json({ error: "No registrations found" }, { status: 404 })
    }

    // Get certificate size
    const certSize = CERTIFICATE_SIZES[template.size] || CERTIFICATE_SIZES["A4-landscape"]
    const templateData = template.template_data || {}
    const elements = templateData.elements || []

    // Scale factor: template uses pixels at 96 DPI, PDF uses points at 72 DPI
    const scaleFactor = 72 / 96

    // Create PDF document
    const pdfDoc = await PDFDocument.create()
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Fetch and embed template background image if exists
    let backgroundImage: any = null
    if (template.template_image_url) {
      try {
        const imageResponse = await fetch(template.template_image_url)
        const imageBytes = await imageResponse.arrayBuffer()
        const uint8Array = new Uint8Array(imageBytes)

        const isPNG = uint8Array[0] === 0x89 && uint8Array[1] === 0x50
        const isJPG = uint8Array[0] === 0xFF && uint8Array[1] === 0xD8

        if (isPNG) {
          backgroundImage = await pdfDoc.embedPng(imageBytes)
        } else if (isJPG) {
          backgroundImage = await pdfDoc.embedJpg(imageBytes)
        }
      } catch (e) {
        console.error("Failed to load background image:", e)
      }
    }

    // Helper function to draw a single certificate
    const drawCertificate = async (page: any, registration: any) => {
      // Draw background color if no image
      if (!backgroundImage && templateData.backgroundColor) {
        const bgColor = hexToRgb(templateData.backgroundColor)
        page.drawRectangle({
          x: 0,
          y: 0,
          width: certSize.width,
          height: certSize.height,
          color: rgb(bgColor.r, bgColor.g, bgColor.b),
        })
      }

      // Draw background image if exists
      if (backgroundImage) {
        page.drawImage(backgroundImage, {
          x: 0,
          y: 0,
          width: certSize.width,
          height: certSize.height,
        })
      }

      // Draw elements
      for (const element of elements) {
        const x = element.x * scaleFactor
        const y = certSize.height - (element.y * scaleFactor) - (element.height * scaleFactor)
        const width = element.width * scaleFactor
        const height = element.height * scaleFactor

        if (element.type === "line") {
          const lineColor = hexToRgb(element.color || "#000000")
          const lineHeight = Math.max(1, element.height * scaleFactor)
          page.drawRectangle({
            x,
            y: y + (height - lineHeight) / 2,
            width,
            height: lineHeight,
            color: rgb(lineColor.r, lineColor.g, lineColor.b),
            opacity: (element.opacity ?? 100) / 100,
          })
        }

        if (element.type === "shape") {
          if (element.backgroundColor) {
            const color = hexToRgb(element.backgroundColor)
            page.drawRectangle({
              x, y, width, height,
              color: rgb(color.r, color.g, color.b),
              opacity: (element.opacity ?? 100) / 100,
            })
          }
          if (element.borderWidth && element.borderWidth > 0) {
            const borderColor = hexToRgb(element.borderColor || "#000000")
            const bw = element.borderWidth * scaleFactor
            page.drawRectangle({
              x, y, width, height,
              borderColor: rgb(borderColor.r, borderColor.g, borderColor.b),
              borderWidth: bw,
              opacity: (element.opacity ?? 100) / 100,
            })
          }
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
          const qrContent = replacePlaceholders(element.content || "{{verification_url}}", registration, event)
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

        if (element.type === "image" && element.imageUrl) {
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
    }

    // Generate certificates - one per page
    for (const registration of registrations) {
      const page = pdfDoc.addPage([certSize.width, certSize.height])
      await drawCertificate(page, registration)
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save()

    // Log activity
    logActivity({
      action: registrations.length === 1 ? "generate_certificate" : "bulk_action",
      entityType: "certificate",
      eventId: event_id,
      eventName: event?.name,
      description: registrations.length === 1
        ? `Generated certificate for ${registrations[0].attendee_name}`
        : `Generated ${registrations.length} certificates`,
      metadata: {
        count: registrations.length,
        templateId: template_id,
        templateName: template.name,
      },
    })

    // Return PDF
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificates-${event?.short_name || "event"}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error("Error generating certificates:", error)
    return NextResponse.json({ error: "Failed to generate certificates" }, { status: 500 })
  }
}
