#!/usr/bin/env node
import xlsx from "xlsx"

const file = process.argv[2]
if (!file) {
  console.error("Usage: node scripts/read-delegate-xlsx.mjs <path-to-xlsx>")
  process.exit(1)
}

const wb = xlsx.readFile(file)
for (const sheetName of wb.SheetNames) {
  const sheet = wb.Sheets[sheetName]
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" })
  console.log(`Sheet "${sheetName}" (${rows.length} rows)`)
  console.log("Headers:", Object.keys(rows[0] || {}))
  console.log("First 3 rows:")
  console.log(JSON.stringify(rows.slice(0, 3), null, 2))
  console.log(`\nAll rows (${rows.length}):`)
  for (const row of rows) {
    console.log(JSON.stringify(row))
  }
}
