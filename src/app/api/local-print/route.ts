import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

// POST /api/local-print - Send ZPL to local USB Zebra printer
export async function POST(request: NextRequest) {
  try {
    const { zpl, printer_name } = await request.json()

    if (!zpl) {
      return NextResponse.json({ error: "ZPL data required" }, { status: 400 })
    }

    // Default to Zebra printer
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
