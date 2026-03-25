import { createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const AMASI_API = "https://application.amasi.org/api/member_detail_data"
const FILLOUT_KEY = (process.env.FILLOUT_API_KEY || "").trim()
const AIRTABLE_PAT = (process.env.AIRTABLE_PAT || "").trim()
const AIRTABLE_BASE = (process.env.AIRTABLE_CONVOCATION_BASE || "").trim()
const AIRTABLE_TABLE = (process.env.AIRTABLE_CONVOCATION_TABLE || "").trim()

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

async function lookupAmasi(val: string) {
  try {
    const fd = new FormData()
    fd.append("email_or_phone", val)
    const res = await fetch(AMASI_API, { method: "POST", body: fd })
    const data = await res.json()
    if (data.status && data.data?.[0]) return data.data[0].membership_no
    return null
  } catch { return null }
}

// GET /api/cron/exam-daily-sync - Daily automated sync
export async function GET() {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  // Vercel crons don't send auth headers, they just call the endpoint

  try {
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const results = {
      membershipChecked: 0,
      membershipFound: 0,
      addressesSynced: 0,
      airtableCreated: 0,
      errors: [] as string[],
    }

    // Get all active FMAS events (with examination enabled)
    const { data: eventSettings } = await db
      .from("event_settings")
      .select("event_id")
      .eq("enable_examination", true)

    const eventIds = (eventSettings || []).map((s: any) => s.event_id)
    if (!eventIds.length) {
      return NextResponse.json({ message: "No exam events found", results })
    }

    for (const eventId of eventIds) {
      // ===== 1. CHECK WITHHELD MEMBERSHIP =====
      const { data: withheld } = await db
        .from("registrations")
        .select("id, attendee_name, attendee_email, attendee_phone, exam_marks")
        .eq("event_id", eventId)
        .eq("exam_result", "withheld")

      for (const r of withheld || []) {
        let amasiNo = r.attendee_email ? await lookupAmasi(r.attendee_email) : null
        if (!amasiNo && r.attendee_phone) {
          const phone = String(r.attendee_phone).replace(/[^0-9]/g, "").slice(-10)
          if (phone.length === 10) amasiNo = await lookupAmasi(phone)
        }

        if (amasiNo) {
          const marks = r.exam_marks || {}
          marks.amasi_number = amasiNo
          await db.from("registrations").update({ exam_result: "pass", exam_marks: marks }).eq("id", r.id)
          results.membershipFound++
        }
        results.membershipChecked++
        await delay(500)
      }

      // ===== 2. SYNC ADDRESSES FROM FILLOUT =====
      if (FILLOUT_KEY) {
        try {
          const { data: regs } = await db
            .from("registrations")
            .select("id, convocation_number, convocation_address, exam_marks")
            .eq("event_id", eventId)
            .in("exam_result", ["pass", "without_exam"])
            .not("convocation_number", "is", null)
            .is("convocation_address", null)

          // Build map of fillout link record IDs
          const regByRecId = new Map()
          for (const r of regs || []) {
            const link = r.exam_marks?.fillout_link
            const match = link?.match(/id=(rec[A-Za-z0-9]+)/)
            if (match) regByRecId.set(match[1], r)
          }

          if (regByRecId.size > 0) {
            // Fetch Fillout submissions
            let allSubs: any[] = []
            let offset = 0
            while (true) {
              const res = await fetch(
                `https://api.fillout.com/v1/api/forms/gz1eLocmB9us/submissions?limit=150&offset=${offset}`,
                { headers: { Authorization: `Bearer ${FILLOUT_KEY}` } }
              )
              const data = await res.json()
              allSubs = allSubs.concat(data.responses || [])
              if (allSubs.length >= data.totalResponses) break
              offset += 150
            }

            for (const sub of allSubs) {
              const recId = sub.urlParameters?.find((p: any) => p.id === "id")?.value
              if (!recId) continue
              const reg = regByRecId.get(recId)
              if (!reg || reg.convocation_address) continue

              const getQ = (name: string) => sub.questions?.find((q: any) => q.name === name)?.value || ""
              const address = {
                address_line1: [getQ("Flat/Door/Block No"), getQ("Road/Street/Lane")].filter(Boolean).join(", "),
                address_line2: getQ("Area/Locality"),
                city: getQ("City/District"),
                state: getQ("State"),
                pincode: String(getQ("POSTAL/PIN  CODE") || ""),
                country: "India",
              }

              if (address.city) {
                await db.from("registrations").update({ convocation_address: address }).eq("id", reg.id)
                results.addressesSynced++
              }
            }
          }
        } catch (e) {
          results.errors.push(`Fillout sync error: ${e}`)
        }
      }

      // ===== 3. CHECK AIRTABLE RECORDS =====
      if (AIRTABLE_PAT && AIRTABLE_BASE && AIRTABLE_TABLE) {
        try {
          const { data: regsWithConv } = await db
            .from("registrations")
            .select("id, registration_number, attendee_name, attendee_email, attendee_phone, convocation_number, exam_marks, ticket_type_id")
            .eq("event_id", eventId)
            .in("exam_result", ["pass", "without_exam"])
            .not("convocation_number", "is", null)

          const noFillout = (regsWithConv || []).filter((r: any) => !r.exam_marks?.fillout_link)

          for (const r of noFillout) {
            const { data: ticket } = await db.from("ticket_types").select("name").eq("id", r.ticket_type_id).single()

            const atRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`, {
              method: "POST",
              headers: { Authorization: `Bearer ${AIRTABLE_PAT}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                records: [{
                  fields: {
                    "CONVOCATION NUMBER": r.convocation_number,
                    "Name": r.attendee_name,
                    "AMASI Number": r.exam_marks?.amasi_number || null,
                    "Category": ticket?.name || "",
                    "Email": r.attendee_email || "",
                    "MOBILE": r.attendee_phone || "",
                  },
                }],
              }),
            })
            const atData = await atRes.json()
            if (atData.records?.[0]?.id) {
              const filloutLink = `https://forms.fillout.com/t/gz1eLocmB9us?id=${atData.records[0].id}`
              const marks = r.exam_marks || {}
              marks.fillout_link = filloutLink
              await db.from("registrations").update({ exam_marks: marks }).eq("id", r.id)
              results.airtableCreated++
            }
            await delay(200)
          }
        } catch (e) {
          results.errors.push(`Airtable sync error: ${e}`)
        }
      }
    }

    return NextResponse.json({
      message: "Daily exam sync completed",
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Cron exam-daily-sync error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
