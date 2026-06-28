import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

type HonorariumStatus =
  | 'not_eligible'
  | 'pending'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'rejected'

const PAYMENT_METHODS = ['upi', 'bank', 'cheque', 'cash', 'waived'] as const
type PaymentMethod = typeof PAYMENT_METHODS[number]

// GET /api/events/[eventId]/honoraria
// Lists event_faculty rows joined with the public-safe faculty profile
// (no bank/PAN). Sorted by faculty.name ASC.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

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
          phone
        )
      `)
      .eq('event_id', eventId)

    if (error) {
      console.error('honoraria list error:', { eventId, error })
      return NextResponse.json({ error: 'Failed to load honoraria' }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sorted = ((data ?? []) as any[]).slice().sort((a, b) => {
      const an = (a?.faculty?.name ?? '').toLowerCase()
      const bn = (b?.faculty?.name ?? '').toLowerCase()
      return an.localeCompare(bn)
    })

    return NextResponse.json({ data: sorted })
  } catch (e) {
    console.error('honoraria GET error:', { eventId, error: e })
    return NextResponse.json({ error: 'Failed to load honoraria' }, { status: 500 })
  }
}

// POST /api/events/[eventId]/honoraria
// Bulk actions: approve | mark_paid
// Body: { ids: string[], action: 'approve' | 'mark_paid', payload?: {...} }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, 'speakers')
  if (authError) return authError

  let body: {
    ids?: unknown
    action?: unknown
    payload?: {
      amount?: number
      currency?: string
      payment_method?: string
      honorarium_reference?: string
      honorarium_paid_date?: string
      tds_deducted?: number
    }
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).filter((v): v is string => typeof v === 'string') : []
  const action = body.action
  const payload = body.payload ?? {}

  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array of event_faculty ids' }, { status: 400 })
  }
  if (action !== 'approve' && action !== 'mark_paid') {
    return NextResponse.json({ error: "action must be 'approve' or 'mark_paid'" }, { status: 400 })
  }

  // payment_method validation if provided
  if (payload.payment_method && !PAYMENT_METHODS.includes(payload.payment_method as PaymentMethod)) {
    return NextResponse.json(
      { error: `payment_method must be one of: ${PAYMENT_METHODS.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const supabase = await createAdminClient()

    // Fetch the candidate rows scoped to this event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: candidateRows, error: fetchError } = await (supabase as any)
      .from('event_faculty')
      .select('id, honorarium_status, honorarium_amount, honorarium_currency')
      .eq('event_id', eventId)
      .in('id', ids)

    if (fetchError) {
      console.error('honoraria bulk fetch error:', { eventId, error: fetchError })
      return NextResponse.json({ error: 'Failed to load target rows' }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (candidateRows ?? []) as any[]

    if (action === 'approve') {
      // Only rows currently 'pending'
      const eligible = rows.filter((r) => r.honorarium_status === 'pending').map((r) => r.id as string)
      if (eligible.length === 0) {
        return NextResponse.json({ data: [], updated_count: 0 })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const update: Record<string, any> = {
        honorarium_status: 'approved' satisfies HonorariumStatus,
      }
      if (typeof payload.amount === 'number' && !Number.isNaN(payload.amount)) {
        update.honorarium_amount = payload.amount
      }
      if (typeof payload.currency === 'string' && payload.currency.trim()) {
        update.honorarium_currency = payload.currency.trim().toUpperCase()
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updated, error: updateError } = await (supabase as any)
        .from('event_faculty')
        .update(update)
        .in('id', eligible)
        .eq('event_id', eventId)
        .select('*')

      if (updateError) {
        console.error('honoraria bulk approve error:', { eventId, error: updateError })
        return NextResponse.json({ error: 'Failed to approve honoraria' }, { status: 500 })
      }

      return NextResponse.json({ data: updated ?? [], updated_count: (updated ?? []).length })
    }

    // mark_paid — eligible rows are 'approved' or 'processing'
    const eligible = rows
      .filter((r) => r.honorarium_status === 'approved' || r.honorarium_status === 'processing')
      .map((r) => r.id as string)

    if (eligible.length === 0) {
      return NextResponse.json({ data: [], updated_count: 0 })
    }

    const paidDate = payload.honorarium_paid_date && payload.honorarium_paid_date.trim()
      ? payload.honorarium_paid_date.trim()
      : new Date().toISOString().slice(0, 10) // DATE column → YYYY-MM-DD

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {
      honorarium_status: 'paid' satisfies HonorariumStatus,
      honorarium_paid_date: paidDate,
    }
    if (typeof payload.honorarium_reference === 'string' && payload.honorarium_reference.trim()) {
      update.honorarium_reference = payload.honorarium_reference.trim()
    }
    if (payload.payment_method) {
      update.payment_method = payload.payment_method
    }
    if (typeof payload.tds_deducted === 'number' && !Number.isNaN(payload.tds_deducted)) {
      update.tds_deducted = payload.tds_deducted
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error: updateError } = await (supabase as any)
      .from('event_faculty')
      .update(update)
      .in('id', eligible)
      .eq('event_id', eventId)
      .select('*')

    if (updateError) {
      console.error('honoraria bulk mark_paid error:', { eventId, error: updateError })
      return NextResponse.json({ error: 'Failed to mark honoraria paid' }, { status: 500 })
    }

    return NextResponse.json({ data: updated ?? [], updated_count: (updated ?? []).length })
  } catch (e) {
    console.error('honoraria POST error:', { eventId, error: e })
    return NextResponse.json({ error: 'Failed to apply bulk action' }, { status: 500 })
  }
}
