// AMASICON 2026 · Gmail-reply webhook receiver
//
// The Apps Script GmailScanner.gs runs every 30 minutes → scans amasi.india@
// inbox for new AMASICON 2026 replies → POSTs the classified payload here.
// We validate the shared-secret header, then insert into
// public.program_change_log with change_type='gmail_reply' and broadcast to
// any open SSE listener so the dashboard's Live Changes tab updates in
// real time.
//
// Env vars:
//   AMASICON_WEBHOOK_TOKEN
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY (via createAdminClient)

import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { broadcastChange } from "../sheet-changes/broadcast"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const AMASICON_2026_EVENT_ID = "c11fe702-404c-4473-928d-eb8d8536a897"

type IncomingPayload = {
  name?: string
  email?: string
  response?: string
  response_bucket?: string
  reply_summary?: string
  subject?: string
  message_id?: string
  received_at?: string
}

export async function GET() {
  return NextResponse.json({
    hint: "POST-only. Called by the GmailScanner.gs Apps Script every 30 min.",
  })
}

export async function POST(request: NextRequest) {
  const expected = process.env.AMASICON_WEBHOOK_TOKEN
  const provided = request.headers.get("x-amasicon-token")
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: IncomingPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  if (!body.email || !body.response_bucket) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 })
  }

  const supabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const summary = `${body.name || body.email} → ${body.response_bucket}`

  const { data, error } = await db
    .from("program_change_log")
    .insert({
      event_id: AMASICON_2026_EVENT_ID,
      change_type: "gmail_reply",
      session_name: `Gmail reply · ${body.subject ?? ""}`.trim(),
      old_values: null,
      new_values: {
        name: body.name,
        email: body.email,
        response_bucket: body.response_bucket,
        reply_summary: body.reply_summary,
        message_id: body.message_id,
        received_at: body.received_at,
      },
      summary,
      changed_by_email: body.email ?? null,
      changed_by_name: body.name ?? null,
    })
    .select("id, created_at")
    .single()

  if (error) {
    return NextResponse.json(
      { error: "supabase_insert_failed", detail: error.message },
      { status: 500 }
    )
  }

  broadcastChange({
    id: data.id,
    ts: data.created_at,
    kind: "modified",
    day: "",
    hall: "",
    session: "Gmail reply",
    time: body.received_at ?? "",
    topic: summary,
    editor: body.email ?? null,
  })

  return NextResponse.json({ ok: true, id: data.id })
}
