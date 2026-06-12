import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET /api/abstracts/[id]/file-url
// Returns a fresh short-lived signed URL for the abstract's stored file,
// falling back to the legacy file_url for rows submitted before Phase A.
//
// Signed lazily so list endpoints don't pay N sign-ops per request.
// Auth posture mirrors /api/abstracts/[id]: open lookup; we don't leak file
// content unless the abstract id is known.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const supabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: row, error } = await sb
    .from("abstracts")
    .select("id, file_path, file_url, file_name")
    .eq("id", id)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
  }

  if (!row.file_path && !row.file_url) {
    return NextResponse.json({ url: null, file_name: row.file_name ?? null })
  }

  if (row.file_path) {
    const { data: signed, error: signErr } = await supabase.storage
      .from("abstract-files")
      .createSignedUrl(row.file_path, 3600)
    if (signErr || !signed?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate signed URL" },
        { status: 500 }
      )
    }
    return NextResponse.json({
      url: signed.signedUrl,
      file_name: row.file_name ?? null,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    })
  }

  // Legacy row — return the historical file_url as-is.
  return NextResponse.json({
    url: row.file_url,
    file_name: row.file_name ?? null,
    expires_at: null,
  })
}
