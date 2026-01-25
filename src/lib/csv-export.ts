/**
 * CSV Export Utility
 *
 * Export data to CSV format
 */

/**
 * Escape CSV value
 */
function escapeCSV(value: any): string {
  if (value == null) return ""

  const str = String(value)

  // If contains comma, newline, or quote, wrap in quotes
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

/**
 * Convert data to CSV string
 *
 * Usage:
 * ```
 * const csv = toCSV(
 *   ["Name", "Email", "Phone"],
 *   [
 *     ["John", "john@example.com", "123456"],
 *     ["Jane", "jane@example.com", "789012"]
 *   ]
 * )
 * ```
 */
export function toCSV(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const headerLine = headers.map(escapeCSV).join(",")
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","))

  return [headerLine, ...dataLines].join("\n")
}

/**
 * Download data as CSV file
 */
export function downloadCSV(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  filename: string
): void {
  const csv = toCSV(headers, rows)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Convert objects to CSV and download
 *
 * Usage:
 * ```
 * exportToCSV(
 *   users,
 *   [
 *     { key: "name", header: "Name" },
 *     { key: "email", header: "Email" },
 *     { key: "createdAt", header: "Joined", format: (v) => new Date(v).toLocaleDateString() }
 *   ],
 *   "users"
 * )
 * ```
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: Array<{
    key: keyof T
    header: string
    format?: (value: any, row: T) => string | number
  }>,
  filename: string
): void {
  const headers = columns.map((col) => col.header)
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key]
      if (col.format) {
        return col.format(value, row)
      }
      if (value !== null && typeof value === "object" && (value as object) instanceof Date) {
        return (value as Date).toISOString()
      }
      return value ?? ""
    })
  )

  downloadCSV(headers, rows, filename)
}

/**
 * Parse CSV string to array
 */
export function parseCSV(csv: string): string[][] {
  const lines = csv.split("\n")
  const result: string[][] = []

  for (const line of lines) {
    if (!line.trim()) continue

    const row: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === "," && !inQuotes) {
        row.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }

    row.push(current.trim())
    result.push(row)
  }

  return result
}

/**
 * Parse CSV with headers to objects
 */
export function parseCSVToObjects<T extends Record<string, string>>(
  csv: string
): T[] {
  const rows = parseCSV(csv)
  if (rows.length < 2) return []

  const headers = rows[0]
  const data = rows.slice(1)

  return data.map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? ""
    })
    return obj as T
  })
}

/**
 * Export registrations to CSV
 */
export function exportRegistrationsCSV(
  registrations: Array<{
    registration_number: string
    attendee_name: string
    attendee_email: string
    attendee_phone?: string | null
    attendee_institution?: string | null
    status: string
    total_amount?: number
    created_at: string
  }>,
  eventName: string
): void {
  exportToCSV(
    registrations,
    [
      { key: "registration_number", header: "Reg. Number" },
      { key: "attendee_name", header: "Name" },
      { key: "attendee_email", header: "Email" },
      { key: "attendee_phone", header: "Phone", format: (v) => v || "" },
      { key: "attendee_institution", header: "Institution", format: (v) => v || "" },
      { key: "status", header: "Status" },
      { key: "total_amount", header: "Amount", format: (v) => v || 0 },
      {
        key: "created_at",
        header: "Registered On",
        format: (v) => new Date(v).toLocaleDateString("en-IN"),
      },
    ],
    `${eventName.replace(/\s+/g, "-").toLowerCase()}-registrations`
  )
}

/**
 * Export emails to CSV (for email clients)
 */
export function exportEmailsCSV(
  emails: Array<{ email: string; name?: string }>,
  filename: string = "emails"
): void {
  const headers = ["Email", "Name"]
  const rows = emails.map((e) => [e.email, e.name || ""])
  downloadCSV(headers, rows, filename)
}

/**
 * Create CSV from table element
 */
export function tableToCSV(table: HTMLTableElement): string {
  const rows: string[][] = []

  // Headers
  const headerRow = table.querySelector("thead tr")
  if (headerRow) {
    const headers: string[] = []
    headerRow.querySelectorAll("th").forEach((th) => {
      headers.push(th.textContent?.trim() || "")
    })
    rows.push(headers)
  }

  // Body
  table.querySelectorAll("tbody tr").forEach((tr) => {
    const row: string[] = []
    tr.querySelectorAll("td").forEach((td) => {
      row.push(td.textContent?.trim() || "")
    })
    rows.push(row)
  })

  return toCSV(rows[0] || [], rows.slice(1))
}

/**
 * Download table as CSV
 */
export function downloadTableAsCSV(
  table: HTMLTableElement,
  filename: string
): void {
  const csv = tableToCSV(table)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
