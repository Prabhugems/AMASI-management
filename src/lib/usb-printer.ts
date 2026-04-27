// USB Thermal Printer support (e.g., Decode DC 400 Pro Series)
// Uses WebUSB API to send ESC/POS raster data via USB from Android tablets / Chrome
// WebUSB is supported on Chrome for Android, Chrome desktop, and Edge.

// WebUSB type declarations (not in default TS lib)
/* eslint-disable @typescript-eslint/no-explicit-any */
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
    let foundEndpoint: any | null = null

    for (const iface of device.configuration!.interfaces) {
      for (const alt of iface.alternates) {
        // Look for printer class (7) or vendor-specific interfaces
        if (alt.interfaceClass === 0x07 || alt.interfaceClass === 0xFF) {
          for (const ep of alt.endpoints) {
            if (ep.direction === "out" && ep.type === "bulk") {
              foundInterface = iface
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

// Send a test print to verify the USB connection works
export async function testUsbPrinter(): Promise<{
  success: boolean
  error?: string
}> {
  const { buildTestPrint } = await import("./escpos-printer")
  const data = buildTestPrint()
  return sendToUsbPrinter(data)
}

// Print a badge image via USB using ESC/POS raster format
// Renders canvas to ESC/POS and sends via WebUSB
export async function printBadgeViaUsb(
  canvas: HTMLCanvasElement,
  paperSize: string = "4x6"
): Promise<{ success: boolean; error?: string }> {
  const { canvasToEscPos } = await import("./escpos-printer")
  const escposData = await canvasToEscPos(canvas, paperSize)
  return sendToUsbPrinter(escposData)
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
        let foundEndpoint: any | null = null

        for (const iface of device.configuration!.interfaces) {
          for (const alt of iface.alternates) {
            if (alt.interfaceClass === 0x07 || alt.interfaceClass === 0xFF) {
              for (const ep of alt.endpoints) {
                if (ep.direction === "out" && ep.type === "bulk") {
                  foundInterface = iface
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
