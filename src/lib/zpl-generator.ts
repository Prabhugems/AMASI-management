// Client-side ZPL generator for Zebra label printers
// Extracted from /api/print-stations/zpl-print/route.ts for use in browser (iPad PWA)

export interface ZPLRegistration {
  attendee_name?: string
  attendee_email?: string
  attendee_phone?: string | null
  attendee_institution?: string | null
  attendee_designation?: string | null
  registration_number?: string
  ticket_type?: string
  ticket_types?: { name: string } | null
}

export interface ZPLStation {
  id?: string
  name?: string
  print_settings?: {
    paper_size?: string
    rotation?: number
    [key: string]: any
  }
  events?: { id?: string; name?: string; short_name?: string } | null
}

export interface ZPLBadgeTemplate {
  id?: string
  name?: string
  template_data?: {
    elements?: any[]
    backgroundColor?: string
    [key: string]: any
  }
}

// Generate ZPL based on available data (template or default)
export function generateZPL(
  registration: ZPLRegistration,
  station: ZPLStation,
  badgeTemplate?: ZPLBadgeTemplate | null,
  printMode?: "label" | "overlay" | "full_badge"
): string {
  if (badgeTemplate?.template_data) {
    return generateZPLFromTemplate(badgeTemplate.template_data, registration, station, printMode)
  }
  return generateDefaultZPL(registration, station)
}

// Simple test label
export function generateTestZPL(): string {
  return [
    "^XA",
    "^CI28",
    "^MNM",
    "^POI",
    "^FO50,50^A0N,40,40^FDZebra Test Print^FS",
    "^FO50,100^A0N,30,30^FDConnection Successful!^FS",
    `^FO50,150^A0N,25,25^FD${new Date().toLocaleString()}^FS`,
    "^XZ",
  ].join("\n")
}

// Default badge ZPL (when no template)
function generateDefaultZPL(registration: ZPLRegistration, station: ZPLStation): string {
  const settings = station?.print_settings || {}
  const paperSize = settings.paper_size || "4x6"
  const rotation = settings.rotation || 0

  const dimensions = getLabelDimensions(paperSize)
  const centerX = Math.floor(dimensions.width / 2)
  const startY = 80

  const name = registration?.attendee_name || "Test Name"
  const designation = registration?.attendee_designation || ""
  const institution = registration?.attendee_institution || ""
  const ticketType = registration?.ticket_type || registration?.ticket_types?.name || "Attendee"
  const regNumber = registration?.registration_number || "REG000"
  const eventName = station?.events?.name || "Event"

  // Default to 180° for thermal printers
  const rotationCmd = rotation === 0 ? "^PON" : "^POI"

  const lines = [
    "^XA",
    "^CI28",
    "^MNM",
    rotationCmd,
    "^LH0,0",
    `^LL${dimensions.height}`,
    `^PW${dimensions.width}`,
    "",
    `^FO${centerX - 200},${startY}^A0N,35,35^FB400,1,0,C^FD${eventName}^FS`,
    "",
    `^FO${centerX - 250},${startY + 80}^A0N,60,60^FB500,2,0,C^FD${name}^FS`,
  ]

  if (designation) {
    lines.push("", `^FO${centerX - 200},${startY + 200}^A0N,35,35^FB400,1,0,C^FD${designation}^FS`)
  }

  if (institution) {
    lines.push("", `^FO${centerX - 200},${startY + 250}^A0N,30,30^FB400,1,0,C^FD${institution}^FS`)
  }

  lines.push(
    "",
    `^FO${centerX - 100},${startY + 320}^GB200,50,3^FS`,
    `^FO${centerX - 90},${startY + 332}^A0N,30,30^FB180,1,0,C^FD${ticketType}^FS`,
    "",
    `^FO${centerX - 80},${startY + 400}^A0N,25,25^FB160,1,0,C^FD${regNumber}^FS`,
    "",
    `^FO${centerX - 60},${startY + 450}^BQN,2,4^FDQA,${regNumber}^FS`,
    "",
    "^XZ"
  )

  return lines.join("\n")
}

// Generate ZPL from badge template
function generateZPLFromTemplate(
  templateData: any,
  registration: ZPLRegistration,
  station: ZPLStation,
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
  const templateDims = getTemplateDimensions(paperSize)
  const scaleX = dimensions.width / templateDims.width
  const scaleY = dimensions.height / templateDims.height

  // For overlay mode: only print variable data (text, QR, barcode)
  if (isOverlayMode) {
    elements = elements.filter((el: any) =>
      el.type === "text" || el.type === "qr_code" || el.type === "barcode"
    )
  }

  let zplElements = ""

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

      const align = element.align === "center" ? "C" : element.align === "right" ? "R" : "L"

      zplElements += `^FO${x},${y}^A0N,${fontHeight},${fontWidth}^FB${width},1,0,${align}^FD${content}^FS\n`
    } else if (element.type === "shape" && element.shapeType === "rectangle") {
      const borderWidth = Math.max(1, Math.floor((element.borderWidth || 1) * scaleX))
      zplElements += `^FO${x},${y}^GB${width},${height},${borderWidth}^FS\n`
    } else if (element.type === "line") {
      const lineThickness = Math.max(1, Math.floor(height))
      zplElements += `^FO${x},${y}^GB${width},${lineThickness},${lineThickness}^FS\n`
    } else if (element.type === "qr_code") {
      const qrContent = replacePlaceholders(element.content || "", registration, station)
      // QR magnification: use max (10) for best quality, ~25 modules typical
      const magnification = 10
      const actualQrSize = 25 * magnification // Approximate QR size in dots
      // Center QR within its designed area
      const qrX = x + Math.floor((width - actualQrSize) / 2)
      const qrY = y + Math.floor((height - actualQrSize) / 2)
      zplElements += `^FO${Math.max(0, qrX)},${Math.max(0, qrY)}^BQN,2,${magnification}^FDQA,${qrContent}^FS\n`
    } else if (element.type === "barcode") {
      const barcodeContent = replacePlaceholders(element.content || "", registration, station)
      zplElements += `^FO${x},${y}^BCN,${height},Y,N,N^FD${barcodeContent}^FS\n`
    }
  }

  return [
    "^XA",
    "~SD30",           // Set Darkness (max = 30)
    "^CI28",           // UTF-8 encoding
    "^MNM",            // Mark sensing (black mark media)
    "^MMT",            // Media mode: Tear-off
    "^LT0",            // Label top offset (adjust if needed)
    "^LS0",            // Label shift left/right (adjust if needed)
    rotationCmd,
    "^LH0,0",          // Label home position
    `^LL${dimensions.height}`,  // Label length
    `^PW${dimensions.width}`,   // Print width
    zplElements,
    "^PQ1,0,1,Y",      // Print quantity: 1 label, pause, cut
    "^XZ",
  ].join("\n")
}

// Replace placeholders with registration data
function replacePlaceholders(text: string, registration: ZPLRegistration, station: ZPLStation): string {
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

// Label dimensions in dots (203 DPI: 1 inch = 203 dots)
function getLabelDimensions(paperSize: string): { width: number; height: number } {
  const sizes: Record<string, { width: number; height: number }> = {
    "4x2": { width: 812, height: 406 },
    "4x3": { width: 812, height: 609 },
    "4x6": { width: 812, height: 1218 },
    "a6": { width: 833, height: 1181 },
    "a5": { width: 1181, height: 1654 },
  }
  return sizes[paperSize] || sizes["4x6"]
}

// Template dimensions in pixels (for scaling)
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
