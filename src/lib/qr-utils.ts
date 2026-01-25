/**
 * QR Code Utilities
 *
 * Generate and download QR codes for registrations, tickets, etc.
 */

/**
 * Generate QR code as Data URL
 *
 * Uses the qrcode library (dynamically imported)
 *
 * Usage:
 * ```
 * const dataUrl = await generateQRCode("https://example.com/checkin/123")
 * ```
 */
export async function generateQRCode(
  data: string,
  options: {
    width?: number
    margin?: number
    color?: { dark?: string; light?: string }
    errorCorrectionLevel?: "L" | "M" | "Q" | "H"
  } = {}
): Promise<string> {
  const QRCode = await import("qrcode")

  const {
    width = 256,
    margin = 2,
    color = { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel = "M",
  } = options

  return QRCode.toDataURL(data, {
    width,
    margin,
    color,
    errorCorrectionLevel,
  })
}

/**
 * Generate QR code as SVG string
 */
export async function generateQRCodeSVG(
  data: string,
  options: {
    width?: number
    margin?: number
    color?: { dark?: string; light?: string }
  } = {}
): Promise<string> {
  const QRCode = await import("qrcode")

  const {
    width = 256,
    margin = 2,
    color = { dark: "#000000", light: "#ffffff" },
  } = options

  return QRCode.toString(data, {
    type: "svg",
    width,
    margin,
    color,
  })
}

/**
 * Download QR code as PNG
 */
export async function downloadQRCode(
  data: string,
  filename: string,
  options: {
    width?: number
    margin?: number
  } = {}
): Promise<void> {
  const dataUrl = await generateQRCode(data, options)

  const link = document.createElement("a")
  link.href = dataUrl
  link.download = `${filename}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Download QR code as SVG
 */
export async function downloadQRCodeSVG(
  data: string,
  filename: string,
  options: {
    width?: number
    margin?: number
  } = {}
): Promise<void> {
  const svgString = await generateQRCodeSVG(data, options)

  const blob = new Blob([svgString], { type: "image/svg+xml" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = `${filename}.svg`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Generate check-in QR code URL
 *
 * Creates a URL that, when scanned, will check in the attendee
 */
export function getCheckinQRData(
  baseUrl: string,
  registrationId: string,
  listId?: string
): string {
  const url = new URL(`${baseUrl}/checkin`)
  url.searchParams.set("reg", registrationId)
  if (listId) {
    url.searchParams.set("list", listId)
  }
  return url.toString()
}

/**
 * Generate registration QR code data
 *
 * Creates a compact data string with registration info
 */
export function getRegistrationQRData(registration: {
  id: string
  registrationNumber: string
}): string {
  return JSON.stringify({
    type: "registration",
    id: registration.id,
    num: registration.registrationNumber,
  })
}

/**
 * Parse registration QR code data
 */
export function parseRegistrationQRData(data: string): {
  type: string
  id: string
  num: string
} | null {
  try {
    const parsed = JSON.parse(data)
    if (parsed.type === "registration" && parsed.id && parsed.num) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

/**
 * Generate batch QR codes
 *
 * Useful for printing multiple QR codes at once
 */
export async function generateBatchQRCodes(
  items: Array<{ data: string; label?: string }>,
  options: {
    width?: number
    margin?: number
  } = {}
): Promise<Array<{ data: string; label?: string; qrCode: string }>> {
  const results = await Promise.all(
    items.map(async (item) => ({
      ...item,
      qrCode: await generateQRCode(item.data, options),
    }))
  )

  return results
}

/**
 * Generate vCard QR code data
 *
 * For contact information sharing
 */
export function generateVCardData(contact: {
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  organization?: string
  title?: string
  url?: string
}): string {
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${contact.lastName || ""};${contact.firstName};;;`,
    `FN:${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ""}`,
  ]

  if (contact.email) {
    lines.push(`EMAIL:${contact.email}`)
  }
  if (contact.phone) {
    lines.push(`TEL:${contact.phone}`)
  }
  if (contact.organization) {
    lines.push(`ORG:${contact.organization}`)
  }
  if (contact.title) {
    lines.push(`TITLE:${contact.title}`)
  }
  if (contact.url) {
    lines.push(`URL:${contact.url}`)
  }

  lines.push("END:VCARD")

  return lines.join("\n")
}

/**
 * Generate WiFi QR code data
 *
 * For sharing WiFi credentials
 */
export function generateWiFiData(config: {
  ssid: string
  password?: string
  security?: "WPA" | "WEP" | "nopass"
  hidden?: boolean
}): string {
  const security = config.security || (config.password ? "WPA" : "nopass")
  const hidden = config.hidden ? "H:true" : ""
  const password = config.password ? `P:${config.password}` : ""

  return `WIFI:T:${security};S:${config.ssid};${password};${hidden};`
}

/**
 * Generate email QR code data
 */
export function generateEmailData(config: {
  to: string
  subject?: string
  body?: string
}): string {
  const params = new URLSearchParams()
  if (config.subject) params.set("subject", config.subject)
  if (config.body) params.set("body", config.body)

  const queryString = params.toString()
  return `mailto:${config.to}${queryString ? `?${queryString}` : ""}`
}

/**
 * Generate SMS QR code data
 */
export function generateSMSData(phone: string, message?: string): string {
  return `sms:${phone}${message ? `?body=${encodeURIComponent(message)}` : ""}`
}

/**
 * Generate phone call QR code data
 */
export function generatePhoneData(phone: string): string {
  return `tel:${phone}`
}

/**
 * Generate geo location QR code data
 */
export function generateGeoData(lat: number, lng: number, label?: string): string {
  return `geo:${lat},${lng}${label ? `?q=${encodeURIComponent(label)}` : ""}`
}
