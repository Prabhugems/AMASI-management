import { NextRequest, NextResponse } from "next/server"
import net from "net"

const TIMEOUT_MS = 10000

export async function POST(request: NextRequest) {
  try {
    const { printer_ip, port, data } = await request.json()

    if (!printer_ip || !port || !data) {
      return NextResponse.json(
        { error: "Missing required fields: printer_ip, port, data" },
        { status: 400 }
      )
    }

    // Validate IP format (basic check)
    if (!/^[\d.]+$/.test(printer_ip) && !/^[a-zA-Z0-9.-]+$/.test(printer_ip)) {
      return NextResponse.json(
        { error: "Invalid printer IP address" },
        { status: 400 }
      )
    }

    // Validate port range
    const portNum = Number(port)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return NextResponse.json(
        { error: "Invalid port number" },
        { status: 400 }
      )
    }

    // Decode base64 data to binary
    const binaryData = Buffer.from(data, "base64")

    if (binaryData.length === 0) {
      return NextResponse.json(
        { error: "Empty print data" },
        { status: 400 }
      )
    }

    // Send raw data via TCP socket
    await new Promise<void>((resolve, reject) => {
      const socket = new net.Socket()

      const timeout = setTimeout(() => {
        socket.destroy()
        reject(new Error("Connection timed out"))
      }, TIMEOUT_MS)

      socket.connect(portNum, printer_ip, () => {
        socket.write(binaryData, (err) => {
          clearTimeout(timeout)
          if (err) {
            socket.destroy()
            reject(new Error(`Write error: ${err.message}`))
          } else {
            // Give the printer a moment to receive the data before closing
            setTimeout(() => {
              socket.end()
              resolve()
            }, 500)
          }
        })
      })

      socket.on("error", (err) => {
        clearTimeout(timeout)
        socket.destroy()
        reject(new Error(`Printer connection error: ${err.message}`))
      })

      socket.on("close", () => {
        clearTimeout(timeout)
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Thermal print error:", error)

    // Provide user-friendly error messages
    let errorMessage = error.message || "Print failed"
    if (errorMessage.includes("ECONNREFUSED")) {
      errorMessage = "Printer refused connection - check IP and port"
    } else if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("timed out")) {
      errorMessage = "Printer connection timed out - check network"
    } else if (errorMessage.includes("EHOSTUNREACH")) {
      errorMessage = "Printer unreachable - check network connection"
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
