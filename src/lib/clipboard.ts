/**
 * Clipboard Utilities
 *
 * Copy text, tables, and formatted data to clipboard
 */

import { toast } from "sonner"

/**
 * Copy text to clipboard with optional toast notification
 */
export async function copyToClipboard(
  text: string,
  options: {
    showToast?: boolean
    successMessage?: string
    errorMessage?: string
  } = {}
): Promise<boolean> {
  const {
    showToast = true,
    successMessage = "Copied to clipboard",
    errorMessage = "Failed to copy",
  } = options

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement("textarea")
      textArea.value = text
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
    }

    if (showToast) {
      toast.success(successMessage)
    }
    return true
  } catch (err) {
    console.error("Failed to copy:", err)
    if (showToast) {
      toast.error(errorMessage)
    }
    return false
  }
}

/**
 * Copy formatted table data to clipboard (for pasting into Excel/Sheets)
 */
export async function copyTableToClipboard(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  options: { showToast?: boolean } = {}
): Promise<boolean> {
  const { showToast = true } = options

  // Format as TSV (tab-separated values) for Excel compatibility
  const headerRow = headers.join("\t")
  const dataRows = rows.map((row) =>
    row.map((cell) => (cell ?? "").toString().replace(/\t/g, " ")).join("\t")
  )
  const tsv = [headerRow, ...dataRows].join("\n")

  return copyToClipboard(tsv, {
    showToast,
    successMessage: `Copied ${rows.length} rows to clipboard`,
  })
}

/**
 * Copy email addresses (comma-separated)
 */
export async function copyEmails(
  emails: string[],
  options: { showToast?: boolean } = {}
): Promise<boolean> {
  const uniqueEmails = [...new Set(emails.filter(Boolean))]
  return copyToClipboard(uniqueEmails.join(", "), {
    showToast: options.showToast,
    successMessage: `Copied ${uniqueEmails.length} email${uniqueEmails.length !== 1 ? "s" : ""}`,
  })
}

/**
 * Copy phone numbers (comma-separated)
 */
export async function copyPhones(
  phones: string[],
  options: { showToast?: boolean } = {}
): Promise<boolean> {
  const uniquePhones = [...new Set(phones.filter(Boolean))]
  return copyToClipboard(uniquePhones.join(", "), {
    showToast: options.showToast,
    successMessage: `Copied ${uniquePhones.length} phone number${uniquePhones.length !== 1 ? "s" : ""}`,
  })
}

/**
 * Copy a URL with optional title
 */
export async function copyLink(
  url: string,
  title?: string,
  options: { showToast?: boolean } = {}
): Promise<boolean> {
  const text = title ? `${title}\n${url}` : url
  return copyToClipboard(text, {
    showToast: options.showToast,
    successMessage: "Link copied",
  })
}

/**
 * Copy JSON data (formatted)
 */
export async function copyJson(
  data: any,
  options: { showToast?: boolean; pretty?: boolean } = {}
): Promise<boolean> {
  const { pretty = true } = options
  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)
  return copyToClipboard(json, {
    showToast: options.showToast,
    successMessage: "JSON copied",
  })
}
