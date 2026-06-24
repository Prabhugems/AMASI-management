import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/api-auth'

const normalizeText = (v: unknown) => typeof v === 'string' ? (v.trim() || null) : v

const NULLABLE_TEXT_FIELDS = [
  'title', 'phone', 'phone_secondary', 'whatsapp',
  'designation', 'department', 'institution', 'institution_type', 'institution_city',
  'qualification', 'specialty', 'sub_specialty',
  'bio', 'bio_markdown', 'youtube_reel_url', 'photo_url',
  'linkedin', 'twitter', 'researchgate', 'website', 'orcid_id', 'pubmed_id',
  'address', 'city', 'state', 'pincode', 'country',
  'dietary_preference', 'tshirt_size', 'preferred_contact',
  'reviewer_specialties', 'email_secondary',
] as const

// Financial / PII / status fields (pan_number, gst_number, bank_*, status, internal_notes,
// blacklist_reason) are deliberately excluded — they need a separate super-admin-only endpoint.
// requireAdmin() admits any event_admin, including newly-registered team members.
const UPDATABLE_FIELDS = [
  'title', 'name', 'email', 'email_secondary',
  'phone', 'phone_secondary', 'whatsapp',
  'designation', 'department', 'institution', 'institution_type', 'institution_city',
  'qualification', 'specialty', 'sub_specialty', 'experience_years',
  'bio', 'bio_markdown', 'expertise_tags', 'headshot_urls', 'youtube_reel_url',
  'photo_url', 'areas_of_interest',
  'linkedin', 'twitter', 'researchgate', 'website', 'orcid_id', 'pubmed_id',
  'address', 'city', 'state', 'pincode', 'country',
  'dietary_preference', 'tshirt_size', 'preferred_contact',
  'is_reviewer', 'reviewer_specialties',
] as const

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ facultyId: string }> }
) {
  const { facultyId } = await params

  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const supabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('faculty')
    .select('*')
    .eq('id', facultyId)
    .maybeSingle()

  if (error) {
    console.error('Faculty GET error', { facultyId, error })
    return NextResponse.json({ error: 'Failed to load faculty' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Faculty not found' }, { status: 404 })
  }

  return NextResponse.json({ data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ facultyId: string }> }
) {
  const { facultyId } = await params

  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const supabase = await createAdminClient()

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const field of UPDATABLE_FIELDS) {
    if (field in body) update[field] = body[field]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  // Validate array fields
  for (const field of ['expertise_tags', 'areas_of_interest'] as const) {
    if (field in update) {
      const value = update[field]
      if (
        !Array.isArray(value) ||
        !value.every((t) => typeof t === 'string')
      ) {
        return NextResponse.json(
          { error: `${field} must be an array of strings` },
          { status: 400 }
        )
      }
    }
  }

  // Validate headshot_urls: array of objects each having a string `url`
  if ('headshot_urls' in update) {
    const value = update.headshot_urls
    const isValid =
      Array.isArray(value) &&
      value.every(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          !Array.isArray(item) &&
          typeof (item as { url?: unknown }).url === 'string'
      )
    if (!isValid) {
      return NextResponse.json(
        { error: 'headshot_urls must be an array of objects with a string url' },
        { status: 400 }
      )
    }
  }

  if (typeof update.email === 'string') {
    const trimmed = update.email.trim().toLowerCase()
    update.email = trimmed || null
  }
  if (typeof update.name === 'string') update.name = update.name.trim()
  if (typeof update.name === 'string' && !update.name) {
    return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
  }

  // Normalize empty/whitespace strings to null for nullable text fields
  for (const field of NULLABLE_TEXT_FIELDS) {
    if (field in update) {
      update[field] = normalizeText(update[field])
    }
  }

  if (typeof update.email === 'string') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clash } = await (supabase as any)
      .from('faculty')
      .select('id')
      .eq('email', update.email)
      .neq('id', facultyId)
      .maybeSingle()
    if (clash) {
      return NextResponse.json({ error: 'Another faculty already uses this email' }, { status: 409 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('faculty')
    .update(update)
    .eq('id', facultyId)
    .select()
    .single()

  if (error) {
    console.error('Faculty PATCH error', { facultyId, error })
    return NextResponse.json({ error: 'Failed to update faculty' }, { status: 500 })
  }

  return NextResponse.json({ data, success: true })
}
