// Badge-template HTML/CSS rendering, extracted verbatim from
// src/app/print/[token]/page.tsx (the standalone Print Station device page)
// so the kiosk "Check-in + Print Badge" mode (Stage 4) can render the exact
// same badge layout without duplicating this logic. Renders template_data
// (an ordered list of positioned text/shape/image/photo/line/qr_code/
// barcode elements) to an HTML string; the caller rasterizes it (e.g. via
// html2canvas) and sends the result to a printer -- this module has no
// printer-specific code and no network calls of its own.

// Shared by every html2canvas capture site (KioskCheckinScreen.tsx,
// print/[token]/page.tsx x2) in place of a fixed setTimeout guess before
// capturing the rendered badge. Live hardware test (2026-08): the exact
// same delegate, reprinted multiple times with zero content/code/cache
// differences, alternated between a correctly-sized print and one ~1.5x
// too long -- true non-determinism, not a stale cache (confirmed: full
// "Clear site data" before every attempt). A fixed timeout is a guess at
// "has layout settled yet", not a real signal, and a loaded Android tablet
// can plausibly take longer than that guess on some runs. document.fonts.ready
// waits for actual font loading to finish; the double rAF that follows
// guarantees at least one full layout+paint cycle has completed afterward.
export async function waitForRenderReady(): Promise<void> {
  try {
    if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
      await document.fonts.ready
    }
  } catch {
    // Not fatal -- proceed with whatever's rendered so far.
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

// Replace placeholders in text with registration data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function replacePlaceholders(text: string, reg: any, eventName: string): string {
  if (!text) return ""
  let result = text
  result = result.replace(/\{\{name\}\}/g, reg?.attendee_name || "")
  result = result.replace(/\{\{registration_number\}\}/g, reg?.registration_number || "")
  result = result.replace(/\{\{ticket_type\}\}/g, reg?.ticket_type || reg?.ticket_types?.name || "")
  result = result.replace(/\{\{email\}\}/g, reg?.attendee_email || "")
  result = result.replace(/\{\{phone\}\}/g, reg?.attendee_phone || "")
  result = result.replace(/\{\{institution\}\}/g, reg?.attendee_institution || "")
  result = result.replace(/\{\{designation\}\}/g, reg?.attendee_designation || "")
  result = result.replace(/\{\{event_name\}\}/g, eventName || "")
  result = result.replace(/\{\{event_date\}\}/g, "")
  return result
}

// Render a single badge element to HTML
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function renderElementToHtml(element: any, registration: any, eventName: string): string {
  const content = replacePlaceholders(element.content || "", registration, eventName)
  const rotation = element.rotation || 0
  const opacity = (element.opacity ?? 100) / 100

  const baseStyle = `
    position: absolute;
    left: ${element.x}px;
    top: ${element.y}px;
    width: ${element.width}px;
    height: ${element.height}px;
    z-index: ${element.zIndex || 0};
    opacity: ${opacity};
    ${rotation ? `transform: rotate(${rotation}deg); transform-origin: center center;` : ""}
  `

  if (element.type === "shape") {
    const gradientBg = element.gradient?.enabled && element.gradient.colors.length >= 2
      ? element.gradient.type === "radial"
        ? `radial-gradient(circle, ${element.gradient.colors.join(", ")})`
        : `linear-gradient(${element.gradient.angle || 0}deg, ${element.gradient.colors.join(", ")})`
      : null

    const bgStyle = gradientBg ? `background-image: ${gradientBg};` : `background-color: ${element.backgroundColor || "#e5e7eb"};`
    const borderStyle = element.borderWidth ? `border: ${element.borderWidth}px solid ${element.borderColor || "transparent"};` : ""
    const radiusStyle = element.shapeType === "circle" ? "border-radius: 50%;" : `border-radius: ${element.borderRadius || 0}px;`

    if (element.shapeType === "triangle") {
      return `<div style="${baseStyle}">
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
          <polygon points="50,0 100,100 0,100" fill="${element.backgroundColor || "#e5e7eb"}" />
        </svg>
      </div>`
    }

    return `<div style="${baseStyle} ${bgStyle} ${borderStyle} ${radiusStyle}"></div>`
  }

  if (element.type === "image") {
    if (element.imageUrl) {
      return `<div style="${baseStyle}">
        <img src="${element.imageUrl}" style="width: 100%; height: 100%; object-fit: contain;" />
      </div>`
    }
    return ""
  }

  if (element.type === "photo") {
    if (element.imageUrl) {
      return `<div style="${baseStyle}">
        <img src="${element.imageUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: ${element.borderRadius || 0}px; border: ${element.borderWidth || 0}px solid ${element.borderColor || "transparent"};" />
      </div>`
    }
    return ""
  }

  if (element.type === "line") {
    return `<div style="${baseStyle} display: flex; align-items: center;">
      <div style="width: 100%; height: ${Math.max(1, element.height)}px; background-color: ${element.color || "#000000"};"></div>
    </div>`
  }

  if (element.type === "qr_code") {
    const qrValue = replacePlaceholders(element.content || "", registration, eventName)
    const qrSize = Math.min(element.width, element.height)
    // Use pre-generated data URL if available, fallback to external API
    // _qrDataUrl is generated locally in triggerPrint() before this runs.
    // No external fallback — never ship the verify URL / token to a third-party
    // QR service. If generation somehow failed, show a placeholder (rescan).
    const qrDataUrl = element._qrDataUrl
    const inner = qrDataUrl
      ? `<img src="${qrDataUrl}" style="width: ${qrSize}px; height: ${qrSize}px;" />`
      : `<div style="width: ${qrSize}px; height: ${qrSize}px; display: flex; align-items: center; justify-content: center; border: 1px dashed #999; font-size: 10px; color: #999; text-align: center;">QR unavailable&mdash;rescan</div>`
    return `<div style="${baseStyle} display: flex; align-items: center; justify-content: center;">
      ${inner}
    </div>`
  }

  if (element.type === "barcode") {
    // For barcodes, we'll show a placeholder - actual barcode rendering would need jsbarcode
    return `<div style="${baseStyle} display: flex; align-items: center; justify-content: center; font-family: monospace; font-size: 12px;">
      ${content}
    </div>`
  }

  // Text element
  const shadowStyle = element.shadowEnabled
    ? `text-shadow: ${element.shadowOffsetX || 2}px ${element.shadowOffsetY || 2}px ${element.shadowBlur || 4}px ${element.shadowColor || "rgba(0,0,0,0.3)"};`
    : ""

  // Shared text styling used by every layout mode below (singleLine, lineClamp, default).
  const textStyle = `
    font-size: ${element.fontSize || 14}px;
    font-family: ${element.fontFamily || "Arial, sans-serif"};
    font-weight: ${element.fontWeight || "normal"};
    font-style: ${element.fontStyle || "normal"};
    color: ${element.color || "#000000"};
    text-align: ${element.align || "left"};
    background-color: ${element.backgroundColor || "transparent"};
    letter-spacing: ${element.letterSpacing ? `${element.letterSpacing}px` : "normal"};
    ${shadowStyle}
    border: ${element.borderWidth || 0}px solid ${element.borderColor || "transparent"};
    border-radius: ${element.borderRadius || 0}px;
  `

  // singleLine: truncate to one line with an ellipsis instead of wrapping.
  // Used by narrow labels (e.g. Brother QL 62mm badges) where a long value
  // must not push other elements off the printable area.
  if (element.singleLine) {
    return `<div style="
      ${baseStyle}
      display: block;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      line-height: ${element.height}px;
      ${textStyle}
    ">${content}</div>`
  }

  // lineClamp: wrap normally but cut off after N lines with an ellipsis.
  const lineClampStyle = element.lineClamp
    ? `display: -webkit-box; -webkit-line-clamp: ${element.lineClamp}; -webkit-box-orient: vertical;`
    : "display: flex; align-items: center;"

  return `<div style="
    ${baseStyle}
    ${lineClampStyle}
    overflow: hidden;
    white-space: ${element.lineClamp ? "normal" : "pre-wrap"};
    justify-content: ${element.align === "center" ? "center" : element.align === "right" ? "flex-end" : "flex-start"};
    line-height: ${element.lineHeight || 1.3};
    ${textStyle}
  ">${content}</div>`
}

export function getPaperDimensions(paperSize: string, orientation: string): { width: string; height: string } {
  const sizes: Record<string, { width: string; height: string }> = {
    "4x2": { width: "4in", height: "2in" },
    "4x3": { width: "4in", height: "3in" },
    "4x6": { width: "4in", height: "6in" },
    "62x86": { width: "62mm", height: "86mm" },
    "a6": { width: "105mm", height: "148mm" },
    "a5": { width: "148mm", height: "210mm" }
  }

  const size = sizes[paperSize] || sizes["4x6"]

  if (orientation === "landscape") {
    return { width: size.height, height: size.width }
  }

  return size
}

// Shared with every html2canvas call site (KioskCheckinScreen.tsx,
// print/[token]/page.tsx x2) so the rotation setting actually takes effect
// on canvas-rasterized (WebUSB/USB thermal) prints, not just on the
// window.print() "Browser print" path. Those call sites strip printContent's
// <head> (and the rotation CSS transform that lives there, applied to
// .badge-container) before handing the remaining <body> to html2canvas, and
// rebuild a minimal scoped <style> of their own -- which never re-applied
// this, so print_settings.rotation had zero effect on any canvas-based
// print, ever, regardless of what an admin set it to. Exporting the same
// computation used below lets each call site put the transform back.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getBadgeRotationDegrees(settings: any, printMode: string): number {
  const isOverlayMode = printMode === "overlay"
  // Overlay mode: NO rotation (pre-printed stock orientation is fixed)
  // Full badge/label: 180° rotation for thermal printers (labels feed bottom-first)
  return (settings || {}).rotation ?? (isOverlayMode ? 0 : 180)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generatePrintContent(data: {
  registration: any
  printSettings: any
  printMode: string
  badgeTemplate: any
  eventName: string
  // Skip the injected Google Fonts <link> -- Path B (window.print() via a
  // hidden iframe) loads it live at print time, a real network call. The
  // kiosk's local-first requirement (work order §0.6) means the kiosk's own
  // call site passes true; other callers (e.g. the always-online Print
  // Station page) are unaffected and keep the correct custom-font
  // rendering.
  offline?: boolean
}): string {
  const { registration, printSettings, printMode, badgeTemplate, eventName, offline = false } = data
  const settings = printSettings || {}
  const dimensions = getPaperDimensions(settings.paper_size, settings.orientation)
  const isOverlayMode = printMode === "overlay"
  const rotation = getBadgeRotationDegrees(settings, printMode)

  // If we have a badge template, render it
  if (badgeTemplate?.template_data) {
    const templateData = badgeTemplate.template_data
    let elements = templateData.elements || []
    // For overlay mode: transparent background, skip background images (keep only variable data)
    const bgColor = isOverlayMode ? "transparent" : (templateData.backgroundColor || "#ffffff")

    if (isOverlayMode) {
      // Overlay mode: Only print variable data on pre-printed stock
      // Skip images, shapes, lines - all design elements are pre-printed
      // Keep ONLY: text, QR codes, barcodes (variable content)
      elements = elements.filter((el: any) => {
        // Keep only variable content elements
        if (el.type === "text" || el.type === "qr_code" || el.type === "barcode") {
          return true
        }
        // Skip everything else: image, photo, shape, line
        return false
      })
    }

    // Get Google Fonts used in the template
    const googleFonts = new Set<string>()
    elements.forEach((el: any) => {
      if (el.fontFamily && el.fontFamily.includes("'")) {
        const fontName = el.fontFamily.match(/'([^']+)'/)?.[1]
        if (fontName) googleFonts.add(fontName.replace(/ /g, "+"))
      }
    })
    const googleFontsLink = googleFonts.size > 0 && !offline
      ? `<link href="https://fonts.googleapis.com/css2?${Array.from(googleFonts).map(f => `family=${f}:wght@400;500;600;700`).join("&")}&display=swap" rel="stylesheet" />`
      : ""

    // Sort elements by zIndex
    const sortedElements = [...elements].sort((a: any, b: any) => (a.zIndex || 0) - (b.zIndex || 0))
    const elementsHtml = sortedElements.map((el: any) => renderElementToHtml(el, registration, eventName)).join("\n")

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Badge - ${registration.attendee_name}</title>
        ${googleFontsLink}
        <style>
          @page {
            size: ${dimensions.width} ${dimensions.height};
            margin: 0;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: ${dimensions.width};
            height: ${dimensions.height};
            overflow: hidden;
          }
          .badge-wrapper {
            width: ${dimensions.width};
            height: ${dimensions.height};
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .badge-container {
            position: relative;
            width: ${dimensions.width};
            height: ${dimensions.height};
            background-color: ${bgColor};
            overflow: hidden;
            ${rotation ? `transform: rotate(${rotation}deg); transform-origin: center center;` : ""}
          }
          @media print {
            html, body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            * {
              -webkit-font-smoothing: none !important;
              text-rendering: geometricPrecision !important;
            }
            .badge-wrapper {
              page-break-after: always;
            }
          }
        </style>
      </head>
      <body>
        <div class="badge-wrapper">
          <div class="badge-container">
            ${elementsHtml}
          </div>
        </div>
      </body>
      </html>
    `
  }

  // Fallback: Simple default layout if no template
  const isLabel = printMode === "label"
  const ticketTypeName = registration.ticket_type || registration.ticket_types?.name || "Attendee"

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Badge - ${registration.attendee_name}</title>
      <style>
        @page { size: ${dimensions.width} ${dimensions.height}; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: ${dimensions.width}; height: ${dimensions.height}; font-family: Arial, sans-serif; background: white; overflow: hidden; }
        .badge-wrapper { width: ${dimensions.width}; height: ${dimensions.height}; display: flex; align-items: center; justify-content: center; }
        .badge { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: ${isLabel ? "5mm" : "10mm"}; text-align: center; background: white; ${rotation ? `transform: rotate(${rotation}deg); transform-origin: center center;` : ""} }
        .event-name { font-size: ${isLabel ? "10pt" : "14pt"}; font-weight: bold; color: #333; margin-bottom: ${isLabel ? "3mm" : "8mm"}; text-transform: uppercase; }
        .attendee-name { font-size: ${isLabel ? "16pt" : "28pt"}; font-weight: bold; color: #000; margin-bottom: ${isLabel ? "2mm" : "5mm"}; }
        .designation { font-size: ${isLabel ? "11pt" : "16pt"}; color: #444; margin-bottom: 2mm; }
        .institution { font-size: ${isLabel ? "10pt" : "14pt"}; color: #666; margin-bottom: ${isLabel ? "3mm" : "6mm"}; }
        .ticket-type { font-size: ${isLabel ? "11pt" : "16pt"}; font-weight: bold; color: white; background: #333; padding: 2mm 6mm; border-radius: 2mm; margin-bottom: 3mm; }
        .reg-number { font-size: ${isLabel ? "9pt" : "11pt"}; color: #888; font-family: monospace; }
        @media print { html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .badge-wrapper { page-break-after: always; } }
      </style>
    </head>
    <body>
      <div class="badge-wrapper">
        <div class="badge">
          <div class="event-name">${eventName || "Event"}</div>
          <div class="attendee-name">${registration.attendee_name}</div>
          ${registration.attendee_designation ? `<div class="designation">${registration.attendee_designation}</div>` : ""}
          ${registration.attendee_institution ? `<div class="institution">${registration.attendee_institution}</div>` : ""}
          <div class="ticket-type">${ticketTypeName}</div>
          <div class="reg-number">${registration.registration_number}</div>
        </div>
      </div>
    </body>
    </html>
  `
}
