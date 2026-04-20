import { createAdminClient } from "@/lib/supabase/server"
import { syncAddressesFromFillout, syncAddressesFromAirtable } from "@/lib/services/fillout-sync"
import { syncRegistrationToAirtable } from "@/lib/services/airtable-sync"
import { logCronRun } from "@/lib/services/cron-logger"
import { NextResponse } from "next/server"

const AMASI_API = "https://application.amasi.org/api/member_detail_data"

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
export async function GET(request: Request) {
  // Verify cron secret - Vercel crons send authorization header
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const run = await logCronRun("exam-daily-sync")
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

      // ===== 2. SYNC ADDRESSES (uses event-level config) =====
      const { data: eventData } = await db.from("events").select("settings").eq("id", eventId).single()
      const examConfig = eventData?.settings?.examination
      const addressSource = examConfig?.address_source || "both"
      const filloutFormId = examConfig?.fillout_form_id
      const airtableBaseId = examConfig?.airtable_address_base_id
      const airtableTableId = examConfig?.airtable_address_table_id

      // 2a. Fillout sync
      if (addressSource === "fillout" || addressSource === "both") {
        try {
          const syncResult = await syncAddressesFromFillout({ eventId, filloutFormId })
          results.addressesSynced += syncResult.synced
          console.log(`[exam-daily-sync] Fillout sync for event ${eventId}: synced=${syncResult.synced}, notFilled=${syncResult.notFilled}`)
        } catch (e) {
          const msg = `Fillout sync failed for event ${eventId}: ${e}`
          console.error(`[exam-daily-sync] ${msg}`)
          results.errors.push(msg)
        }
      }

      // 2b. Airtable sync
      if (addressSource === "airtable" || addressSource === "both") {
        try {
          const atResult = await syncAddressesFromAirtable({ eventId, airtableBaseId, airtableTableId })
          results.addressesSynced += atResult.synced
          if (atResult.synced > 0) {
            console.log(`[exam-daily-sync] Airtable address sync for event ${eventId}: synced=${atResult.synced}`)
          }
        } catch (e) {
          console.error(`[exam-daily-sync] Airtable address sync failed for event ${eventId}:`, e)
        }
      }

      // ===== 3. CREATE AIRTABLE RECORDS (idempotent) =====
      try {
        const { data: regsWithConv } = await db
          .from("registrations")
          .select("id, registration_number, attendee_name, attendee_email, attendee_phone, convocation_number, exam_marks, ticket_type_id")
          .eq("event_id", eventId)
          .in("exam_result", ["pass", "without_exam"])
          .not("convocation_number", "is", null)

        const noFillout = (regsWithConv || []).filter((r: any) => !r.exam_marks?.fillout_link)

        for (const r of noFillout) {
          try {
            const link = await syncRegistrationToAirtable(r, db)
            if (link) results.airtableCreated++
          } catch (e) {
            console.error(`[exam-daily-sync] Airtable sync failed for ${r.attendee_name}:`, e)
          }
          await delay(200)
        }
      } catch (e) {
        results.errors.push(`Airtable sync error: ${e}`)
      }
    }

    await run.ok({ syncedCount: results.addressesSynced, metadata: results })
    return NextResponse.json({
      message: "Daily exam sync completed",
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Cron exam-daily-sync error:", error)
    await run.err(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
