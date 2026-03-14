import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET /api/my/abstracts?email=... - Get abstracts submitted by an email
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Fetch abstracts where the user is the presenting author
    const { data: abstracts, error } = await (supabase as any)
      .from("abstracts")
      .select(`
        id,
        abstract_number,
        title,
        abstract_text,
        keywords,
        presentation_type,
        accepted_as,
        award_type,
        status,
        decision,
        decision_notes,
        submitted_at,
        updated_at,
        file_url,
        file_name,
        video_url,
        presenting_author_name,
        presenting_author_email,
        presenting_author_affiliation,
        session_date,
        session_time,
        session_location,
        presentation_completed,
        presentation_completed_at,
        presentation_url,
        presentation_name,
        presentation_uploaded_at,
        revision_count,
        last_revision_at,
        category:abstract_categories(id, name),
        event:events(id, name, short_name, start_date, end_date, city),
        authors:abstract_authors(id, name, email, affiliation, author_order, is_presenting),
        reviews:abstract_reviews(
          id,
          recommendation,
          comments_to_author,
          reviewed_at
        )
      `)
      .ilike("presenting_author_email", email)
      .order("submitted_at", { ascending: false })

    if (error) {
      console.error("Error fetching abstracts:", error)
      return NextResponse.json({ error: "Failed to fetch abstracts" }, { status: 500 })
    }

    // Also check if they're a co-author on any abstracts
    const { data: coAuthoredAbstracts } = await (supabase as any)
      .from("abstract_authors")
      .select(`
        abstract:abstracts(
          id,
          abstract_number,
          title,
          abstract_text,
          keywords,
          presentation_type,
          accepted_as,
          award_type,
          status,
          decision,
          decision_notes,
          submitted_at,
          updated_at,
          file_url,
          file_name,
          video_url,
          presenting_author_name,
          presenting_author_email,
          presenting_author_affiliation,
          session_date,
          session_time,
          session_location,
          presentation_completed,
          presentation_completed_at,
          presentation_url,
          presentation_name,
          presentation_uploaded_at,
          revision_count,
          last_revision_at,
          category:abstract_categories(id, name),
          event:events(id, name, short_name, start_date, end_date, city),
          authors:abstract_authors(id, name, email, affiliation, author_order, is_presenting),
          reviews:abstract_reviews(
            id,
            recommendation,
            comments_to_author,
            reviewed_at
          )
        )
      `)
      .ilike("email", email)
      .eq("is_presenting", false)

    // Combine and deduplicate
    const abstractIds = new Set(abstracts?.map((a: any) => a.id) || [])
    const coAuthored = (coAuthoredAbstracts || [])
      .map((ca: any) => ca.abstract)
      .filter((a: any) => a && !abstractIds.has(a.id))

    // Process abstracts to hide reviewer details in blind review
    const processedAbstracts = [...(abstracts || []), ...coAuthored].map((abstract: any) => {
      // Only show reviewer comments if decision has been made
      const showReviewerComments = abstract.decision && ["accepted", "rejected", "revision_requested"].includes(abstract.decision)

      return {
        ...abstract,
        reviews: showReviewerComments
          ? abstract.reviews?.map((r: any) => ({
              recommendation: r.recommendation,
              comments_to_author: r.comments_to_author,
              reviewed_at: r.reviewed_at,
            }))
          : [],
        is_presenting_author: abstract.presenting_author_email?.toLowerCase() === email,
      }
    })

    return NextResponse.json({
      abstracts: processedAbstracts,
      total: processedAbstracts.length,
    })
  } catch (error) {
    console.error("Error in GET /api/my/abstracts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/my/abstracts - Withdraw, revise, or upload presentation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { abstract_id, email, action } = body

    if (!abstract_id || !email) {
      return NextResponse.json({ error: "Abstract ID and email are required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Verify the abstract belongs to this email
    const { data: abstract, error: fetchError } = await (supabase as any)
      .from("abstracts")
      .select("id, status, presenting_author_email, event_id, title, abstract_text, keywords, category_id, revision_count")
      .eq("id", abstract_id)
      .ilike("presenting_author_email", email.trim())
      .single()

    if (fetchError || !abstract) {
      return NextResponse.json({ error: "Abstract not found or you don't have permission" }, { status: 404 })
    }

    if (action === "withdraw") {
      // Check if withdrawal is allowed
      if (["accepted", "rejected", "withdrawn"].includes(abstract.status)) {
        return NextResponse.json({
          error: `Cannot withdraw - abstract is already ${abstract.status}`
        }, { status: 400 })
      }

      // Update status to withdrawn
      const { error: updateError } = await (supabase as any)
        .from("abstracts")
        .update({
          status: "withdrawn",
          withdrawn_at: new Date().toISOString(),
          withdrawn_reason: body.reason || "Withdrawn by author",
        })
        .eq("id", abstract_id)

      if (updateError) {
        console.error("Error withdrawing abstract:", updateError)
        return NextResponse.json({ error: "Failed to withdraw abstract" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "Abstract withdrawn successfully",
      })
    }

    if (action === "submit_revision") {
      // Check if revision is allowed
      if (abstract.status !== "revision_requested") {
        return NextResponse.json({
          error: "Revision can only be submitted when revision is requested"
        }, { status: 400 })
      }

      const { title, abstract_text, keywords, file_url, file_name, revision_notes } = body

      if (!title || !abstract_text) {
        return NextResponse.json({ error: "Title and abstract text are required" }, { status: 400 })
      }

      // Store previous version in history
      await (supabase as any)
        .from("abstract_revisions")
        .insert({
          abstract_id: abstract.id,
          event_id: abstract.event_id,
          version_number: abstract.revision_count || 1,
          title: abstract.title,
          abstract_text: abstract.abstract_text,
          keywords: abstract.keywords,
          revised_at: new Date().toISOString(),
        })

      // Update abstract with new content
      const { error: updateError } = await (supabase as any)
        .from("abstracts")
        .update({
          title,
          abstract_text,
          keywords: keywords || abstract.keywords,
          file_url: file_url || undefined,
          file_name: file_name || undefined,
          status: "submitted", // Reset to submitted for re-review
          revision_count: (abstract.revision_count || 0) + 1,
          revision_notes,
          last_revision_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", abstract_id)

      if (updateError) {
        console.error("Error submitting revision:", updateError)
        return NextResponse.json({ error: "Failed to submit revision" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "Revision submitted successfully",
      })
    }

    if (action === "upload_presentation") {
      // Check if upload is allowed (only for accepted abstracts)
      if (abstract.status !== "accepted") {
        return NextResponse.json({
          error: "Presentation can only be uploaded for accepted abstracts"
        }, { status: 400 })
      }

      const { presentation_url, presentation_name, presentation_type } = body

      if (!presentation_url) {
        return NextResponse.json({ error: "Presentation file URL is required" }, { status: 400 })
      }

      // Update abstract with presentation file
      const { error: updateError } = await (supabase as any)
        .from("abstracts")
        .update({
          presentation_url,
          presentation_name,
          presentation_type: presentation_type || "slides",
          presentation_uploaded_at: new Date().toISOString(),
        })
        .eq("id", abstract_id)

      if (updateError) {
        console.error("Error uploading presentation:", updateError)
        return NextResponse.json({ error: "Failed to upload presentation" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "Presentation uploaded successfully",
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error in POST /api/my/abstracts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
