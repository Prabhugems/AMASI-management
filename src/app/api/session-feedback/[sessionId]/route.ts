import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// PUBLIC route — attendees submit feedback via QR.
// No auth required.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/session-feedback/[sessionId]
// Returns minimal session info + speakers list for the public form.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  if (!sessionId || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  try {
    const supabase = await createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session, error: sessionError } = await (supabase as any)
      .from("sessions")
      .select("id, session_name, session_date, start_time, end_time, hall, event_id")
      .eq("id", sessionId)
      .maybeSingle()

    if (sessionError) {
      console.error("session-feedback GET session error", { sessionId, error: sessionError })
      return NextResponse.json({ error: "Failed to load session" }, { status: 500 })
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: speakers } = await (supabase as any)
      .from("faculty_assignments")
      .select("id, faculty_name, role")
      .eq("session_id", sessionId)
      .order("display_order", { ascending: true })

    return NextResponse.json({
      session,
      speakers: speakers ?? [],
    })
  } catch (e) {
    console.error("session-feedback GET error", { sessionId, error: e })
    return NextResponse.json({ error: "Failed to load session" }, { status: 500 })
  }
}

// POST /api/session-feedback/[sessionId]
// Body: { rating_overall, rating_content?, rating_delivery?, comments?,
//         session_speaker_id?, respondent_email?, is_anonymous?, question? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  if (!sessionId || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const ratingOverall = body.rating_overall
  if (
    typeof ratingOverall !== "number" ||
    !Number.isInteger(ratingOverall) ||
    ratingOverall < 1 ||
    ratingOverall > 5
  ) {
    return NextResponse.json(
      { error: "rating_overall is required and must be an integer between 1 and 5" },
      { status: 400 }
    )
  }

  const validateOptionalRating = (
    value: unknown,
    field: string
  ): { ok: true; value: number | null } | { ok: false; error: string } => {
    if (value === undefined || value === null) return { ok: true, value: null }
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > 5
    ) {
      return { ok: false, error: `${field} must be an integer between 1 and 5 or null` }
    }
    return { ok: true, value }
  }

  const contentResult = validateOptionalRating(body.rating_content, "rating_content")
  if (!contentResult.ok) {
    return NextResponse.json({ error: contentResult.error }, { status: 400 })
  }
  const deliveryResult = validateOptionalRating(body.rating_delivery, "rating_delivery")
  if (!deliveryResult.ok) {
    return NextResponse.json({ error: deliveryResult.error }, { status: 400 })
  }

  const sessionSpeakerId =
    typeof body.session_speaker_id === "string" && body.session_speaker_id.length > 0
      ? body.session_speaker_id
      : null
  const comments =
    typeof body.comments === "string" && body.comments.trim().length > 0
      ? body.comments.trim()
      : null
  const respondentEmail =
    typeof body.respondent_email === "string" && body.respondent_email.trim().length > 0
      ? body.respondent_email.trim().toLowerCase()
      : null
  const isAnonymous = body.is_anonymous === true
  const question =
    typeof body.question === "string" && body.question.trim().length > 0
      ? body.question.trim()
      : null

  try {
    const supabase = await createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session } = await (supabase as any)
      .from("sessions")
      .select("id, event_id")
      .eq("id", sessionId)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (sessionSpeakerId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: assignment } = await (supabase as any)
        .from("faculty_assignments")
        .select("id, session_id")
        .eq("id", sessionSpeakerId)
        .maybeSingle()
      if (!assignment || assignment.session_id !== sessionId) {
        return NextResponse.json(
          { error: "session_speaker_id does not belong to this session" },
          { status: 400 }
        )
      }
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: feedback, error: feedbackError } = await (supabase as any)
      .from("session_feedback")
      .insert({
        session_id: sessionId,
        event_id: session.event_id,
        session_speaker_id: sessionSpeakerId,
        rating_overall: ratingOverall,
        rating_content: contentResult.value,
        rating_delivery: deliveryResult.value,
        comments,
        respondent_email: respondentEmail,
        is_anonymous: isAnonymous,
        ip_address: ip,
      })
      .select("id")
      .single()

    if (feedbackError) {
      if (feedbackError.code === "23505") {
        return NextResponse.json(
          { error: "You have already submitted feedback for this session." },
          { status: 409 }
        )
      }
      console.error("session-feedback POST insert error", { sessionId, error: feedbackError })
      return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 })
    }

    let qaId: string | undefined
    if (question) {
      const askedByName = respondentEmail || "Anonymous"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: qaRow, error: qaError } = await (supabase as any)
        .from("session_qa")
        .insert({
          session_id: sessionId,
          event_id: session.event_id,
          session_speaker_id: sessionSpeakerId,
          asked_by_name: askedByName,
          asked_by_email: respondentEmail,
          question,
          is_anonymous: isAnonymous,
          is_published: true,
          ip_address: ip,
        })
        .select("id")
        .single()

      if (qaError) {
        console.error("session-feedback POST qa insert error", { sessionId, error: qaError })
        // Don't fail the entire request — feedback already saved.
      } else if (qaRow) {
        qaId = qaRow.id as string
      }
    }

    return NextResponse.json({ feedback_id: feedback.id, qa_id: qaId })
  } catch (e) {
    console.error("session-feedback POST error", { sessionId, error: e })
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 })
  }
}
