/**
 * String Utilities
 *
 * Common string manipulation functions
 */

/**
 * Convert string to slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
}

/**
 * Truncate string with ellipsis
 */
export function truncate(
  text: string,
  length: number,
  suffix = "..."
): string {
  if (text.length <= length) return text
  return text.substring(0, length - suffix.length).trim() + suffix
}

/**
 * Truncate in the middle
 */
export function truncateMiddle(
  text: string,
  maxLength: number,
  separator = "..."
): string {
  if (text.length <= maxLength) return text

  const charsToShow = maxLength - separator.length
  const frontChars = Math.ceil(charsToShow / 2)
  const backChars = Math.floor(charsToShow / 2)

  return text.substring(0, frontChars) + separator + text.substring(text.length - backChars)
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

/**
 * Capitalize each word
 */
export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/**
 * Convert to sentence case
 */
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

/**
 * Pluralize a word based on count
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  if (count === 1) return singular
  return plural || singular + "s"
}

/**
 * Pluralize with count
 */
export function pluralizeWithCount(
  count: number,
  singular: string,
  plural?: string
): string {
  return `${count} ${pluralize(count, singular, plural)}`
}

/**
 * Convert camelCase to Title Case
 */
export function camelToTitle(text: string): string {
  return text
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

/**
 * Convert camelCase to snake_case
 */
export function camelToSnake(text: string): string {
  return text.replace(/([A-Z])/g, "_$1").toLowerCase()
}

/**
 * Convert snake_case to camelCase
 */
export function snakeToCamel(text: string): string {
  return text.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Convert kebab-case to camelCase
 */
export function kebabToCamel(text: string): string {
  return text.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Convert camelCase to kebab-case
 */
export function camelToKebab(text: string): string {
  return text.replace(/([A-Z])/g, "-$1").toLowerCase()
}

/**
 * Strip HTML tags
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "")
}

/**
 * Escape HTML entities
 */
export function escapeHtml(text: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }
  return text.replace(/[&<>"']/g, (char) => entities[char])
}

/**
 * Unescape HTML entities
 */
export function unescapeHtml(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
  }
  return text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => entities[entity] || entity)
}

/**
 * Generate initials from name
 */
export function getInitials(name: string, maxLength = 2): string {
  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .substring(0, maxLength)
}

/**
 * Mask sensitive data
 */
export function mask(
  text: string,
  visibleStart = 4,
  visibleEnd = 4,
  maskChar = "*"
): string {
  if (text.length <= visibleStart + visibleEnd) {
    return maskChar.repeat(text.length)
  }

  const start = text.substring(0, visibleStart)
  const end = text.substring(text.length - visibleEnd)
  const middle = maskChar.repeat(text.length - visibleStart - visibleEnd)

  return start + middle + end
}

/**
 * Mask email address
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!domain) return email

  const maskedLocal = local.length > 2
    ? local.charAt(0) + "*".repeat(local.length - 2) + local.charAt(local.length - 1)
    : "*".repeat(local.length)

  return `${maskedLocal}@${domain}`
}

/**
 * Mask phone number
 */
export function maskPhone(phone: string, visibleDigits = 4): string {
  const cleaned = phone.replace(/\D/g, "")
  if (cleaned.length <= visibleDigits) return phone

  const visible = cleaned.slice(-visibleDigits)
  const masked = "*".repeat(cleaned.length - visibleDigits)

  return masked + visible
}

/**
 * Extract numbers from string
 */
export function extractNumbers(text: string): string {
  return text.replace(/\D/g, "")
}

/**
 * Remove extra whitespace
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

/**
 * Wrap text at specified width
 */
export function wordWrap(text: string, width: number): string {
  const words = text.split(" ")
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    if ((currentLine + word).length > width) {
      if (currentLine) lines.push(currentLine.trim())
      currentLine = word + " "
    } else {
      currentLine += word + " "
    }
  }

  if (currentLine) lines.push(currentLine.trim())
  return lines.join("\n")
}

/**
 * Generate random string
 */
export function randomString(length: number, charset?: string): string {
  const chars = charset || "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Generate random ID
 */
export function randomId(prefix = ""): string {
  return prefix + Date.now().toString(36) + randomString(4).toLowerCase()
}

/**
 * Check if string contains only letters
 */
export function isAlpha(text: string): boolean {
  return /^[a-zA-Z]+$/.test(text)
}

/**
 * Check if string contains only letters and numbers
 */
export function isAlphanumeric(text: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(text)
}

/**
 * Highlight search term in text
 */
export function highlightMatch(
  text: string,
  query: string,
  tag = "mark"
): string {
  if (!query.trim()) return text

  const regex = new RegExp(`(${escapeRegex(query)})`, "gi")
  return text.replace(regex, `<${tag}>$1</${tag}>`)
}

/**
 * Escape regex special characters
 */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Convert bytes to human readable size
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i]
}

/**
 * Parse bytes from human readable size
 */
export function parseBytes(sizeStr: string): number {
  const units: Record<string, number> = {
    b: 1,
    bytes: 1,
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
    tb: 1024 ** 4,
  }

  const match = sizeStr.match(/^([\d.]+)\s*([a-zA-Z]+)$/)
  if (!match) return 0

  const [, value, unit] = match
  const multiplier = units[unit.toLowerCase()] || 1

  return parseFloat(value) * multiplier
}

/**
 * Ordinal suffix for number
 */
export function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0])
}
