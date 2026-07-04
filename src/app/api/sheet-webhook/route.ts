// AMASICON 2026 · Google Apps Script webhook receiver.
//
// The Program (Scientific Program) and YAMM sheets fire onSheetEdit → POST
// here → we validate the shared-secret header, insert into
// public.program_change_log, and broadcast to any open dashboard SSE listener.
//
// Env vars:
//   AMASICON_WEBHOOK_TOKEN   — must match the sheet's Apps Script property
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY (via createAdminClient)
//
// URL: POST https://events.amasi.org/api/sheet-webhook

import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { broadcastChange } from "../sheet-changes/broadcast"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// AMASICON 2026 · Kolkata event UUID (from public.events)
const AMASICON_2026_EVENT_ID = "c11fe702-404c-4473-928d-eb8d8536a897"

type IncomingPayload = {
  spreadsheetId?: string
  spreadsheetName?: string
  tabName?: string
  tabGid?: number
  row?: number
  column?: number
  a1?: string
  oldValue?: string
  newValue?: string
  editorEmail?: string
  editedAt?: string
}

export async function GET() {
  return NextResponse.json({
    hint: "POST-only. Called by the Program / YAMM sheets' onSheetEdit trigger.",
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

  const oldVal = (body.oldValue ?? "").trim()
  const newVal = (body.newValue ?? "").trim()
  if (oldVal === newVal) {
    return NextResponse.json({ ok: true, skipped: "no_change" })
  }

  const supabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const summary =
    oldVal === ""
      ? `Added "${newVal}" in ${body.tabName ?? "?"}!${body.a1 ?? "?"}`
      : newVal === ""
        ? `Cleared "${oldVal}" from ${body.tabName ?? "?"}!${body.a1 ?? "?"}`
        : `${body.tabName ?? "?"}!${body.a1 ?? "?"}: "${oldVal}" → "${newVal}"`

  const { data, error } = await db
    .from("program_change_log")
    .insert({
      event_id: AMASICON_2026_EVENT_ID,
      change_type: "sheet_edit",
      session_name: `${body.spreadsheetName ?? ""} · ${body.tabName ?? ""}`.trim(),
      old_values: {
        value: oldVal,
        spreadsheet: body.spreadsheetId,
        tab: body.tabName,
        a1: body.a1,
      },
      new_values: {
        value: newVal,
        spreadsheet: body.spreadsheetId,
        tab: body.tabName,
        a1: body.a1,
        row: body.row,
        column: body.column,
      },
      summary,
      changed_by_email: body.editorEmail || null,
      changed_by_name: body.editorEmail?.split("@")[0] || null,
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
    session: body.tabName ?? "",
    time: body.a1 ?? "",
    topic: summary,
    editor: body.editorEmail ?? null,
  })

  return NextResponse.json({ ok: true, id: data.id })
}
