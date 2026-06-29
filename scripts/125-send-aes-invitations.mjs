#!/usr/bin/env node
/**
 * Generate AES-8 style faculty invitation PDFs for the 125th AMASI Skill
 * Course & FMAS Exam (Kolkata, 10-12 July 2026) and send via Resend.
 *
 * Each faculty member receives a personalised PDF listing their commitment
 * table (one row per faculty_assignments record) with the AMASI letterhead,
 * Dr Roshan Shetty's signature, and Coimbatore footer.
 *
 * Default: DRY RUN. Pass --apply to actually send.
 * Pass --only=125F2030,125F2032 to limit to specific reg numbers.
 * Pass --save-pdfs=/tmp/aes_out to also save PDFs to disk.
 * Pass --force to resend to faculty already marked sent.
 */
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

const APPLY = process.argv.includes("--apply")
const FORCE = process.argv.includes("--force")
const ONLY_ARG = process.argv.find(a => a.startsWith("--only="))
const SAVE_ARG = process.argv.find(a => a.startsWith("--save-pdfs="))
const ONLY = ONLY_ARG ? ONLY_ARG.split("=")[1].split(",").map(s => s.trim()) : null
const SAVE_DIR = SAVE_ARG ? SAVE_ARG.split("=")[1] : null

const env = {}
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_API_KEY = env.RESEND_API_KEY
const RESEND_FROM = env.RESEND_FROM_EMAIL || "AMASI Events <noreply@amasi.org>"
const APP_URL = "https://collegeofmas.org.in"

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

const EVENT = {
  id: "cb26bbb1-0ab9-4e2f-a391-dcb5636c47d6",
  name: "125th AMASI Skill Course",
  fullName: "125th AMASI Skill Course and FMAS Exam",
  startDateText: "10 July 2026",
  endDateText: "12 July 2026",
  venue: "IPGMER / SSKM Hospital, Kolkata",
  signerName: "Dr. Roshan Shetty",
  signerTitle: "Secretary, AMASI",
}

const LETTERHEAD = fs.readFileSync(
  "/Users/prabhubalasubramaniam/amasi-faculty-management/public/amasi/letterhead.png"
).toString("base64")
const SIGNATURE = fs.readFileSync(
  "/Users/prabhubalasubramaniam/amasi-faculty-management/public/amasi/signature-roshan-shetty-flat.png"
).toString("base64")

if (SAVE_DIR) fs.mkdirSync(SAVE_DIR, { recursive: true })

// ── Fetch faculty + their assignments ─────────────────────────────────────
const { data: assignments, error } = await supabase
  .from("faculty_assignments")
  .select("id, faculty_name, faculty_email, faculty_phone, role, session_name, topic_title, session_date, start_time, end_time, hall, status, registration_id")
  .eq("event_id", EVENT.id)
  .order("faculty_name", { ascending: true })
  .order("session_date", { ascending: true })
  .order("start_time", { ascending: true })
if (error) { console.error("Fetch assignments failed:", error); process.exit(1) }

// Group by faculty_email
const byFaculty = new Map()
for (const a of assignments) {
  if (!a.faculty_email) continue
  const key = a.faculty_email.toLowerCase()
  if (!byFaculty.has(key)) byFaculty.set(key, { name: a.faculty_name, email: a.faculty_email, phone: a.faculty_phone, rows: [] })
  byFaculty.get(key).rows.push(a)
}

// Pull registrations to read/write custom_fields for send-tracking + portal token
const facultyEmails = Array.from(byFaculty.keys())
const { data: regs } = await supabase
  .from("registrations")
  .select("id, attendee_email, registration_number, attendee_phone, custom_fields")
  .eq("event_id", EVENT.id)
  .ilike("attendee_email", "%@%")
const regByEmail = new Map()
for (const r of regs || []) {
  if (r.registration_number?.startsWith("125F")) {
    regByEmail.set(r.attendee_email.toLowerCase(), r)
  }
}

// ── Build target list ─────────────────────────────────────────────────────
const targets = []
for (const [email, f] of byFaculty) {
  if (email.includes("@amasi.local") || email.includes("@placeholder.")) continue
  const reg = regByEmail.get(email)
  if (!reg) continue
  if (ONLY && !ONLY.includes(reg.registration_number)) continue
  if (!FORCE && reg.custom_fields?.aes_invite_sent_at) continue
  targets.push({ ...f, reg })
}

console.log(`\nMode: ${APPLY ? "APPLY (will send)" : "DRY RUN"}${FORCE ? " (force resend)" : ""}`)
console.log(`Faculty with sendable email: ${byFaculty.size}`)
console.log(`Targets after filters: ${targets.length}`)
if (SAVE_DIR) console.log(`Saving PDFs to: ${SAVE_DIR}`)
console.log()
for (const t of targets) {
  console.log(`  -> ${t.reg.registration_number}  ${t.name}  <${t.email}>  ${t.rows.length} session(s)`)
}

// ── PDF builder ───────────────────────────────────────────────────────────
function buildPdf(faculty) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // Background letterhead - covers full A4
  doc.addImage(`data:image/png;base64,${LETTERHEAD}`, "PNG", 0, 0, pageW, pageH, undefined, "FAST")

  const margin = 20
  let y = 50  // start below blue header band

  // Greeting
  doc.setTextColor(15, 23, 42)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.text(`Dear Dr. ${faculty.name},`, margin, y)
  y += 7

  // Intro paragraph
  const intro = `I trust this message finds you in good health. We are delighted to extend an invitation for you to share your expertise at the ${EVENT.name}, scheduled from ${EVENT.startDateText} - ${EVENT.endDateText}, at ${EVENT.venue}. Your valuable insights will undoubtedly enrich the experience for participants, marking a significant milestone in our journey. We look forward to your presence at this momentous occasion.`
  doc.setFontSize(10.5)
  const lines = doc.splitTextToSize(intro, pageW - 2 * margin)
  doc.text(lines, margin, y, { lineHeightFactor: 1.45 })
  y += lines.length * 5.2 + 4

  doc.text("Hereby your Commitment for the course is follows", margin, y)
  y += 6

  // Commitment table
  const rows = faculty.rows.map((r, i) => {
    const sno = i + 1
    const dateStr = r.session_date ? new Date(r.session_date + "T00:00:00").toLocaleDateString("en-GB") : "-"
    const startStr = r.start_time ? r.start_time.slice(0, 5) : "-"
    const endStr = r.end_time ? r.end_time.slice(0, 5) : "-"
    let duration = "-"
    if (r.start_time && r.end_time) {
      const [sh, sm] = r.start_time.split(":").map(Number)
      const [eh, em] = r.end_time.split(":").map(Number)
      duration = String((eh * 60 + em) - (sh * 60 + sm))
    }
    const sessionLabel = r.hall || (r.role === "chairperson" ? "Chairperson" : "Session")
    const topic = r.topic_title || r.session_name || "-"
    return [String(sno), sessionLabel, `${dateStr}\n${startStr}`, `${dateStr}\n${endStr}`, duration, topic]
  })

  autoTable(doc, {
    startY: y,
    head: [["S.No", "Session", "Starting Time", "Ending Time", "Duration\n(Minutes)", "Topic"]],
    body: rows,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
      lineColor: [180, 180, 180],
      lineWidth: 0.15,
      textColor: [30, 30, 30],
      valign: "middle",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [20, 20, 20],
      fontStyle: "bold",
      halign: "center",
      lineColor: [120, 120, 120],
      lineWidth: 0.25,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { halign: "center", cellWidth: 28, fillColor: [205, 232, 196] }, // light green badge
      2: { halign: "center", cellWidth: 26 },
      3: { halign: "center", cellWidth: 26 },
      4: { halign: "center", cellWidth: 22 },
      5: { halign: "left" },
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    bodyStyles: { fillColor: [255, 255, 255] },
  })

  // After table - signature
  const afterTableY = (doc.lastAutoTable?.finalY ?? y) + 18
  const sigW = 38, sigH = 22
  // Right-align signature
  const sigX = pageW - margin - sigW
  doc.addImage(`data:image/png;base64,${SIGNATURE}`, "PNG", sigX, afterTableY, sigW, sigH, undefined, "FAST")
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text(EVENT.signerName, pageW - margin, afterTableY + sigH + 5, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(EVENT.signerTitle, pageW - margin, afterTableY + sigH + 10, { align: "right" })

  return Buffer.from(doc.output("arraybuffer"))
}

// Build PDFs for everyone in the target list (so dry run produces samples)
for (const t of targets.slice(0, SAVE_DIR ? targets.length : APPLY ? targets.length : 1)) {
  const pdf = buildPdf(t)
  if (SAVE_DIR) {
    const safeName = t.name.replace(/[^a-zA-Z0-9]/g, "_")
    const out = path.join(SAVE_DIR, `${t.reg.registration_number}_${safeName}.pdf`)
    fs.writeFileSync(out, pdf)
    console.log(`   saved ${out}  (${pdf.length} bytes)`)
  }
  if (!APPLY) continue

  // Send email with PDF attached
  const subject = `Faculty Invitation — ${EVENT.fullName}, Kolkata`
  const text = `Dear Dr. ${t.name},

Please find attached your faculty invitation for the ${EVENT.fullName}, scheduled ${EVENT.startDateText} - ${EVENT.endDateText} at ${EVENT.venue}.

Your commitment table is listed inside the PDF. Kindly confirm participation and submit any travel/accommodation requirements via the speaker portal:
${APP_URL}/speaker/${t.reg.custom_fields?.portal_token || ""}

Warm regards,
${EVENT.signerName}
${EVENT.signerTitle}
`
  const html = `<p>Dear Dr. ${t.name},</p>
<p>Please find attached your faculty invitation for the <strong>${EVENT.fullName}</strong>, scheduled <strong>${EVENT.startDateText} – ${EVENT.endDateText}</strong> at <strong>${EVENT.venue}</strong>.</p>
<p>Your commitment table is listed inside the PDF. Kindly confirm participation and submit any travel/accommodation requirements via the speaker portal:<br>
<a href="${APP_URL}/speaker/${t.reg.custom_fields?.portal_token || ""}">${APP_URL}/speaker/${t.reg.custom_fields?.portal_token || ""}</a></p>
<p>Warm regards,<br><strong>${EVENT.signerName}</strong><br>${EVENT.signerTitle}</p>`

  // Ensure portal token
  let token = t.reg.custom_fields?.portal_token
  if (!token) {
    token = crypto.randomUUID()
    await supabase.from("registrations")
      .update({ custom_fields: { ...(t.reg.custom_fields || {}), portal_token: token } })
      .eq("id", t.reg.id)
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: t.email,
      subject,
      html,
      text,
      attachments: [{
        filename: `Invitation-${t.reg.registration_number}.pdf`,
        content: pdf.toString("base64"),
      }],
    }),
  })
  const j = await res.json()
  if (!res.ok || !j.id) {
    console.log(`   FAIL ${t.reg.registration_number}:`, j)
    continue
  }
  console.log(`   sent ${t.reg.registration_number}  id=${j.id}`)

  await supabase.from("registrations")
    .update({ custom_fields: {
      ...(t.reg.custom_fields || {}),
      portal_token: token,
      aes_invite_sent_at: new Date().toISOString(),
      aes_invite_email_id: j.id,
      aes_invite_send_count: (t.reg.custom_fields?.aes_invite_send_count || 0) + 1,
    } })
    .eq("id", t.reg.id)

  await new Promise(r => setTimeout(r, 350))
}

if (!APPLY && !SAVE_DIR) {
  console.log(`\n(dry run -- pass --apply to send, --save-pdfs=/path to write PDF samples)`)
}
