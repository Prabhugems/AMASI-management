import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

const FILLOUT_API_KEY = process.env.FILLOUT_API_KEY || ""
const FILLOUT_FORM_ID = "gz1eLocmB9us"

// POST /api/examination/sync-addresses - Sync addresses from Fillout API
export async function POST(request: NextRequest) {
  try {
    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { event_id } = await request.json()
    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    if (!FILLOUT_API_KEY) {
      return NextResponse.json({ error: "FILLOUT_API_KEY not configured" }, { status: 500 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get registrations with fillout links
    const { data: regs } = await db
      .from("registrations")
      .select("id, attendee_name, convocation_number, exam_marks, convocation_address")
      .eq("event_id", event_id)
      .eq("exam_result", "pass")

    // Build map: airtable record ID → registration
    const regByRecId = new Map()
    for (const r of regs || []) {
      const link = r.exam_marks?.fillout_link
      if (!link) continue
      const match = link.match(/id=(rec[A-Za-z0-9]+)/)
      if (match) regByRecId.set(match[1], r)
    }

    // Fetch all Fillout submissions
    let allSubmissions: any[] = []
    let offset = 0
    while (true) {
      const res = await fetch(
        `https://api.fillout.com/v1/api/forms/${FILLOUT_FORM_ID}/submissions?limit=150&offset=${offset}`,
        { headers: { Authorization: `Bearer ${FILLOUT_API_KEY}` } }
      )
      const data = await res.json()
      allSubmissions = allSubmissions.concat(data.responses || [])
      if (allSubmissions.length >= data.totalResponses) break
      offset += 150
    }

    // Match and sync
    let synced = 0
    let alreadyHas = 0
    const matched = new Set()

    for (const sub of allSubmissions) {
      const recId = sub.urlParameters?.find((p: any) => p.id === "id")?.value
      if (!recId || matched.has(recId)) continue

      const reg = regByRecId.get(recId)
      if (!reg) continue
      matched.add(recId)

      if (reg.convocation_address) { alreadyHas++; continue }

      const getQ = (name: string) => sub.questions?.find((q: any) => q.name === name)?.value || ""
      const address = {
        address_line1: [getQ("Flat/Door/Block No"), getQ("Road/Street/Lane")].filter(Boolean).join(", "),
        address_line2: getQ("Area/Locality"),
        city: getQ("City/District"),
        state: getQ("State"),
        pincode: String(getQ("POSTAL/PIN  CODE") || ""),
        country: "India",
      }

      const certificateName = getQ("Certificate Name")
      const attending = getQ("Are you available for the convocation at AMASICON kolkata 2026?")

      const marks = reg.exam_marks || {}
      if (certificateName) marks.certificate_name = certificateName
      if (attending) marks.attending_convocation = attending

      await db.from("registrations").update({
        convocation_address: address,
        exam_marks: marks,
      }).eq("id", reg.id)

      synced++
    }

    return NextResponse.json({
      synced,
      alreadyHas,
      notFilled: regByRecId.size - synced - alreadyHas,
      totalRegistrations: regByRecId.size,
      totalSubmissions: allSubmissions.length,
    })
  } catch (error) {
    console.error("Error syncing addresses:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
