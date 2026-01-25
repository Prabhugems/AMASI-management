/**
 * Date Utilities
 *
 * Date math, business days, ranges, and comparisons
 */

// ==================== Date Math ====================

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Add months to a date
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

/**
 * Add years to a date
 */
export function addYears(date: Date, years: number): Date {
  const result = new Date(date)
  result.setFullYear(result.getFullYear() + years)
  return result
}

/**
 * Add hours to a date
 */
export function addHours(date: Date, hours: number): Date {
  const result = new Date(date)
  result.setHours(result.getHours() + hours)
  return result
}

/**
 * Add minutes to a date
 */
export function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date)
  result.setMinutes(result.getMinutes() + minutes)
  return result
}

/**
 * Subtract days from a date
 */
export function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days)
}

// ==================== Date Comparisons ====================

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * Check if two dates are the same month
 */
export function isSameMonth(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth()
  )
}

/**
 * Check if two dates are the same year
 */
export function isSameYear(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear()
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

/**
 * Check if date is yesterday
 */
export function isYesterday(date: Date): boolean {
  return isSameDay(date, subtractDays(new Date(), 1))
}

/**
 * Check if date is tomorrow
 */
export function isTomorrow(date: Date): boolean {
  return isSameDay(date, addDays(new Date(), 1))
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < new Date().getTime()
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > new Date().getTime()
}

/**
 * Check if date is within a range
 */
export function isWithinRange(date: Date, start: Date, end: Date): boolean {
  const time = date.getTime()
  return time >= start.getTime() && time <= end.getTime()
}

/**
 * Check if date is a weekend
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

/**
 * Check if date is a weekday
 */
export function isWeekday(date: Date): boolean {
  return !isWeekend(date)
}

// ==================== Date Calculations ====================

/**
 * Get difference in days between two dates
 */
export function diffInDays(date1: Date, date2: Date): number {
  const diff = date1.getTime() - date2.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * Get difference in hours between two dates
 */
export function diffInHours(date1: Date, date2: Date): number {
  const diff = date1.getTime() - date2.getTime()
  return Math.floor(diff / (1000 * 60 * 60))
}

/**
 * Get difference in minutes between two dates
 */
export function diffInMinutes(date1: Date, date2: Date): number {
  const diff = date1.getTime() - date2.getTime()
  return Math.floor(diff / (1000 * 60))
}

/**
 * Get number of business days between two dates
 */
export function diffInBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0
  const current = new Date(startDate)

  while (current <= endDate) {
    if (isWeekday(current)) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  return count
}

/**
 * Add business days to a date
 */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date)
  let remaining = days

  while (remaining > 0) {
    result.setDate(result.getDate() + 1)
    if (isWeekday(result)) {
      remaining--
    }
  }

  return result
}

// ==================== Date Boundaries ====================

/**
 * Get start of day
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Get end of day
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * Get start of week (Sunday)
 */
export function startOfWeek(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  result.setDate(result.getDate() - day)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Get end of week (Saturday)
 */
export function endOfWeek(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  result.setDate(result.getDate() + (6 - day))
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * Get start of month
 */
export function startOfMonth(date: Date): Date {
  const result = new Date(date)
  result.setDate(1)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Get end of month
 */
export function endOfMonth(date: Date): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + 1)
  result.setDate(0)
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * Get start of year
 */
export function startOfYear(date: Date): Date {
  const result = new Date(date)
  result.setMonth(0, 1)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Get end of year
 */
export function endOfYear(date: Date): Date {
  const result = new Date(date)
  result.setMonth(11, 31)
  result.setHours(23, 59, 59, 999)
  return result
}

// ==================== Date Ranges ====================

/**
 * Get array of dates in a range
 */
export function getDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = []
  const current = new Date(start)

  while (current <= end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

/**
 * Get days of week for a date
 */
export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date)
  return getDateRange(start, addDays(start, 6))
}

/**
 * Get days of month for a date
 */
export function getMonthDays(date: Date): Date[] {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  return getDateRange(start, end)
}

// ==================== Preset Ranges ====================

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7days"
  | "last30days"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear"

/**
 * Get preset date range
 */
export function getPresetRange(preset: DateRangePreset): { start: Date; end: Date } {
  const now = new Date()

  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) }

    case "yesterday": {
      const yesterday = subtractDays(now, 1)
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) }
    }

    case "last7days":
      return { start: startOfDay(subtractDays(now, 6)), end: endOfDay(now) }

    case "last30days":
      return { start: startOfDay(subtractDays(now, 29)), end: endOfDay(now) }

    case "thisWeek":
      return { start: startOfWeek(now), end: endOfWeek(now) }

    case "lastWeek": {
      const lastWeek = subtractDays(now, 7)
      return { start: startOfWeek(lastWeek), end: endOfWeek(lastWeek) }
    }

    case "thisMonth":
      return { start: startOfMonth(now), end: endOfMonth(now) }

    case "lastMonth": {
      const lastMonth = addMonths(now, -1)
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }
    }

    case "thisYear":
      return { start: startOfYear(now), end: endOfYear(now) }

    case "lastYear": {
      const lastYear = addYears(now, -1)
      return { start: startOfYear(lastYear), end: endOfYear(lastYear) }
    }

    default:
      return { start: startOfDay(now), end: endOfDay(now) }
  }
}

// ==================== Formatting Helpers ====================

/**
 * Get day name
 */
export function getDayName(date: Date, format: "short" | "long" = "long"): string {
  return date.toLocaleDateString("en-IN", { weekday: format })
}

/**
 * Get month name
 */
export function getMonthName(date: Date, format: "short" | "long" = "long"): string {
  return date.toLocaleDateString("en-IN", { month: format })
}

/**
 * Get ordinal suffix (1st, 2nd, 3rd, etc.)
 */
export function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * Format as "Monday, 15th January 2024"
 */
export function formatLongDate(date: Date): string {
  const day = getDayName(date)
  const dayNum = getOrdinal(date.getDate())
  const month = getMonthName(date)
  const year = date.getFullYear()
  return `${day}, ${dayNum} ${month} ${year}`
}

// ==================== Parsing ====================

/**
 * Parse date string safely
 */
export function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value

  const parsed = new Date(value)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Parse ISO date string (YYYY-MM-DD)
 */
export function parseISODate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const [, year, month, day] = match
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  return isNaN(date.getTime()) ? null : date
}

/**
 * Format to ISO date string (YYYY-MM-DD)
 */
export function toISODateString(date: Date): string {
  return date.toISOString().split("T")[0]
}
