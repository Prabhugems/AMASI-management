import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/api-auth'

const BUCKET = 'speaker-headshots'
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'avif']
// Defense-in-depth: extension must match content_type. Blocks e.g. an .exe declared as image/png.
const MIME_TO_EXT: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/avif': ['avif'],
}

// POST /api/faculty/[facultyId]/headshots/upload-url
// Returns a signed upload URL the client uses to PUT the headshot directly to Supabase Storage.
// Client should then POST /api/faculty/[facultyId]/headshots with the resulting publicUrl.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ facultyId: string }> }
) {
  const { facultyId } = await params
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  let body: { file_name?: string; content_type?: string; size?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.file_name) {
    return NextResponse.json({ error: 'file_name is required' }, { status: 400 })
  }
  if (!body.content_type || !ALLOWED_MIME.includes(body.content_type)) {
    return NextResponse.json(
      { error: `content_type must be one of: ${ALLOWED_MIME.join(', ')}` },
      { status: 400 }
    )
  }
  if (typeof body.size === 'number' && body.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: faculty } = await (supabase as any)
    .from('faculty')
    .select('id')
    .eq('id', facultyId)
    .maybeSingle()
  if (!faculty) {
    return NextResponse.json({ error: 'Faculty not found' }, { status: 404 })
  }

  const rawExt = body.file_name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
  if (!ALLOWED_EXT.includes(rawExt)) {
    return NextResponse.json(
      { error: `file_name extension must be one of: ${ALLOWED_EXT.join(', ')}` },
      { status: 400 }
    )
  }
  const allowedExtsForMime = MIME_TO_EXT[body.content_type] ?? []
  if (!allowedExtsForMime.includes(rawExt)) {
    return NextResponse.json(
      { error: `file_name extension .${rawExt} does not match content_type ${body.content_type}` },
      { status: 400 }
    )
  }
  const ext = rawExt
  // Append a short random suffix so two uploads in the same ms don't collide on the storage path.
  const suffix = Math.random().toString(36).slice(2, 8)
  const path = `faculty/${facultyId}/${Date.now()}-${suffix}.${ext}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).storage
    .from(BUCKET)
    .createSignedUploadUrl(path)

  if (error) {
    console.error('Headshot signed-url error:', { facultyId, error })
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: urlData } = (supabase as any).storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({
    signedUrl: data.signedUrl,
    token: data.token,
    path,
    publicUrl: urlData.publicUrl,
  })
}
