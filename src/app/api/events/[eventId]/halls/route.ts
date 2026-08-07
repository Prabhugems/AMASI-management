import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

const createSchema = z.object({
  name: z.string().min(1),
  capacity: z.number().int().positive().nullable().optional(),
  floor: z.string().nullable().optional(),
  display_order: z.number().int().optional(),
  // Nesting: a screen carries a parent_id; a hall does not. See
  // supabase/migrations/20260807_agenda_halls_nesting.sql.
  parent_id: z.string().uuid().nullable().optional(),
  kind: z.enum(["hall", "screen"]).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const supabase = (await createAdminClient()) as any
  const { data, error } = await supabase
    .from("halls")
    .select("*")
    .eq("event_id", eventId)
    .order("display_order")

  if (error) return NextResponse.json({ error: "Failed to fetch halls" }, { status: 500 })

  // Returned flat; the caller shapes the tree with buildVenueTree() so the
  // grouping rules live in one tested place rather than being duplicated here.
  return NextResponse.json({ data })
}

/**
 * Resolve the parent of a would-be screen, rejecting the two cases the database
 * CHECK constraints cannot express because they need a lookup:
 *   - a parent in a different event
 *   - a parent that is itself a screen (nesting deeper than two levels)
 */
async function validateParent(
  supabase: any,
  eventId: string,
  parentId: string
): Promise<NextResponse | null> {
  const { data: parent, error } = await supabase
    .from("halls")
    .select("id, event_id, parent_id")
    .eq("id", parentId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: "Failed to verify parent hall" }, { status: 500 })
  if (!parent) return NextResponse.json({ error: "Parent hall not found" }, { status: 404 })
  if (parent.event_id !== eventId) {
    return NextResponse.json({ error: "Parent hall belongs to a different event" }, { status: 400 })
  }
  if (parent.parent_id) {
    return NextResponse.json({ error: "Screens can't be nested inside other screens" }, { status: 400 })
  }
  return null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const { parent_id, kind, ...rest } = parsed.data
  // A row with a parent is a screen whether or not the caller said so, and a row
  // without one is a hall. Deriving it here keeps the two fields from ever
  // disagreeing, which the halls_two_level_tree CHECK would otherwise reject
  // with a message no coordinator could act on.
  const resolvedKind = parent_id ? "screen" : "hall"
  if (kind && kind !== resolvedKind) {
    return NextResponse.json(
      { error: `A ${kind} ${parent_id ? "cannot" : "must"} have a parent hall` },
      { status: 400 }
    )
  }

  const supabase = (await createAdminClient()) as any

  if (parent_id) {
    const parentError = await validateParent(supabase, eventId, parent_id)
    if (parentError) return parentError
  }

  const { data, error } = await supabase
    .from("halls")
    .insert({ event_id: eventId, parent_id: parent_id ?? null, kind: resolvedKind, ...rest })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: "Failed to create hall" }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
