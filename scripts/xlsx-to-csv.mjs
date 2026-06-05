#!/usr/bin/env node
import xlsx from "xlsx"
import fs from "node:fs"
import path from "node:path"

const file = process.argv[2]
const outFile = process.argv[3]
if (!file || !outFile) {
  console.error("Usage: node scripts/xlsx-to-csv.mjs <input.xlsx> <output.csv>")
  process.exit(1)
}

const wb = xlsx.readFile(file)
const sheet = wb.Sheets[wb.SheetNames[0]]
const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" })

// Map source columns (Name, Phone, Email) → import UI columns (name, email, phone)
// Phone is numeric in the source; normalise to a 10-digit string and prepend
// nothing (the existing import path stores raw, the welcome WhatsApp helper
// will add +91 as needed).
function normalisePhone(v) {
  if (v === null || v === undefined || v === "") return ""
  return String(v).replace(/[^0-9]/g, "")
}

const csvRows = [["name", "email", "phone"]]
for (const r of rows) {
  csvRows.push([
    String(r.Name || "").trim(),
    String(r.Email || "").trim().toLowerCase(),
    normalisePhone(r.Phone),
  ])
}

const csv = csvRows
  .map((row) =>
    row
      .map((cell) => {
        const s = String(cell)
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      })
      .join(",")
  )
  .join("\n")

fs.writeFileSync(outFile, csv + "\n", "utf8")
console.log(`Wrote ${csvRows.length - 1} rows to ${outFile}`)
console.log(`Preview:\n${csv.split("\n").slice(0, 4).join("\n")}\n...`)
