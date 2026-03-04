import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

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
      .select("name, short_name, contact_email")
      .eq("id", event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Send email notification using Blastable directly (avoid @/lib/email static import which causes Turbopack hang)
    const recipientEmail = event.contact_email
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
