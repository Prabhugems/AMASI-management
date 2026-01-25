/**
 * URL Utilities
 *
 * Helpers for working with URLs, query params, and routing
 */

/**
 * Build URL with query parameters
 *
 * Usage:
 * ```
 * const url = buildUrl("/events", { status: "active", page: "2" })
 * // "/events?status=active&page=2"
 * ```
 */
export function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>
): string {
  if (!params) return path

  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") {
      searchParams.set(key, String(value))
    }
  }

  const queryString = searchParams.toString()
  return queryString ? `${path}?${queryString}` : path
}

/**
 * Parse query parameters from URL
 */
export function parseQueryParams(url: string): Record<string, string> {
  const searchParams = new URL(url, "http://localhost").searchParams
  const params: Record<string, string> = {}

  searchParams.forEach((value, key) => {
    params[key] = value
  })

  return params
}

/**
 * Update query parameters in current URL
 *
 * Usage:
 * ```
 * const newUrl = updateQueryParams(currentUrl, { page: "2" })
 * ```
 */
export function updateQueryParams(
  url: string,
  updates: Record<string, string | number | boolean | null | undefined>
): string {
  const urlObj = new URL(url, "http://localhost")

  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") {
      urlObj.searchParams.delete(key)
    } else {
      urlObj.searchParams.set(key, String(value))
    }
  }

  return `${urlObj.pathname}${urlObj.search}`
}

/**
 * Remove query parameters from URL
 */
export function removeQueryParams(url: string, keys: string[]): string {
  const urlObj = new URL(url, "http://localhost")

  for (const key of keys) {
    urlObj.searchParams.delete(key)
  }

  return `${urlObj.pathname}${urlObj.search}`
}

/**
 * Get a single query parameter
 */
export function getQueryParam(url: string, key: string): string | null {
  return new URL(url, "http://localhost").searchParams.get(key)
}

/**
 * Check if URL is absolute
 */
export function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/**
 * Check if URL is relative
 */
export function isRelativeUrl(url: string): boolean {
  return !isAbsoluteUrl(url) && !url.startsWith("//")
}

/**
 * Get domain from URL
 */
export function getDomain(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return null
  }
}

/**
 * Normalize URL path (remove trailing slashes, etc.)
 */
export function normalizePath(path: string): string {
  // Remove trailing slashes except for root
  let normalized = path.replace(/\/+$/, "") || "/"

  // Ensure leading slash
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized
  }

  // Remove duplicate slashes
  normalized = normalized.replace(/\/+/g, "/")

  return normalized
}

/**
 * Join path segments
 */
export function joinPaths(...segments: string[]): string {
  const joined = segments
    .map((s) => s.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")

  return "/" + joined
}

/**
 * Create slug from text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove non-word chars
    .replace(/[\s_-]+/g, "-") // Replace spaces, underscores with hyphens
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
}

/**
 * Parse slug to readable text
 */
export function unslugify(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Create shareable URL with UTM parameters
 */
export function createShareUrl(
  url: string,
  params: {
    source?: string
    medium?: string
    campaign?: string
    content?: string
    term?: string
  }
): string {
  const utmParams: Record<string, string> = {}

  if (params.source) utmParams.utm_source = params.source
  if (params.medium) utmParams.utm_medium = params.medium
  if (params.campaign) utmParams.utm_campaign = params.campaign
  if (params.content) utmParams.utm_content = params.content
  if (params.term) utmParams.utm_term = params.term

  return buildUrl(url, utmParams)
}

/**
 * Extract UTM parameters from URL
 */
export function extractUtmParams(url: string): Record<string, string> {
  const params = parseQueryParams(url)
  const utmParams: Record<string, string> = {}

  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith("utm_")) {
      utmParams[key] = value
    }
  }

  return utmParams
}

/**
 * Create mailto link
 */
export function createMailtoUrl(options: {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject?: string
  body?: string
}): string {
  const to = Array.isArray(options.to) ? options.to.join(",") : options.to
  const params: Record<string, string> = {}

  if (options.cc) {
    params.cc = Array.isArray(options.cc) ? options.cc.join(",") : options.cc
  }
  if (options.bcc) {
    params.bcc = Array.isArray(options.bcc) ? options.bcc.join(",") : options.bcc
  }
  if (options.subject) {
    params.subject = options.subject
  }
  if (options.body) {
    params.body = options.body
  }

  const queryString = new URLSearchParams(params).toString()
  return `mailto:${to}${queryString ? `?${queryString}` : ""}`
}

/**
 * Create tel link
 */
export function createTelUrl(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "")
  return `tel:${cleaned}`
}

/**
 * Create WhatsApp link
 */
export function createWhatsAppUrl(phone: string, message?: string): string {
  const cleaned = phone.replace(/[^\d]/g, "")
  const baseUrl = `https://wa.me/${cleaned}`
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl
}

/**
 * Create Google Maps link
 */
export function createMapsUrl(options: {
  query?: string
  lat?: number
  lng?: number
  placeId?: string
}): string {
  const baseUrl = "https://www.google.com/maps/search/"

  if (options.placeId) {
    return `https://www.google.com/maps/place/?q=place_id:${options.placeId}`
  }

  if (options.lat != null && options.lng != null) {
    return `${baseUrl}?api=1&query=${options.lat},${options.lng}`
  }

  if (options.query) {
    return `${baseUrl}?api=1&query=${encodeURIComponent(options.query)}`
  }

  return baseUrl
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Add protocol to URL if missing
 */
export function ensureProtocol(url: string, defaultProtocol: string = "https"): string {
  if (isAbsoluteUrl(url)) return url
  if (url.startsWith("//")) return `${defaultProtocol}:${url}`
  return `${defaultProtocol}://${url}`
}

/**
 * Get file extension from URL
 */
export function getFileExtension(url: string): string | null {
  try {
    const pathname = new URL(url, "http://localhost").pathname
    const lastDot = pathname.lastIndexOf(".")
    if (lastDot === -1) return null
    return pathname.slice(lastDot + 1).toLowerCase()
  } catch {
    return null
  }
}

/**
 * Check if URL points to an image
 */
export function isImageUrl(url: string): boolean {
  const ext = getFileExtension(url)
  if (!ext) return false
  return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext)
}
