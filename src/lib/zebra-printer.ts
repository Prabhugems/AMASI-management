// Direct HTTP printing to Zebra ZD230 (and compatible printers)
// Zebra printers accept raw ZPL via HTTP POST at http://<ip>/pstprnt
// This works from iPad Safari using fetch with mode: 'no-cors'

const DEFAULT_TIMEOUT = 5000

export interface ZebraPrintResult {
  success: boolean
  error?: string
}

// Send ZPL to Zebra printer via HTTP POST
// Uses mode: 'no-cors' because the printer doesn't send CORS headers.
// With no-cors, we get an opaque response (status 0) — we treat that as success
// because the ZPL was delivered. A network error (printer unreachable) will throw.
export async function sendZPLToZebra(printerIp: string, zpl: string): Promise<ZebraPrintResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)

  try {
    await fetch(`http://${printerIp}/pstprnt`, {
      method: "POST",
      body: zpl,
      mode: "no-cors",
      signal: controller.signal,
    })

    // With no-cors, a successful fetch (no throw) means the request was sent
    return { success: true }
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { success: false, error: "Printer connection timed out" }
    }
    return { success: false, error: err.message || "Failed to reach printer" }
  } finally {
    clearTimeout(timeout)
  }
}

// Send a test label to verify connectivity
export async function testZebraPrinter(printerIp: string): Promise<ZebraPrintResult> {
  const { generateTestZPL } = await import("./zpl-generator")
  const zpl = generateTestZPL()
  return sendZPLToZebra(printerIp, zpl)
}

// Quick health check — try to fetch the printer's web page
// Returns true if the printer responds (even with an opaque response)
export async function isZebraReachable(printerIp: string): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)

  try {
    await fetch(`http://${printerIp}/`, {
      method: "GET",
      mode: "no-cors",
      signal: controller.signal,
    })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}
