import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Tokenize text into lowercase words (3+ chars) for matching
function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length >= 3)
  )
}

// Compute specialty match score between a reviewer's specialty and an abstract's text signals
function specialtyScore(
  reviewerSpecialty: string | null,
  abstractTitle: string,
  abstractKeywords: string[] | null,
  categoryName: string | null
): number {
  if (!reviewerSpecialty) return 0

  const specTokens = tokenize(reviewerSpecialty)
  if (specTokens.size === 0) return 0

  // Build abstract text tokens from title + keywords + category
  const abstractText = [
    abstractTitle,
    ...(abstractKeywords || []),
    categoryName || "",
  ].join(" ")
  const absTokens = tokenize(abstractText)

  // Count matching tokens
  let matches = 0
  for (const token of specTokens) {
    if (absTokens.has(token)) matches++
  }

  return matches
}

// POST — Auto-assign abstracts to reviewers (round-robin, least-loaded)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    if (!uuidRegex.test(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
    }

    const { error: authError } = await requireEventAndPermission(eventId, 'abstracts')
    if (authError) return authError

    const adminClient: SupabaseClient = await createAdminClient()

    // Fetch settings
    const { data: settings } = await adminClient
      .from("abstract_settings")
      .select("reviewers_per_abstract")
      .eq("event_id", eventId)
      .maybeSingle()

    const reviewersPerAbstract = settings?.reviewers_per_abstract ?? 2

    // Fetch active reviewers (include specialty for matching)
    const { data: reviewers, error: rErr } = await adminClient
      .from("abstract_reviewers")
      .select("id, name, email, specialty, assigned_abstracts")
      .eq("event_id", eventId)
      .eq("status", "active")

    if (rErr || !reviewers || reviewers.length === 0) {
      return NextResponse.json(
        { error: "No active reviewers found" },
        { status: 400 }
      )
    }

    // Fetch abstracts with title, keywords, and category name for specialty matching
    const { data: abstracts, error: aErr } = await adminClient
      .from("abstracts")
      .select("id, title, keywords, category:abstract_categories(name)")
      .eq("event_id", eventId)
      .in("status", ["submitted", "under_review"])

    if (aErr || !abstracts || abstracts.length === 0) {
      return NextResponse.json(
        { error: "No eligible abstracts found" },
        { status: 400 }
      )
    }

    // Build load map (how many abstracts each reviewer currently has)
    const loadMap = new Map<string, number>()
    reviewers.forEach((r: any) => {
      loadMap.set(r.id, (r.assigned_abstracts || []).length)
    })

    // Build assignment map (reviewer id -> set of abstract ids)
    const assignmentMap = new Map<string, Set<string>>()
    reviewers.forEach((r: any) => {
      assignmentMap.set(r.id, new Set(r.assigned_abstracts || []))
    })

    const shuffledAbstracts = shuffle(abstracts as any[])
    const assignments: { abstract_id: string; reviewer_ids: string[] }[] = []

    for (const abs of shuffledAbstracts) {
      const absTitle: string = abs.title || ""
      const absKeywords: string[] | null = abs.keywords
      const catName: string | null = abs.category?.name || null

      // Sort reviewers: specialty match (desc) → load (asc) → random tiebreak
      const sorted = [...reviewers].sort((a: any, b: any) => {
        const scoreA = specialtyScore(a.specialty, absTitle, absKeywords, catName)
        const scoreB = specialtyScore(b.specialty, absTitle, absKeywords, catName)
        if (scoreB !== scoreA) return scoreB - scoreA // higher match first
        return (loadMap.get(a.id) || 0) - (loadMap.get(b.id) || 0) // lower load first
      })

      const assigned: string[] = []
      for (const reviewer of sorted) {
        if (assigned.length >= reviewersPerAbstract) break
        // Skip if already assigned to this abstract
        if (assignmentMap.get(reviewer.id)!.has(abs.id)) continue
        assigned.push(reviewer.id)
        assignmentMap.get(reviewer.id)!.add(abs.id)
        loadMap.set(reviewer.id, (loadMap.get(reviewer.id) || 0) + 1)
      }

      if (assigned.length > 0) {
        assignments.push({ abstract_id: abs.id, reviewer_ids: assigned })
      }
    }

    // Update each reviewer's assigned_abstracts in DB
    for (const reviewer of reviewers) {
      const newAssigned = Array.from(assignmentMap.get(reviewer.id)!)
      await adminClient
        .from("abstract_reviewers")
        .update({ assigned_abstracts: newAssigned })
        .eq("id", reviewer.id)
    }

    return NextResponse.json({
      total_abstracts: abstracts.length,
      total_reviewers: reviewers.length,
      reviewers_per_abstract: reviewersPerAbstract,
      assignments,
    })
  } catch (error) {
    console.error("Error in POST /assign:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT — Reassign unreviewed abstracts from one set of reviewers to others
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    if (!uuidRegex.test(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
    }

    const { error: putAuthError } = await requireEventAndPermission(eventId, 'abstracts')
    if (putAuthError) return putAuthError

    const adminClient: SupabaseClient = await createAdminClient()

    return await reassignPending(adminClient, eventId)
  } catch (error) {
    console.error("Error in PUT /assign:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE — Clear all assignments
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    if (!uuidRegex.test(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
    }

    const { error: delAuthError } = await requireEventAndPermission(eventId, 'abstracts')
    if (delAuthError) return delAuthError

    const adminClient: SupabaseClient = await createAdminClient()

    const { error } = await adminClient
      .from("abstract_reviewers")
      .update({ assigned_abstracts: [] })
      .eq("event_id", eventId)

    if (error) {
      console.error("Error clearing assignments:", error)
      return NextResponse.json({ error: "Failed to clear assignments" }, { status: 500 })
    }

    return NextResponse.json({ cleared: true })
  } catch (error) {
    console.error("Error in DELETE /assign:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Shared reassignment logic (used by PUT and cron)
export async function reassignPending(adminClient: SupabaseClient, eventId: string) {
  // Fetch active reviewers (include specialty for matching)
  const { data: reviewers, error: rErr } = await adminClient
    .from("abstract_reviewers")
    .select("id, name, email, specialty, assigned_abstracts")
    .eq("event_id", eventId)
    .eq("status", "active")

  if (rErr || !reviewers || reviewers.length === 0) {
    return NextResponse.json({ error: "No active reviewers" }, { status: 400 })
  }

  // Fetch all abstracts with details for specialty matching
  const { data: allAbstracts } = await adminClient
    .from("abstracts")
    .select("id, title, keywords, category:abstract_categories(name)")
    .eq("event_id", eventId)

  const abstractIds = (allAbstracts || []).map((a: any) => a.id)

  // Build abstract lookup for specialty matching
  const abstractLookup = new Map<string, any>()
  ;(allAbstracts || []).forEach((a: any) => abstractLookup.set(a.id, a))

  const { data: allReviews } = await adminClient
    .from("abstract_reviews")
    .select("abstract_id, reviewer_email")
    .in("abstract_id", abstractIds.length > 0 ? abstractIds : ["__none__"])

  // Build set of (reviewer_email, abstract_id) that have been reviewed
  const reviewedSet = new Set<string>()
  ;(allReviews || []).forEach((r: any) => {
    reviewedSet.add(`${r.reviewer_email}:${r.abstract_id}`)
  })

  // For each reviewer, find assigned abstracts that have NOT been reviewed by them
  const unreviewedItems: { reviewer_id: string; abstract_id: string }[] = []
  const fromReviewers: string[] = []

  for (const reviewer of reviewers) {
    const assigned: string[] = reviewer.assigned_abstracts || []
    const unreviewed = assigned.filter(
      (aid: string) => !reviewedSet.has(`${reviewer.email}:${aid}`)
    )

    if (unreviewed.length > 0) {
      fromReviewers.push(reviewer.name)
      // Remove unreviewed from this reviewer
      const remaining = assigned.filter(
        (aid: string) => reviewedSet.has(`${reviewer.email}:${aid}`)
      )
      await adminClient
        .from("abstract_reviewers")
        .update({ assigned_abstracts: remaining })
        .eq("id", reviewer.id)

      unreviewed.forEach((aid: string) => {
        unreviewedItems.push({ reviewer_id: reviewer.id, abstract_id: aid })
      })
    }
  }

  if (unreviewedItems.length === 0) {
    return NextResponse.json({ reassigned_count: 0, from_reviewers: [], to_reviewers: [] })
  }

  // Re-fetch reviewers with updated assignments (include specialty)
  const { data: updatedReviewers } = await adminClient
    .from("abstract_reviewers")
    .select("id, name, email, specialty, assigned_abstracts")
    .eq("event_id", eventId)
    .eq("status", "active")

  // Build load map
  const loadMap = new Map<string, number>()
  const assignmentMap = new Map<string, Set<string>>()
  ;(updatedReviewers || []).forEach((r: any) => {
    loadMap.set(r.id, (r.assigned_abstracts || []).length)
    assignmentMap.set(r.id, new Set(r.assigned_abstracts || []))
  })

  const toReviewersSet = new Set<string>()

  // Redistribute unreviewed abstracts — specialty match first, then least-loaded
  for (const item of unreviewedItems) {
    const abs = abstractLookup.get(item.abstract_id)
    const absTitle: string = abs?.title || ""
    const absKeywords: string[] | null = abs?.keywords || null
    const catName: string | null = abs?.category?.name || null

    const sorted = [...(updatedReviewers || [])].sort((a: any, b: any) => {
      const scoreA = specialtyScore(a.specialty, absTitle, absKeywords, catName)
      const scoreB = specialtyScore(b.specialty, absTitle, absKeywords, catName)
      if (scoreB !== scoreA) return scoreB - scoreA
      return (loadMap.get(a.id) || 0) - (loadMap.get(b.id) || 0)
    })

    for (const reviewer of sorted) {
      // Don't reassign to the same reviewer who failed to review
      if (reviewer.id === item.reviewer_id) continue
      // Don't assign if already assigned
      if (assignmentMap.get(reviewer.id)?.has(item.abstract_id)) continue

      assignmentMap.get(reviewer.id)!.add(item.abstract_id)
      loadMap.set(reviewer.id, (loadMap.get(reviewer.id) || 0) + 1)
      toReviewersSet.add(reviewer.name)
      break
    }
  }

  // Update DB
  for (const reviewer of (updatedReviewers || [])) {
    const newAssigned = Array.from(assignmentMap.get(reviewer.id)!)
    await adminClient
      .from("abstract_reviewers")
      .update({ assigned_abstracts: newAssigned })
      .eq("id", reviewer.id)
  }

  return NextResponse.json({
    reassigned_count: unreviewedItems.length,
    from_reviewers: [...new Set(fromReviewers)],
    to_reviewers: Array.from(toReviewersSet),
  })
}
