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


// Smallest possible label: a single 1x1 inch declared size, sent alone --
// no jobs before it in the same transfer, no bitmap, one TEXT command.
// Live hardware test (2026-08): the 6-inch ruler test, always sent as the
// 3rd job in a row after two other full-size jobs, has now had both of its
// own candidate bugs (a negative TSPL coordinate, then an unproven BAR
// command) removed and STILL printed ~1.5x too long -- meaning neither was
// the actual cause. Two remaining, untested variables: (1) is a small
// declared size ALSO affected proportionally (a universal scale-factor
// issue would show a 1-inch label as ~1.5 inches too), and (2) does being
// the THIRD job in one continuous transfer matter at all, independent of
// content (something drifting cumulatively across jobs, not a per-job
// bug). This test isolates both by being tiny AND standalone -- minimal
// paper cost, answers two questions with one print instead of guessing
// another full-size job and burning more stock.
function buildTinyStandaloneSizeTest(): Uint8Array {
  const lines =
    `SIZE 1 in,1 in\r\n` +
    `GAP 0 in,0 in\r\n` +
    `DIRECTION 0\r\n` +
    `CLS\r\n` +
    `TEXT 5,5,"1",0,1,1,"1x1 TEST"\r\n` +
    `PRINT 1,1\r\n`
  return new Uint8Array(textToBytes(lines))
}

export function buildTsplTestPrint(): Uint8Array {
  return buildTinyStandaloneSizeTest()
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
