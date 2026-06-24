import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

const HONORARIUM_STATUSES = [
  'not_eligible',
  'pending',
  'approved',
  'processing',
  'paid',
  'rejected',
] as const
type HonorariumStatus = typeof HONORARIUM_STATUSES[number]

const PAYMENT_METHODS = ['upi', 'bank', 'cheque', 'cash', 'waived'] as const
type PaymentMethod = typeof PAYMENT_METHODS[number]

const PATCHABLE_FIELDS = [
  'honorarium_applicable',
  'honorarium_amount',
  'honorarium_currency',
  'honorarium_status',
  'honorarium_paid_date',
  'honorarium_reference',
  'payment_method',
  'tds_deducted',
  'notes',
] as const

// GET /api/events/[eventId]/honoraria/[id]
// Returns the full event_faculty row joined with the FULL faculty profile
// (including bank/PAN — sensitive). Access is logged.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  const { eventId, id } = await params
  const { error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  console.info('honoraria detail accessed', { eventId, id })

  try {
    const supabase = await createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('event_faculty')
      .select(`
        *,
        faculty:faculty_id (
          id,
          name,
          email,
          designation,
          institution,
          phone,
          bank_name,
          bank_account_number,
          bank_ifsc,
          pan_number,
          gst_number
        )
      `)
      .eq('event_id', eventId)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('honoraria detail fetch error:', { eventId, id, error })
      return NextResponse.json({ error: 'Failed to load honorarium' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (e) {
    console.error('honoraria detail GET error:', { eventId, id, error: e })
    return NextResponse.json({ error: 'Failed to load honorarium' }, { status: 500 })
  }
}

// PATCH /api/events/[eventId]/honoraria/[id]
// Whitelisted field updates with status / payment_method enum validation.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  const { eventId, id } = await params
  const { error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Whitelist
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {}
  for (const key of PATCHABLE_FIELDS) {
    if (key in body) {
      update[key] = body[key]
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  // Validate honorarium_status enum
  if ('honorarium_status' in update) {
    const status = update.honorarium_status
    if (status !== null && !HONORARIUM_STATUSES.includes(status as HonorariumStatus)) {
      return NextResponse.json(
        { error: `honorarium_status must be one of: ${HONORARIUM_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }
  }

  // Validate payment_method enum
  if ('payment_method' in update) {
    const pm = update.payment_method
    if (pm !== null && pm !== '' && !PAYMENT_METHODS.includes(pm as PaymentMethod)) {
      return NextResponse.json(
        { error: `payment_method must be one of: ${PAYMENT_METHODS.join(', ')}` },
        { status: 400 }
      )
    }
    if (pm === '') update.payment_method = null
  }

  // Normalize currency
  if (typeof update.honorarium_currency === 'string' && update.honorarium_currency.trim()) {
    update.honorarium_currency = update.honorarium_currency.trim().toUpperCase()
  }

  try {
    const supabase = await createAdminClient()

    // Detect whether `notes` column exists; if not, drop silently.
    if ('notes' in update) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const probe = await (supabase as any)
        .from('event_faculty')
        .select('notes')
        .eq('id', id)
        .limit(1)
      if (probe.error && /column .*notes.* does not exist/i.test(probe.error.message ?? '')) {
        delete update.notes
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('event_faculty')
      .update(update)
      .eq('id', id)
      .eq('event_id', eventId)
      .select('*')
      .maybeSingle()

    if (error) {
      console.error('honoraria detail patch error:', { eventId, id, error })
      return NextResponse.json({ error: 'Failed to update honorarium' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (e) {
    console.error('honoraria detail PATCH error:', { eventId, id, error: e })
    return NextResponse.json({ error: 'Failed to update honorarium' }, { status: 500 })
  }
}
