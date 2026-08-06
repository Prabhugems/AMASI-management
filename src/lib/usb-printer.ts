// USB Thermal Printer support (e.g., Decode DC 400 Pro Series)
// Uses WebUSB API to send ESC/POS raster data via USB from Android tablets / Chrome
// WebUSB is supported on Chrome for Android, Chrome desktop, and Edge.

// WebUSB type declarations (not in default TS lib)
declare global {
  interface Navigator {
    usb: {
      requestDevice(options: { filters: Array<Record<string, number>> }): Promise<any>
      getDevices(): Promise<any[]>
      addEventListener(event: string, handler: (event: any) => void): void
      removeEventListener(event: string, handler: (event: any) => void): void
    }
  }
}

let usbDevice: any = null
let usbEndpoint: number | null = null

// Defensive best-effort init for USB-to-serial bridge chips (CH340/CH341,
// PL2303, FTDI -- see the vendorId filters in connectUsbPrinter). Live
// testing (2026-08, 4BARCODE 4B-2054TG): connect + claimInterface +
// selectAlternateInterface all succeed and transferOut() resolves with
// status "ok", yet nothing prints -- while the SAME physical printer has
// printed correctly before from iPad/iMac (over Bluetooth or a real OS
// driver, not this code path) and its own built-in self-test print works.
// That combination -- USB link succeeds, ESC/POS commands are already
// proven correct on this exact unit via other links, only raw-WebUSB fails
// -- points at the one handshake a real driver performs that this code
// never has: for a CDC-ACM virtual-serial bridge, the firmware treats the
// "port" as closed (and silently discards writes to it) until the host
// sends SET_LINE_CODING (configure baud/parity/bits) and
// SET_CONTROL_LINE_STATE (assert DTR/RTS) class-specific control requests
// on the CDC "Communications" interface -- a sibling of the "Data"
// interface the bulk endpoints live on, not necessarily the same interface
// number. A native USB-printer-class device has no such interface and no
// such requirement; this is wrapped so failing/being rejected there is a
// harmless no-op.
async function tryCdcAcmHandshake(device: any, dataInterfaceNumber: number): Promise<void> {
  let commInterfaceNumber = dataInterfaceNumber
  try {
    for (const iface of device.configuration?.interfaces || []) {
      for (const alt of iface.alternates) {
        if (alt.interfaceClass === 0x02) {
          commInterfaceNumber = iface.interfaceNumber
          try {
            await device.claimInterface(iface.interfaceNumber)
          } catch {
            // Already claimed (e.g. part of the same interface association) -- fine.
          }
        }
      }
    }

    // SET_LINE_CODING (bRequest 0x20): dwDTERate(LE32) + bCharFormat + bParityType + bDataBits.
    // Most bridge firmwares ignore the actual rate/format values but require the call itself
    // before they'll consider the virtual port "open".
    await device.controlTransferOut(
      { requestType: "class", recipient: "interface", request: 0x20, value: 0x00, index: commInterfaceNumber },
      new Uint8Array([0x00, 0x25, 0x00, 0x00, 0x00, 0x00, 0x08]) // 9600 baud, 1 stop, no parity, 8 data bits
    )
    // SET_CONTROL_LINE_STATE (bRequest 0x22): bit0 = DTR, bit1 = RTS.
    await device.controlTransferOut(
      { requestType: "class", recipient: "interface", request: 0x22, value: 0x03, index: commInterfaceNumber }
    )
  } catch {
    // Not a CDC-ACM device, or it doesn't need/support this -- ignore.
  }
}

// Hardware-testing fix (found live, 2026-08): a page teardown that never
// calls device.close() first (a manual browser refresh, closing the tab,
// or previously, a plain <a href> navigation elsewhere in the app -- see
// KioskStationShell's self-test link) leaves the OS thinking this interface
// is still claimed by the browser, so the NEXT connection attempt -- even
// from a completely fresh page load -- fails with "Unable to claim
// interface" until the cable is physically unplugged and replugged.
// `pagehide` (not `beforeunload`, which mobile Chrome doesn't reliably fire
// and which blocks the bfcache) is the closest thing to a guaranteed
// last-chance hook for this. Best-effort only: it cannot help the plain-
// unplug or app-crash cases, but should be able to close the device before
// most reload/navigation/tab-close ways this can happen.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (usbDevice && usbDevice.opened) {
      // Fire-and-forget -- the page is already being torn down, there's no
      // way to await this, and it must never throw into an unload handler.
      usbDevice.close().catch(() => {})
    }
  })
}

// Check if WebUSB is available in this browser
export function isWebUSBSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator
}

// Check if a printer is currently connected
export function isUsbPrinterConnected(): boolean {
  return usbDevice !== null && usbDevice.opened
}

// Get connected printer name
export function getUsbPrinterName(): string | null {
  if (!usbDevice) return null
  return usbDevice.productName || usbDevice.manufacturerName || "USB Printer"
}

// Request and connect to a USB printer
// This must be called from a user gesture (click/tap) — browser requirement
export async function connectUsbPrinter(): Promise<{
  success: boolean
  name?: string
  error?: string
}> {
  if (!isWebUSBSupported()) {
    return { success: false, error: "WebUSB is not supported in this browser. Use Chrome on Android." }
  }

  try {
    // Request a USB device — show picker filtered to printers (class 0x07)
    // Also include common USB-serial chips used by thermal printers
    const device = await navigator.usb.requestDevice({
      filters: [
        { classCode: 0x07 },                          // USB Printer class
        { vendorId: 0x0483 },                          // STMicroelectronics (common in Decode printers)
        { vendorId: 0x04b8 },                          // Epson (ESC/POS)
        { vendorId: 0x0416 },                          // WinChipHead (CH340 serial chip)
        { vendorId: 0x1a86 },                          // QinHeng (CH341 serial chip)
        { vendorId: 0x067b },                          // Prolific (PL2303 serial chip)
        { vendorId: 0x0403 },                          // FTDI (serial chip)
        { vendorId: 0x1fc9 },                          // NXP (used in some label printers)
        { vendorId: 0x20d1 },                          // Decode printers
        { vendorId: 0x0dd4 },                          // Custom Engineering
        { vendorId: 0x0fe6 },                          // ICS Electronics (Kontron)
        { vendorId: 0x0a5f },                          // Zebra (for completeness)
      ],
    })

    await device.open()

    // Try to select configuration if not already set
    if (device.configuration === null) {
      await device.selectConfiguration(1)
    }

    // Find the printer interface and bulk OUT endpoint
    let foundInterface: any | null = null
    let foundAlternate: any | null = null
    let foundEndpoint: any | null = null

    for (const iface of device.configuration!.interfaces) {
      for (const alt of iface.alternates) {
        // Look for printer class (7) or vendor-specific interfaces
        if (alt.interfaceClass === 0x07 || alt.interfaceClass === 0xFF) {
          for (const ep of alt.endpoints) {
            if (ep.direction === "out" && ep.type === "bulk") {
              foundInterface = iface
              foundAlternate = alt
              foundEndpoint = ep
              break
            }
          }
        }
        if (foundEndpoint) break
      }
      if (foundEndpoint) break
    }

    // If no printer-class interface found, try any interface with a bulk OUT endpoint
    if (!foundEndpoint) {
      for (const iface of device.configuration!.interfaces) {
        for (const alt of iface.alternates) {
          for (const ep of alt.endpoints) {
            if (ep.direction === "out" && ep.type === "bulk") {
              foundInterface = iface
              foundAlternate = alt
              foundEndpoint = ep
              break
            }
          }
          if (foundEndpoint) break
        }
        if (foundEndpoint) break
      }
    }

    if (!foundInterface || !foundEndpoint) {
      await device.close()
      return { success: false, error: "No suitable print endpoint found on this device" }
    }

    // Claim the interface
    await device.claimInterface(foundInterface.interfaceNumber)

    // Hardware-testing fix (found live, 2026-08, 4BARCODE 4B-2054TG): many
    // USB-printer-class devices expose the data endpoints on a NON-default
    // alternate setting (alternate 0 is often a bare "reserved" setting with
    // no endpoints at all). claimInterface() alone leaves alternate 0 active
    // -- it does NOT activate whichever alternate the endpoint above was
    // actually found on. Without this, transferOut() below can appear to
    // succeed (no thrown error) while the bytes never reach the print
    // engine, because the endpoint being addressed doesn't belong to the
    // interface's currently-active alternate setting. Only skip the call
    // when the found alternate genuinely IS the default (0) -- some devices
    // only ever expose one, and selecting it again is harmless anyway, but
    // explicit is cheap here.
    if (foundAlternate && foundAlternate.alternateSetting !== 0) {
      await device.selectAlternateInterface(foundInterface.interfaceNumber, foundAlternate.alternateSetting)
    }

    // Clear any stale halt/stall condition left on the endpoint by a prior
    // interrupted session -- best-effort, not all platforms support it.
    try {
      await device.clearHalt("out", foundEndpoint.endpointNumber)
    } catch {
      // Ignore -- not fatal if unsupported.
    }

    await tryCdcAcmHandshake(device, foundInterface.interfaceNumber)

    usbDevice = device
    usbEndpoint = foundEndpoint.endpointNumber

    const name = device.productName || device.manufacturerName || "USB Printer"
    return { success: true, name }
  } catch (err: any) {
    // User cancelled the picker or connection failed
    if (err.name === "NotFoundError") {
      return { success: false, error: "No printer selected" }
    }
    return { success: false, error: err.message || "Failed to connect to USB printer" }
  }
}

// Disconnect the USB printer
export async function disconnectUsbPrinter(): Promise<void> {
  if (usbDevice && usbDevice.opened) {
    try {
      await usbDevice.close()
    } catch {
      // Ignore close errors
    }
  }
  usbDevice = null
  usbEndpoint = null
}

// Send raw data (ESC/POS commands) to the USB printer
export async function sendToUsbPrinter(data: Uint8Array): Promise<{
  success: boolean
  error?: string
}> {
  if (!usbDevice || !usbDevice.opened || usbEndpoint === null) {
    return { success: false, error: "USB printer not connected" }
  }

  try {
    // Send data in chunks (some USB devices have max packet size limits)
    const CHUNK_SIZE = 16384 // 16KB chunks
    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      const chunk = data.slice(offset, Math.min(offset + CHUNK_SIZE, data.length))
      const result = await usbDevice.transferOut(usbEndpoint, chunk)
      if (result.status !== "ok") {
        return { success: false, error: `Transfer failed with status: ${result.status}` }
      }
    }
    return { success: true }
  } catch (err: any) {
    // If device was disconnected mid-print
    if (err.name === "NetworkError" || err.name === "NotFoundError") {
      usbDevice = null
      usbEndpoint = null
      return { success: false, error: "Printer disconnected during printing" }
    }
    return { success: false, error: err.message || "Failed to send data to printer" }
  }
}

// Send a test print to verify the USB connection works.
// TSPL2, not ESC/POS -- see tspl-generator.ts for why: this WebUSB path
// targets the 4BARCODE/Godex DC421 family, whose real command language is
// TSPL2, confirmed via scripts/print-proxy.mjs's macOS CUPS pipeline for
// the same printer family.
export async function testUsbPrinter(): Promise<{
  success: boolean
  error?: string
}> {
  const { buildTsplTestPrint } = await import("./tspl-generator")
  const data = buildTsplTestPrint()
  return sendToUsbPrinter(data)
}

// Print a badge image via USB using TSPL2 raster format.
// Renders canvas to TSPL2 and sends via WebUSB.
export async function printBadgeViaUsb(
  canvas: HTMLCanvasElement,
  paperSize: string = "4x6"
): Promise<{ success: boolean; error?: string }> {
  const { canvasToTspl } = await import("./tspl-generator")
  const tsplData = await canvasToTspl(canvas, paperSize)
  return sendToUsbPrinter(tsplData)
}

// Listen for USB disconnect events
export function onUsbDisconnect(callback: () => void): () => void {
  if (!isWebUSBSupported()) return () => {}

  const handler = (event: any) => {
    if (usbDevice && event.device === usbDevice) {
      usbDevice = null
      usbEndpoint = null
      callback()
    }
  }

  navigator.usb.addEventListener("disconnect", handler)
  return () => navigator.usb.removeEventListener("disconnect", handler)
}

// Try to reconnect to a previously paired printer (auto-reconnect on page load)
export async function reconnectUsbPrinter(): Promise<{
  success: boolean
  name?: string
  error?: string
}> {
  if (!isWebUSBSupported()) {
    return { success: false, error: "WebUSB not supported" }
  }

  try {
    // getDevices() returns previously authorized devices without showing the picker
    const devices = await navigator.usb.getDevices()

    for (const device of devices) {
      try {
        await device.open()

        if (device.configuration === null) {
          await device.selectConfiguration(1)
        }

        // Find bulk OUT endpoint
        let foundInterface: any | null = null
        let foundAlternate: any | null = null
        let foundEndpoint: any | null = null

        for (const iface of device.configuration!.interfaces) {
          for (const alt of iface.alternates) {
            if (alt.interfaceClass === 0x07 || alt.interfaceClass === 0xFF) {
              for (const ep of alt.endpoints) {
                if (ep.direction === "out" && ep.type === "bulk") {
                  foundInterface = iface
                  foundAlternate = alt
                  foundEndpoint = ep
                  break
                }
              }
            }
            if (foundEndpoint) break
          }
          if (foundEndpoint) break
        }

        if (!foundEndpoint) {
          for (const iface of device.configuration!.interfaces) {
            for (const alt of iface.alternates) {
              for (const ep of alt.endpoints) {
                if (ep.direction === "out" && ep.type === "bulk") {
                  foundInterface = iface
                  foundAlternate = alt
                  foundEndpoint = ep
                  break
                }
              }
              if (foundEndpoint) break
            }
            if (foundEndpoint) break
          }
        }

        if (foundInterface && foundEndpoint) {
          await device.claimInterface(foundInterface.interfaceNumber)
          // See connectUsbPrinter() for why these are required, not optional.
          if (foundAlternate && foundAlternate.alternateSetting !== 0) {
            await device.selectAlternateInterface(foundInterface.interfaceNumber, foundAlternate.alternateSetting)
          }
          try {
            await device.clearHalt("out", foundEndpoint.endpointNumber)
          } catch {
            // Ignore -- not fatal if unsupported.
          }
          await tryCdcAcmHandshake(device, foundInterface.interfaceNumber)
          usbDevice = device
          usbEndpoint = foundEndpoint.endpointNumber
          const name = device.productName || device.manufacturerName || "USB Printer"
          return { success: true, name }
        }

        await device.close()
      } catch {
        // Skip devices that can't be opened
        continue
      }
    }

    return { success: false, error: "No previously paired printer found" }
  } catch (err: any) {
    return { success: false, error: err.message || "Reconnect failed" }
  }
}
