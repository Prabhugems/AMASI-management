/**
 * Formatting Utilities
 *
 * Consistent formatting for dates, numbers, currency, etc.
 */

// ==================== Date Formatting ====================

/**
 * Format date in Indian locale (DD MMM YYYY)
 */
export function formatDate(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return ""

  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  })
}

/**
 * Format date and time
 */
export function formatDateTime(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return ""

  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  })
}

/**
 * Format time only (12-hour format)
 */
export function formatTime(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return ""

  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  })
}

/**
 * Format as relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return ""

  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHour = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHour / 24)
  const diffWeek = Math.round(diffDay / 7)
  const diffMonth = Math.round(diffDay / 30)
  const diffYear = Math.round(diffDay / 365)

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, "second")
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute")
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour")
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, "day")
  if (Math.abs(diffWeek) < 4) return rtf.format(diffWeek, "week")
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, "month")
  return rtf.format(diffYear, "year")
}

/**
 * Format date range
 */
export function formatDateRange(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined
): string {
  if (!startDate) return ""
  const start = typeof startDate === "string" ? new Date(startDate) : startDate
  if (!endDate) return formatDate(start)
  const end = typeof endDate === "string" ? new Date(endDate) : endDate

  // Same day
  if (start.toDateString() === end.toDateString()) {
    return formatDate(start)
  }

  // Same month and year
  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    return `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`
  }

  // Same year
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
  }

  // Different years
  return `${formatDate(start)} - ${formatDate(end)}`
}

// ==================== Number Formatting ====================

/**
 * Format number with Indian number system (lakhs, crores)
 */
export function formatNumber(
  value: number | null | undefined,
  options: Intl.NumberFormatOptions = {}
): string {
  if (value == null) return ""
  return value.toLocaleString("en-IN", options)
}

/**
 * Format currency (INR by default)
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = "INR",
  options: Intl.NumberFormatOptions = {}
): string {
  if (value == null) return ""
  return value.toLocaleString("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  })
}

/**
 * Format as compact number (1K, 1L, 1Cr)
 */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null) return ""

  if (value >= 10000000) {
    return `${(value / 10000000).toFixed(1).replace(/\.0$/, "")} Cr`
  }
  if (value >= 100000) {
    return `${(value / 100000).toFixed(1).replace(/\.0$/, "")} L`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, "")} K`
  }
  return value.toString()
}

/**
 * Format percentage
 */
export function formatPercentage(
  value: number | null | undefined,
  decimals: number = 0
): string {
  if (value == null) return ""
  return `${value.toFixed(decimals)}%`
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return ""
  if (bytes === 0) return "0 B"

  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = bytes / Math.pow(1024, i)

  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

/**
 * Format duration in minutes to human readable
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return ""
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (mins === 0) return `${hours} hr`
  return `${hours} hr ${mins} min`
}

// ==================== String Formatting ====================

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string | null | undefined, maxLength: number = 50): string {
  if (!text) return ""
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3)}...`
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string | null | undefined): string {
  if (!text) return ""
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

/**
 * Title case
 */
export function titleCase(text: string | null | undefined): string {
  if (!text) return ""
  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/**
 * Format phone number (Indian format)
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return ""
  const cleaned = phone.replace(/\D/g, "")

  // Indian mobile (10 digits)
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`
  }

  // With country code (12 digits for +91)
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`
  }

  return phone
}

/**
 * Mask email for privacy
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return ""
  const [local, domain] = email.split("@")
  if (!domain) return email

  const maskedLocal =
    local.length <= 2
      ? local
      : `${local.charAt(0)}${"*".repeat(Math.min(local.length - 2, 5))}${local.charAt(local.length - 1)}`

  return `${maskedLocal}@${domain}`
}

/**
 * Mask phone for privacy
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return ""
  const cleaned = phone.replace(/\D/g, "")
  if (cleaned.length < 4) return phone

  return `${"*".repeat(cleaned.length - 4)}${cleaned.slice(-4)}`
}

/**
 * Format name (First Last -> F. Last)
 */
export function formatShortName(name: string | null | undefined): string {
  if (!name) return ""
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]

  const firstName = parts[0]
  const lastName = parts[parts.length - 1]
  return `${firstName.charAt(0)}. ${lastName}`
}

/**
 * Get initials from name
 */
export function getInitials(name: string | null | undefined, maxLength: number = 2): string {
  if (!name) return ""
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, maxLength)
    .join("")
}
