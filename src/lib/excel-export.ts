/**
 * Excel Export Utility
 *
 * Export data to XLSX format using the xlsx library
 */

/**
 * Export data to Excel file
 *
 * Usage:
 * ```
 * await exportToExcel({
 *   filename: "registrations",
 *   sheets: [{
 *     name: "Registrations",
 *     headers: ["Name", "Email", "Phone"],
 *     rows: [["John", "john@example.com", "123456789"]]
 *   }]
 * })
 * ```
 */
export async function exportToExcel(options: {
  filename: string
  sheets: Array<{
    name: string
    headers: string[]
    rows: (string | number | boolean | null | undefined)[][]
  }>
}): Promise<void> {
  // Dynamically import xlsx to reduce bundle size
  const xlsxModule = await import("xlsx") as any
  // Handle webpack's CJS/ESM interop - check where utils actually lives
  const XLSX = xlsxModule.utils ? xlsxModule : xlsxModule.default

  const workbook = XLSX.utils.book_new()

  for (const sheet of options.sheets) {
    // Create worksheet data with headers
    const wsData = [sheet.headers, ...sheet.rows]

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(wsData)

    // Auto-size columns
    const colWidths = sheet.headers.map((header, colIndex) => {
      const maxLength = Math.max(
        header.length,
        ...sheet.rows.map((row) => {
          const cell = row[colIndex]
          return cell != null ? String(cell).length : 0
        })
      )
      return { wch: Math.min(maxLength + 2, 50) }
    })
    worksheet["!cols"] = colWidths

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31)) // Excel sheet name max 31 chars
  }

  // Generate filename with date
  const date = new Date().toISOString().split("T")[0]
  const filename = `${options.filename}-${date}.xlsx`

  // Download using Blob for better browser compatibility
  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export single sheet to Excel
 */
export async function exportSheetToExcel(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  sheetName: string = "Data"
): Promise<void> {
  return exportToExcel({
    filename,
    sheets: [{ name: sheetName, headers, rows }],
  })
}

/**
 * Convert objects to Excel rows
 */
export function objectsToRows<T extends Record<string, any>>(
  objects: T[],
  columns: Array<{
    key: keyof T
    header: string
    format?: (value: any, row: T) => string | number
  }>
): { headers: string[]; rows: (string | number)[][] } {
  const headers = columns.map((col) => col.header)
  const rows = objects.map((obj) =>
    columns.map((col) => {
      const value = obj[col.key] as any
      if (col.format) {
        return col.format(value, obj)
      }
      if (value == null) return ""
      if (value instanceof Date) {
        return value.toLocaleDateString()
      }
      return String(value)
    })
  )
  return { headers, rows }
}

/**
 * Export registrations to Excel with common formatting
 */
export async function exportRegistrationsToExcel(
  registrations: Array<{
    registration_number: string
    attendee_name: string
    attendee_email: string
    attendee_phone?: string | null
    attendee_institution?: string | null
    attendee_designation?: string | null
    status: string
    ticket_type?: { name: string } | null
    total_amount?: number
    created_at: string
  }>,
  eventName: string
): Promise<void> {
  const { headers, rows } = objectsToRows(registrations, [
    { key: "registration_number", header: "Reg. Number" },
    { key: "attendee_name", header: "Name" },
    { key: "attendee_email", header: "Email" },
    { key: "attendee_phone", header: "Phone", format: (v) => v || "" },
    { key: "attendee_institution", header: "Institution", format: (v) => v || "" },
    { key: "attendee_designation", header: "Designation", format: (v) => v || "" },
    { key: "ticket_type", header: "Ticket Type", format: (v) => v?.name || "" },
    { key: "status", header: "Status" },
    { key: "total_amount", header: "Amount", format: (v) => v || 0 },
    {
      key: "created_at",
      header: "Registered On",
      format: (v) => new Date(v).toLocaleDateString("en-IN"),
    },
  ])

  await exportToExcel({
    filename: `${eventName.replace(/\s+/g, "-").toLowerCase()}-registrations`,
    sheets: [{ name: "Registrations", headers, rows }],
  })
}

/**
 * Export check-in report to Excel
 */
export async function exportCheckinReportToExcel(
  records: Array<{
    registration_number: string
    attendee_name: string
    attendee_email: string
    ticket_type?: string
    checked_in: boolean
    checked_in_at?: string | null
    list_name?: string
  }>,
  eventName: string,
  listName: string
): Promise<void> {
  const { headers, rows } = objectsToRows(records, [
    { key: "registration_number", header: "Reg. Number" },
    { key: "attendee_name", header: "Name" },
    { key: "attendee_email", header: "Email" },
    { key: "ticket_type", header: "Ticket Type", format: (v) => v || "" },
    { key: "checked_in", header: "Checked In", format: (v) => (v ? "Yes" : "No") },
    {
      key: "checked_in_at",
      header: "Check-in Time",
      format: (v) => (v ? new Date(v).toLocaleString("en-IN") : ""),
    },
  ])

  await exportToExcel({
    filename: `${eventName.replace(/\s+/g, "-").toLowerCase()}-checkin-${listName.replace(/\s+/g, "-").toLowerCase()}`,
    sheets: [{ name: listName.slice(0, 31), headers, rows }],
  })
}
