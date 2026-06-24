import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

const BUCKET = 'speaker-content'
const MAX_BYTES = 100 * 1024 * 1024

const CONTENT_TYPES = ['slides', 'handout', 'video', 'poster', 'supplementary'] as const
type ContentType = typeof CONTENT_TYPES[number]

const ALLOWED_EXT = [
  'pdf', 'ppt', 'pptx', 'doc', 'docx',
  'mp4', 'mov', 'webm',
  'jpg', 'jpeg', 'png', 'webp', 'zip',
]

// Mirrors the bucket allow-list (13 MIME types).
const ALLOWED_MIME = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
]

function maskToken(token: string): string {
  if (!token) return '<empty>'
  return `${token.slice(0, 6)}...`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveSpeakerToken(supabase: any, token: string) {
  const { data: tokenRow } = await supabase
    .from('faculty_assignments')
    .select('id, event_id, faculty_id, faculty_email, faculty_name')
    .eq('invitation_token', token)
    .maybeSingle()
  return tokenRow
}

// POST /api/speaker/[token]/content/upload-url
// Returns a signed upload URL the client uses to PUT the file directly to
// Supabase Storage. The client then calls POST /api/speaker/[token]/content
// with the resulting publicUrl + path to register the row.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createAdminClient()

  let body: {
    faculty_assignment_id?: string
    content_type?: string
    file_name?: string
    content_type_mime?: string
    size?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { faculty_assignment_id, content_type, file_name, content_type_mime, size } = body

  if (!faculty_assignment_id || !content_type || !file_name || !content_type_mime) {
    return NextResponse.json(
      { error: 'faculty_assignment_id, content_type, file_name, content_type_mime are required' },
      { status: 400 }
    )
  }
  if (!CONTENT_TYPES.includes(content_type as ContentType)) {
    return NextResponse.json(
      { error: `content_type must be one of: ${CONTENT_TYPES.join(', ')}` },
      { status: 400 }
    )
  }
  if (typeof size !== 'number' || size <= 0) {
    return NextResponse.json({ error: 'size must be a positive number' }, { status: 400 })
  }
  if (size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 100MB limit' }, { status: 400 })
  }
  if (!ALLOWED_MIME.includes(content_type_mime)) {
    return NextResponse.json(
      { error: `content_type_mime must be one of: ${ALLOWED_MIME.join(', ')}` },
      { status: 400 }
    )
  }

  const rawExt = file_name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
  if (!ALLOWED_EXT.includes(rawExt)) {
    return NextResponse.json(
      { error: `file_name extension must be one of: ${ALLOWED_EXT.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const tokenRow = await resolveSpeakerToken(supabase, token)
    if (!tokenRow) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    }

    // Ownership check.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let siblingsQuery = (supabase as any)
      .from('faculty_assignments')
      .select('id')
      .eq('event_id', tokenRow.event_id)
    if (tokenRow.faculty_email) {
      siblingsQuery = siblingsQuery.eq('faculty_email', tokenRow.faculty_email)
    } else {
      siblingsQuery = siblingsQuery.eq('faculty_name', tokenRow.faculty_name)
    }
    const { data: siblings } = await siblingsQuery
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const siblingIds = ((siblings ?? []) as any[]).map((r) => r.id)
    if (!siblingIds.includes(faculty_assignment_id)) {
      console.error('speaker content upload-url forbidden:', {
        token: maskToken(token),
        faculty_assignment_id,
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Deadline check.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings } = await (supabase as any)
      .from('event_settings')
      .select('speaker_content_deadline')
      .eq('event_id', tokenRow.event_id)
      .maybeSingle()
    const deadline = (settings?.speaker_content_deadline as string | null) ?? null
    if (deadline && new Date(deadline) < new Date()) {
      return NextResponse.json({ error: 'Upload deadline has passed' }, { status: 400 })
    }

    const randomSuffix = Math.random().toString(36).slice(2, 8)
    const path = `events/${tokenRow.event_id}/${faculty_assignment_id}/${content_type}/${Date.now()}-${randomSuffix}.${rawExt}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).storage
      .from(BUCKET)
      .createSignedUploadUrl(path)

    if (error) {
      console.error('speaker content signed-url error:', {
        token: maskToken(token),
        faculty_assignment_id,
        error,
      })
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
  } catch (e) {
    console.error('speaker content upload-url error:', {
      token: maskToken(token),
      error: e,
    })
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 })
  }
}
