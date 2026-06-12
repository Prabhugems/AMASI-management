// scripts/phase-a-wizard-e2e.mjs
//
// Drives the public abstract-submission wizard end-to-end through Playwright,
// uploads a tiny generated PDF, submits, and prints the abstract number.
// Used to close Phase A — proves the wizard → upload → submit chain works
// against the live AMASI Supabase without manual clicking.
//
// Run with the dev server already on http://localhost:3000:
//   node scripts/phase-a-wizard-e2e.mjs                # default Free
//   node scripts/phase-a-wizard-e2e.mjs --best         # second run, Best
//   node scripts/phase-a-wizard-e2e.mjs --headed       # show the browser
//
// Defaults are scoped to AMASICON 2026 (event_id below) which has no
// registration gate and an open submission window.

import { chromium } from "playwright"
import { writeFileSync, mkdtempSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const EVENT_ID = "35181950-057f-4ccb-aaee-9266b9b9b873"
const BASE_URL = process.env.BASE_URL || "http://localhost:3000"
const args = process.argv.slice(2)
const headed = args.includes("--headed")
const wantBest = args.includes("--best")
// Young Scholar Award path: exercise the conditional eligibility section
// (DOB + position) added for AMASICON 2026's Young Scholar category.
const wantYoungScholar = args.includes("--young-scholar")

// Stamp the run so a re-run picks a distinct email and avoids draft restore.
const stamp = Date.now()
const RUN = {
  name: wantBest ? "Phase A Best Test" : "Phase A Free Test",
  email: `phase-a-${wantBest ? "best" : "free"}-${stamp}@example.test`,
  phone: "+91-9000000000",
  affiliation: "Phase A Verification, AMASI",
  title: `Phase A wizard e2e (${wantBest ? "Best" : "Free"}) ${stamp}`,
  abstract: [
    "Introduction. This is an automated submission produced by the Phase A end-to-end script.",
    "Methods. Playwright drives the wizard; a minimal PDF is uploaded to the private bucket.",
    "Results. The submit handler should write file_path, award_type, and return an abstract number.",
    "Conclusion. If you are reading this in the abstracts table, the chain works.",
  ].join(" "),
  keywords: ["phasea", "wizard", "verification"],
  presentationType: "paper",
  competitionType: wantBest ? "best" : "free",
}

// Build a minimal but valid 1-page PDF (~250 bytes) at a temp path.
function writeMinimalPdf() {
  const dir = mkdtempSync(path.join(tmpdir(), "phase-a-pdf-"))
  const filePath = path.join(dir, `phase-a-${stamp}.pdf`)
  const pdf = Buffer.from(
    "%PDF-1.4\n" +
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n" +
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n" +
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n" +
    "4 0 obj << /Length 44 >> stream\nBT /F1 18 Tf 72 720 Td (Phase A e2e) Tj ET\nendstream endobj\n" +
    "xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000100 00000 n \n0000000181 00000 n \n" +
    "trailer << /Size 5 /Root 1 0 R >>\nstartxref\n279\n%%EOF\n",
    "latin1"
  )
  writeFileSync(filePath, pdf)
  return filePath
}

async function main() {
  const pdfPath = writeMinimalPdf()
  console.log(`[setup] wrote ${pdfPath} (${statSync(pdfPath).size} bytes)`)

  const browser = await chromium.launch({ headless: !headed })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  page.on("pageerror", (e) => console.error("[pageerror]", e.message))
  page.on("console", (m) => {
    if (m.type() === "error") console.error("[console.error]", m.text())
  })

  const url = `${BASE_URL}/submit-abstract/${EVENT_ID}`
  console.log(`[step] open ${url}`)
  await page.goto(url, { waitUntil: "networkidle" })

  // ── Step 1: Author ────────────────────────────────────────────
  console.log("[step 1] Author")
  await page.getByLabel(/Full Name/i).fill(RUN.name)
  await page.getByLabel(/Email/i).first().fill(RUN.email)
  // Phone + affiliation are optional but populate for completeness.
  const phoneInput = page.getByLabel(/Phone/i).first()
  if (await phoneInput.count()) await phoneInput.fill(RUN.phone)
  const affInput = page.getByLabel(/Affiliation/i).first()
  if (await affInput.count()) await affInput.fill(RUN.affiliation)
  await clickNext(page)

  // ── Step 2: Abstract content ──────────────────────────────────
  console.log("[step 2] Abstract")
  await page.getByLabel(/Title/i).first().fill(RUN.title)
  // The textarea has no <label for=>, target by placeholder/role
  const textarea = page.locator("textarea").first()
  await textarea.fill(RUN.abstract)
  // Keywords: add 3 via the keyword input + Enter
  for (const k of RUN.keywords) {
    const kwInput = page.getByPlaceholder(/keyword/i).first()
    await kwInput.fill(k)
    await kwInput.press("Enter")
  }
  await clickNext(page)

  // ── Step 3: Co-Authors (optional) ─────────────────────────────
  console.log("[step 3] Co-Authors (skip)")
  await clickNext(page)

  // ── Step 4: Speciality + Category + Competition ───────────────
  console.log("[step 4] Speciality / Category / Competition")
  if (wantYoungScholar) {
    await page.getByText("Young Scholar Award", { exact: true }).first().click()
  } else {
    const firstSpeciality = page.locator('[role="radio"]').first()
    await firstSpeciality.waitFor({ state: "visible", timeout: 10_000 })
    await firstSpeciality.click()
  }
  // Presentation type: paper
  await page.getByText("Paper", { exact: true }).first().click()
  // Competition type — target the RadioGroupItem by id so we don't confuse
  // with speciality names like "Best Paper" / "Free Paper" rendered above.
  await page.locator(`#${RUN.competitionType}`).first().click()

  // Conditional eligibility (Young Scholar Award rules: DOB + position)
  if (wantYoungScholar) {
    console.log("[step 4] eligibility fields")
    const dob = new Date(Date.now() - 25 * 365.25 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10)
    await page.locator("#submitter-dob").fill(dob)
    await page.locator("#submitter-position").click()
    await page.getByRole("option", { name: "PG Resident" }).click()
  }
  await clickNext(page)

  // ── Step 5: Upload ────────────────────────────────────────────
  console.log("[step 5] Upload PDF")
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(pdfPath)
  // Wait for the "File uploaded" toast OR the success card with file name
  await page.waitForSelector(`text=${path.basename(pdfPath)}`, { timeout: 15_000 })
  console.log("[step 5] file accepted by wizard")
  await clickNext(page)

  // ── Step 6: Declarations + Submit ─────────────────────────────
  console.log("[step 6] Declarations + Submit")
  // Tick all checkboxes on the page
  const boxes = page.locator('[role="checkbox"]')
  const n = await boxes.count()
  for (let i = 0; i < n; i++) {
    const box = boxes.nth(i)
    if ((await box.getAttribute("aria-checked")) !== "true") await box.click()
  }
  await page.getByRole("button", { name: /submit/i }).last().click()

  // ── Success: capture abstract number ──────────────────────────
  console.log("[wait] success page")
  await page.waitForSelector("text=Abstract Submitted Successfully", { timeout: 30_000 })
  const numberEl = await page.locator("p.font-mono.font-bold").first()
  const abstractNumber = (await numberEl.textContent())?.trim()
  console.log("─".repeat(60))
  console.log(`ABSTRACT_NUMBER=${abstractNumber}`)
  console.log(`EMAIL=${RUN.email}`)
  console.log("─".repeat(60))

  await browser.close()
  return abstractNumber
}

async function clickNext(page) {
  await page.getByRole("button", { name: /next/i }).first().click()
}

main().catch((e) => {
  console.error("[fatal]", e)
  process.exit(1)
})
