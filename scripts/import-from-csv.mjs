// Import exam marks from the updated CSV file
// Run: node scripts/import-from-csv.mjs

import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SUPABASE_URL = "https://jmdwxymbgxwdsmcwbahp.supabase.co";
const envFile = fs.readFileSync(".env.local", "utf8");
const SUPABASE_SERVICE_ROLE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const EVENT_ID = "9f1e659b-6809-4502-b3c1-b0a98175e813";
const CSV_PATH = "/Users/prabhubalasubramaniam/Downloads/FMAS Skill Course Practical Exam Results.csv";

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    const values = line.split(",");
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = values[i]?.trim() || ""; });
    return row;
  });
}

async function run() {
  const csvText = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseCSV(csvText);

  console.log(`\nParsed ${rows.length} rows from CSV\n`);

  // Fetch registrations
  const { data: registrations, error } = await supabase
    .from("registrations")
    .select("id, registration_number, attendee_name")
    .eq("event_id", EVENT_ID)
    .in("status", ["confirmed", "attended", "completed", "checked_in"]);

  if (error) { console.error("Fetch error:", error.message); process.exit(1); }

  const regMap = new Map();
  for (const r of registrations) regMap.set(r.registration_number, r);

  let success = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    const regNo = row["Registration Number"];
    const viva = row["VIVA[10]"];
    const pub = row["Publication[5]"];
    const practical = row["Practical[10]"];
    const result = row["Result"]?.toUpperCase();
    const remarks = row["Remarks"] || null;

    const reg = regMap.get(regNo);
    if (!reg) {
      console.log(`  ⚠ NOT FOUND: ${regNo} ${row["Full Name"]} — skipping`);
      skipped++;
      continue;
    }

    // Check if absent from practical (all three marks empty)
    const isAbsent = viva === "" && pub === "" && practical === "";

    let updateData;
    if (isAbsent) {
      // Special case: Milind Wadekar (PASS WITHOUT EXAM)
      if (result === "PASS") {
        updateData = {
          exam_marks: { practical: 0, viva: 0, publication: 0, remarks: remarks },
          exam_total_marks: 0,
          exam_result: "pass",
        };
      } else {
        updateData = {
          exam_marks: null,
          exam_total_marks: null,
          exam_result: "absent",
        };
      }
    } else {
      const v = viva === "" ? 0 : parseInt(viva);
      const p = pub === "" ? 0 : parseInt(pub);
      const pr = practical === "" ? 0 : parseInt(practical);
      const total = v + p + pr;
      const examResult = result === "PASS" ? "pass" : "fail";

      updateData = {
        exam_marks: {
          practical: pr,
          viva: v,
          publication: p,
          ...(remarks ? { remarks } : {}),
        },
        exam_total_marks: total,
        exam_result: examResult,
      };
    }

    const { error: updateError } = await supabase
      .from("registrations")
      .update(updateData)
      .eq("id", reg.id);

    if (updateError) {
      console.log(`  ✗ ${regNo} ${reg.attendee_name} — ${updateError.message}`);
      errors++;
    } else {
      const label = updateData.exam_result === "absent" ? "ABSENT"
        : `${updateData.exam_total_marks} (${updateData.exam_result.toUpperCase()})${remarks ? ` [${remarks}]` : ""}`;
      console.log(`  ✓ ${regNo} ${reg.attendee_name} → ${label}`);
      success++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Success: ${success}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors:  ${errors}`);
}

run().catch(console.error);
