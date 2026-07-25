import type { jsPDF } from "jspdf"
import type { PDFDocument, PDFPage } from "pdf-lib"

// Allowed URL domains for uploaded letterhead background images (prevent
// SSRF) — same list as src/app/api/abstracts/certificates/route.ts and
// src/app/api/events/[eventId]/faculty-letter-pdf/route.ts.
const ALLOWED_IMAGE_DOMAINS = [
  "supabase.co",
  "supabase.com",
  "collegeofmas.org.in",
  "vercel-storage.com",
  "amazonaws.com",
]

function isAllowedImageUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    if (url.protocol !== "https:") return false
    const hostname = url.hostname.toLowerCase()
    return ALLOWED_IMAGE_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  } catch {
    return false
  }
}

/**
 * Reads the per-event letterhead background image URL from event.settings,
 * if one has been uploaded and configured. Any event can set this — it is
 * not tied to a specific event ID.
 */
export function getLetterheadBackgroundUrl(
  settings: { letterhead_background_url?: string | null } | null | undefined
): string | undefined {
  const url = settings?.letterhead_background_url
  return url && isAllowedImageUrl(url) ? url : undefined
}

async function fetchImageBytes(url: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get("content-type") || "image/png"
    return { bytes: buffer, contentType }
  } catch {
    return null
  }
}

/**
 * Draw a full-page background image into the current page of a jsPDF
 * document (top-down Y, mm). Call again after every doc.addPage() to cover
 * subsequent pages too. Returns true if drawn, false on any fetch/embed
 * failure — callers must fall back to their generic header/footer in that
 * case, and must not have drawn anything else on the page yet (the
 * background must be the first thing drawn so body content layers on top).
 */
export async function drawLetterheadBackgroundJsPdf(
  doc: jsPDF,
  backgroundUrl: string,
  pageWidthMm: number,
  pageHeightMm: number
): Promise<boolean> {
  const image = await fetchImageBytes(backgroundUrl)
  if (!image) return false
  const base64 = image.bytes.toString("base64")
  const format = image.contentType.includes("png") ? "PNG" : "JPEG"
  doc.addImage(`data:${image.contentType};base64,${base64}`, format, 0, 0, pageWidthMm, pageHeightMm, undefined, "SLOW")
  return true
}

/**
 * Draw a full-page background image into a pdf-lib page (bottom-up Y,
 * points). Call again for every subsequent page added to cover it too.
 * Returns true if drawn, false on any fetch/embed failure.
 */
export async function drawLetterheadBackgroundPdfLib(
  pdfDoc: PDFDocument,
  page: PDFPage,
  backgroundUrl: string
): Promise<boolean> {
  const fetched = await fetchImageBytes(backgroundUrl)
  if (!fetched) return false
  const { width, height } = page.getSize()
  try {
    const image = fetched.contentType.includes("png")
      ? await pdfDoc.embedPng(fetched.bytes)
      : await pdfDoc.embedJpg(fetched.bytes)
    page.drawImage(image, { x: 0, y: 0, width, height })
    return true
  } catch {
    return false
  }
}
