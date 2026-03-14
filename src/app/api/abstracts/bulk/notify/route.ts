import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// POST /api/abstracts/bulk/notify - Send notifications to authors
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { abstract_ids } = body

    if (!abstract_ids || !Array.isArray(abstract_ids) || abstract_ids.length === 0) {
      return NextResponse.json({ error: "No abstracts selected" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Fetch abstracts with their details
    const { data: abstracts, error } = await (supabase as any)
      .from("abstracts")
      .select(`
        id,
        abstract_number,
        title,
        status,
        decision,
        decision_notes,
        accepted_as,
        presenting_author_name,
        presenting_author_email,
        event_id,
        events(name, short_name)
      `)
      .in("id", abstract_ids)

    if (error || !abstracts) {
      return NextResponse.json({ error: "Failed to fetch abstracts" }, { status: 500 })
    }

    // Filter to only those with decisions
    const validStatuses = ["accepted", "rejected", "revision_requested"]
    const notifiableAbstracts = abstracts.filter((a: any) => validStatuses.includes(a.status))

    if (notifiableAbstracts.length === 0) {
      return NextResponse.json({
        error: "No abstracts with decisions to notify"
      }, { status: 400 })
    }

    // Group by email to send one notification per author
    const authorAbstracts = new Map<string, any[]>()
    for (const abstract of notifiableAbstracts) {
      const email = abstract.presenting_author_email?.toLowerCase()
      if (!email) continue
      if (!authorAbstracts.has(email)) {
        authorAbstracts.set(email, [])
      }
      authorAbstracts.get(email)!.push(abstract)
    }

    let sentCount = 0
    const notifications: any[] = []

    for (const [email, authorAbs] of authorAbstracts) {
      const firstAbstract = authorAbs[0]
      const eventName = firstAbstract.events?.short_name || firstAbstract.events?.name || "Event"

      // Determine notification type based on status
      const statuses = [...new Set(authorAbs.map((a: any) => a.status))]
      let notificationType = "abstract_decision"
      let subject = `Abstract Decision: ${eventName}`

      if (statuses.length === 1) {
        if (statuses[0] === "accepted") {
          notificationType = "abstract_accepted"
          subject = `Congratulations! Your Abstract has been Accepted - ${eventName}`
        } else if (statuses[0] === "rejected") {
          notificationType = "abstract_rejected"
          subject = `Abstract Decision - ${eventName}`
        } else if (statuses[0] === "revision_requested") {
          notificationType = "abstract_revision"
          subject = `Revision Requested for Your Abstract - ${eventName}`
        }
      }

      // Build notification body
      const abstractList = authorAbs.map((a: any) => {
        let statusText = a.status
        if (a.status === "accepted" && a.accepted_as) {
          statusText = `Accepted as ${a.accepted_as}`
        }
        return `- ${a.abstract_number}: "${a.title}" - ${statusText}${a.decision_notes ? ` (${a.decision_notes})` : ""}`
      }).join("\n")

      const bodyPreview = `Dear ${firstAbstract.presenting_author_name},\n\nWe have made a decision on your abstract submission(s) for ${eventName}:\n\n${abstractList}`

      // Create notification record
      for (const abstract of authorAbs) {
        notifications.push({
          abstract_id: abstract.id,
          notification_type: notificationType,
          recipient_email: email,
          recipient_name: firstAbstract.presenting_author_name,
          subject,
          body_preview: bodyPreview,
          metadata: {
            event_id: abstract.event_id,
            event_name: eventName,
            status: abstract.status,
            accepted_as: abstract.accepted_as,
            decision_notes: abstract.decision_notes,
          },
        })
      }

      sentCount++
    }

    // Insert all notifications
    if (notifications.length > 0) {
      const { error: notifyError } = await (supabase as any)
        .from("abstract_notifications")
        .insert(notifications)

      if (notifyError) {
        console.error("Error inserting notifications:", notifyError)
      }
    }

    // Mark abstracts as notified
    await (supabase as any)
      .from("abstracts")
      .update({ decision_notified_at: new Date().toISOString() })
      .in("id", notifiableAbstracts.map((a: any) => a.id))

    return NextResponse.json({
      success: true,
      sent: sentCount,
      total_abstracts: notifiableAbstracts.length,
      message: `Notifications queued for ${sentCount} author(s) covering ${notifiableAbstracts.length} abstract(s)`,
    })
  } catch (error) {
    console.error("Error sending bulk notifications:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
