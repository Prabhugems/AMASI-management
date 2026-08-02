// Path B (Badge Printing Admin Configured spec, §2): renders a full HTML
// page and calls the browser's own print(), going through the OS print
// dialog so it works with any printer the device already knows about
// (laser, inkjet, network) instead of raw ESC/POS over WebUSB. Uses a
// hidden iframe rather than window.open -- window.open-based printing is
// blocked on iPad Safari, the exact same reason src/app/print/[token]/page.tsx's
// own browser-print branch already uses this technique.
//
// Async (bug-audit fix, 2026-08): this used to return synchronously,
// BEFORE the deferred print() call had even run, with the actual print()
// wrapped in try/finally and no catch -- so a real failure (a torn-down
// iframe, contentWindow going null, any thrown exception) was silently
// swallowed and never reached the caller, which had already received and
// acted on an earlier `{success: true}`. Now genuinely awaits print()
// being invoked and surfaces any exception. Like every print-confirmation
// path in this codebase (see KioskCheckinScreen's own comment on the USB
// path), "no exception thrown" is not proof a physical badge came out --
// window.print() has no completion signal at all -- it only means the OS
// print dialog was successfully invoked.
export function printHtmlViaBrowser(html: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe")
    // A 0x0 iframe opens the print dialog fine but prints a blank page in
    // Chrome -- @page CSS only controls the OUTPUT paper size, the source
    // iframe still needs a real content box to lay out into. Give it actual
    // dimensions and move it off-screen instead (same off-screen technique
    // already used for printBadge's html2canvas container below).
    iframe.style.position = "absolute"
    iframe.style.left = "-9999px"
    iframe.style.top = "0"
    iframe.style.width = "800px"
    iframe.style.height = "1000px"
    iframe.style.border = "0"
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) {
      document.body.removeChild(iframe)
      resolve({ success: false, error: "Could not prepare the print page." })
      return
    }

    doc.open()
    doc.write(html)
    doc.close()

    // Bug-audit fix (2026-08): the iframe used to be force-removed on a
    // fixed 2-second timer regardless of print-dialog state, diverging from
    // this exact technique's own proven pattern elsewhere in this codebase
    // (a permanently-mounted iframe that's never programmatically removed).
    // On iPad -- the specific platform this hidden-iframe technique exists
    // for -- the native print sheet can easily take longer than 2 seconds
    // to interact with, risking the source document being torn out mid-
    // render. `afterprint` fires once the OS print dialog actually closes
    // (printed or cancelled, per spec); only THEN is it safe to remove the
    // iframe. A generous fallback timeout remains as a safety net in case
    // `afterprint` doesn't fire on some browser/OS combination -- without
    // one, a dialog the volunteer walks away from would leak this iframe
    // forever, and a kiosk prints many badges a day.
    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      if (iframe.parentNode) document.body.removeChild(iframe)
    }

    // Give fonts/images inside the badge a moment to load before printing --
    // mirrors the 400ms wait already used before html2canvas's Path A render.
    setTimeout(() => {
      try {
        iframe.contentWindow?.addEventListener("afterprint", cleanup)
        iframe.contentWindow?.print()
        setTimeout(cleanup, 30000)
        resolve({ success: true })
      } catch (err) {
        cleanup()
        resolve({ success: false, error: err instanceof Error ? err.message : "Print failed." })
      }
    }, 400)
  })
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
