/**
 * Number Utilities
 *
 * Common number manipulation functions
 */

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Round to specified decimal places
 */
export function round(value: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

/**
 * Floor to specified decimal places
 */
export function floor(value: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals)
  return Math.floor(value * factor) / factor
}

/**
 * Ceil to specified decimal places
 */
export function ceil(value: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals)
  return Math.ceil(value * factor) / factor
}

/**
 * Calculate percentage
 */
export function percentage(value: number, total: number): number {
  if (total === 0) return 0
  return (value / total) * 100
}

/**
 * Calculate percentage with formatting
 */
export function formatPercentage(
  value: number,
  total: number,
  decimals: number = 1
): string {
  return round(percentage(value, total), decimals) + "%"
}

/**
 * Apply percentage to value
 */
export function applyPercentage(value: number, percent: number): number {
  return value * (percent / 100)
}

/**
 * Calculate discount
 */
export function calculateDiscount(
  originalPrice: number,
  discountPercent: number
): { discounted: number; savings: number } {
  const savings = applyPercentage(originalPrice, discountPercent)
  return {
    discounted: originalPrice - savings,
    savings,
  }
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1)
}

/**
 * Inverse linear interpolation
 */
export function inverseLerp(start: number, end: number, value: number): number {
  if (start === end) return 0
  return clamp((value - start) / (end - start), 0, 1)
}

/**
 * Map value from one range to another
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return lerp(outMin, outMax, inverseLerp(inMin, inMax, value))
}

/**
 * Check if number is in range
 */
export function inRange(
  value: number,
  min: number,
  max: number,
  inclusive: boolean = true
): boolean {
  if (inclusive) {
    return value >= min && value <= max
  }
  return value > min && value < max
}

/**
 * Format number with commas
 */
export function formatNumber(
  value: number,
  locale: string = "en-IN"
): string {
  return value.toLocaleString(locale)
}

/**
 * Format currency
 */
export function formatCurrency(
  value: number,
  currency: string = "INR",
  locale: string = "en-IN"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]/g, "")) || 0
}

/**
 * Format compact number (1K, 1M, etc.)
 */
export function formatCompact(
  value: number,
  locale: string = "en"
): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    compactDisplay: "short",
  }).format(value)
}

/**
 * Format ordinal (1st, 2nd, 3rd, etc.)
 */
export function formatOrdinal(value: number): string {
  const suffixes = ["th", "st", "nd", "rd"]
  const v = value % 100
  return value + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0])
}

/**
 * Pad number with zeros
 */
export function padNumber(
  value: number,
  length: number,
  char: string = "0"
): string {
  return String(value).padStart(length, char)
}

/**
 * Random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Random float between min and max
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

/**
 * Check if value is a valid number
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value) && isFinite(value)
}

/**
 * Safe parse int with default
 */
export function safeParseInt(
  value: string | number | null | undefined,
  defaultValue: number = 0
): number {
  if (value === null || value === undefined) return defaultValue
  const parsed = parseInt(String(value), 10)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Safe parse float with default
 */
export function safeParseFloat(
  value: string | number | null | undefined,
  defaultValue: number = 0
): number {
  if (value === null || value === undefined) return defaultValue
  const parsed = parseFloat(String(value))
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Calculate average
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0
  return numbers.reduce((a, b) => a + b, 0) / numbers.length
}

/**
 * Calculate median
 */
export function median(numbers: number[]): number {
  if (numbers.length === 0) return 0

  const sorted = [...numbers].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(numbers: number[]): number {
  if (numbers.length === 0) return 0

  const avg = average(numbers)
  const squareDiffs = numbers.map((value) => Math.pow(value - avg, 2))
  return Math.sqrt(average(squareDiffs))
}

/**
 * Calculate sum
 */
export function sum(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0)
}

/**
 * Calculate product
 */
export function product(numbers: number[]): number {
  return numbers.reduce((a, b) => a * b, 1)
}

/**
 * Get min value
 */
export function min(...values: number[]): number {
  return Math.min(...values)
}

/**
 * Get max value
 */
export function max(...values: number[]): number {
  return Math.max(...values)
}

/**
 * Calculate growth percentage
 */
export function growthPercentage(
  previous: number,
  current: number
): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / Math.abs(previous)) * 100
}

/**
 * Format growth percentage with sign
 */
export function formatGrowth(
  previous: number,
  current: number,
  decimals: number = 1
): string {
  const growth = growthPercentage(previous, current)
  const sign = growth > 0 ? "+" : ""
  return `${sign}${round(growth, decimals)}%`
}

/**
 * Convert bytes to human readable
 */
export function bytesToSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return round(bytes / Math.pow(1024, i), 2) + " " + sizes[i]
}

/**
 * Duration in milliseconds to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${round(ms / 1000, 1)}s`
  if (ms < 3600000) return `${round(ms / 60000, 1)}m`
  return `${round(ms / 3600000, 1)}h`
}

/**
 * Fibonacci sequence
 */
export function fibonacci(n: number): number {
  if (n <= 1) return n
  let a = 0, b = 1
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b]
  }
  return b
}

/**
 * Greatest common divisor
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    [a, b] = [b, a % b]
  }
  return a
}

/**
 * Least common multiple
 */
export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b)
}

/**
 * Check if number is prime
 */
export function isPrime(n: number): boolean {
  if (n < 2) return false
  if (n === 2) return true
  if (n % 2 === 0) return false
  for (let i = 3; i <= Math.sqrt(n); i += 2) {
    if (n % i === 0) return false
  }
  return true
}

/**
 * Factorial
 */
export function factorial(n: number): number {
  if (n < 0) return NaN
  if (n === 0 || n === 1) return 1
  let result = 1
  for (let i = 2; i <= n; i++) {
    result *= i
  }
  return result
}
