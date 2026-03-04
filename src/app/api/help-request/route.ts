import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// POST /api/help-request - Submit a help request from delegate portal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_id, name, email, registration_number, category, message } = body

    if (!event_id || !email || !message) {
      return NextResponse.json(
        { error: "event_id, email, and message are required" },
        { status: 400 }
      )
    }

    const supabase: SupabaseClient = await createAdminClient()

    const { data: event } = await supabase
      .from("events")
      .select("name, short_name, contact_email, created_by")
      .eq("id", event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Store help request in database
    const { error: insertError } = await supabase
      .from("help_requests")
      .insert({
        event_id,
        name: name || null,
        email: email.toLowerCase(),
        registration_number: registration_number || null,
        category: category || "General",
        message,
      })

    if (insertError) {
      console.error("Failed to store help request:", insertError)
      // Continue even if DB insert fails — still try to send email
    }

    // Determine recipient: contact_email → event creator email → skip
    let recipientEmail = event.contact_email
    if (!recipientEmail && event.created_by) {
      const { data: creator } = await supabase.auth.admin.getUserById(event.created_by)
      recipientEmail = creator?.user?.email || null
    }

    const blastableKey = process.env.BLASTABLE_API_KEY?.trim()
    const fromEmail = (process.env.BLASTABLE_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "").trim()

    if (recipientEmail && blastableKey && fromEmail) {
      const eventName = event.short_name || event.name || "Event"
      const plainFrom = fromEmail.includes("<") ? fromEmail.match(/<(.+)>/)?.[1] || fromEmail : fromEmail

      const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f3f4f6;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
<div style="background:#dc2626;padding:24px;text-align:center;">
<h1 style="color:#fff;margin:0;font-size:20px;">Delegate Help Request</h1>
<p style="color:#fecaca;margin:8px 0 0;font-size:14px;">${esc(eventName)}</p></div>
<div style="padding:24px;">
<table style="width:100%;margin-bottom:20px;">
<tr><td style="padding:8px 0;color:#6b7280;width:140px;">Name:</td><td style="padding:8px 0;color:#374151;font-weight:500;">${esc(name || "Not provided")}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;">Email:</td><td style="padding:8px 0;color:#374151;">${esc(email)}</td></tr>
${registration_number ? `<tr><td style="padding:8px 0;color:#6b7280;">Reg. Number:</td><td style="padding:8px 0;color:#374151;font-family:monospace;">${esc(registration_number)}</td></tr>` : ""}
<tr><td style="padding:8px 0;color:#6b7280;">Category:</td><td style="padding:8px 0;color:#374151;">${esc(category || "General")}</td></tr></table>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;">
<h3 style="margin:0 0 8px;color:#374151;font-size:14px;">Message:</h3>
<p style="margin:0;color:#4b5563;white-space:pre-wrap;">${esc(message)}</p></div>
<p style="color:#9ca3af;font-size:12px;margin-top:16px;">Sent from the Delegate Portal</p>
</div></div></body></html>`

      try {
        await fetch("https://blastable.com/send-email/process", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": blastableKey,
          },
          body: JSON.stringify({
            from_email: plainFrom,
            to: recipientEmail,
            subject: `[Help] ${category || "General"} — ${name || email}`,
            html_body: htmlContent,
            text_body: `Help Request from ${name || email}\nCategory: ${category || "General"}\n\n${message}`,
          }),
        })
      } catch (emailErr) {
        console.error("Failed to send help email:", emailErr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in POST /api/help-request:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET /api/help-request?event_id=X - List help requests for an event (admin)
export async function GET(request: NextRequest) {
  try {
    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase: SupabaseClient = await createAdminClient()

    const { data, error } = await supabase
      .from("help_requests")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching help requests:", error)
      return NextResponse.json({ error: "Failed to fetch help requests" }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Error in GET /api/help-request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/help-request - Update help request status (admin)
export async function PATCH(request: NextRequest) {
  try {
    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, status, admin_notes } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase: SupabaseClient = await createAdminClient()

    const updates: Record<string, any> = {}
    if (status) updates.status = status
    if (admin_notes !== undefined) updates.admin_notes = admin_notes
    if (status === "resolved" || status === "closed") updates.resolved_at = new Date().toISOString()

    const { data, error } = await supabase
      .from("help_requests")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating help request:", error)
      return NextResponse.json({ error: "Failed to update" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in PATCH /api/help-request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
