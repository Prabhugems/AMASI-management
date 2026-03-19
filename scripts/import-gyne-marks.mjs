// Script to import Gynaecology practical exam marks from handwritten sheets
// Run: node scripts/import-gyne-marks.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jmdwxymbgxwdsmcwbahp.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY. Run with:");
  console.error(
    '  SUPABASE_SERVICE_ROLE_KEY="..." node scripts/import-gyne-marks.mjs'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.trim());

const EVENT_ID = "9f1e659b-6809-4502-b3c1-b0a98175e813";
const PASS_MARKS = 15;

// Marks extracted from handwritten Gyne marksheet (3 pages)
// Format: [registration_number, practical, viva, publication]
// "absent" entries have null marks
const GYNE_MARKS = [
  // Page 1 (Image 3)
  ["122A1009", 7, 8, 2],   // Biradar Hemant → 17
  ["122A1011", 5, 7, 1],   // Avanita Bharathania → 13
  ["122A1012", 5, 7, 0],   // Reena Avkire → 12
  ["122A1013", 6, 6, 1],   // Maitrik Patel → 13
  ["122A1015", 6, 6, 1],   // Parth Makadiya → 13
  ["122A1016", 6, 7, 0],   // Riya Talati → 13
  ["122A1018", 5, 7, 0],   // Rajani Makarand Gosavi → 12
  ["122A1019", 5, 5, 5],   // Shalmali Gosavi → 15
  ["122A1020", 6, 7, 4],   // Priyanka Kamdar → 17
  ["122A1021", 7, 5, 5],   // Aditya Nimbkar → 17
  ["122A1023", 7, 5, 1],   // Jahnavi Anne → 13
  ["122A1024", 7, 8, 1],   // Sneha Bora → 16
  ["122A1025", 7, 7, 0],   // Khyati Myatra → 14
  ["122A1026", 7, 9, 2],   // Stuti Shah → 18
  ["122A1027", 6, 7, 1],   // Astha Kaushal → 14
  ["122A1032", null, null, null], // Sakthi Madhubala → ABSENT
  ["122A1034", 6, 6, 4],   // Dipika Nannaware → 16
  ["122A1036", 7, 8, 3],   // Indrani Rajput → 18
  ["122A1039", 6, 5, 5],   // Prajakta Shende → 16 (marks uncertain)
  ["122A1041", 6, 6, 3],   // Shravan Bg → 15
  ["122A1043", 6, 6, 4],   // Vaishvi Patel → 16
  ["122A1049", 6, 6, 3],   // Ishitaba Jadeja → 15
  ["122A1055", 6, 7, 0],   // Jainabbanu Khatri → 13
  ["122A1057", 10, 9, 5],  // Kokila B T → 24
  ["122A1059", 7, 7, 0],   // Hemisha Gandhi → 14
  ["122A1060", 7, 6, 1],   // Sneha Chila → 14
  ["122A1063", 6, 6, 2],   // Dhwani Parmar → 14
  ["122A1064", null, null, null], // Sapna Purushotham → ABSENT
  ["122A1070", 5, 7, 2],   // Kundena Srilakshmi → 14

  // Page 2 (Image 2)
  ["122A1071", 8, 8, 1],   // Jyoti Kala → 17
  ["122A1073", 5, 7, 2],   // Swapna Mudigonda → 14
  ["122A1077", 5, 7, 2],   // Supriya Borole → 14
  ["122A1078", 5, 6, 3],   // Rachana Barkale → 14
  ["122A1079", 6, 7, 4],   // Sudha Bhimavarapu → 17
  ["122A1081", 7, 6, 3],   // Priyanka Rane → 16
  ["122A1094", 6, 6, 1],   // Savankumar Shah → 13
  ["122A1095", 5, 6, 2],   // Nidhi Patel → 13
  ["122A1096", 5, 5, 3],   // Sejal Kulkarni → 13
  ["122A1098", 7, 7, 4],   // Amisha Dogra → 18
  ["122A1101", 7, 7, 4],   // Sujata Gatalwar → 18
  ["122A1102", 6, 6, 3],   // Krishna Dholariya → 15
  ["122A1121", 8, 9, 2],   // Poonam Patil → 19
  ["122A1123", null, null, null], // Ishita Rathore → ABSENT
  ["122A1126", 6, 6, 3],   // Uzma Khan → 15
  ["122A1129", 5, 7, 1],   // Payalkumari Yogeshbhai Patel → 13
  ["122A1131", 6, 6, 0],   // Nidhi Thumar → 12
  ["122A1132", 6, 5, 3],   // Shailvi Parikh → 14
  ["122A1133", 6, 7, 1],   // Brynivalentina Pereira → 14
  ["122A1136", 7, 6, 4],   // Dhwani Nanvani → 17
  ["122A1137", 7, 7, 5],   // Anuja Sachapara → 19
  ["122A1139", 5, 7, 1],   // Rishit Sondarava → 13
  ["122A1140", 5, 5, 3],   // Mital Bhakhar → 13
  ["122A1141", 6, 7, 0],   // Poojan Patel → 13
  ["122A1150", 6, 6, 0],   // Aanal Bhoiwala → 12
  ["122A1154", 9, 7, 1],   // Deba Ali Khan → 17
  ["122A1155", 6, 7, 2],   // Shreeja Desai → 15
  ["122A1157", 5, 5, 5],   // Drasti Sagar Patel → 15
  ["122A1158", 5, 5, 3],   // Priya Mansukhbhai Kanani → 13

  // Page 3 (Image 1)
  ["122A1159", 6, 6, 0],   // Manish Mittal → 12
  ["122A1160", 6, 6, 1],   // Jitali Rasiklal Patel → 13
];

async function run() {
  console.log(`\nImporting ${GYNE_MARKS.length} Gyne exam marks...\n`);

  // Fetch all registrations for this event
  const { data: registrations, error: fetchError } = await supabase
    .from("registrations")
    .select("id, registration_number, attendee_name")
    .eq("event_id", EVENT_ID)
    .in("status", ["confirmed", "attended", "completed", "checked_in"]);

  if (fetchError) {
    console.error("Failed to fetch registrations:", fetchError.message);
    process.exit(1);
  }

  // Build a map of registration_number → id
  const regMap = new Map();
  for (const r of registrations) {
    regMap.set(r.registration_number, { id: r.id, name: r.attendee_name });
  }

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const [regNo, practical, viva, publication] of GYNE_MARKS) {
    const reg = regMap.get(regNo);
    if (!reg) {
      console.log(`  ⚠ NOT FOUND: ${regNo} — skipping`);
      skipped++;
      continue;
    }

    const isAbsent = practical === null;

    const updateData = isAbsent
      ? {
          exam_marks: null,
          exam_total_marks: null,
          exam_result: "absent",
        }
      : {
          exam_marks: { practical, viva, publication },
          exam_total_marks: practical + viva + publication,
          exam_result:
            practical + viva + publication >= PASS_MARKS ? "pass" : "fail",
        };

    const { error: updateError } = await supabase
      .from("registrations")
      .update(updateData)
      .eq("id", reg.id);

    if (updateError) {
      console.log(`  ✗ ERROR: ${regNo} (${reg.name}) — ${updateError.message}`);
      errors++;
    } else {
      const total = isAbsent ? "ABSENT" : `${updateData.exam_total_marks} (${updateData.exam_result.toUpperCase()})`;
      console.log(`  ✓ ${regNo} ${reg.name} → ${total}`);
      success++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Success: ${success}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors:  ${errors}`);
  console.log(`  Total:   ${GYNE_MARKS.length}`);
}

run().catch(console.error);
