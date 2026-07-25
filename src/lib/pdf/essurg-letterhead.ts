import fs from "node:fs"
import path from "node:path"
import type { jsPDF } from "jspdf"
import type { PDFDocument, PDFPage } from "pdf-lib"

// The one event this bundled artwork is for. This codebase is shared across
// multiple white-label deployments (AMASI/College at collegeofmas.org.in,
// ESSURG at app.essurg2026.org, others) — every call site MUST gate on this
// before using the real letterhead, or a future deploy of this shared code
// leaks ESSURG's logo onto another tenant's real documents.
export const ESSURG_EVENT_ID = "e4af037d-6055-463c-9d57-31db69ecd414"

export function shouldUseEssurgLetterhead(eventId: string | null | undefined): boolean {
  return eventId === ESSURG_EVENT_ID
}

const HEADER_PATH = path.join(process.cwd(), "public/essurg/letterhead-header.png")
const FOOTER_PATH = path.join(process.cwd(), "public/essurg/letterhead-footer.png")

let headerCache: Buffer | null = null
let footerCache: Buffer | null = null

function loadHeaderBytes(): Buffer | null {
  if (headerCache) return headerCache
  try {
    headerCache = fs.readFileSync(HEADER_PATH)
    return headerCache
  } catch {
    return null
  }
}

function loadFooterBytes(): Buffer | null {
  if (footerCache) return footerCache
  try {
    footerCache = fs.readFileSync(FOOTER_PATH)
    return footerCache
  } catch {
    return null
  }
}

// Aspect-ratio-preserving target sizes (mm), derived from the source crops
// (header 1785x650px, footer 1785x451px) — see
// docs/superpowers/specs/2026-07-25-essurg-letterhead-branding-design.md
export const ESSURG_HEADER_WIDTH_MM = 109.8
export const ESSURG_HEADER_HEIGHT_MM = 40
export const ESSURG_FOOTER_WIDTH_MM = 98.9
export const ESSURG_FOOTER_HEIGHT_MM = 25

const MM_TO_PT = 2.83465

const ESSURG_HEADER_WIDTH_PT = ESSURG_HEADER_WIDTH_MM * MM_TO_PT
const ESSURG_HEADER_HEIGHT_PT = ESSURG_HEADER_HEIGHT_MM * MM_TO_PT
const ESSURG_FOOTER_WIDTH_PT = ESSURG_FOOTER_WIDTH_MM * MM_TO_PT
const ESSURG_FOOTER_HEIGHT_PT = ESSURG_FOOTER_HEIGHT_MM * MM_TO_PT

/**
 * Draw the ESSURG header into a jsPDF document (top-down Y, mm).
 * Returns the Y where body content should start, or null if the image
 * couldn't be loaded — callers must fall back to their generic header.
 */
export function drawEssurgHeaderJsPdf(doc: jsPDF, marginMm: number): number | null {
  const bytes = loadHeaderBytes()
  if (!bytes) return null
  const base64 = bytes.toString("base64")
  doc.addImage(`data:image/png;base64,${base64}`, "PNG", marginMm, 10, ESSURG_HEADER_WIDTH_MM, ESSURG_HEADER_HEIGHT_MM)
  return 10 + ESSURG_HEADER_HEIGHT_MM + 8
}

/** Draw the ESSURG footer into a jsPDF document. Returns true if drawn. */
export function drawEssurgFooterJsPdf(doc: jsPDF, pageHeightMm: number, marginMm: number): boolean {
  const bytes = loadFooterBytes()
  if (!bytes) return false
  const base64 = bytes.toString("base64")
  const y = pageHeightMm - ESSURG_FOOTER_HEIGHT_MM - 10
  doc.addImage(`data:image/png;base64,${base64}`, "PNG", marginMm, y, ESSURG_FOOTER_WIDTH_MM, ESSURG_FOOTER_HEIGHT_MM)
  return true
}

/**
 * Draw the ESSURG header into a pdf-lib page (bottom-up Y, points).
 * Returns the Y where body content should start, or null on failure.
 */
export async function drawEssurgHeaderPdfLib(
  pdfDoc: PDFDocument,
  page: PDFPage,
  marginPt: number
): Promise<number | null> {
  const bytes = loadHeaderBytes()
  if (!bytes) return null
  const image = await pdfDoc.embedPng(bytes)
  const { height: pageHeight } = page.getSize()
  const topPaddingPt = 30
  const y = pageHeight - topPaddingPt - ESSURG_HEADER_HEIGHT_PT
  page.drawImage(image, { x: marginPt, y, width: ESSURG_HEADER_WIDTH_PT, height: ESSURG_HEADER_HEIGHT_PT })
  return y - 20
}

/** Draw the ESSURG footer into a pdf-lib page. Returns true if drawn. */
export async function drawEssurgFooterPdfLib(
  pdfDoc: PDFDocument,
  page: PDFPage,
  marginPt: number
): Promise<boolean> {
  const bytes = loadFooterBytes()
  if (!bytes) return false
  const image = await pdfDoc.embedPng(bytes)
  page.drawImage(image, { x: marginPt, y: 30, width: ESSURG_FOOTER_WIDTH_PT, height: ESSURG_FOOTER_HEIGHT_PT })
  return true
}
