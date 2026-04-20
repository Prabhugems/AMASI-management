import { createAdminClient } from "@/lib/supabase/server"

// ===== Defaults (used when event has no custom config) =====
export const DEFAULT_FILLOUT_FORM_ID = "gz1eLocmB9us"
export const DEFAULT_AIRTABLE_CONVOCATION_BASE = "app7TElm0QUruBlZr"
export const DEFAULT_AIRTABLE_CONVOCATION_TABLE = "tbl9CuIgSFdoNVk9x"
const MAX_PAGINATION_PAGES = 100 // Safety limit: 100 × 150 = 15,000 submissions max
const RETRY_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 1000

function getFilloutApiKey(): string {
  const key = (process.env.FILLOUT_API_KEY || "").trim()
  if (!key) throw new Error("FILLOUT_API_KEY is not configured")
  return key
}

function getQuestionValue(submission: any, name: string): string {
  return submission.questions?.find((q: any) => q.name === name)?.value || ""
}

function extractAddress(submission: any) {
  return {
    address_line1: [
      getQuestionValue(submission, "Flat/Door/Block No"),
      getQuestionValue(submission, "Road/Street/Lane"),
    ].filter(Boolean).join(", "),
    address_line2: getQuestionValue(submission, "Area/Locality"),
    city: getQuestionValue(submission, "City/District"),
    state: getQuestionValue(submission, "State"),
    pincode: String(getQuestionValue(submission, "POSTAL/PIN  CODE") || ""),
    country: "India",
  }
}

function getRecordIdFromSubmission(submission: any): string | null {
  // Fillout may use "id", "key", or "name" as the parameter identifier
  const params = submission.urlParameters || []
  const param = params.find((p: any) => p.id === "id" || p.key === "id" || p.name === "id")
  return param?.value || null
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Fetch with retry and exponential backoff for transient failures.
 */
async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, options)
      if (res.ok) return res
      // Don't retry client errors (4xx), only server errors (5xx) and rate limits (429)
      if (res.status < 500 && res.status !== 429) {
        throw new Error(`Fillout API returned ${res.status}: ${res.statusText}`)
      }
      if (attempt === RETRY_ATTEMPTS - 1) {
        throw new Error(`Fillout API returned ${res.status} after ${RETRY_ATTEMPTS} attempts`)
      }
    } catch (e: any) {
      if (attempt === RETRY_ATTEMPTS - 1) throw e
      // Network errors get retried
      if (e.message?.includes("Fillout API returned 4")) throw e // Don't retry 4xx
    }
    await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt))
  }
  throw new Error("Unreachable")
}

/**
 * Fetch all Fillout form submissions (paginated with safety limit and retry).
 * Throws if FILLOUT_API_KEY is missing or API fails after retries.
 */
export async function fetchFilloutSubmissions(formId?: string): Promise<any[]> {
  const apiKey = getFilloutApiKey()
  const effectiveFormId = formId || DEFAULT_FILLOUT_FORM_ID
  const allSubmissions: any[] = []
  let offset = 0

  for (let page = 0; page < MAX_PAGINATION_PAGES; page++) {
    const res = await fetchWithRetry(
      `https://api.fillout.com/v1/api/forms/${effectiveFormId}/submissions?limit=150&offset=${offset}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    )

    const data = await res.json()
    allSubmissions.push(...(data.responses || []))
    if (allSubmissions.length >= data.totalResponses) break
    offset += 150
  }

  return allSubmissions
}

/**
 * Returns the set of Airtable record IDs that have Fillout submissions.
 * Used by the reminder cron to verify who has already submitted.
 * Throws if Fillout is unavailable.
 */
export async function getSubmittedRecordIds(): Promise<Set<string>> {
  const submissions = await fetchFilloutSubmissions()
  const ids = new Set<string>()
  for (const sub of submissions) {
    const recId = getRecordIdFromSubmission(sub)
    if (recId) ids.add(recId)
  }
  return ids
}

export interface SyncResult {
  synced: number
  alreadyHas: number
  notFilled: number
  totalSubmissions: number
}

/**
 * Sync addresses from Fillout submissions into Supabase registrations.
 * Uses the LATEST submission per candidate (not first) so address corrections are respected.
 *
 * @param eventId - The event to sync addresses for
 * @param includeExtraFields - If true, also syncs certificate_name and attending_convocation into exam_marks
 * @throws If FILLOUT_API_KEY is missing or Fillout API fails
 */
export async function syncAddressesFromFillout({
  eventId,
  includeExtraFields = false,
  filloutFormId,
}: {
  eventId: string
  includeExtraFields?: boolean
  filloutFormId?: string
}): Promise<SyncResult> {
  const supabase = await createAdminClient()
  const db = supabase as any

  // Get registrations that need address sync
  const { data: regs } = await db
    .from("registrations")
    .select("id, convocation_number, convocation_address, exam_marks")
    .eq("event_id", eventId)
    .in("exam_result", ["pass", "without_exam"])
    .not("convocation_number", "is", null)
    .is("convocation_address", null)

  // Build map: Airtable record ID → registration
  const regByRecId = new Map<string, any>()
  for (const r of regs || []) {
    const link = r.exam_marks?.fillout_link
    const match = link?.match(/id=(rec[A-Za-z0-9]+)/)
    if (match) regByRecId.set(match[1], r)
  }

  if (regByRecId.size === 0) {
    return { synced: 0, alreadyHas: 0, notFilled: 0, totalSubmissions: 0 }
  }

  // Fetch all Fillout submissions
  const allSubmissions = await fetchFilloutSubmissions(filloutFormId)

  // Build map of LATEST submission per record ID (last one wins — respects corrections)
  const latestByRecId = new Map<string, any>()
  let unmatchedCount = 0
  for (const sub of allSubmissions) {
    const recId = getRecordIdFromSubmission(sub)
    if (!recId) {
      unmatchedCount++
      // Log first unmatched submission's urlParameters for debugging
      if (unmatchedCount === 1) {
        console.log("[fillout-sync] Sample submission urlParameters:", JSON.stringify(sub.urlParameters))
      }
      continue
    }
    // Fillout returns submissions in creation order; later entries overwrite earlier ones
    latestByRecId.set(recId, sub)
  }
  if (unmatchedCount > 0) {
    console.log(`[fillout-sync] ${unmatchedCount} submissions had no record ID match out of ${allSubmissions.length} total`)
  }
  console.log(`[fillout-sync] Matched ${latestByRecId.size} unique record IDs from ${allSubmissions.length} submissions`)

  let synced = 0
  let alreadyHas = 0

  for (const [recId, sub] of latestByRecId) {
    const reg = regByRecId.get(recId)
    if (!reg) continue

    if (reg.convocation_address) {
      alreadyHas++
      continue
    }

    const address = extractAddress(sub)

    // Only sync if city is present (minimum viable address)
    if (!address.city) continue

    const updateData: any = { convocation_address: address }

    if (includeExtraFields) {
      const certificateName = getQuestionValue(sub, "Certificate Name")
      const attending = getQuestionValue(sub, "Are you available for the convocation at AMASICON kolkata 2026?")
      if (certificateName || attending) {
        const marks = { ...(reg.exam_marks || {}) }
        if (certificateName) marks.certificate_name = certificateName
        if (attending) marks.attending_convocation = attending
        updateData.exam_marks = marks
      }
    }

    await db.from("registrations").update(updateData).eq("id", reg.id)
    synced++
  }

  return {
    synced,
    alreadyHas,
    notFilled: regByRecId.size - synced - alreadyHas,
    totalSubmissions: allSubmissions.length,
  }
}

// ===== Airtable Direct Sync =====
// For events where candidates fill addresses directly in Airtable (not via Fillout)

// These are now defaults — events can override via settings

// Airtable Master-FMAS field IDs
const AT_FIELDS = {
  convocationNumber: "fldhhci1nlRDeVaYf",
  email: "fldPEYzaj0B6X9Sxw",
  flat: "fldBxgxonal2WaQbb",
  road: "fldp7IyB2tr8J06mI",
  area: "fldTBUoDMViY7Z2Jh",
  city: "fldhPpyLIJ9xFbc9g",
  state: "fldSAb1WuOwPld67M",
  pincode: "fldWN5x8DyCHavsw5",
}

function getAirtablePat(): string {
  const key = (process.env.AIRTABLE_PAT || "").trim()
  if (!key) throw new Error("AIRTABLE_PAT is not configured")
  return key
}

/**
 * Sync addresses from Airtable Master-FMAS table into Supabase registrations.
 * Matches by email (case-insensitive) for registrations in the given event
 * that have a convocation number but no address yet.
 *
 * This handles events where candidates fill their address directly in Airtable
 * (via the FORM button) rather than through the Fillout form.
 *
 * @param eventId - The event to sync addresses for
 * @throws If AIRTABLE_PAT is missing or Airtable API fails
 */
export async function syncAddressesFromAirtable({
  eventId,
  airtableBaseId,
  airtableTableId,
}: {
  eventId: string
  airtableBaseId?: string
  airtableTableId?: string
}): Promise<SyncResult> {
  const pat = getAirtablePat()
  const supabase = await createAdminClient()
  const db = supabase as any

  // Get registrations that need address sync. Email is the join key — do NOT
  // exclude rows with a NULL convocation_number, otherwise candidates whose
  // number was assigned later in Airtable can never sync.
  const { data: regs } = await db
    .from("registrations")
    .select("id, attendee_email, convocation_number, convocation_address")
    .eq("event_id", eventId)
    .in("exam_result", ["pass", "without_exam"])
    .is("convocation_address", null)

  if (!regs || regs.length === 0) {
    console.log(`[airtable-sync] No regs need address sync for event ${eventId}`)
    return { synced: 0, alreadyHas: 0, notFilled: 0, totalSubmissions: 0 }
  }

  // Collect ALL distinct convocation prefixes present in the pending cohort
  // (e.g. an event can have both "122AEC" and "122WEC" — picking only the first
  // sample row silently drops every other prefix from the Airtable filter).
  const prefixes = new Set<string>()
  for (const r of regs) {
    const m = (r.convocation_number || "").match(/^(\d+[A-Z]+)/)
    if (m) prefixes.add(m[1])
  }
  if (prefixes.size === 0) {
    console.log(`[airtable-sync] No valid convocation prefix found for event ${eventId}, skipping`)
    return { synced: 0, alreadyHas: 0, notFilled: regs.length, totalSubmissions: 0 }
  }

  // Build email → registration map (case-insensitive)
  const regByEmail = new Map<string, any>()
  for (const r of regs) {
    if (r.attendee_email) {
      regByEmail.set(r.attendee_email.trim().toLowerCase(), r)
    }
  }

  // Fetch Airtable records with this prefix that have city filled
  const fieldParams = Object.values(AT_FIELDS).map((f) => `fields%5B%5D=${f}`).join("&")
  const effectiveBase = airtableBaseId || DEFAULT_AIRTABLE_CONVOCATION_BASE
  const effectiveTable = airtableTableId || DEFAULT_AIRTABLE_CONVOCATION_TABLE

  const prefixClauses = Array.from(prefixes)
    .map((p) => `FIND("${p}", {CONVOCATION NUMBER}) = 1`)
    .join(", ")
  const formula = encodeURIComponent(
    `AND(OR(${prefixClauses}), {City/District} != "")`
  )

  let allRecords: any[] = []
  let airtableOffset: string | undefined

  for (let page = 0; page < MAX_PAGINATION_PAGES; page++) {
    const url = `https://api.airtable.com/v0/${effectiveBase}/${effectiveTable}?${fieldParams}&filterByFormula=${formula}&pageSize=100&returnFieldsByFieldId=true${airtableOffset ? `&offset=${airtableOffset}` : ""}`

    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${pat}` },
    })

    const data = await res.json()
    allRecords.push(...(data.records || []))
    airtableOffset = data.offset
    if (!airtableOffset) break
  }

  console.log(`[airtable-sync] Fetched ${allRecords.length} Airtable records for prefixes [${Array.from(prefixes).join(", ")}]`)

  let synced = 0
  let alreadyHas = 0

  for (const rec of allRecords) {
    const fields = rec.cellValuesByFieldId || rec.fields || {}
    const email = String(fields[AT_FIELDS.email] || "").trim().toLowerCase()
    if (!email) continue

    const reg = regByEmail.get(email)
    if (!reg) continue

    if (reg.convocation_address) {
      alreadyHas++
      continue
    }

    const flat = String(fields[AT_FIELDS.flat] || "").trim()
    const road = String(fields[AT_FIELDS.road] || "").trim()
    const area = String(fields[AT_FIELDS.area] || "").trim()
    const city = String(fields[AT_FIELDS.city] || "").trim()
    const state = String(fields[AT_FIELDS.state] || "").trim()
    const pincode = String(fields[AT_FIELDS.pincode] || "").trim()

    if (!city) continue

    const address = {
      address_line1: [flat, road].filter(Boolean).join(", "),
      address_line2: area,
      city,
      state,
      pincode,
      country: "India",
    }

    await db.from("registrations").update({ convocation_address: address }).eq("id", reg.id)
    // Remove from map so we don't count as "not filled"
    regByEmail.delete(email)
    synced++
  }

  return {
    synced,
    alreadyHas,
    notFilled: regs.length - synced - alreadyHas,
    totalSubmissions: allRecords.length,
  }
}
