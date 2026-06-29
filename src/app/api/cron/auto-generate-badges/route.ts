import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { logCronRun } from "@/lib/services/cron-logger"
import { selectEventsForTenant } from "@/lib/tenant"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const PER_RUN_LIMIT = 100

function getInternalBaseUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "")
  if (appUrl) return appUrl
  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) return `https://${vercelUrl}`
  return "http://localhost:3000"
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const run = await logCronRun("auto-generate-badges")
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createAdminClient()) as any
    const today = new Date().toISOString().split("T")[0]

    // Active events for this tenant (not ended, not completed/archived/cancelled)
    const { data: activeEvents, error: eventsError } = await selectEventsForTenant(
      supabase,
      "id, name",
    )
      .not("status", "in", '("completed","archived","cancelled")')
      .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`)

    if (eventsError) {
      await run.err(eventsError)
      return NextResponse.json({ error: eventsError.message }, { status: 500 })
    }
    if (!activeEvents?.length) {
      await run.ok({ syncedCount: 0, metadata: { reason: "no active events" } })
      return NextResponse.json({ message: "No active events", generated: 0 })
    }

    const eventIds = activeEvents.map((e: { id: string }) => e.id)

    // Eligible registrations: confirmed, paid (or free), no stored badge, has checkin_token
    const { data: regs, error: regsError } = await supabase
      .from("registrations")
      .select("id, event_id, registration_number, attendee_name")
      .in("event_id", eventIds)
      .eq("status", "confirmed")
      .in("payment_status", ["completed", "not_required"])
      .is("badge_url", null)
      .not("checkin_token", "is", null)
      .order("created_at", { ascending: true })
      .limit(PER_RUN_LIMIT)

    if (regsError) {
      await run.err(regsError)
      return NextResponse.json({ error: regsError.message }, { status: 500 })
    }
    if (!regs?.length) {
      await run.ok({ syncedCount: 0, metadata: { reason: "no eligible registrations" } })
      return NextResponse.json({ message: "No eligible registrations", generated: 0 })
    }

    // Group by event so we fetch each event's template only once
    const byEvent = new Map<string, { id: string; attendee_name: string; registration_number: string }[]>()
    for (const r of regs) {
      const list = byEvent.get(r.event_id) || []
      list.push({ id: r.id, attendee_name: r.attendee_name, registration_number: r.registration_number })
      byEvent.set(r.event_id, list)
    }

    const baseUrl = getInternalBaseUrl()
    const results: {
      event_id: string
      attempted: number
      generated: number
      skipped: number
      failures: { registration_number: string; reason: string }[]
    }[] = []

    for (const [eventId, eventRegs] of byEvent) {
      // Pick a usable template for this event. Prefer locked + default; fall back to any.
      const { data: templates } = await supabase
        .from("badge_templates")
        .select("id, is_locked, is_default, created_at")
        .eq("event_id", eventId)
        .order("is_default", { ascending: false })
        .order("is_locked", { ascending: false })
        .order("created_at", { ascending: true })

      if (!templates?.length) {
        results.push({
          event_id: eventId,
          attempted: eventRegs.length,
          generated: 0,
          skipped: eventRegs.length,
          failures: eventRegs.map((r) => ({ registration_number: r.registration_number, reason: "no badge template for event" })),
        })
        continue
      }

      const templateId = templates[0].id
      let generated = 0
      const failures: { registration_number: string; reason: string }[] = []

      for (const reg of eventRegs) {
        try {
          const resp = await fetch(`${baseUrl}/api/badges/generate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-cron-secret": cronSecret,
            },
            body: JSON.stringify({
              event_id: eventId,
              template_id: templateId,
              single_registration_id: reg.id,
              store_badges: true,
            }),
          })

          if (!resp.ok) {
            const text = await resp.text().catch(() => "")
            failures.push({
              registration_number: reg.registration_number,
              reason: `HTTP ${resp.status}: ${text.slice(0, 200)}`,
            })
            continue
          }

          // Bulk endpoint only updates badge_url when store_badges + single upload succeeds.
          // Re-verify the row actually got a URL — otherwise count as failure so we retry.
          const { data: after } = await supabase
            .from("registrations")
            .select("badge_url")
            .eq("id", reg.id)
            .maybeSingle()

          if (after?.badge_url) {
            generated++
          } else {
            failures.push({
              registration_number: reg.registration_number,
              reason: "endpoint returned 200 but badge_url still null",
            })
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          failures.push({
            registration_number: reg.registration_number,
            reason: message.slice(0, 200) || "unknown error",
          })
        }
      }

      results.push({
        event_id: eventId,
        attempted: eventRegs.length,
        generated,
        skipped: 0,
        failures,
      })
    }

    const totalGenerated = results.reduce((s, r) => s + r.generated, 0)
    const totalFailed = results.reduce((s, r) => s + r.failures.length, 0)
    const totalSkipped = results.reduce((s, r) => s + r.skipped, 0)

    await run.ok({
      syncedCount: totalGenerated,
      metadata: { totalGenerated, totalFailed, totalSkipped, eligible: regs.length, events: results.length },
    })

    return NextResponse.json({
      generated: totalGenerated,
      failed: totalFailed,
      skipped: totalSkipped,
      eligible: regs.length,
      results,
    })
  } catch (error) {
    await run.err(error)
    const message = error instanceof Error ? error.message : "auto-generate-badges failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
