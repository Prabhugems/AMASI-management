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

/**
 * A room sharing a name with one of its siblings, if any.
 *
 * Two "Hall A"s in one event are indistinguishable to a delegate and to the
 * Session Builder's location picker, which lists rooms by name. Scoped to
 * siblings so "Screen 1" under two different halls stays legal — that reads as
 * "Hall A › Screen 1", which is unambiguous.
 *
 * Compared case- and whitespace-insensitively, matching the unique indexes in
 * 20260808_halls_unique_name.sql. Those indexes are the real guarantee; this
 * exists so the caller gets a message naming the room it collided with.
 */
async function findDuplicateName(
  supabase: any,
  eventId: string,
  parentId: string | null,
  name: string
): Promise<{ id: string; name: string } | null> {
  const normalise = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ")

  let query = supabase.from("halls").select("id, name").eq("event_id", eventId)
  query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null)

  const { data } = await query
  const target = normalise(name)
  return (
    ((data ?? []) as Array<{ id: string; name: string }>).find(
      (h) => normalise(h.name) === target
    ) ?? null
  )
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

  const duplicate = await findDuplicateName(supabase, eventId, parent_id ?? null, rest.name)
  if (duplicate) {
    return NextResponse.json(
      {
        error: parent_id
          ? `This hall already has a ${duplicate.name}.`
          : `You already have a ${duplicate.name}.`,
        conflictsWith: duplicate.id,
      },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from("halls")
    .insert({ event_id: eventId, parent_id: parent_id ?? null, kind: resolvedKind, ...rest })
    .select("*")
    .single()

  if (error) {
    // The unique index is the real authority; the check above is only there to
    // return a useful message. A race between the two lands here.
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: `You already have a ${rest.name}.` }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to create hall" }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}
