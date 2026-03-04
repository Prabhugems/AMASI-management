import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// POST /api/help-request/replies - Create a reply
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { help_request_id, sender_type, message, send_email } = body

    if (!help_request_id || !sender_type || !message?.trim()) {
      return NextResponse.json(
        { error: "help_request_id, sender_type, and message are required" },
        { status: 400 }
      )
    }

    const supabase: SupabaseClient = await createAdminClient()

    // Fetch the help request
    const { data: helpRequest } = await supabase
      .from("help_requests")
      .select("*, events:event_id(name, short_name, contact_email, created_by)")
      .eq("id", help_request_id)
      .single()

    if (!helpRequest) {
      return NextResponse.json({ error: "Help request not found" }, { status: 404 })
    }

    let senderName = ""
    let senderEmail: string | null = null

    if (sender_type === "admin") {
      // Require auth for admin replies
      const authResult = await getApiUser()
      if (!authResult.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      senderName = authResult.user.name || authResult.user.email
      senderEmail = authResult.user.email
    } else if (sender_type === "delegate") {
      // Verify email matches the help request
      const { email } = body
      if (!email || email.toLowerCase() !== helpRequest.email?.toLowerCase()) {
        return NextResponse.json({ error: "Email does not match help request" }, { status: 403 })
      }
      senderName = helpRequest.name || email
      senderEmail = email.toLowerCase()
    } else {
      return NextResponse.json({ error: "Invalid sender_type" }, { status: 400 })
    }

    // Insert reply
    const { data: reply, error: insertError } = await supabase
      .from("help_request_replies")
      .insert({
        help_request_id,
        sender_type,
        sender_name: senderName,
        sender_email: senderEmail,
        message: message.trim(),
      })
      .select()
      .single()

    if (insertError) {
      console.error("Failed to insert reply:", insertError)
      return NextResponse.json({ error: "Failed to create reply" }, { status: 500 })
    }

    // If delegate reply and request is resolved/closed, auto-reopen
    if (sender_type === "delegate" && (helpRequest.status === "resolved" || helpRequest.status === "closed")) {
      await supabase
        .from("help_requests")
        .update({ status: "open", resolved_at: null })
        .eq("id", help_request_id)
    }

    // If admin reply with send_email, email the delegate
    if (sender_type === "admin" && send_email !== false) {
      const blastableKey = process.env.BLASTABLE_API_KEY?.trim()
      const fromEmail = (process.env.BLASTABLE_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "").trim()

      if (helpRequest.email && blastableKey && fromEmail) {
        const plainFrom = fromEmail.includes("<") ? fromEmail.match(/<(.+)>/)?.[1] || fromEmail : fromEmail
        const eventName = helpRequest.events?.short_name || helpRequest.events?.name || "Event"

        const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f3f4f6;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
<div style="background:#2563eb;padding:24px;text-align:center;">
<h1 style="color:#fff;margin:0;font-size:20px;">Reply to Your Help Request</h1>
<p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">${esc(eventName)}</p></div>
<div style="padding:24px;">
<p style="color:#6b7280;font-size:14px;margin:0 0 4px;">Your request regarding:</p>
<p style="color:#374151;font-weight:500;margin:0 0 16px;">${esc(helpRequest.category || "General")} — ${esc(helpRequest.message?.substring(0, 100) || "")}</p>
<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:16px;">
<p style="color:#6b7280;font-size:12px;margin:0 0 8px;">${esc(senderName)} replied:</p>
<p style="margin:0;color:#1e40af;white-space:pre-wrap;">${esc(message.trim())}</p></div>
<p style="color:#9ca3af;font-size:12px;margin-top:16px;">You can reply back from the Delegate Portal at /my</p>
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
              to: helpRequest.email,
              subject: `[Reply] ${helpRequest.category || "General"} — ${eventName}`,
              html_body: htmlContent,
              text_body: `Reply to your help request (${helpRequest.category || "General"}):\n\n${message.trim()}\n\n— ${senderName}`,
            }),
          })
        } catch (emailErr) {
          console.error("Failed to send reply email:", emailErr)
        }
      }
    }

    return NextResponse.json(reply)
  } catch (error) {
    console.error("Error in POST /api/help-request/replies:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/help-request/replies?help_request_id=X - Fetch replies for a help request
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const helpRequestId = searchParams.get("help_request_id")
    const email = searchParams.get("email")

    if (!helpRequestId) {
      return NextResponse.json({ error: "help_request_id is required" }, { status: 400 })
    }

    const supabase: SupabaseClient = await createAdminClient()

    // If email is provided, verify ownership (delegate access)
    if (email) {
      const { data: helpRequest } = await supabase
        .from("help_requests")
        .select("email")
        .eq("id", helpRequestId)
        .single()

      if (!helpRequest || helpRequest.email?.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    } else {
      // Admin access — require auth
      const authResult = await getApiUser()
      if (!authResult.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const { data, error } = await supabase
      .from("help_request_replies")
      .select("*")
      .eq("help_request_id", helpRequestId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching replies:", error)
      return NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Error in GET /api/help-request/replies:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
