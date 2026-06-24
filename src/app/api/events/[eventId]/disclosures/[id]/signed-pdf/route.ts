import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

// GET /api/events/[eventId]/disclosures/[id]/signed-pdf
// Returns a short-lived signed URL for the signed disclosure PDF.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  const { eventId, id } = await params
  const { error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  try {
    const supabase = await createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: disclosure, error: lookupError } = await (supabase as any)
      .from('speaker_disclosures')
      .select('id, event_id, pdf_storage_path')
      .eq('id', id)
      .maybeSingle()

    if (lookupError) {
      console.error('disclosure signed-pdf lookup error:', { eventId, id, error: lookupError })
      return NextResponse.json({ error: 'Failed to load disclosure' }, { status: 500 })
    }

    if (!disclosure) {
      return NextResponse.json({ error: 'Disclosure not found' }, { status: 404 })
    }

    if (disclosure.event_id !== eventId) {
      return NextResponse.json({ error: 'Disclosure does not belong to this event' }, { status: 403 })
    }

    if (!disclosure.pdf_storage_path) {
      return NextResponse.json({ error: 'PDF not yet rendered' }, { status: 404 })
    }

    const { data: signed, error: signError } = await supabase.storage
      .from('speaker-disclosures')
      .createSignedUrl(disclosure.pdf_storage_path, 300)

    if (signError || !signed?.signedUrl) {
      console.error('disclosure signed-pdf sign error:', { eventId, id, error: signError })
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
    }

    return NextResponse.json({ url: signed.signedUrl })
  } catch (e) {
    console.error('disclosure signed-pdf GET error:', { eventId, id, error: e })
    return NextResponse.json({ error: 'Failed to load signed URL' }, { status: 500 })
  }
}
