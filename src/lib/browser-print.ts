// Path B (Badge Printing Admin Configured spec, §2): renders a full HTML
// page and calls the browser's own print(), going through the OS print
// dialog so it works with any printer the device already knows about
// (laser, inkjet, network) instead of raw ESC/POS over WebUSB. Uses a
// hidden iframe rather than window.open -- window.open-based printing is
// blocked on iPad Safari, the exact same reason src/app/print/[token]/page.tsx's
// own browser-print branch already uses this technique.
export function printHtmlViaBrowser(html: string): { success: boolean; error?: string } {
  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "0"
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return { success: false, error: "Could not prepare the print page." }
  }

  doc.open()
  doc.write(html)
  doc.close()

  // Give fonts/images inside the badge a moment to load before printing --
  // mirrors the 400ms wait already used before html2canvas's Path A render.
  setTimeout(() => {
    try {
      iframe.contentWindow?.print()
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe)
      }, 2000)
    }
  }, 400)

  return { success: true }
}

// A minimal, deliberately non-badge test page -- Test Print on a
// printer_type: "browser" station just needs to confirm the OS print
// dialog appears and something physically comes out, not exercise the
// real badge template.
export function buildBrowserTestPageHtml(eventName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<style>
  @page { margin: 0.5in; }
  body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  p { font-size: 16px; color: #444; }
</style>
</head>
<body>
  <h1>TEST PRINT</h1>
  <p>${eventName}</p>
  <p>Browser print — ${new Date().toLocaleString()}</p>
</body>
</html>`
}
