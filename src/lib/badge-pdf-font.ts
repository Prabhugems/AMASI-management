export type PdfFontFamily = "serif" | "sans"

/**
 * pdf-lib's built-in StandardFonts only cover Helvetica/Times/Courier --
 * none of the Google fonts offered in the badge designer's font picker can
 * be rendered as-is. Rather than always falling back to Helvetica (which
 * silently mismatches every serif choice a template was designed with),
 * map each designer font family to the closest standard family so serif
 * fonts at least render with serif metrics instead of sans-serif ones.
 */
const SERIF_KEYWORDS = ["serif", "georgia", "times", "playfair", "merriweather"]

export function resolvePdfFontFamily(fontFamily: string | undefined | null): PdfFontFamily {
  if (!fontFamily) return "sans"
  const normalized = fontFamily.toLowerCase()
  // "sans-serif" contains "serif" as a substring, so sans-serif keywords
  // must be checked first or every sans-serif font would match "serif".
  if (normalized.includes("sans-serif") || normalized.includes("sans serif")) return "sans"
  return SERIF_KEYWORDS.some((keyword) => normalized.includes(keyword)) ? "serif" : "sans"
}
