import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import QRCode from "qrcode"
import { logActivity } from "@/lib/activity-logger"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

interface Placeholder {
  id: string
  type: "text" | "qr_code" | "image" | "shape" | "line" | "barcode" | "photo"
  x: number
  y: number
  width: number
  height: number
  content?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: "normal" | "bold"
  fontStyle?: "normal" | "italic"
  textCase?: "none" | "uppercase" | "lowercase" | "capitalize"
  color?: string
  backgroundColor?: string
  align?: "left" | "center" | "right"
  imageUrl?: string
  borderWidth?: number
  borderColor?: string
  borderRadius?: number
  opacity?: number
  lineStyle?: "solid" | "dashed" | "dotted"
  visible?: boolean
  zIndex?: number
  shapeType?: "rectangle" | "circle" | "triangle"
}

// Badge sizes in points (72 points = 1 inch)
const BADGE_SIZES: Record<string, { width: number; height: number }> = {
  "4x3": { width: 288, height: 216 },
  "3x4": { width: 216, height: 288 },
  "4x6": { width: 288, height: 432 },
  "3.5x2": { width: 252, height: 144 },
  "A6": { width: 298, height: 420 },
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
      // Handle proper capitalization including after periods (Dr.Name)
      return text.toLowerCase().replace(/(?:^|[\s.])([a-z])/g, (match) => match.toUpperCase())
    default: return text
  }
}

// Get base URL for verification links
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  // Only use localhost in development
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000"
  }
  // Fallback for production without proper config
  console.warn("No NEXT_PUBLIC_APP_URL or VERCEL_URL configured, using relative paths")
  return ""
}

// Replace placeholders in text
function replacePlaceholders(text: string, registration: any, event: any): string {
  if (!text) return ""

  let result = text
  result = result.replace(/\{\{name\}\}/g, registration.attendee_name || "")
  result = result.replace(/\{\{registration_number\}\}/g, registration.registration_number || "")
  result = result.replace(/\{\{ticket_type\}\}/g, registration.ticket_types?.name || "")
  result = result.replace(/\{\{email\}\}/g, registration.attendee_email || "")
  result = result.replace(/\{\{phone\}\}/g, registration.attendee_phone || "")
  result = result.replace(/\{\{institution\}\}/g, registration.attendee_institution || "")
  result = result.replace(/\{\{designation\}\}/g, registration.attendee_designation || "")
  result = result.replace(/\{\{event_name\}\}/g, event?.name || "")

  // Addons - comma-separated list of purchased addon names
  const addonNames = (registration.registration_addons || [])
    .map((ra: any) => ra.addons?.name)
    .filter(Boolean)
    .join(", ")
  result = result.replace(/\{\{addons\}\}/g, addonNames)

  // Secure check-in token (for QR codes - like Tito)
  const checkinToken = registration.checkin_token || registration.registration_number
  result = result.replace(/\{\{checkin_token\}\}/g, checkinToken)

  // Full verification URL for QR codes
  const baseUrl = getBaseUrl()
  const verifyUrl = `${baseUrl}/v/${checkinToken}`
  result = result.replace(/\{\{checkin_url\}\}/g, verifyUrl)
  result = result.replace(/\{\{verify_url\}\}/g, verifyUrl)

  // Event date
  if (event?.start_date && event?.end_date) {
    const start = new Date(event.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    const end = new Date(event.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    result = result.replace(/\{\{event_date\}\}/g, `${start} - ${end}`)
  } else {
    result = result.replace(/\{\{event_date\}\}/g, "")
  }

  return result
}

// A4 size in points (72 points = 1 inch)
const A4_WIDTH = 595
const A4_HEIGHT = 842

// POST /api/badges/generate - Generate PDF badges
export async function POST(request: NextRequest) {
  // Rate limit: bulk tier for badge generation (resource intensive)
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "bulk")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const body = await request.json()
    const { event_id, template_id, registration_ids, single_registration_id, badges_per_page = 1, store_badges = false } = body

    if (!event_id || !template_id) {
      return NextResponse.json({ error: "event_id and template_id are required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Fetch template
    const { data: template, error: templateError } = await (supabase as any)
      .from("badge_templates")
      .select("*")
      .eq("id", template_id)
      .single()

    if (templateError || !template) {
      console.error("Template fetch error:", templateError)
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // Debug: Log raw template from database
    console.log("Raw template from DB:", JSON.stringify({
      id: template.id,
      name: template.name,
      size: template.size,
      template_data_type: typeof template.template_data,
      template_data_keys: template.template_data ? Object.keys(template.template_data) : null,
      elements_count: template.template_data?.elements?.length,
    }, null, 2))

    // Fetch event
    const { data: event } = await (supabase as any)
      .from("events")
      .select("id, name, short_name, logo_url, start_date, end_date")
      .eq("id", event_id)
      .single() as { data: { id: string; name: string; short_name: string; logo_url: string | null; start_date: string; end_date: string } | null }

    // Fetch registrations (including checkin_token for secure QR codes and addons)
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
        checkin_token,
        ticket_types (name),
        registration_addons (
          addon_id,
          addons (name)
        )
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

    // Get badge size
    const badgeSize = BADGE_SIZES[template.size] || BADGE_SIZES["4x3"]
    const templateData = template.template_data || {}
    let elements = templateData.elements || []

    // If template has no elements, use default fallback elements
    if (elements.length === 0) {
      console.warn(`Template "${template.name}" has no elements - using default layout`)
      const defaultWidth = badgeSize.width * (96/72) // Convert points to pixels
      const defaultHeight = badgeSize.height * (96/72)
      elements = [
        // Background
        { id: "bg", type: "shape", x: 0, y: 0, width: defaultWidth, height: defaultHeight, backgroundColor: "#ffffff", zIndex: 0, visible: true },
        // Name - large, centered at top
        { id: "name", type: "text", x: 20, y: 40, width: defaultWidth - 40, height: 50, content: "{{name}}", fontSize: 28, fontWeight: "bold", align: "center", color: "#1a1a2e", zIndex: 1, visible: true, textCase: "uppercase" },
        // Ticket type / Role
        { id: "ticket", type: "text", x: 20, y: 95, width: defaultWidth - 40, height: 30, content: "{{ticket_type}}", fontSize: 16, fontWeight: "normal", align: "center", color: "#4a4a68", zIndex: 1, visible: true },
        // Institution
        { id: "institution", type: "text", x: 20, y: 130, width: defaultWidth - 40, height: 25, content: "{{institution}}", fontSize: 12, fontWeight: "normal", align: "center", color: "#6b6b80", zIndex: 1, visible: true },
        // QR Code - centered at bottom
        { id: "qr", type: "qr_code", x: (defaultWidth - 80) / 2, y: defaultHeight - 110, width: 80, height: 80, content: "{{checkin_url}}", zIndex: 1, visible: true },
        // Registration number below QR
        { id: "regnum", type: "text", x: 20, y: defaultHeight - 25, width: defaultWidth - 40, height: 20, content: "{{registration_number}}", fontSize: 10, fontWeight: "normal", align: "center", color: "#888888", zIndex: 1, visible: true },
      ]
    }

    // Debug: Log template data
    console.log("Template loaded:", {
      id: template.id,
      name: template.name,
      size: template.size,
      hasTemplateData: !!template.template_data,
      backgroundColor: templateData.backgroundColor,
      elementsCount: elements.length,
      usingDefaultLayout: (templateData.elements || []).length === 0,
      elements: elements.map((e: Placeholder) => ({ type: e.type, visible: e.visible, content: e.content?.substring(0, 30) })),
    })

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

        // Check magic bytes for image type
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

    // Helper function to draw a single badge
    const drawBadge = async (page: any, registration: any, offsetX: number, offsetY: number, scale: number) => {
      const actualBadgeW = badgeSize.width * scale
      const actualBadgeH = badgeSize.height * scale

      // Draw background color (default to white if no image and no color specified)
      if (!backgroundImage) {
        const bgColor = hexToRgb(templateData.backgroundColor || "#ffffff")
        page.drawRectangle({
          x: offsetX,
          y: offsetY,
          width: actualBadgeW,
          height: actualBadgeH,
          color: rgb(bgColor.r, bgColor.g, bgColor.b),
        })
      }

      // Draw background image if exists
      if (backgroundImage) {
        page.drawImage(backgroundImage, {
          x: offsetX,
          y: offsetY,
          width: actualBadgeW,
          height: actualBadgeH,
        })
      }

      // Sort elements by zIndex and filter out hidden ones
      const visibleElements = elements
        .filter((el: Placeholder) => el.visible !== false)
        .sort((a: Placeholder, b: Placeholder) => (a.zIndex || 0) - (b.zIndex || 0))

      console.log(`Drawing ${visibleElements.length} visible elements for registration ${registration.registration_number}`)

      // Draw elements
      for (const element of visibleElements) {
        const x = offsetX + element.x * scaleFactor * scale
        const y = offsetY + actualBadgeH - (element.y * scaleFactor * scale) - (element.height * scaleFactor * scale)
        const width = element.width * scaleFactor * scale
        const height = element.height * scaleFactor * scale

        if (element.type === "line") {
          const lineColor = hexToRgb(element.color || "#000000")
          const lineHeight = Math.max(1, element.height * scaleFactor * scale)
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
          // Use backgroundColor if set, otherwise fall back to color
          const fillColor = element.backgroundColor || element.color
          if (fillColor) {
            const colorRgb = hexToRgb(fillColor)
            page.drawRectangle({
              x, y, width, height,
              color: rgb(colorRgb.r, colorRgb.g, colorRgb.b),
              opacity: (element.opacity ?? 100) / 100,
            })
          }
          if (element.borderWidth && element.borderWidth > 0) {
            const borderColor = hexToRgb(element.borderColor || "#000000")
            const bw = element.borderWidth * scaleFactor * scale
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
          const fontSize = (element.fontSize || 14) * scaleFactor * scale
          const font = element.fontWeight === "bold" ? helveticaBold : helveticaFont

          const textWidth = font.widthOfTextAtSize(text, fontSize)
          let textX = x
          if (element.align === "center") textX = x + (width - textWidth) / 2
          else if (element.align === "right") textX = x + width - textWidth

          const textY = y + (height - fontSize) / 2
          page.drawText(text, { x: textX, y: textY, size: fontSize, font, color: rgb(color.r, color.g, color.b) })
        }

        if (element.type === "qr_code") {
          // Use secure verification URL by default (like Tito)
          // Falls back to registration_number for backward compatibility
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

        // Barcode - render as monospace text (for visual representation)
        if (element.type === "barcode" && element.content) {
          const barcodeContent = replacePlaceholders(element.content, registration, event)
          const color = hexToRgb(element.color || "#000000")
          const fontSize = Math.min(height * 0.3, 12) * scale

          // Draw barcode background
          page.drawRectangle({
            x, y, width, height,
            color: rgb(1, 1, 1),
          })

          // Draw barcode lines representation (simplified)
          const lineWidth = width / (barcodeContent.length * 2 + 10)
          for (let i = 0; i < barcodeContent.length * 2 + 10; i++) {
            if (i % 2 === 0 || (barcodeContent.charCodeAt(i % barcodeContent.length) % 2 === 0)) {
              page.drawRectangle({
                x: x + i * lineWidth,
                y: y + height * 0.2,
                width: lineWidth * 0.8,
                height: height * 0.6,
                color: rgb(0, 0, 0),
              })
            }
          }

          // Draw text below barcode
          const textWidth = helveticaFont.widthOfTextAtSize(barcodeContent, fontSize)
          page.drawText(barcodeContent, {
            x: x + (width - textWidth) / 2,
            y: y + 2,
            size: fontSize,
            font: helveticaFont,
            color: rgb(color.r, color.g, color.b),
          })
        }

        // Photo placeholder - draw a placeholder box
        if (element.type === "photo") {
          // Draw placeholder background
          page.drawRectangle({
            x, y, width, height,
            color: rgb(0.9, 0.9, 0.9),
            borderColor: rgb(0.7, 0.7, 0.7),
            borderWidth: 1,
          })
        }
      }
    }

    // Calculate layout for multiple badges per page
    const useA4 = badges_per_page > 1
    const pageWidth = useA4 ? A4_WIDTH : badgeSize.width
    const pageHeight = useA4 ? A4_HEIGHT : badgeSize.height

    // Grid layout for badges per page
    const layouts: Record<number, { cols: number; rows: number }> = {
      1: { cols: 1, rows: 1 },
      2: { cols: 1, rows: 2 },
      4: { cols: 2, rows: 2 },
      6: { cols: 2, rows: 3 },
      8: { cols: 2, rows: 4 },
    }
    const layout = layouts[badges_per_page] || { cols: 1, rows: 1 }

    // Calculate badge scale to fit in grid
    const margin = useA4 ? 20 : 0
    const availableWidth = (pageWidth - margin * 2) / layout.cols
    const availableHeight = (pageHeight - margin * 2) / layout.rows
    const badgeScale = useA4 ? Math.min(availableWidth / badgeSize.width, availableHeight / badgeSize.height) * 0.95 : 1
    const scaledBadgeW = badgeSize.width * badgeScale
    const scaledBadgeH = badgeSize.height * badgeScale

    // Generate badges
    let currentPage: any = null
    let badgeIndex = 0

    for (const registration of registrations) {
      const posOnPage = badgeIndex % badges_per_page

      if (posOnPage === 0) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight])
      }

      const col = posOnPage % layout.cols
      const row = Math.floor(posOnPage / layout.cols)

      // Calculate position (centered in each grid cell)
      const cellWidth = (pageWidth - margin * 2) / layout.cols
      const cellHeight = (pageHeight - margin * 2) / layout.rows
      const offsetX = margin + col * cellWidth + (cellWidth - scaledBadgeW) / 2
      const offsetY = pageHeight - margin - (row + 1) * cellHeight + (cellHeight - scaledBadgeH) / 2

      await drawBadge(currentPage, registration, offsetX, offsetY, badgeScale)
      badgeIndex++
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save()

    // Lock template if not already locked (first generation locks it)
    if (!template.is_locked) {
      await (supabase as any)
        .from("badge_templates")
        .update({
          is_locked: true,
          locked_at: new Date().toISOString(),
          locked_by: "system",
          badges_generated_count: registrations.length,
        })
        .eq("id", template_id)
    } else {
      // Increment badges generated count
      await (supabase as any)
        .from("badge_templates")
        .update({
          badges_generated_count: (template.badges_generated_count || 0) + registrations.length,
        })
        .eq("id", template_id)
    }

    // Store badges if requested (for single badge generation)
    if (store_badges && single_registration_id) {
      try {
        const fileName = `badges/${event_id}/${single_registration_id}.pdf`
        const { data: uploadData, error: uploadError } = await (supabase as any)
          .storage
          .from("badges")
          .upload(fileName, Buffer.from(pdfBytes), {
            contentType: "application/pdf",
            upsert: true,
          })

        if (!uploadError && uploadData) {
          // Get public URL
          const { data: urlData } = (supabase as any)
            .storage
            .from("badges")
            .getPublicUrl(fileName)

          // Update registration with badge URL
          await (supabase as any)
            .from("registrations")
            .update({
              badge_url: urlData?.publicUrl,
              badge_generated_at: new Date().toISOString(),
              badge_template_id: template_id,
            })
            .eq("id", single_registration_id)
        }
      } catch (storageError) {
        console.error("Failed to store badge:", storageError)
        // Continue - don't fail the whole request
      }
    }

    // Fetch ALL templates for this event to properly assign per ticket type
    const { data: allTemplates } = await (supabase as any)
      .from("badge_templates")
      .select("id, ticket_type_ids, is_default")
      .eq("event_id", event_id)

    // Helper to find correct template for a ticket type
    const findCorrectTemplateId = (ticketTypeId: string | null): string => {
      if (!allTemplates || allTemplates.length === 0) return template_id

      // Priority 1: Template that explicitly includes this ticket type
      if (ticketTypeId) {
        const specificTemplate = allTemplates.find((t: any) =>
          t.ticket_type_ids && t.ticket_type_ids.includes(ticketTypeId)
        )
        if (specificTemplate) return specificTemplate.id
      }

      // Priority 2: Default template without specific ticket types
      const generalDefault = allTemplates.find((t: any) =>
        t.is_default && (!t.ticket_type_ids || t.ticket_type_ids.length === 0)
      )
      if (generalDefault) return generalDefault.id

      // Priority 3: Any default or the passed template_id
      const anyDefault = allTemplates.find((t: any) => t.is_default)
      return anyDefault?.id || template_id
    }

    // Update badge_generated_at status for all generated registrations with CORRECT template
    const regIds = single_registration_id
      ? [single_registration_id]
      : (registration_ids?.length > 0 ? registration_ids : registrations.map((r: any) => r.id))

    console.log("Updating badge_generated_at for registration IDs:", regIds)

    if (regIds?.length > 0) {
      // Update each registration with the correct template based on their ticket type
      for (const reg of registrations) {
        const correctTemplateId = findCorrectTemplateId(reg.ticket_type_id)
        const { error: updateError } = await (supabase as any)
          .from("registrations")
          .update({
            badge_generated_at: new Date().toISOString(),
            badge_template_id: correctTemplateId,
          })
          .eq("id", reg.id)

        if (updateError) {
          console.error(`Failed to update badge for ${reg.id}:`, updateError)
        }
      }
      console.log("Successfully updated badge_generated_at for:", registrations.length, "registrations")
    }

    // Log activity
    logActivity({
      action: registrations.length === 1 ? "generate_badge" : "bulk_action",
      entityType: "badge",
      eventId: event_id,
      eventName: event?.name,
      description: registrations.length === 1
        ? `Generated badge for ${registrations[0].attendee_name}`
        : `Generated ${registrations.length} badges`,
      metadata: {
        count: registrations.length,
        templateId: template_id,
        templateName: template.name,
      },
    })

    // Return PDF - convert Uint8Array to Buffer for NextResponse
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="badges-${event?.short_name || "event"}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error("Error generating badges:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
