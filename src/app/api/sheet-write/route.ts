// AMASICON 2026 · Sheet write-back proxy.
//
// The dashboard POSTs a batch of writes → we validate the shared token → we
// forward to the Apps Script Web App URL (which is authenticated as the
// sheet owner and applies the writes). Rationale: no service-account creds
// in Vercel; the Apps Script already has authenticated access to the sheet.
//
// Payload:
//   {
//     "spreadsheetId": "…",
//     "writes": [
//       { "tabName": "Day 1", "a1": "D25", "value": "docjasmeet@gmail.com" }
//     ]
//   }
//
// Env vars:
//   AMASICON_WEBHOOK_TOKEN
//   APPS_SCRIPT_WEB_APP_URL  ← from the sheet's WriteHandler.gs deployment

import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Write = { tabName: string; a1: string; value: string }
type Body = { spreadsheetId?: string; writes: Write[] }

export async function POST(request: NextRequest) {
  const expected = process.env.AMASICON_WEBHOOK_TOKEN
  const provided = request.headers.get("x-amasicon-token")
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const appsScriptUrl = process.env.APPS_SCRIPT_WEB_APP_URL
  if (!appsScriptUrl) {
    return NextResponse.json(
      { error: "apps_script_not_configured" },
      { status: 500 }
    )
  }

  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  if (!body.writes?.length) {
    return NextResponse.json({ error: "no_writes" }, { status: 400 })
  }

  // Apps Script Web Apps strip most custom headers on inbound requests, so
  // pass the token inside the JSON body too.
  const resp = await fetch(appsScriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-AMASICON-Token": expected,
    },
    body: JSON.stringify({ ...body, token: expected }),
  })

  const text = await resp.text()
  return new NextResponse(text, {
    status: resp.status,
    headers: {
      "Content-Type": resp.headers.get("Content-Type") ?? "text/plain",
    },
  })
}
