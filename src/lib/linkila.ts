/**
 * Linkila URL Shortener Integration
 * https://linkila.com/
 */

type ShortenResult = {
  success: boolean
  shortUrl?: string
  error?: string
}

type LinkInfo = {
  id: string
  shortUrl: string
  targetUrl: string
  title?: string
  clicks?: number
}

const API_BASE = "https://app.linkila.com/integrations/api/v1"

/**
 * Create a short URL using Linkila
 */
export async function shortenUrl(
  targetUrl: string,
  options?: {
    title?: string
    slug?: string
    domainName?: string
  }
): Promise<ShortenResult> {
  const apiKey = process.env.LINKILA_API_KEY

  if (!apiKey) {
    console.log("[Linkila] No API key configured, returning original URL")
    return { success: true, shortUrl: targetUrl }
  }

  try {
    const response = await fetch(`${API_BASE}/quickGenerate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        targetURL: targetUrl,
        title: options?.title,
        slug: options?.slug,
        domainName: options?.domainName,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Linkila] API error:", response.status, errorText)
      return { success: false, error: `API error: ${response.status}`, shortUrl: targetUrl }
    }

    const result = await response.json()

    if (result.shortUrl || result.short_url || result.link) {
      const shortUrl = result.shortUrl || result.short_url || result.link
      console.log(`[Linkila] Shortened: ${targetUrl} -> ${shortUrl}`)
      return { success: true, shortUrl }
    }

    // If response doesn't have expected format, return original URL
    console.log("[Linkila] Unexpected response format:", result)
    return { success: true, shortUrl: targetUrl }
  } catch (error: any) {
    console.error("[Linkila] Request failed:", error)
    return { success: false, error: error.message, shortUrl: targetUrl }
  }
}

/**
 * Get all links from Linkila account
 */
export async function getLinks(page = 1, limit = 50): Promise<LinkInfo[]> {
  const apiKey = process.env.LINKILA_API_KEY

  if (!apiKey) {
    return []
  }

  try {
    const response = await fetch(`${API_BASE}/links?page=${page}&limit=${limit}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      console.error("[Linkila] Failed to get links:", response.status)
      return []
    }

    const result = await response.json()
    return result.links || result.data || []
  } catch (error) {
    console.error("[Linkila] Error getting links:", error)
    return []
  }
}

/**
 * Check if Linkila is enabled
 */
export function isLinkilaEnabled(): boolean {
  return !!process.env.LINKILA_API_KEY
}

/**
 * Shorten a speaker portal URL
 * Creates a memorable short link for speaker invitations
 */
export async function shortenSpeakerPortalUrl(
  portalUrl: string,
  speakerName: string,
  eventName: string
): Promise<string> {
  const result = await shortenUrl(portalUrl, {
    title: `${speakerName} - ${eventName}`,
  })
  return result.shortUrl || portalUrl
}
