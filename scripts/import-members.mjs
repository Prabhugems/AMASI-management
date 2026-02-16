import { createReadStream } from "fs";
import { parse } from "csv-parse";

const SUPABASE_URL = "https://jmdwxymbgxwdsmcwbahp.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptZHd4eW1iZ3h3ZHNtY3diYWhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAxMTA1NSwiZXhwIjoyMDgyNTg3MDU1fQ.rvk94RhIk7lcDonsR_dWdPL7rEzmn91tdXLChDg9b4Y";

const CSV_PATH = "/Users/prabhubalasubramaniam/Downloads/AMASI Membership Application Report (3).csv";

// Column mapping: CSV header -> DB column
const COLUMN_MAP = {
  "Name": "name",
  "Father's Name": "father_name",
  "DOB": "date_of_birth",
  "Nationality": "nationality",
  "Gender": "gender",
  "Membership Type": "membership_type",
  "Application No": "application_no",
  "Member ID": "amasi_number",
  "Mobile Code": "mobile_code",
  "Mobile": "phone",
  "Email": "email",
  "Street Address 1": "street_address_1",
  "Street Address 2": "street_address_2",
  "City": "city",
  "State": "state",
  "Country": "country",
  "Postal/Zip Code": "postal_code",
  "Landline": "landline",
  "STD Code": "std_code",
  "Education - UG College": "ug_college",
  "Education - UG University": "ug_university",
  "Education - UG Year": "ug_year",
  "Education - PG Degree": "pg_degree",
  "Education - PG College": "pg_college",
  "Education - PG University": "pg_university",
  "Education - PG Year": "pg_year",
  "MCI Council Number": "mci_council_number",
  "MCI Council State": "mci_council_state",
  "IMR Registration No": "imr_registration_no",
  "ASI Membership No": "asi_membership_no",
  "ASI State": "asi_state",
  "Other International Organization": "other_intl_org",
  "Other International Organization Value": "other_intl_org_value",
  "Application Date": "application_date",
  "Status": "status",
};

function clean(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (s === "" || s === "N/A" || s === "n/a" || s === "-" || s === "--") return null;
  return s;
}

function parseDate(val) {
  const s = clean(val);
  if (!s) return null;
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  return null;
}

function parseStatus(val) {
  const s = clean(val)?.toLowerCase();
  if (!s) return "active";
  if (s.includes("allotted") || s.includes("active") || s.includes("approved")) return "active";
  if (s.includes("pending")) return "pending";
  if (s.includes("expired")) return "expired";
  if (s.includes("rejected") || s.includes("inactive")) return "inactive";
  return "active";
}

async function supabaseRequest(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "resolution=merge-duplicates,return=minimal" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res;
}

function mapRow(csvRow) {
  const mapped = {};
  for (const [csvCol, dbCol] of Object.entries(COLUMN_MAP)) {
    if (csvRow[csvCol] !== undefined) {
      mapped[dbCol] = csvRow[csvCol];
    }
  }
  return mapped;
}

function transformRow(mapped) {
  const amasiNumber = mapped.amasi_number ? parseInt(String(mapped.amasi_number)) : null;
  if (!amasiNumber || isNaN(amasiNumber)) return null;

  const name = clean(mapped.name);
  if (!name) return null;

  const isLifeMember = mapped.membership_type?.includes("Life Member [LM]") || mapped.membership_type === "LM";

  return {
    amasi_number: amasiNumber,
    name,
    email: clean(mapped.email)?.toLowerCase() || `noemail-${amasiNumber}@placeholder.amasi.org`,
    phone: clean(mapped.phone) ? parseInt(String(mapped.phone).replace(/\D/g, "")) || null : null,
    membership_type: clean(mapped.membership_type) || null,
    status: parseStatus(mapped.status),
    voting_eligible: isLifeMember,
    father_name: clean(mapped.father_name),
    date_of_birth: parseDate(mapped.date_of_birth),
    nationality: clean(mapped.nationality),
    gender: clean(mapped.gender),
    application_no: clean(mapped.application_no),
    application_date: parseDate(mapped.application_date),
    mobile_code: clean(mapped.mobile_code),
    landline: clean(mapped.landline),
    std_code: clean(mapped.std_code),
    street_address_1: clean(mapped.street_address_1),
    street_address_2: clean(mapped.street_address_2),
    city: clean(mapped.city),
    state: clean(mapped.state),
    country: clean(mapped.country) || "India",
    postal_code: clean(mapped.postal_code),
    ug_college: clean(mapped.ug_college),
    ug_university: clean(mapped.ug_university),
    ug_year: clean(mapped.ug_year),
    pg_degree: clean(mapped.pg_degree),
    pg_college: clean(mapped.pg_college),
    pg_university: clean(mapped.pg_university),
    pg_year: clean(mapped.pg_year),
    mci_council_number: clean(mapped.mci_council_number),
    mci_council_state: clean(mapped.mci_council_state),
    imr_registration_no: clean(mapped.imr_registration_no),
    asi_membership_no: clean(mapped.asi_membership_no),
    asi_state: clean(mapped.asi_state),
    other_intl_org: clean(mapped.other_intl_org),
    other_intl_org_value: clean(mapped.other_intl_org_value),
    updated_at: new Date().toISOString(),
  };
}

async function readCSV() {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(CSV_PATH)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true, bom: true }))
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

async function main() {
  console.log("Reading CSV...");
  const csvRows = await readCSV();
  console.log(`Read ${csvRows.length} rows from CSV`);

  // Transform all rows
  const transformed = [];
  let skipped = 0;
  for (const row of csvRows) {
    const mapped = mapRow(row);
    const record = transformRow(mapped);
    if (record) {
      transformed.push(record);
    } else {
      skipped++;
    }
  }
  console.log(`Transformed ${transformed.length} records (skipped ${skipped} without name/amasi_number)`);

  // Upsert in batches of 200 using PostgREST upsert (POST with Prefer: resolution=merge-duplicates)
  // This requires a unique constraint on amasi_number
  const BATCH_SIZE = 200;
  let success = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
    const batch = transformed.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(transformed.length / BATCH_SIZE);

    try {
      await supabaseRequest("POST", "members?on_conflict=amasi_number", batch);
      success += batch.length;
      process.stdout.write(`\rBatch ${batchNum}/${totalBatches}: ${success} imported, ${failed} failed`);
    } catch (err) {
      // If batch fails, try one by one
      for (const record of batch) {
        try {
          await supabaseRequest("POST", "members?on_conflict=amasi_number", record);
          success++;
        } catch (singleErr) {
          failed++;
          errors.push({ amasi_number: record.amasi_number, name: record.name, error: singleErr.message.substring(0, 100) });
        }
      }
      process.stdout.write(`\rBatch ${batchNum}/${totalBatches}: ${success} imported, ${failed} failed`);
    }
  }

  console.log(`\n\nImport complete!`);
  console.log(`  Success: ${success}`);
  console.log(`  Failed: ${failed}`);
  if (errors.length > 0) {
    console.log(`  First 10 errors:`);
    errors.slice(0, 10).forEach(e => console.log(`    AMASI #${e.amasi_number} (${e.name}): ${e.error}`));
  }
}

main().catch(console.error);
