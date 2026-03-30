import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

// Simple similarity check using Jaccard index for word sets
function calculateSimilarity(text1: string, text2: string): number {
  // Normalize text
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 3) // Ignore short words

  const words1 = new Set(normalize(text1))
  const words2 = new Set(normalize(text2))

  if (words1.size === 0 || words2.size === 0) return 0

  // Calculate Jaccard similarity
  const intersection = new Set([...words1].filter((x) => words2.has(x)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

// POST /api/abstracts/check-duplicates - Check for similar abstracts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_id, title, abstract_text, exclude_id } = body

    if (!event_id || !title) {
      return NextResponse.json(
        { error: "event_id and title are required" },
        { status: 400 }
      )
    }

    const { error: authError } = await requireEventAndPermission(event_id, 'abstracts')
    if (authError) return authError

    const supabase = await createAdminClient()

    // Fetch existing abstracts for this event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("abstracts")
      .select("id, abstract_number, title, abstract_text, presenting_author_name, status")
      .eq("event_id", event_id)
      .neq("status", "withdrawn")

    // Exclude the current abstract if provided (for revision mode)
    if (exclude_id) {
      query = query.neq("id", exclude_id)
    }

    const { data: abstracts, error } = await query

    if (error) {
      console.error("Error fetching abstracts:", error)
      return NextResponse.json(
        { error: "Failed to check duplicates" },
        { status: 500 }
      )
    }

    if (!abstracts || abstracts.length === 0) {
      return NextResponse.json({ duplicates: [], message: "No existing abstracts" })
    }

    const TITLE_THRESHOLD = 0.6 // 60% similarity for title
    const CONTENT_THRESHOLD = 0.4 // 40% similarity for content
    const combinedText = `${title} ${abstract_text || ""}`

    const duplicates: {
      id: string
      abstract_number: string
      title: string
      author: string
      title_similarity: number
      content_similarity: number
      overall_similarity: number
      match_type: "exact_title" | "similar_title" | "similar_content" | "partial_match"
    }[] = []

    for (const existing of abstracts) {
      // Skip entries with no title
      if (!existing.title) continue

      // Check exact title match first
      const exactTitleMatch =
        title.toLowerCase().trim() === existing.title.toLowerCase().trim()

      // Calculate title similarity
      const titleSimilarity = calculateSimilarity(title, existing.title)

      // Calculate content similarity if abstract text is provided
      const contentSimilarity = abstract_text
        ? calculateSimilarity(combinedText, `${existing.title} ${existing.abstract_text || ""}`)
        : 0

      // Overall weighted similarity (title is more important)
      const overallSimilarity = titleSimilarity * 0.6 + contentSimilarity * 0.4

      // Determine match type
      let matchType: typeof duplicates[number]["match_type"] | null = null

      if (exactTitleMatch) {
        matchType = "exact_title"
      } else if (titleSimilarity >= TITLE_THRESHOLD) {
        matchType = "similar_title"
      } else if (contentSimilarity >= CONTENT_THRESHOLD && abstract_text) {
        matchType = "similar_content"
      } else if (overallSimilarity >= 0.35) {
        matchType = "partial_match"
      }

      if (matchType) {
        duplicates.push({
          id: existing.id,
          abstract_number: existing.abstract_number,
          title: existing.title,
          author: existing.presenting_author_name,
          title_similarity: Math.round(titleSimilarity * 100),
          content_similarity: Math.round(contentSimilarity * 100),
          overall_similarity: Math.round(overallSimilarity * 100),
          match_type: matchType,
        })
      }
    }

    // Sort by overall similarity
    duplicates.sort((a, b) => b.overall_similarity - a.overall_similarity)

    // Limit to top 5 matches
    const topDuplicates = duplicates.slice(0, 5)

    return NextResponse.json({
      duplicates: topDuplicates,
      has_exact_match: duplicates.some((d) => d.match_type === "exact_title"),
      has_similar: duplicates.length > 0,
      message:
        duplicates.length > 0
          ? `Found ${duplicates.length} potential duplicate(s)`
          : "No duplicates found",
    })
  } catch (error) {
    console.error("Error in duplicate check:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
