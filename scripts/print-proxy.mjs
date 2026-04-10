#!/usr/bin/env node
/**
 * Local Print Proxy for USB thermal printers
 *
 * Runs on the machine with the USB printer attached.
 * Accepts print jobs via HTTP from the browser, sends them to the printer
 * via CUPS with auto-cut enabled.
 *
 * Usage:
 *   node scripts/print-proxy.mjs
 *   # or with a specific port:
 *   PORT=3001 node scripts/print-proxy.mjs
 *
 * The print station web app sends print jobs to http://localhost:PORT/print
 */

import http from "node:http"
import https from "node:https"
import crypto from "node:crypto"
import { execSync, exec } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const PORT = parseInt(process.env.PORT || "3001", 10)

// Auto-detect thermal printers connected via USB
function detectPrinters() {
  try {
    const output = execSync("lpstat -v 2>/dev/null", { encoding: "utf8" })
    const printers = []
    for (const line of output.split("\n")) {
      const match = line.match(/device for (.+?):\s+(.+)/)
      if (match) {
        printers.push({ name: match[1], uri: match[2], isUsb: match[2].startsWith("usb://") })
      }
    }
    return printers
  } catch {
    return []
  }
}

// Get printer options
function getPrinterOptions(printerName) {
  try {
    const output = execSync(`lpoptions -p ${printerName} -l 2>/dev/null`, { encoding: "utf8" })
    const options = {}
    for (const line of output.split("\n")) {
      const match = line.match(/^(\w+)\/.*:\s+(.+)/)
      if (match) {
        const values = match[2].split(" ")
        const current = values.find(v => v.startsWith("*"))
        options[match[1]] = { values, current: current?.replace("*", "") || values[0] }
      }
    }
    return options
  } catch {
    return {}
  }
}

// Generate self-signed certificate for HTTPS (browsers block mixed content http from https pages)
function generateSelfSignedCert() {
  const certDir = path.join(os.homedir(), ".amasi-print-proxy")
  const certFile = path.join(certDir, "cert.pem")
  const keyFile = path.join(certDir, "key.pem")

  if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
    return { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }
  }

  // Generate using openssl
  try {
    fs.mkdirSync(certDir, { recursive: true })
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyFile}" -out "${certFile}" -days 3650 -nodes -subj "/CN=localhost"`,
      { stdio: "pipe" }
    )
    console.log("  Generated self-signed certificate for HTTPS")
    return { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }
  } catch (e) {
    console.warn("  Could not generate HTTPS cert, falling back to HTTP only")
    return null
  }
}

const tlsCert = generateSelfSignedCert()

const handler = async (req, res) => {
  // CORS headers — allow browser requests from any origin
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    res.writeHead(200)
    res.end()
    return
  }

  // Health check / printer info
  if (req.method === "GET" && (req.url === "/" || req.url === "/status")) {
    const printers = detectPrinters()
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      status: "ok",
      hostname: os.hostname(),
      printers: printers.map(p => ({
        name: p.name,
        usb: p.isUsb,
        uri: p.uri,
      })),
    }))
    return
  }

  // List printer options
  if (req.method === "GET" && req.url?.startsWith("/options")) {
    const printerName = new URL(req.url, `http://localhost`).searchParams.get("printer")
    if (!printerName) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "printer query param required" }))
      return
    }
    const options = getPrinterOptions(printerName)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ printer: printerName, options }))
    return
  }

  // Print endpoint
  if (req.method === "POST" && req.url === "/print") {
    let body = ""
    for await (const chunk of req) body += chunk

    let payload
    try {
      payload = JSON.parse(body)
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Invalid JSON" }))
      return
    }

    const {
      printer,       // printer name (e.g., "_4BARCODE_4B_2054TG")
      html,          // HTML content to print
      copies = 1,
      paperSize,     // e.g., "w4h6"
      autoCut = true,
      labelMark = true,
    } = payload

    if (!printer || !html) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "printer and html are required" }))
      return
    }

    // Write HTML to a temp file
    const tmpFile = path.join(os.tmpdir(), `badge-${Date.now()}.html`)
    fs.writeFileSync(tmpFile, html)

    // Build lp command with options
    const opts = []
    if (paperSize) opts.push(`-o media=${paperSize}`)
    if (copies > 1) opts.push(`-n ${copies}`)
    if (labelMark) opts.push("-o PaperType=LabelMark")
    if (autoCut) opts.push("-o PostAction=Cut")

    const cmd = `lp -d ${printer} ${opts.join(" ")} ${tmpFile}`

    exec(cmd, (error, stdout, stderr) => {
      // Cleanup temp file
      try { fs.unlinkSync(tmpFile) } catch {}

      if (error) {
        console.error(`Print failed: ${error.message}`)
        res.writeHead(500, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ success: false, error: error.message }))
        return
      }

      const jobMatch = stdout.match(/request id is (\S+)/)
      const jobId = jobMatch ? jobMatch[1] : null
      console.log(`Printed: ${jobId || stdout.trim()}`)

      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ success: true, jobId, message: stdout.trim() }))
    })
    return
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" })
  res.end(JSON.stringify({ error: "Not found" }))
}

// Start both HTTP and HTTPS servers
const httpServer = http.createServer(handler)
const HTTPS_PORT = PORT + 1 // 3002

let httpsServer = null
if (tlsCert) {
  httpsServer = https.createServer(tlsCert, handler)
  httpsServer.listen(HTTPS_PORT)
}

httpServer.listen(PORT, () => {
  const printers = detectPrinters()
  console.log(`
╔══════════════════════════════════════════════╗
║        AMASI Print Proxy v1.0               ║
╠══════════════════════════════════════════════╣
║  HTTP:  http://localhost:${String(PORT).padEnd(15)}║
║  HTTPS: https://localhost:${String(HTTPS_PORT).padEnd(13)}║
║  Host: ${os.hostname().padEnd(37)}║
╠══════════════════════════════════════════════╣
║  Detected Printers:                         ║`)
  for (const p of printers) {
    const usb = p.isUsb ? " [USB]" : ""
    console.log(`║  • ${(p.name + usb).padEnd(40)}║`)
  }
  console.log(`╚══════════════════════════════════════════════╝

  The print station will auto-detect this proxy.
  Press Ctrl+C to stop.
  `)
})
