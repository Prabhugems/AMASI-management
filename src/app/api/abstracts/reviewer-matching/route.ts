import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

// POST /api/abstracts/reviewer-matching - Auto-assign reviewers based on specialty matching
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const body = await request.json()
    const { event_id, abstract_ids, min_reviewers = 2, max_per_reviewer = 10 } = body

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Fetch abstracts that need reviewers
    let abstractsQuery = (supabase as any)
      .from("abstracts")
      .select(`
        id,
        abstract_number,
        title,
        keywords,
        presenting_author_email,
        presenting_author_affiliation,
        category:abstract_categories(id, name, keywords, specialty_track)
      `)
      .eq("event_id", event_id)
      .in("status", ["submitted", "under_review"])

    if (abstract_ids && abstract_ids.length > 0) {
      abstractsQuery = abstractsQuery.in("id", abstract_ids)
    }

    const { data: abstracts, error: absError } = await abstractsQuery

    if (absError || !abstracts || abstracts.length === 0) {
      return NextResponse.json({ error: "No abstracts found to assign" }, { status: 404 })
    }

    // Fetch co-authors for all abstracts — a reviewer must not be assigned
    // to an abstract they (co-)authored. Without this, only the presenting
    // author was checked for COI.
    const abstractIds = abstracts.map((a: any) => a.id)
    const { data: authorRows } = await (supabase as any)
      .from("abstract_authors")
      .select("abstract_id, email")
      .in("abstract_id", abstractIds)
    const coAuthorEmailsByAbstract: Record<string, Set<string>> = {}
    for (const row of authorRows || []) {
      if (!row.email) continue
      if (!coAuthorEmailsByAbstract[row.abstract_id]) {
        coAuthorEmailsByAbstract[row.abstract_id] = new Set()
      }
      coAuthorEmailsByAbstract[row.abstract_id].add(String(row.email).toLowerCase())
    }

    // Fetch all active reviewers with their specialties and current load
    const { data: reviewers } = await (supabase as any)
      .from("abstract_reviewers")
      .select(`
        id,
        name,
        email,
        institution,
        specialties,
        keywords,
        max_assignments,
        status
      `)
      .eq("event_id", event_id)
      .eq("status", "active")

    if (!reviewers || reviewers.length === 0) {
      return NextResponse.json({ error: "No active reviewers found" }, { status: 404 })
    }

    // Fetch existing assignments to check load
    const { data: existingAssignments } = await (supabase as any)
      .from("abstract_review_assignments")
      .select("reviewer_id, abstract_id")
      .eq("event_id", event_id)

    // Build reviewer load map
    const reviewerLoad: Record<string, number> = {}
    const existingPairs: Set<string> = new Set()
    for (const a of existingAssignments || []) {
      reviewerLoad[a.reviewer_id] = (reviewerLoad[a.reviewer_id] || 0) + 1
      existingPairs.add(`${a.reviewer_id}-${a.abstract_id}`)
    }

    // Fetch COI declarations
    const { data: conflicts } = await (supabase as any)
      .from("reviewer_conflicts")
      .select("reviewer_id, conflict_type, conflict_value")
      .eq("event_id", event_id)

    const reviewerConflicts: Record<string, { institutions: Set<string>; emails: Set<string> }> = {}
    for (const c of conflicts || []) {
      if (!reviewerConflicts[c.reviewer_id]) {
        reviewerConflicts[c.reviewer_id] = { institutions: new Set(), emails: new Set() }
      }
      if (c.conflict_type === "institution") {
        reviewerConflicts[c.reviewer_id].institutions.add(c.conflict_value.toLowerCase())
      }
      if (c.conflict_type === "co_author" || c.conflict_type === "personal") {
        reviewerConflicts[c.reviewer_id].emails.add(c.conflict_value.toLowerCase())
      }
    }

    // Scoring function for reviewer-abstract match
    function calculateMatchScore(reviewer: any, abstract: any): number {
      let score = 0

      // Check for conflicts (return -1 to skip)
      const authorEmail = abstract.presenting_author_email?.toLowerCase()
      const authorInstitution = abstract.presenting_author_affiliation?.toLowerCase()
      const reviewerEmail = reviewer.email ? String(reviewer.email).toLowerCase() : null

      // Reviewer is a (co-)author of this abstract = conflict
      const coAuthors = coAuthorEmailsByAbstract[abstract.id]
      if (reviewerEmail && coAuthors && coAuthors.has(reviewerEmail)) {
        return -1
      }
      if (reviewerEmail && authorEmail && reviewerEmail === authorEmail) {
        return -1
      }

      // Same institution = conflict
      if (reviewer.institution && authorInstitution &&
          reviewer.institution.toLowerCase() === authorInstitution) {
        return -1
      }

      // Declared COI
      const coi = reviewerConflicts[reviewer.id]
      if (coi) {
        if (authorEmail && coi.emails.has(authorEmail)) return -1
        if (authorInstitution && coi.institutions.has(authorInstitution)) return -1
      }

      // Check existing assignment
      if (existingPairs.has(`${reviewer.id}-${abstract.id}`)) {
        return -1
      }

      // Check load
      const currentLoad = reviewerLoad[reviewer.id] || 0
      const maxLoad = reviewer.max_assignments || max_per_reviewer
      if (currentLoad >= maxLoad) {
        return -1
      }

      // Keyword matching
      const abstractKeywords = new Set([
        ...(abstract.keywords || []).map((k: string) => k.toLowerCase()),
        ...(abstract.category?.keywords || []).map((k: string) => k.toLowerCase()),
      ])
      const reviewerKeywords = new Set([
        ...(reviewer.keywords || []).map((k: string) => k.toLowerCase()),
        ...(reviewer.specialties || []).map((s: string) => s.toLowerCase()),
      ])

      for (const kw of abstractKeywords) {
        if (reviewerKeywords.has(kw)) {
          score += 10
        }
        // Partial match
        for (const rk of reviewerKeywords) {
          if (kw.includes(rk) || rk.includes(kw)) {
            score += 5
          }
        }
      }

      // Specialty track matching
      if (abstract.category?.specialty_track && reviewer.specialties) {
        const track = abstract.category.specialty_track.toLowerCase()
        for (const spec of reviewer.specialties) {
          if (spec.toLowerCase().includes(track) || track.includes(spec.toLowerCase())) {
            score += 15
          }
        }
      }

      // Prefer reviewers with lower current load (load balancing)
      score -= currentLoad * 2

      return score
    }

    // Assign reviewers to each abstract
    const assignments: { abstract_id: string; reviewer_id: string; match_score: number }[] = []
    const errors: string[] = []

    for (const abstract of abstracts) {
      // Score all reviewers for this abstract
      const scored = reviewers
        .map((r: any) => ({
          reviewer: r,
          score: calculateMatchScore(r, abstract),
        }))
        .filter((s: any) => s.score >= 0)
        .sort((a: any, b: any) => b.score - a.score)

      if (scored.length < min_reviewers) {
        errors.push(`${abstract.abstract_number}: Only ${scored.length} eligible reviewers (need ${min_reviewers})`)
      }

      // Assign top N reviewers
      const toAssign = scored.slice(0, min_reviewers)
      for (const { reviewer, score } of toAssign) {
        assignments.push({
          abstract_id: abstract.id,
          reviewer_id: reviewer.id,
          match_score: score,
        })
        // Update load tracking
        reviewerLoad[reviewer.id] = (reviewerLoad[reviewer.id] || 0) + 1
        existingPairs.add(`${reviewer.id}-${abstract.id}`)
      }
    }

    // Insert assignments
    if (assignments.length > 0) {
      const insertData = assignments.map((a) => ({
        event_id,
        abstract_id: a.abstract_id,
        reviewer_id: a.reviewer_id,
        status: "pending",
        assigned_at: new Date().toISOString(),
        match_score: a.match_score,
      }))

      const { error: insertError } = await (supabase as any)
        .from("abstract_review_assignments")
        .upsert(insertData, { onConflict: "abstract_id,reviewer_id" })

      if (insertError) {
        console.error("Error inserting assignments:", insertError)
        return NextResponse.json({ error: "Failed to create assignments" }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      assigned: assignments.length,
      abstracts_processed: abstracts.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Assigned ${assignments.length} reviewer(s) to ${abstracts.length} abstract(s)`,
    })
  } catch (error) {
    console.error("Error in reviewer matching:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
