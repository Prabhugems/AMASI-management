/**
 * Clipboard Utilities
 *
 * Advanced clipboard operations
 */

/**
 * Copy text to clipboard
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }

    // Fallback for non-secure contexts
    return copyTextFallback(text)
  } catch {
    return copyTextFallback(text)
  }
}

/**
 * Fallback copy using textarea
 */
function copyTextFallback(text: string): boolean {
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.style.position = "fixed"
  textarea.style.left = "-9999px"
  textarea.style.top = "-9999px"
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    document.execCommand("copy")
    return true
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

/**
 * Read text from clipboard
 */
export async function readText(): Promise<string | null> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      return await navigator.clipboard.readText()
    }
    return null
  } catch {
    return null
  }
}

/**
 * Copy HTML with plain text fallback
 */
export async function copyHtml(
  html: string,
  plainText?: string
): Promise<boolean> {
  try {
    const text = plainText || htmlToPlainText(html)

    if (navigator.clipboard && window.ClipboardItem) {
      const htmlBlob = new Blob([html], { type: "text/html" })
      const textBlob = new Blob([text], { type: "text/plain" })

      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        }),
      ])
      return true
    }

    // Fallback to plain text
    return copyText(text)
  } catch {
    return copyText(plainText || htmlToPlainText(html))
  }
}

/**
 * Copy image from URL
 */
export async function copyImageFromUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url)
    const blob = await response.blob()

    if (!navigator.clipboard || !window.ClipboardItem) {
      return false
    }

    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob,
      }),
    ])
    return true
  } catch {
    return false
  }
}

/**
 * Copy image from canvas
 */
export async function copyCanvas(canvas: HTMLCanvasElement): Promise<boolean> {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve(false)
        return
      }

      try {
        if (!navigator.clipboard || !window.ClipboardItem) {
          resolve(false)
          return
        }

        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ])
        resolve(true)
      } catch {
        resolve(false)
      }
    }, "image/png")
  })
}

/**
 * Copy table data as TSV (for spreadsheet paste)
 */
export async function copyTableData(
  headers: string[],
  rows: string[][]
): Promise<boolean> {
  const tsv = [headers.join("\t"), ...rows.map((row) => row.join("\t"))].join(
    "\n"
  )
  return copyText(tsv)
}

/**
 * Copy JSON as formatted text
 */
export async function copyJson(data: unknown, indent = 2): Promise<boolean> {
  try {
    const json = JSON.stringify(data, null, indent)
    return copyText(json)
  } catch {
    return false
  }
}

/**
 * Copy URL with optional title
 */
export async function copyUrl(url: string, title?: string): Promise<boolean> {
  if (title) {
    return copyHtml(`<a href="${url}">${title}</a>`, `${title}\n${url}`)
  }
  return copyText(url)
}

/**
 * Copy email address with mailto link
 */
export async function copyEmail(email: string, name?: string): Promise<boolean> {
  const displayName = name || email
  return copyHtml(`<a href="mailto:${email}">${displayName}</a>`, email)
}

/**
 * Convert HTML to plain text
 */
function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html")
  return doc.body.textContent || ""
}

/**
 * Check clipboard permissions
 */
export async function checkClipboardPermission(
  type: "read" | "write" = "write"
): Promise<"granted" | "denied" | "prompt"> {
  try {
    const permissionName = type === "read" ? "clipboard-read" : "clipboard-write"
    const permission = await navigator.permissions.query({
      name: permissionName as PermissionName,
    })
    return permission.state
  } catch {
    // Fallback for browsers that don't support permissions API
    return "prompt"
  }
}

/**
 * Create shareable clipboard content
 */
export function createShareableContent(
  title: string,
  description: string,
  url: string
): { html: string; text: string } {
  const html = `
    <h3>${title}</h3>
    <p>${description}</p>
    <p><a href="${url}">${url}</a></p>
  `.trim()

  const text = `${title}\n\n${description}\n\n${url}`

  return { html, text }
}
