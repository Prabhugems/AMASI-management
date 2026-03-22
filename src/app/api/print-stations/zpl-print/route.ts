import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import net from "net"

// POST /api/print-stations/zpl-print - Send ZPL to Zebra printer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      printer_ip,
      printer_port = 9100,
      registration,
      station,
      badge_template,
      print_mode,
      test_print = false,
      generate_only = false
    } = body

    // Generate ZPL code
    let zpl: string

    if (test_print) {
      // Simple test label
      zpl = generateTestZPL()
    } else if (badge_template?.template_data) {
      // Generate ZPL from badge template
      zpl = generateZPLFromTemplate(badge_template.template_data, registration, station, print_mode)
    } else {
      // Default badge ZPL
      zpl = generateDefaultZPL(registration, station)
    }

    // If generate_only flag is set, return ZPL without sending to printer
    // This is used by Electron app which sends via its own TCP socket
    if (generate_only || printer_ip === 'GENERATE_ONLY') {
      return NextResponse.json({
        success: true,
        zpl: zpl,
        message: "ZPL generated (not sent to printer)"
      })
    }

    if (!printer_ip) {
      return NextResponse.json({ error: "printer_ip is required" }, { status: 400 })
    }

    // Send to printer
    const result = await sendToPrinter(printer_ip, printer_port, zpl)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Print job sent successfully",
        zpl_preview: zpl.substring(0, 500) + "..." // Preview for debugging
      })
    } else {
      return NextResponse.json({
        error: result.error,
        message: "Failed to send to printer"
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error("ZPL Print Error:", error)
    return NextResponse.json({ error: "Failed to process print request" }, { status: 500 })
  }
}

// Send ZPL to printer via TCP socket
async function sendToPrinter(ip: string, port: number, zpl: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const client = new net.Socket()
    const timeout = 10000 // 10 seconds

    const timer = setTimeout(() => {
      client.destroy()
      resolve({ success: false, error: "Connection timeout" })
    }, timeout)

    client.connect(port, ip, () => {
      client.write(zpl, () => {
        clearTimeout(timer)
        client.end()
        resolve({ success: true })
      })
    })

    client.on("error", (err) => {
      clearTimeout(timer)
      client.destroy()
      resolve({ success: false, error: err.message })
    })

    client.on("close", () => {
      clearTimeout(timer)
    })
  })
}

// Generate test label ZPL
function generateTestZPL(): string {
  return `
^XA
^CI28
^MNM
^POI
^FO50,50^A0N,40,40^FDZebra Test Print^FS
^FO50,100^A0N,30,30^FDConnection Successful!^FS
^FO50,150^A0N,25,25^FD${new Date().toLocaleString()}^FS
^XZ
`.trim()
}

// Generate default badge ZPL (when no template)
function generateDefaultZPL(registration: any, station: any): string {
  const settings = station?.print_settings || {}
  const paperSize = settings.paper_size || "4x6"
  const rotation = settings.rotation || 0

  // Get label dimensions in dots (203 DPI: 1 inch = 203 dots)
  const dimensions = getLabelDimensions(paperSize)

  // Calculate positions based on label size
  const centerX = Math.floor(dimensions.width / 2)
  const startY = 80

  const name = registration?.attendee_name || "Test Name"
  const designation = registration?.attendee_designation || ""
  const institution = registration?.attendee_institution || ""
  const ticketType = registration?.ticket_type || registration?.ticket_types?.name || "Attendee"
  const regNumber = registration?.registration_number || "REG000"
  const eventName = station?.events?.name || "Event"

  // Rotation command: ^PON (normal), ^POI (inverted/180°)
  // Default to 180° for thermal printers (labels feed bottom-first)
  const rotationCmd = rotation === 0 ? "^PON" : "^POI"

  return `
^XA
^CI28
^MNM
${rotationCmd}
^LH0,0
^LL${dimensions.height}
^PW${dimensions.width}

^FO${centerX - 200},${startY}^A0N,35,35^FB400,1,0,C^FD${eventName}^FS

^FO${centerX - 250},${startY + 80}^A0N,60,60^FB500,2,0,C^FD${name}^FS

${designation ? `^FO${centerX - 200},${startY + 200}^A0N,35,35^FB400,1,0,C^FD${designation}^FS` : ""}

${institution ? `^FO${centerX - 200},${startY + 250}^A0N,30,30^FB400,1,0,C^FD${institution}^FS` : ""}

^FO${centerX - 100},${startY + 320}^GB200,50,3^FS
^FO${centerX - 90},${startY + 332}^A0N,30,30^FB180,1,0,C^FD${ticketType}^FS

^FO${centerX - 80},${startY + 400}^A0N,25,25^FB160,1,0,C^FD${regNumber}^FS

^FO${centerX - 60},${startY + 450}^BQN,2,4^FDQA,${regNumber}^FS

^XZ
`.trim()
}

// Generate ZPL from badge template
function generateZPLFromTemplate(
  templateData: any,
  registration: any,
  station: any,
  printMode?: "label" | "overlay" | "full_badge"
): string {
  let elements = templateData.elements || []
  const settings = station?.print_settings || {}
  const paperSize = settings.paper_size || "4x6"
  const isOverlayMode = printMode === "overlay"

  // Overlay mode: NO rotation (pre-printed stock orientation is fixed)
  // Full badge/label: Use settings or default 180° for thermal printers
  const rotation = isOverlayMode ? 0 : (settings.rotation ?? 180)

  const dimensions = getLabelDimensions(paperSize)
  const rotationCmd = rotation === 0 ? "^PON" : "^POI"

  // Scale factor: template uses pixels, Zebra uses 203 DPI dots
  const templateWidth = getTemplateDimensions(paperSize).width
  const templateHeight = getTemplateDimensions(paperSize).height
  const scaleX = dimensions.width / templateWidth
  const scaleY = dimensions.height / templateHeight

  // For overlay mode: only print variable data (text, QR, barcode)
  if (isOverlayMode) {
    elements = elements.filter((el: any) =>
      el.type === "text" || el.type === "qr_code" || el.type === "barcode"
    )
  }

  let zplElements = ""

  // Sort elements by zIndex
  const sortedElements = [...elements].sort((a: any, b: any) => (a.zIndex || 0) - (b.zIndex || 0))

  for (const element of sortedElements) {
    const x = Math.floor(element.x * scaleX)
    const y = Math.floor(element.y * scaleY)
    const width = Math.floor(element.width * scaleX)
    const height = Math.floor(element.height * scaleY)

    if (element.type === "text") {
      const content = replacePlaceholders(element.content || "", registration, station)
      // Scale font properly to match design
      const scaledFontSize = Math.floor((element.fontSize || 14) * scaleY)
      const fontHeight = Math.max(20, Math.min(scaledFontSize, 150))
      const fontWidth = fontHeight

      // Text alignment
      const align = element.align === "center" ? "C" : element.align === "right" ? "R" : "L"

      zplElements += `^FO${x},${y}^A0N,${fontHeight},${fontWidth}^FB${width},1,0,${align}^FD${content}^FS\n`
    }
    else if (element.type === "shape" && element.shapeType === "rectangle") {
      const borderWidth = Math.max(1, Math.floor((element.borderWidth || 1) * scaleX))
      zplElements += `^FO${x},${y}^GB${width},${height},${borderWidth}^FS\n`
    }
    else if (element.type === "line") {
      const lineThickness = Math.max(1, Math.floor(height))
      zplElements += `^FO${x},${y}^GB${width},${lineThickness},${lineThickness}^FS\n`
    }
    else if (element.type === "qr_code") {
      const qrContent = replacePlaceholders(element.content || "", registration, station)
      // QR magnification: use max (10) for best quality, ~25 modules typical
      const magnification = 10
      const actualQrSize = 25 * magnification // Approximate QR size in dots
      // Center QR within its designed area
      const qrX = x + Math.floor((width - actualQrSize) / 2)
      const qrY = y + Math.floor((height - actualQrSize) / 2)
      zplElements += `^FO${Math.max(0, qrX)},${Math.max(0, qrY)}^BQN,2,${magnification}^FDQA,${qrContent}^FS\n`
    }
    else if (element.type === "barcode") {
      const barcodeContent = replacePlaceholders(element.content || "", registration, station)
      zplElements += `^FO${x},${y}^BCN,${height},Y,N,N^FD${barcodeContent}^FS\n`
    }
  }

  return `
^XA
^CI28
^MNM
${rotationCmd}
^LH0,0
^LL${dimensions.height}
^PW${dimensions.width}
${zplElements}
^XZ
`.trim()
}

// Replace placeholders with registration data
function replacePlaceholders(text: string, registration: any, station: any): string {
  if (!text) return ""
  let result = text
  result = result.replace(/\{\{name\}\}/g, registration?.attendee_name || "")
  result = result.replace(/\{\{registration_number\}\}/g, registration?.registration_number || "")
  result = result.replace(/\{\{ticket_type\}\}/g, registration?.ticket_type || registration?.ticket_types?.name || "")
  result = result.replace(/\{\{email\}\}/g, registration?.attendee_email || "")
  result = result.replace(/\{\{phone\}\}/g, registration?.attendee_phone || "")
  result = result.replace(/\{\{institution\}\}/g, registration?.attendee_institution || "")
  result = result.replace(/\{\{designation\}\}/g, registration?.attendee_designation || "")
  result = result.replace(/\{\{event_name\}\}/g, station?.events?.name || "")
  result = result.replace(/\{\{event_date\}\}/g, "")
  return result
}

// Get label dimensions in dots (203 DPI)
function getLabelDimensions(paperSize: string): { width: number; height: number } {
  // 203 DPI: 1 inch = 203 dots
  const sizes: Record<string, { width: number; height: number }> = {
    "4x2": { width: 812, height: 406 },   // 4" x 2"
    "4x3": { width: 812, height: 609 },   // 4" x 3"
    "4x6": { width: 812, height: 1218 },  // 4" x 6"
    "a6": { width: 833, height: 1181 },   // A6 (105mm x 148mm)
    "a5": { width: 1181, height: 1654 },  // A5 (148mm x 210mm)
  }
  return sizes[paperSize] || sizes["4x6"]
}

// Get template dimensions in pixels (for scaling)
function getTemplateDimensions(paperSize: string): { width: number; height: number } {
  const sizes: Record<string, { width: number; height: number }> = {
    "4x2": { width: 384, height: 192 },
    "4x3": { width: 384, height: 288 },
    "4x6": { width: 384, height: 576 },
    "a6": { width: 397, height: 559 },
    "a5": { width: 559, height: 794 },
  }
  return sizes[paperSize] || sizes["4x6"]
}
