import { createAdminClient } from "@/lib/supabase/server"

const FILLOUT_FORM_ID = "gz1eLocmB9us"

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
  return submission.urlParameters?.find((p: any) => p.id === "id")?.value || null
}

/**
 * Fetch all Fillout form submissions (paginated).
 * Throws if FILLOUT_API_KEY is missing or API fails.
 */
export async function fetchFilloutSubmissions(): Promise<any[]> {
  const apiKey = getFilloutApiKey()
  const allSubmissions: any[] = []
  let offset = 0

  while (true) {
    const res = await fetch(
      `https://api.fillout.com/v1/api/forms/${FILLOUT_FORM_ID}/submissions?limit=150&offset=${offset}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    )

    if (!res.ok) {
      throw new Error(`Fillout API returned ${res.status}: ${res.statusText}`)
    }

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
 *
 * @param eventId - The event to sync addresses for
 * @param includeExtraFields - If true, also syncs certificate_name and attending_convocation into exam_marks
 * @throws If FILLOUT_API_KEY is missing or Fillout API fails
 */
export async function syncAddressesFromFillout({
  eventId,
  includeExtraFields = false,
}: {
  eventId: string
  includeExtraFields?: boolean
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
  const allSubmissions = await fetchFilloutSubmissions()

  let synced = 0
  let alreadyHas = 0
  const matched = new Set<string>()

  for (const sub of allSubmissions) {
    const recId = getRecordIdFromSubmission(sub)
    if (!recId || matched.has(recId)) continue

    const reg = regByRecId.get(recId)
    if (!reg) continue
    matched.add(recId)

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
