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

function textToBytes(s: string): number[] {
  const out: number[] = []
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff)
  return out
}

// Paper size in inches for the TSPL `SIZE`/`GAP` commands -- kept in lockstep
// with getPaperWidthDots()'s 203-DPI dot widths for the same paperSize keys.
function getPaperDimensionsInches(paperSize: string): { widthIn: number; heightIn: number } {
  switch (paperSize) {
    case "4x6": return { widthIn: 4, heightIn: 6 }
    case "4x3": return { widthIn: 4, heightIn: 3 }
    case "4x2": return { widthIn: 4, heightIn: 2 }
    case "3x2": return { widthIn: 3, heightIn: 2 }
    case "A4": return { widthIn: 8.27, heightIn: 11.69 }
    case "Letter": return { widthIn: 8.5, heightIn: 11 }
    default: return { widthIn: 4, heightIn: 6 }
  }
}

// Live hardware test (2026-08, 4BARCODE 4B-2054TG): the first real TSPL2
// print came out fully solid black. ditherToMonochrome()/packBits() encode
// 1 = black / 0 = white -- the ESC/POS raster convention -- but this
// printer's BITMAP dialect (its own CUPS filter is literally named
// "rastertosnailtspl", not plain TSPL) reads that polarity inverted: a
// mostly-white badge (sparse black text/graphics) becomes almost entirely
// black on paper when every bit is read backwards. Inverting each packed
// byte here (XOR 0xFF) corrects it for TSPL specifically, without touching
// the shared helpers escpos-printer.ts still relies on for its own,
// unrelated printer class.
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
  const header = textToBytes(
    `SIZE ${widthIn} in,${heightIn} in\r\n` +
    `GAP 0 in,0 in\r\n` +
    `DIRECTION 0\r\n` +
    `REFERENCE 0,0\r\n` +
    `CLS\r\n` +
    `BITMAP 0,0,${bytesPerRow},${imageData.height},0,`
  )
  const footer = textToBytes(`\r\nPRINT 1,1\r\n`)

  const buffer = new Uint8Array(header.length + inverted.length + footer.length)
  buffer.set(header, 0)
  buffer.set(inverted, header.length)
  buffer.set(footer, header.length + inverted.length)
  return buffer
}

// Build a simple TSPL2 text test print -- printer's built-in font, no
// rasterization needed, so a failure here isolates command-language issues
// from html2canvas/bitmap-specific ones.
export function buildTsplTestPrint(): Uint8Array {
  const lines =
    `SIZE 4 in,2 in\r\n` +
    `GAP 0 in,0 in\r\n` +
    `DIRECTION 0\r\n` +
    `CLS\r\n` +
    `TEXT 50,40,"3",0,1,1,"TEST PRINT"\r\n` +
    `TEXT 50,100,"2",0,1,1,"AMASI Print Station"\r\n` +
    `TEXT 50,130,"2",0,1,1,"TSPL2 Connected!"\r\n` +
    `PRINT 1,1\r\n`
  return new Uint8Array(textToBytes(lines))
}

// Convert a canvas to a TSPL2 raster job, scaling to the printer's dot width.
export async function canvasToTspl(
  canvas: HTMLCanvasElement,
  paperSize: string = "4x6"
): Promise<Uint8Array> {
  const targetWidth = getPaperWidthDots(paperSize)

  const scale = targetWidth / canvas.width
  const scaledHeight = Math.round(canvas.height * scale)

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
