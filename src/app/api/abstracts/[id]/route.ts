import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// GET /api/abstracts/[id] - Get single abstract with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase: SupabaseClient = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Check if user is an authenticated team member
    let isTeamMember = false
    if (user?.email) {
      const adminClient: SupabaseClient = await createAdminClient()
      const { data: teamMember } = await adminClient
        .from("team_members")
        .select("id")
        .eq("email", user.email.toLowerCase())
        .eq("is_active", true)
        .maybeSingle()
      isTeamMember = !!teamMember
    }

    const { data, error } = await supabase
      .from("abstracts")
      .select(`
        *,
        category:abstract_categories(id, name, description),
        authors:abstract_authors(id, name, email, affiliation, author_order, is_presenting),
        reviews:abstract_reviews(
          id, reviewer_id, reviewer_name, reviewer_email,
          score_originality, score_methodology, score_relevance, score_clarity, overall_score,
          recommendation, comments_to_author, comments_private, reviewed_at
        ),
        registration:registrations(id, registration_number, attendee_name)
      `)
      .eq("id", id)
      .single()

    if (error) {
      console.error("Error fetching abstract:", error)
      return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
    }

    // If user is not an authenticated team member, strip private/identity fields from reviews (blind review)
    if (!isTeamMember && data.reviews && Array.isArray(data.reviews)) {
      data.reviews = data.reviews.map((review: any) => {
        const { comments_private: _cp, reviewer_name: _rn, reviewer_email: _re, reviewer_id: _ri, ...rest } = review
        return rest
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in GET /api/abstracts/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/abstracts/[id] - Update abstract (by author before deadline, or admin anytime)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase: SupabaseClient = await createServerSupabaseClient()
    const adminClient: SupabaseClient = await createAdminClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Check team membership
    const { data: teamMember } = await adminClient
      .from("team_members")
      .select("id")
      .eq("email", user.email?.toLowerCase())
      .eq("is_active", true)
      .maybeSingle()
    const isTeamMember = !!teamMember

    // Get current abstract
    const { data: abstract } = await adminClient
      .from("abstracts")
      .select("*, event_id")
      .eq("id", id)
      .maybeSingle()

    if (!abstract) {
      return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
    }

    // Authorization: determine what the user is allowed to do
    const isAuthor = user.email?.toLowerCase() === abstract.presenting_author_email?.toLowerCase()

    if (!isTeamMember && !isAuthor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Content fields that an author is allowed to update
    const authorAllowedFields = [
      "title", "abstract_text", "keywords", "presentation_type",
      "category_id", "presenting_author_affiliation",
      "file_url", "file_name", "file_size",
      "amasi_membership_number", "declarations_accepted", "submitter_metadata"
    ]

    // If user is the author (not a team member), check deadline and restrict fields
    if (!isTeamMember && isAuthor) {
      // Check submission deadline
      const { data: settings } = await adminClient
        .from("abstract_settings")
        .select("submission_deadline")
        .eq("event_id", abstract.event_id)
        .maybeSingle()

      if (settings?.submission_deadline) {
        const deadline = new Date(settings.submission_deadline)
        if (new Date() > deadline) {
          return NextResponse.json(
            { error: "Submission deadline has passed. Updates are no longer allowed." },
            { status: 403 }
          )
        }
      }

      // Check if any non-allowed fields are being set
      const bodyKeys = Object.keys(body).filter(k => k !== "authors")
      const disallowedKeys = bodyKeys.filter(k => !authorAllowedFields.includes(k))
      if (disallowedKeys.length > 0) {
        return NextResponse.json(
          { error: `You are not allowed to update: ${disallowedKeys.join(", ")}` },
          { status: 403 }
        )
      }
    }

    // Build update payload
    const updateData: Record<string, any> = {}

    // Content fields (author can update before deadline)
    if (body.title !== undefined) updateData.title = body.title
    if (body.abstract_text !== undefined) updateData.abstract_text = body.abstract_text
    if (body.keywords !== undefined) updateData.keywords = body.keywords
    if (body.presentation_type !== undefined) updateData.presentation_type = body.presentation_type
    if (body.category_id !== undefined) updateData.category_id = body.category_id
    if (body.presenting_author_affiliation !== undefined) updateData.presenting_author_affiliation = body.presenting_author_affiliation
    if (body.file_url !== undefined) updateData.file_url = body.file_url
    if (body.file_name !== undefined) updateData.file_name = body.file_name
    if (body.file_size !== undefined) updateData.file_size = body.file_size
    if (body.amasi_membership_number !== undefined) updateData.amasi_membership_number = body.amasi_membership_number
    if (body.declarations_accepted !== undefined) updateData.declarations_accepted = body.declarations_accepted
    if (body.submitter_metadata !== undefined) updateData.submitter_metadata = body.submitter_metadata

    // Status changes (team member only)
    if (body.status !== undefined) updateData.status = body.status

    // Decision fields (team member only)
    if (body.decision_notes !== undefined) updateData.decision_notes = body.decision_notes
    if (body.accepted_as !== undefined) updateData.accepted_as = body.accepted_as
    if (body.decision_date !== undefined) updateData.decision_date = body.decision_date

    // Session assignment (team member only)
    if (body.session_id !== undefined) updateData.session_id = body.session_id
    if (body.session_date !== undefined) updateData.session_date = body.session_date
    if (body.session_time !== undefined) updateData.session_time = body.session_time
    if (body.session_location !== undefined) updateData.session_location = body.session_location

    // Award fields (team member only)
    if (body.award_rank !== undefined) updateData.award_rank = body.award_rank
    if (body.award_type !== undefined) updateData.award_type = body.award_type
    if (body.is_podium_selected !== undefined) updateData.is_podium_selected = body.is_podium_selected
    if (body.redirected_from_category_id !== undefined) updateData.redirected_from_category_id = body.redirected_from_category_id

    const { data, error } = await adminClient
      .from("abstracts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating abstract:", error)
      return NextResponse.json({ error: "Failed to update abstract" }, { status: 500 })
    }

    // Update authors if provided
    if (body.authors) {
      try {
        // Delete existing authors
        const { error: deleteError } = await adminClient
          .from("abstract_authors")
          .delete()
          .eq("abstract_id", id)

        if (deleteError) {
          console.error("Error deleting existing authors:", deleteError)
        }

        // Insert new authors
        if (body.authors.length > 0) {
          const authorInserts = body.authors.map((author: any, index: number) => ({
            abstract_id: id,
            author_order: index + 1,
            name: author.name,
            email: author.email || null,
            affiliation: author.affiliation || null,
            is_presenting: author.is_presenting || false,
          }))

          const { error: insertError } = await adminClient
            .from("abstract_authors")
            .insert(authorInserts)

          if (insertError) {
            console.error("Error inserting authors:", insertError)
          }
        }
      } catch (authorError) {
        console.error("Error updating authors:", authorError)
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in PUT /api/abstracts/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/abstracts/[id] - Delete or withdraw abstract
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const withdraw = searchParams.get("withdraw") === "true"

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase: SupabaseClient = await createServerSupabaseClient()
    const adminClient: SupabaseClient = await createAdminClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Check team membership
    const { data: teamMember } = await adminClient
      .from("team_members")
      .select("id")
      .eq("email", user.email?.toLowerCase())
      .eq("is_active", true)
      .maybeSingle()
    const isTeamMember = !!teamMember

    if (withdraw) {
      // Get the abstract to check ownership
      const { data: abstract } = await adminClient
        .from("abstracts")
        .select("presenting_author_email")
        .eq("id", id)
        .maybeSingle()

      if (!abstract) {
        return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
      }

      const isAuthor = user.email?.toLowerCase() === abstract.presenting_author_email?.toLowerCase()

      // Allow withdraw if team member or the presenting author
      if (!isTeamMember && !isAuthor) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      // Just mark as withdrawn
      const { error } = await adminClient
        .from("abstracts")
        .update({ status: "withdrawn" })
        .eq("id", id)

      if (error) {
        console.error("Error withdrawing abstract:", error)
        return NextResponse.json({ error: "Failed to withdraw abstract" }, { status: 500 })
      }

      return NextResponse.json({ success: true, action: "withdrawn" })
    } else {
      // Hard delete - require team member
      if (!isTeamMember) {
        return NextResponse.json({ error: "Forbidden: only team members can delete abstracts" }, { status: 403 })
      }

      const { error } = await adminClient.from("abstracts").delete().eq("id", id)

      if (error) {
        console.error("Error deleting abstract:", error)
        return NextResponse.json({ error: "Failed to delete abstract" }, { status: 500 })
      }

      return NextResponse.json({ success: true, action: "deleted" })
    }
  } catch (error) {
    console.error("Error in DELETE /api/abstracts/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
