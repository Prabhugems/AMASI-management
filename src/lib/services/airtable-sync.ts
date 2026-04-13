/**
 * Shared Airtable sync for convocation records.
 * Ensures idempotency: checks if fillout_link already exists before creating a new Airtable record.
 */

const FILLOUT_FORM_ID = "gz1eLocmB9us"

function getAirtableConfig() {
  const pat = (process.env.AIRTABLE_PAT || "").trim()
  const baseId = (process.env.AIRTABLE_CONVOCATION_BASE || "").trim()
  const tableId = (process.env.AIRTABLE_CONVOCATION_TABLE || "").trim()
  if (!pat || !baseId || !tableId) return null
  return { pat, baseId, tableId }
}

/**
 * Sync a registration to Airtable and store the Fillout link back.
 * Idempotent: skips if the registration already has a fillout_link.
 *
 * @returns The Fillout link if created/exists, or null if Airtable is not configured.
 */
export async function syncRegistrationToAirtable(
  reg: {
    id: string
    convocation_number: string
    attendee_name: string
    attendee_email?: string
    attendee_phone?: string
    exam_marks?: any
    ticket_type_id?: string
  },
  db: any
): Promise<string | null> {
  // Idempotency check: if fillout_link already exists, skip
  if (reg.exam_marks?.fillout_link) {
    return reg.exam_marks.fillout_link
  }

  const config = getAirtableConfig()
  if (!config) return null

  // Double-check DB in case exam_marks was stale
  const { data: fresh } = await db
    .from("registrations")
    .select("exam_marks")
    .eq("id", reg.id)
    .single()

  if (fresh?.exam_marks?.fillout_link) {
    return fresh.exam_marks.fillout_link
  }

  // Get ticket type name
  let ticketName = ""
  if (reg.ticket_type_id) {
    const { data: ticket } = await db
      .from("ticket_types")
      .select("name")
      .eq("id", reg.ticket_type_id)
      .single()
    ticketName = ticket?.name || ""
  }

  // Create Airtable record
  const res = await fetch(`https://api.airtable.com/v0/${config.baseId}/${config.tableId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      records: [{
        fields: {
          "CONVOCATION NUMBER": reg.convocation_number,
          "Name": reg.attendee_name,
          "AMASI Number": reg.exam_marks?.amasi_number || null,
          "Category": ticketName,
          "Email": reg.attendee_email || "",
          "MOBILE": reg.attendee_phone || "",
        },
      }],
    }),
  })

  const result = await res.json()
  if (!result.records?.[0]?.id) {
    throw new Error(`Airtable create failed: ${JSON.stringify(result)}`)
  }

  const recordId = result.records[0].id
  const filloutLink = `https://forms.fillout.com/t/${FILLOUT_FORM_ID}?id=${recordId}`

  // Store fillout link back — use atomic merge to avoid clobbering other exam_marks keys
  const existingMarks = fresh?.exam_marks || reg.exam_marks || {}
  const updatedMarks = { ...existingMarks, fillout_link: filloutLink }
  await db.from("registrations").update({ exam_marks: updatedMarks }).eq("id", reg.id)

  return filloutLink
}
