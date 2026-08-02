// Single source of truth for badge/label paper sizes, in inches.
//
// Before this file existed, "paper size" was defined FOUR separate times
// across this codebase, each with a different unit and a different set of
// known sizes: the Designer's own pixel table (96px/in), badge-render.ts's
// CSS in/mm table, escpos-printer.ts/tspl-generator.ts's dots-at-203-DPI /
// inches tables, and print/[token]/page.tsx's local-proxy keyword map. None
// of the four matched: "3.5x2" and "3x4" (real Designer options) didn't
// exist in the render/print tables at all; "A6" (Designer) vs "a6"
// (badge-render.ts) was a plain case mismatch; "4x4" existed ONLY in the
// proxy's keyword map, nowhere else -- any of these silently fell back to a
// default 4x6 canvas wherever they were missing, live hardware test
// (2026-08) found this as the root cause of a badge printing consistently
// 1.5x too long (a 4x6 fallback used for a size whose real height wasn't 6).
//
// Lookup is case-insensitive (see getPaperSizeInches) since that case
// mismatch was itself one of the four inconsistencies.

export interface PaperSizeInches {
  widthIn: number
  heightIn: number
}

const MM_PER_INCH = 25.4

export const PAPER_SIZES_IN: Record<string, PaperSizeInches> = {
  "4x6": { widthIn: 4, heightIn: 6 },
  "4x3": { widthIn: 4, heightIn: 3 },
  "3x4": { widthIn: 3, heightIn: 4 },
  "4x2": { widthIn: 4, heightIn: 2 },
  "3x2": { widthIn: 3, heightIn: 2 },
  "3.5x2": { widthIn: 3.5, heightIn: 2 },
  "4x4": { widthIn: 4, heightIn: 4 },
  "62x86": { widthIn: 62 / MM_PER_INCH, heightIn: 86 / MM_PER_INCH },
  a6: { widthIn: 105 / MM_PER_INCH, heightIn: 148 / MM_PER_INCH },
  a5: { widthIn: 148 / MM_PER_INCH, heightIn: 210 / MM_PER_INCH },
  a4: { widthIn: 210 / MM_PER_INCH, heightIn: 297 / MM_PER_INCH },
  letter: { widthIn: 8.5, heightIn: 11 },
}

const DEFAULT_SIZE = "4x6"

// Case-insensitive: the Designer's "A6" and this file's "a6" key must
// resolve to the same entry, which the case mismatch above never allowed.
export function getPaperSizeInches(paperSize: string | undefined | null): PaperSizeInches {
  const key = (paperSize || DEFAULT_SIZE).toLowerCase()
  return PAPER_SIZES_IN[key] || PAPER_SIZES_IN[DEFAULT_SIZE]
}
