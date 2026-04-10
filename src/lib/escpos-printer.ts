// ESC/POS thermal printer support (e.g. 4BARCODE 4B-2054TG)
// Converts images to ESC/POS raster format and sends via raw TCP (port 9100)

// Paper width in dots at 203 DPI for common paper sizes
function getPaperWidthDots(paperSize: string): number {
  // 203 DPI standard
  switch (paperSize) {
    case "4x6":
    case "4x3":
    case "4x2":
      return 203 * 4 // 812 dots for 4" wide paper
    case "3x2":
      return 203 * 3 // 609 dots for 3" wide paper
    case "A4":
    case "Letter":
      return 203 * 4 // Clamp to 4" for thermal
    default:
      return 203 * 4
  }
}

// Floyd-Steinberg dithering: convert RGBA image data to 1-bit monochrome
function ditherToMonochrome(
  imageData: { data: Uint8ClampedArray; width: number; height: number }
): Uint8Array {
  const { width, height, data } = imageData

  // Convert to grayscale float array
  const gray = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const a = data[i * 4 + 3]
    // Treat transparent as white
    if (a < 128) {
      gray[i] = 255
    } else {
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b
    }
  }

  // Floyd-Steinberg dithering
  const output = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const oldPixel = gray[idx]
      const newPixel = oldPixel < 128 ? 0 : 255
      output[idx] = newPixel === 0 ? 1 : 0 // 1 = black, 0 = white
      const error = oldPixel - newPixel

      if (x + 1 < width) gray[idx + 1] += error * 7 / 16
      if (y + 1 < height) {
        if (x - 1 >= 0) gray[(y + 1) * width + x - 1] += error * 3 / 16
        gray[(y + 1) * width + x] += error * 5 / 16
        if (x + 1 < width) gray[(y + 1) * width + x + 1] += error * 1 / 16
      }
    }
  }

  return output
}

// Pack monochrome pixel array (1 byte per pixel) into bit-packed bytes (MSB first)
function packBits(mono: Uint8Array, width: number, height: number): { data: Uint8Array; bytesPerRow: number } {
  const bytesPerRow = Math.ceil(width / 8)
  const packed = new Uint8Array(bytesPerRow * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mono[y * width + x] === 1) {
        const byteIndex = y * bytesPerRow + Math.floor(x / 8)
        const bitIndex = 7 - (x % 8)
        packed[byteIndex] |= (1 << bitIndex)
      }
    }
  }

  return { data: packed, bytesPerRow }
}

// Build ESC/POS raster image command with init + image + cut
export function buildEscPosRaster(
  imageData: { data: Uint8ClampedArray; width: number; height: number }
): Uint8Array {
  const mono = ditherToMonochrome(imageData)
  const { data: packed, bytesPerRow } = packBits(mono, imageData.width, imageData.height)
  const height = imageData.height

  // Calculate total size:
  // ESC @ (2 bytes) + GS v 0 header (8 bytes) + image data + GS V 0 cut (3 bytes) + line feeds (3 bytes)
  const headerSize = 2 + 8
  const cutSize = 3
  const feedSize = 3 // 3 line feeds before cut
  const totalSize = headerSize + packed.length + feedSize + cutSize

  const buffer = new Uint8Array(totalSize)
  let offset = 0

  // ESC @ - Initialize printer
  buffer[offset++] = 0x1b
  buffer[offset++] = 0x40

  // GS v 0 - Print raster bit image
  buffer[offset++] = 0x1d // GS
  buffer[offset++] = 0x76 // v
  buffer[offset++] = 0x30 // 0
  buffer[offset++] = 0x00 // Normal mode

  // xL xH - width in bytes (low byte, high byte)
  buffer[offset++] = bytesPerRow & 0xff
  buffer[offset++] = (bytesPerRow >> 8) & 0xff

  // yL yH - height in dots (low byte, high byte)
  buffer[offset++] = height & 0xff
  buffer[offset++] = (height >> 8) & 0xff

  // Image data
  buffer.set(packed, offset)
  offset += packed.length

  // Feed a few lines before cutting
  buffer[offset++] = 0x0a // LF
  buffer[offset++] = 0x0a // LF
  buffer[offset++] = 0x0a // LF

  // GS V 0 - Full cut
  buffer[offset++] = 0x1d
  buffer[offset++] = 0x56
  buffer[offset++] = 0x00

  return buffer
}

// Build a simple text test print with cut
export function buildTestPrint(): Uint8Array {
  const lines = [
    "\x1b\x40",           // ESC @ - Initialize
    "\x1b\x61\x01",       // ESC a 1 - Center align
    "\x1d\x21\x11",       // GS ! 0x11 - Double width + double height
    "TEST PRINT\n",
    "\x1d\x21\x00",       // GS ! 0x00 - Normal size
    "\x1b\x61\x01",       // Center
    "================================\n",
    "AMASI Print Station\n",
    "Thermal Printer Connected!\n",
    "================================\n",
    `${new Date().toLocaleString()}\n`,
    "\n\n\n",
    "\x1d\x56\x00",       // GS V 0 - Full cut
  ]

  const text = lines.join("")
  // Build manually since TextEncoder won't handle raw control bytes correctly
  const parts: number[] = []
  for (let i = 0; i < text.length; i++) {
    parts.push(text.charCodeAt(i) & 0xff)
  }
  return new Uint8Array(parts)
}

// Convert a canvas to ESC/POS raster data, scaling to printer width
export async function canvasToEscPos(
  canvas: HTMLCanvasElement,
  paperSize: string = "4x6"
): Promise<Uint8Array> {
  const targetWidth = getPaperWidthDots(paperSize)

  // Scale the canvas to printer dot width
  const scale = targetWidth / canvas.width
  const scaledHeight = Math.round(canvas.height * scale)

  // Create a scaled canvas
  const scaledCanvas = document.createElement("canvas")
  scaledCanvas.width = targetWidth
  scaledCanvas.height = scaledHeight
  const ctx = scaledCanvas.getContext("2d")!
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, targetWidth, scaledHeight)
  ctx.drawImage(canvas, 0, 0, targetWidth, scaledHeight)

  const imageData = ctx.getImageData(0, 0, targetWidth, scaledHeight)
  return buildEscPosRaster(imageData)
}

// Send ESC/POS data to thermal printer via server API route
export async function sendToThermalPrinter(
  ip: string,
  port: number,
  data: Uint8Array
): Promise<{ success: boolean; error?: string }> {
  try {
    // Convert to base64 for JSON transport
    // Use chunked approach to avoid call stack overflow with large images
    let binary = ""
    const chunkSize = 8192
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.subarray(i, Math.min(i + chunkSize, data.length))
      binary += String.fromCharCode(...chunk)
    }
    const base64 = btoa(binary)

    const res = await fetch("/api/print/thermal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printer_ip: ip,
        port,
        data: base64,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      return { success: false, error: result.error || "Print failed" }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reach print server" }
  }
}

// Test thermal printer connectivity by sending a test print
export async function testThermalPrinter(
  ip: string,
  port: number
): Promise<{ success: boolean; error?: string }> {
  const data = buildTestPrint()
  return sendToThermalPrinter(ip, port, data)
}
