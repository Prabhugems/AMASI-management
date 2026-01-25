/**
 * Print Utilities
 *
 * Printing specific elements and layouts
 */

interface PrintOptions {
  title?: string
  styles?: string
  beforePrint?: () => void
  afterPrint?: () => void
  pageSize?: "A4" | "Letter" | "A5" | "Badge"
  orientation?: "portrait" | "landscape"
  margin?: string
}

/**
 * Print a specific element
 *
 * Usage:
 * ```
 * printElement(document.getElementById("badge"), {
 *   title: "Event Badge",
 *   pageSize: "Badge"
 * })
 * ```
 */
export function printElement(
  element: HTMLElement,
  options: PrintOptions = {}
): void {
  const {
    title = document.title,
    styles = "",
    beforePrint,
    afterPrint,
    pageSize = "A4",
    orientation = "portrait",
    margin = "10mm",
  } = options

  // Create print window
  const printWindow = window.open("", "_blank", "width=800,height=600")
  if (!printWindow) {
    console.error("Failed to open print window. Check popup blocker.")
    return
  }

  beforePrint?.()

  // Get page dimensions
  const pageDimensions = getPageDimensions(pageSize)

  // Build print document
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: ${pageDimensions.width} ${pageDimensions.height} ${orientation};
            margin: ${margin};
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 0;
            font-family: system-ui, -apple-system, sans-serif;
          }

          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }

          ${styles}
        </style>
        ${getDocumentStyles()}
      </head>
      <body>
        ${element.outerHTML}
      </body>
    </html>
  `)

  printWindow.document.close()

  // Wait for content to load
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
    printWindow.close()
    afterPrint?.()
  }
}

/**
 * Print multiple elements (one per page)
 */
export function printMultipleElements(
  elements: HTMLElement[],
  options: PrintOptions = {}
): void {
  const container = document.createElement("div")
  container.style.cssText = `
    display: flex;
    flex-direction: column;
  `

  elements.forEach((element, index) => {
    const wrapper = document.createElement("div")
    wrapper.style.cssText = `
      page-break-after: ${index < elements.length - 1 ? "always" : "auto"};
    `
    wrapper.appendChild(element.cloneNode(true))
    container.appendChild(wrapper)
  })

  printElement(container, options)
}

/**
 * Print badge layout
 */
export function printBadge(
  badgeHtml: string,
  options: Omit<PrintOptions, "pageSize"> = {}
): void {
  const container = document.createElement("div")
  container.innerHTML = badgeHtml

  printElement(container, {
    ...options,
    pageSize: "Badge",
    margin: "0",
    styles: `
      .badge-container {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      ${options.styles || ""}
    `,
  })
}

/**
 * Print multiple badges (4 per A4 page)
 */
export function printBadgeSheet(
  badges: string[],
  options: PrintOptions = {}
): void {
  const container = document.createElement("div")
  container.style.cssText = `
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 10mm;
    width: 100%;
    height: 100%;
  `

  badges.forEach((badgeHtml) => {
    const badge = document.createElement("div")
    badge.innerHTML = badgeHtml
    badge.style.cssText = `
      border: 1px dashed #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
    `
    container.appendChild(badge)
  })

  printElement(container, {
    ...options,
    pageSize: "A4",
    orientation: "portrait",
  })
}

/**
 * Print certificate
 */
export function printCertificate(
  certificateHtml: string,
  options: PrintOptions = {}
): void {
  const container = document.createElement("div")
  container.innerHTML = certificateHtml

  printElement(container, {
    ...options,
    pageSize: "A4",
    orientation: "landscape",
    margin: "15mm",
    styles: `
      .certificate {
        width: 100%;
        height: 100%;
        border: 2px solid #333;
        padding: 20mm;
        text-align: center;
      }
      ${options.styles || ""}
    `,
  })
}

/**
 * Print table with headers on each page
 */
export function printTable(
  table: HTMLTableElement,
  options: PrintOptions = {}
): void {
  printElement(table, {
    ...options,
    styles: `
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10pt;
      }

      th, td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }

      th {
        background-color: #f5f5f5;
        font-weight: bold;
      }

      thead {
        display: table-header-group;
      }

      tbody tr:nth-child(even) {
        background-color: #fafafa;
      }

      ${options.styles || ""}
    `,
  })
}

/**
 * Get page dimensions for different sizes
 */
function getPageDimensions(
  size: PrintOptions["pageSize"]
): { width: string; height: string } {
  const sizes = {
    A4: { width: "210mm", height: "297mm" },
    Letter: { width: "8.5in", height: "11in" },
    A5: { width: "148mm", height: "210mm" },
    Badge: { width: "85.6mm", height: "54mm" }, // Credit card size
  }

  return sizes[size || "A4"]
}

/**
 * Get document stylesheets as string
 */
function getDocumentStyles(): string {
  let styles = ""

  // Include linked stylesheets
  for (const sheet of document.styleSheets) {
    try {
      if (sheet.href) {
        styles += `<link rel="stylesheet" href="${sheet.href}">`
      }
    } catch {
      // Cross-origin stylesheet, skip
    }
  }

  return styles
}

/**
 * Trigger browser print dialog for current page
 */
export function printPage(): void {
  window.print()
}

/**
 * Create print-friendly version of current page
 */
export function createPrintView(
  contentSelector: string,
  options: PrintOptions = {}
): void {
  const content = document.querySelector(contentSelector)
  if (!content) {
    console.error(`Element not found: ${contentSelector}`)
    return
  }

  printElement(content as HTMLElement, options)
}

/**
 * Hide elements during print
 */
export function addPrintHideClass(selectors: string[]): void {
  const style = document.createElement("style")
  style.id = "print-hide-styles"
  style.textContent = `
    @media print {
      ${selectors.join(", ")} {
        display: none !important;
      }
    }
  `
  document.head.appendChild(style)
}

/**
 * Remove print hide styles
 */
export function removePrintHideClass(): void {
  const style = document.getElementById("print-hide-styles")
  if (style) {
    style.remove()
  }
}

/**
 * Print preview in modal
 */
export function createPrintPreview(element: HTMLElement): HTMLIFrameElement {
  const iframe = document.createElement("iframe")
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
    background: white;
  `

  iframe.srcdoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            margin: 20px;
            font-family: system-ui, -apple-system, sans-serif;
          }
        </style>
        ${getDocumentStyles()}
      </head>
      <body>
        ${element.outerHTML}
      </body>
    </html>
  `

  return iframe
}
