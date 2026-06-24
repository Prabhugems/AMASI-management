import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/api-auth'

const BUCKET = 'speaker-headshots'
const MAX_HEADSHOTS = 10

// Headshot URLs must point to a file under faculty/<facultyId>/ inside our public bucket.
// This blocks two abuse paths: registering another faculty's URL into this faculty's library
// (then a DELETE here would remove the other faculty's storage object), and pointing the
// register endpoint at an arbitrary external image (which would render in our admin UI as if
// hosted by us). We do not validate that the object actually exists — a missing file just
// shows a broken image, not a security issue.
function isOwnedHeadshotUrl(url: string, facultyId: string): boolean {
  const match = url.match(/\/storage\/v1\/object\/public\/speaker-headshots\/(.+)$/)
  if (!match) return false
  const path = match[1]
  // Reject path traversal even though Supabase normalizes — defense in depth.
  if (path.includes('..')) return false
  return path.startsWith(`faculty/${facultyId}/`)
}

type Headshot = {
  url: string
  label?: string
  uploaded_at: string
  is_primary?: boolean
}

async function loadHeadshots(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  facultyId: string
): Promise<Headshot[] | { error: NextResponse }> {
  const { data, error } = await supabase
    .from('faculty')
    .select('id, headshot_urls')
    .eq('id', facultyId)
    .maybeSingle()

  if (error) {
    console.error('Faculty headshot load error:', { facultyId, error })
    return { error: NextResponse.json({ error: 'Failed to load faculty' }, { status: 500 }) }
  }
  if (!data) {
    return { error: NextResponse.json({ error: 'Faculty not found' }, { status: 404 }) }
  }
  return (data.headshot_urls as Headshot[] | null) ?? []
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ facultyId: string }> }
) {
  const { facultyId } = await params
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const supabase = await createAdminClient()
  const result = await loadHeadshots(supabase, facultyId)
  if ('error' in result) return result.error

  return NextResponse.json({ data: result })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ facultyId: string }> }
) {
  const { facultyId } = await params
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const supabase = await createAdminClient()

  let body: { url?: string; label?: string; is_primary?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  if (!isOwnedHeadshotUrl(body.url, facultyId)) {
    return NextResponse.json(
      { error: 'url must point to a file under faculty/' + facultyId + '/ in the speaker-headshots bucket' },
      { status: 400 }
    )
  }

  // Verify the storage object actually exists before registering — catches the dangling
  // case where a client POSTs a URL without ever uploading to it.
  const objectPath = body.url.match(/\/storage\/v1\/object\/public\/speaker-headshots\/(.+)$/)?.[1]
  const filename = objectPath?.split('/').pop()
  if (!filename) {
    return NextResponse.json({ error: 'url does not contain a valid object path' }, { status: 400 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: listing, error: listError } = await (supabase as any).storage
    .from(BUCKET)
    .list(`faculty/${facultyId}`, { search: filename })
  if (listError) {
    console.error('Faculty headshot storage list error:', { facultyId, error: listError })
    return NextResponse.json({ error: 'Failed to verify storage object' }, { status: 500 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const found = (listing ?? []).some((o: any) => o.name === filename)
  if (!found) {
    return NextResponse.json(
      { error: 'Storage object not found — upload first' },
      { status: 400 }
    )
  }

  // Read-modify-write — concurrent uploads from two tabs may lose one. Acceptable for Phase 1.
  const existing = await loadHeadshots(supabase, facultyId)
  if ('error' in existing) return existing.error

  // Cap on JSONB array size — prevents row bloat from an attacker (or a runaway client)
  // looping the register endpoint. Skip the cap if the URL is already in the list (idempotent re-register).
  const alreadyPresent = existing.some((h) => h.url === body.url)
  if (!alreadyPresent && existing.length >= MAX_HEADSHOTS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_HEADSHOTS} headshots allowed; delete one first.` },
      { status: 400 }
    )
  }

  const newEntry: Headshot = {
    url: body.url,
    label: body.label?.trim() || undefined,
    uploaded_at: new Date().toISOString(),
    is_primary: body.is_primary === true,
  }

  let next = existing.filter((h) => h.url !== newEntry.url)
  if (newEntry.is_primary) {
    next = next.map((h) => ({ ...h, is_primary: false }))
  } else if (next.length === 0) {
    // First headshot is automatically primary
    newEntry.is_primary = true
  }
  next.push(newEntry)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('faculty')
    .update({ headshot_urls: next })
    .eq('id', facultyId)

  if (error) {
    console.error('Faculty headshot insert error:', { facultyId, error })
    return NextResponse.json({ error: 'Failed to save headshot' }, { status: 500 })
  }

  return NextResponse.json({ data: next, success: true })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ facultyId: string }> }
) {
  const { facultyId } = await params
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const supabase = await createAdminClient()

  let body: { primary_url?: string; url?: string; label?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.primary_url && !body.url) {
    return NextResponse.json({ error: 'primary_url or url required' }, { status: 400 })
  }
  if (body.url && body.label === undefined) {
    return NextResponse.json(
      { error: 'Provide label to rename; or primary_url to set primary' },
      { status: 400 }
    )
  }

  const existing = await loadHeadshots(supabase, facultyId)
  if ('error' in existing) return existing.error

  let next = existing
  if (body.primary_url) {
    const target = existing.find((h) => h.url === body.primary_url)
    if (!target) {
      return NextResponse.json({ error: 'Headshot not found' }, { status: 404 })
    }
    next = existing.map((h) => ({ ...h, is_primary: h.url === body.primary_url }))
  }
  if (body.url && body.label !== undefined) {
    next = next.map((h) => (h.url === body.url ? { ...h, label: body.label } : h))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('faculty')
    .update({ headshot_urls: next })
    .eq('id', facultyId)

  if (error) {
    console.error('Faculty headshot patch error:', { facultyId, error })
    return NextResponse.json({ error: 'Failed to update headshot' }, { status: 500 })
  }

  return NextResponse.json({ data: next, success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ facultyId: string }> }
) {
  const { facultyId } = await params
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const url = new URL(request.url).searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'url query param required' }, { status: 400 })
  }

  const supabase = await createAdminClient()
  const existing = await loadHeadshots(supabase, facultyId)
  if ('error' in existing) return existing.error

  const target = existing.find((h) => h.url === url)
  if (!target) {
    return NextResponse.json({ error: 'Headshot not found' }, { status: 404 })
  }

  let next = existing.filter((h) => h.url !== url)
  // If we removed the primary and others remain, promote the first one.
  if (target.is_primary && next.length > 0 && !next.some((h) => h.is_primary)) {
    next = next.map((h, i) => ({ ...h, is_primary: i === 0 }))
  }

  // Best-effort delete from storage only if the URL is owned by this faculty.
  // The isOwnedHeadshotUrl check guards against the registered URL pointing at another
  // faculty's storage object even if it somehow slipped past the POST validation
  // (e.g. legacy rows from before validation was added).
  if (isOwnedHeadshotUrl(url, facultyId)) {
    const path = url.match(/\/storage\/v1\/object\/public\/speaker-headshots\/(.+)$/)?.[1]
    if (path) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).storage.from(BUCKET).remove([path])
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('faculty')
    .update({ headshot_urls: next })
    .eq('id', facultyId)

  if (error) {
    console.error('Faculty headshot delete error:', { facultyId, error })
    return NextResponse.json({ error: 'Failed to delete headshot' }, { status: 500 })
  }

  return NextResponse.json({ data: next, success: true })
}
