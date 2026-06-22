import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import { requireAdmin } from "@/lib/auth/api-auth"

const execAsync = promisify(exec)

// POST /api/local-print - Send ZPL to local USB Zebra printer
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { zpl, printer_name } = await request.json()

    if (!zpl) {
      return NextResponse.json({ error: "ZPL data required" }, { status: 400 })
    }

    // If the local print proxy is reachable AND the caller did not pin a
    // specific printer, refuse so the page falls through to its proxy path.
    // Stops cached browsers from silently sending raw ZPL to the wrong
    // (Zebra) printer when the user actually has a Dcode/4BARCODE on the
    // proxy. Pinning printer_name keeps the legacy direct-to-Zebra path.
    if (!printer_name) {
      try {
        const probe = await fetch("http://localhost:3001/status", {
          signal: AbortSignal.timeout(800),
        })
        if (probe.ok) {
          return NextResponse.json(
            { success: false, error: "Local print proxy is online; use proxy path." },
            { status: 503 },
          )
        }
      } catch {
        // Proxy not reachable — fall through to direct ZPL path
      }
    }

    // Default to Zebra printer when caller has not specified one and no proxy.
    const printerName = printer_name || "Zebra_Technologies_ZTC_ZD230_203dpi_ZPL"

    // Send ZPL to printer via lp command
    const { stdout, stderr } = await execAsync(
      `echo '${zpl.replace(/'/g, "\\'")}' | lp -d "${printerName}" -o raw -`,
      { timeout: 10000 }
    )

    console.log("[Local Print] Sent to", printerName, stdout)

    return NextResponse.json({
      success: true,
      message: "Print job sent",
      printer: printerName,
      output: stdout
    })
  } catch (error: any) {
    console.error("[Local Print] Error:", error)
    return NextResponse.json({
      success: false,
      error: error.message || "Print failed"
    }, { status: 500 })
  }
}

// GET /api/local-print - Check printer status
export async function GET() {
  try {
    const { stdout } = await execAsync("lpstat -p -d 2>/dev/null | head -20")

    const printers = stdout.split("\n")
      .filter(line => line.includes("printer "))
      .map(line => {
        const match = line.match(/printer (\S+) is (\w+)/)
        return match ? { name: match[1], status: match[2] } : null
      })
      .filter(Boolean)

    return NextResponse.json({ printers })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
