// TSPL2 command generation for 4BARCODE / Godex DC421 family USB label
// printers, sent via WebUSB (see usb-printer.ts).
//
// Confirmed via scripts/print-proxy.mjs -- the macOS CUPS pipeline already
// built for this exact printer family -- that its real command language is
// TSPL2, not ESC/POS. The WebUSB path had been sending raw ESC/POS
// (escpos-printer.ts) since it was first written, which this firmware
// doesn't understand: every USB-layer step (connect, claim, transferOut)
// reported success all along, but nothing ever printed, because the bytes
// arriving were never valid commands to this firmware in the first place.
//
// Bitmap packing (1 bit per pixel, MSB first, 1 = black) is identical to
// ESC/POS's raster format -- only the text command framing around the
// bitmap differs -- so the dithering/packing/width helpers are reused from
// escpos-printer.ts rather than duplicated.
//
// Like every print-confirmation path in this codebase, this has not been
// verified against the physical printer yet -- TSPL2 is a large, loosely
// standardized command set with real per-vendor quirks (see print-proxy.mjs's
// own notes on this exact printer ignoring several backfeed/cut variants).
// This targets the documented core subset (SIZE/GAP/CLS/BITMAP/PRINT) and
// deliberately does not attempt cutter/backfeed control, matching the
// tear-off behavior print-proxy.mjs already settled on as the working state
// for this printer.

import { ditherToMonochrome, packBits, getPaperWidthDots } from "./escpos-printer"
import { getPaperSizeInches as getPaperDimensionsInches } from "./paper-sizes"

function textToBytes(s: string): number[] {
  const out: number[] = []
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff)
  return out
}

// Real thermal-label printers commonly cap how much data a single BITMAP
// command can hold (their receive/print buffer isn't infinite). A real 4x6
// badge at 203 DPI is roughly 120KB in one command -- ~250x the diagnostic
// checkerboard below, which printed correctly at its tiny size. Splitting
// the image into horizontal bands, each its own BITMAP command at the
// correct Y offset, keeps every single command small regardless of the
// printer's exact limit (a number this codebase has no way to know without
// its datasheet), while printing the identical assembled image.
const MAX_BAND_HEIGHT_DOTS = 100

function invertPackedBits(packed: Uint8Array): Uint8Array {
  const inverted = new Uint8Array(packed.length)
  for (let i = 0; i < packed.length; i++) inverted[i] = packed[i] ^ 0xff
  return inverted
}

// Build a TSPL2 job that prints a raster image filling the label.
export function buildTsplRaster(
  imageData: { data: Uint8ClampedArray; width: number; height: number },
  paperSize: string = "4x6"
): Uint8Array {
  const mono = ditherToMonochrome(imageData)
  const { data: packed, bytesPerRow } = packBits(mono, imageData.width, imageData.height)
  const inverted = invertPackedBits(packed)
  const { widthIn, heightIn } = getPaperDimensionsInches(paperSize)
  const totalHeight = imageData.height

  // Bit polarity IS inverted here -- reversing an earlier revert of this
  // same fix. That revert was based on a hand-built diagnostic checkerboard
  // printing with "clean quadrants": true, but a checkerboard is a poor
  // polarity test -- a symmetric 2-color pattern still looks like a valid
  // checkerboard even with black and white swapped, since the shape is
  // identical either way. A real badge print (live hardware test, 2026-08)
  // removed that ambiguity: perfectly formed, correctly positioned,
  // completely readable text/QR/reg-number -- proving content and sizing
  // are both correct -- but with a solid black background and white
  // text/QR, the exact opposite of the intended blank-background/dark-text
  // overlay. Inverting each packed byte (XOR 0xFF) corrects this.
  //
  // Gap = 0 assumes continuous/tear-off stock, matching print-proxy.mjs's
  // documented working state for this printer (no cutter/backfeed control).
  // DIRECTION is deliberately left at the neutral 0 -- orientation is
  // already controlled upstream, baked into imageData's pixels before this
  // function ever runs, by the existing admin-configurable
  // print_settings.rotation (badge-render.ts, defaults to 180 for full
  // badges). Kiosk Stations and the Print Station page share the exact same
  // print_stations.print_settings row (see KioskCheckinScreen.tsx's own
  // comment on this), so that one Rotation dropdown already covers this
  // WebUSB path too -- adding a second rotation here would double up with
  // it instead of composing.
  const parts: Uint8Array[] = []
  parts.push(new Uint8Array(textToBytes(
    `SIZE ${widthIn} in,${heightIn} in\r\n` +
    `GAP 0 in,0 in\r\n` +
    `DIRECTION 0\r\n` +
    `REFERENCE 0,0\r\n` +
    `CLS\r\n`
  )))

  for (let y = 0; y < totalHeight; y += MAX_BAND_HEIGHT_DOTS) {
    const bandHeight = Math.min(MAX_BAND_HEIGHT_DOTS, totalHeight - y)
    const bandStart = y * bytesPerRow
    const bandBytes = bandHeight * bytesPerRow
    parts.push(new Uint8Array(textToBytes(`BITMAP 0,${y},${bytesPerRow},${bandHeight},0,`)))
    parts.push(inverted.subarray(bandStart, bandStart + bandBytes))
    parts.push(new Uint8Array(textToBytes(`\r\n`)))
  }

  parts.push(new Uint8Array(textToBytes(`PRINT 1,1\r\n`)))

  const totalLength = parts.reduce((sum, p) => sum + p.length, 0)
  const buffer = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    buffer.set(part, offset)
    offset += part.length
  }
  return buffer
}

// A tiny 64x64-dot checkerboard: top-left + bottom-right BLACK, the other
// two quadrants WHITE. Deliberately hand-built (not run through
// ditherToMonochrome/packBits) so its expected output is known by
// construction, not by trusting the same pipeline we're debugging.
// Small and simple enough to read by eye, unlike a full badge -- reveals
// bit-polarity inversion (colors fully swapped) and row/column
// misalignment (quadrants shifted, smeared, or scrambled instead of clean
// squares) in one shot, isolated from html2canvas/badge-template concerns
// entirely.
function buildDiagnosticCheckerboard(width: number, height: number): { packed: Uint8Array; bytesPerRow: number; height: number } {
  const bytesPerRow = Math.ceil(width / 8) // 1 bit per dot, MSB first

  const packed = new Uint8Array(bytesPerRow * height)
  for (let y = 0; y < height; y++) {
    for (let byteX = 0; byteX < bytesPerRow; byteX++) {
      const isLeftHalf = byteX < bytesPerRow / 2
      const isTopHalf = y < height / 2
      const shouldBeBlack = isTopHalf === isLeftHalf // TL and BR black, TR and BL white
      packed[y * bytesPerRow + byteX] = shouldBeBlack ? 0xff : 0x00
    }
  }
  return { packed, bytesPerRow, height }
}

// Full real-badge-sized (4x6 @ 203 DPI) checkerboard, sent as ONE single,
// unchunked BITMAP command -- same ~120KB data volume as a real badge, but
// hand-built content with a known-correct expected appearance, isolating
// "is this a size/structural limit on this printer" from "is this specific
// to the real badge's actual dithered html2canvas content". If this prints
// clean, the row-band chunking in buildTsplRaster() was solving a problem
// that didn't exist and the real bug is in the badge's rendered content; if
// this ALSO comes out solid black, it confirms something structural breaks
// at real-badge data volumes on this printer regardless of chunking.
function buildLargeDiagnosticJob(): Uint8Array {
  const width = getPaperWidthDots("4x6") // 812 dots
  const height = Math.round(width * (6 / 4)) // 1218 dots, matching a real 4x6 badge
  const { packed, bytesPerRow } = buildDiagnosticCheckerboard(width, height)
  const { widthIn, heightIn } = getPaperDimensionsInches("4x6")

  const header = textToBytes(
    `SIZE ${widthIn} in,${heightIn} in\r\n` +
    `GAP 0 in,0 in\r\n` +
    `DIRECTION 0\r\n` +
    `CLS\r\n` +
    `BITMAP 0,0,${bytesPerRow},${height},0,`
  )
  const footer = textToBytes(`\r\nPRINT 1,1\r\n`)

  const buffer = new Uint8Array(header.length + packed.length + footer.length)
  buffer.set(header, 0)
  buffer.set(packed, header.length)
  buffer.set(footer, header.length + packed.length)
  return buffer
}

// Build a TSPL2 test print combining plain text (printer's own font -- no
// rasterization, isolates command-language issues) with the diagnostic
// checkerboard bitmap (isolates BITMAP-specific format issues) in one job,
// followed by a SECOND, separate job: a full real-badge-sized checkerboard
// (buildLargeDiagnosticJob) -- since chunking (#137) didn't fix a real
// badge still printing solid black, one Test Print now yields two labels to
// compare: a small known-good one, and one at real data-volume to isolate
// whether this printer has a structural limit at that size independent of
// content.
export function buildTsplTestPrint(): Uint8Array {
  const { packed, bytesPerRow, height } = buildDiagnosticCheckerboard(64, 64)

  const header = textToBytes(
    `SIZE 4 in,3 in\r\n` +
    `GAP 0 in,0 in\r\n` +
    `DIRECTION 0\r\n` +
    `CLS\r\n` +
    `TEXT 20,20,"3",0,1,1,"TEST PRINT"\r\n` +
    `TEXT 20,70,"1",0,1,1,"AMASI Print Station - TSPL2 Connected!"\r\n` +
    `TEXT 20,100,"1",0,1,1,"Top-left + bottom-right = BLACK"\r\n` +
    `TEXT 20,120,"1",0,1,1,"Top-right + bottom-left = WHITE"\r\n` +
    `BITMAP 20,150,${bytesPerRow},${height},0,`
  )
  const footer = textToBytes(`\r\nPRINT 1,1\r\n`)

  const smallJob = new Uint8Array(header.length + packed.length + footer.length)
  smallJob.set(header, 0)
  smallJob.set(packed, header.length)
  smallJob.set(footer, header.length + packed.length)

  const largeJob = buildLargeDiagnosticJob()

  const combined = new Uint8Array(smallJob.length + largeJob.length)
  combined.set(smallJob, 0)
  combined.set(largeJob, smallJob.length)
  return combined
}

// Convert a canvas to a TSPL2 raster job, scaling to the printer's dot width.
export async function canvasToTspl(
  canvas: HTMLCanvasElement,
  paperSize: string = "4x6"
): Promise<Uint8Array> {
  const targetWidth = getPaperWidthDots(paperSize)

  // Height is derived from the DECLARED label size (widthIn/heightIn), not
  // proportionally from the captured canvas's own dimensions. Live hardware
  // test (2026-08): a real badge printed ~1.5x longer than its declared
  // "SIZE 4in,6in" -- a blank stretch of label before the actual (correctly
  // colored, correctly positioned) content. Root cause: the print
  // container html2canvas captures has no overflow:hidden of its own, so
  // if the captured canvas comes out even slightly taller than its nominal
  // 4x6 aspect ratio (a real risk with off-screen absolutely-positioned
  // content), the old `scaledHeight = canvas.height * scale` carried that
  // extra height straight into the BITMAP command as a genuinely taller
  // image -- out of sync with what the SIZE command declares fits on one
  // label. Forcing the target height from the paper size, and drawImage()
  // stretching/fitting the source into that fixed box, guarantees the
  // BITMAP command's dimensions always match the declared SIZE, regardless
  // of any upstream capture quirks.
  const { widthIn, heightIn } = getPaperDimensionsInches(paperSize)
  const scaledHeight = Math.round(targetWidth * (heightIn / widthIn))

  const scaledCanvas = document.createElement("canvas")
  scaledCanvas.width = targetWidth
  scaledCanvas.height = scaledHeight
  const ctx = scaledCanvas.getContext("2d")!
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, targetWidth, scaledHeight)
  ctx.drawImage(canvas, 0, 0, targetWidth, scaledHeight)

  const imageData = ctx.getImageData(0, 0, targetWidth, scaledHeight)
  return buildTsplRaster(imageData, paperSize)
}
