import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// Sample data for preview/test
const SAMPLE_DATA = {
  // Attendee/Registration
  attendee_name: "John Doe",
  attendee_email: "john.doe@example.com",
  registration_number: "REG-2025-001234",
  ticket_type: "Professional Pass",
  amount: "₹5,000",
  payment_id: "pay_ABC123XYZ",

  // Event
  event_name: "AMASI Annual Conference 2025",
  event_date: "March 15-17, 2025",
  venue_name: "Convention Center",
  venue_address: "123 Main Street, Mumbai",

  // Speaker
  speaker_name: "Dr. Jane Smith",
  speaker_role: "Keynote Speaker",
  session_name: "Future of Medical Education",
  session_date: "March 15, 2025",
  session_time: "10:00 AM - 11:00 AM",
  hall_name: "Main Auditorium",
  response_url: "https://example.com/respond/abc123",

  // URLs
  badge_url: "https://example.com/badge/abc123.pdf",
  certificate_url: "https://example.com/certificate/abc123.pdf",

  // Organizer
  organizer_name: "AMASI",
  organizer_email: "support@amasi.org",
  year: new Date().getFullYear().toString(),
}

// Replace template variables with sample data
function replaceVariables(content: string, data: Record<string, string> = SAMPLE_DATA): string {
  let result = content
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value)
  }
  return result
}

// POST - Send test email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { id } = await params

  try {
    const body = await request.json()
    const { email, custom_data } = body

    if (!email) {
      return NextResponse.json(
        { error: "Test email address is required" },
        { status: 400 }
      )
    }

    // Get template
    const { data: template, error: templateError } = await (supabase as any)
      .from("email_templates")
      .select("*")
      .eq("id", id)
      .single()

    if (templateError || !template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      )
    }

    // Merge custom data with sample data
    const mergedData = { ...SAMPLE_DATA, ...custom_data }

    // Replace variables in subject and body
    const subject = replaceVariables(template.subject, mergedData) + " [TEST]"
    const htmlBody = replaceVariables(template.body_html, mergedData)

    // Send test email using the existing email system
    // Check if Blastable is configured
    const blastableApiKey = process.env.BLASTABLE_API_KEY
    const resendApiKey = process.env.RESEND_API_KEY

    if (blastableApiKey) {
      // Send via Blastable
      const response = await fetch("https://api.blastable.com/v1/emails/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${blastableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "noreply@amasi.org",
          to: email,
          subject,
          html: htmlBody,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to send via Blastable")
      }
    } else if (resendApiKey) {
      // Send via Resend
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "AMASI <noreply@amasi.org>",
          to: [email],
          subject,
          html: htmlBody,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to send via Resend")
      }
    } else {
      return NextResponse.json(
        { error: "No email provider configured. Set BLASTABLE_API_KEY or RESEND_API_KEY." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${email}`,
    })
  } catch (error: any) {
    console.error("Error sending test email:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET - Get preview with sample data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { id } = await params

  try {
    // Get template
    const { data: template, error } = await (supabase as any)
      .from("email_templates")
      .select("*")
      .eq("id", id)
      .single()

    if (error || !template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      )
    }

    // Replace variables with sample data
    const previewSubject = replaceVariables(template.subject)
    const previewHtml = replaceVariables(template.body_html)

    return NextResponse.json({
      subject: previewSubject,
      body_html: previewHtml,
      available_variables: Object.keys(SAMPLE_DATA),
    })
  } catch (error: any) {
    console.error("Error getting template preview:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
