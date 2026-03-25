import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { COMPANY_CONFIG } from "@/lib/config"
import { getApiUser } from "@/lib/auth/api-auth"

// POST /api/communications/templates/seed?event_id=xxx
// Seeds beautiful pre-built templates for an event
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get event details for template customization
    const { data: event } = await (supabase as any)
      .from("events")
      .select("name, short_name, start_date, end_date, venue_name, city")
      .eq("id", eventId)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const eventName = event.short_name || event.name || "Event"

    const templates = [
      {
        event_id: eventId,
        name: "Welcome - Registration Confirmed",
        description: "Sent immediately after successful registration",
        channel: "email",
        email_subject: `🎉 Welcome to ${eventName}, {{name}}! Your Registration is Confirmed`,
        email_body: `Dear Dr. {{name}},

Greetings from ${COMPANY_CONFIG.name}!

We are thrilled to confirm your registration for ${eventName}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 REGISTRATION DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Registration ID: {{registration_id}}
Event: ${eventName}
Date: {{event_date}}
Venue: {{venue}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 WHAT'S NEXT?

1️⃣ Save the date in your calendar
2️⃣ Prepare your travel arrangements
3️⃣ Review the scientific program (coming soon)
4️⃣ Connect with fellow delegates

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We look forward to your active participation!

Warm regards,
The Organizing Committee`,
        message_body: null,
        variables: ["name", "registration_id", "event_date", "venue"],
        is_system: false,
        is_active: true,
      },
      {
        event_id: eventId,
        name: "WhatsApp - Registration Confirmed",
        description: "WhatsApp message after registration",
        channel: "whatsapp",
        email_subject: null,
        email_body: null,
        message_body: `🎉 *Welcome to ${eventName}!*

Dear Dr. {{name}},

Your registration is confirmed! ✅

📋 *Details:*
• Reg ID: {{registration_id}}
• Date: {{event_date}}
• Venue: {{venue}}

We look forward to seeing you!

_Team ${COMPANY_CONFIG.name}_`,
        variables: ["name", "registration_id", "event_date", "venue"],
        is_system: false,
        is_active: true,
      },
      {
        event_id: eventId,
        name: "Reminder - 7 Days to Go",
        description: "Reminder sent 7 days before event",
        channel: "email",
        email_subject: `⏰ 7 Days to Go! ${eventName} Awaits You, {{name}}`,
        email_body: `Dear Dr. {{name}},

The countdown has begun! 🎯

${eventName} is just ONE WEEK away!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 EVENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Date: {{event_date}}
Venue: {{venue}}
Your Registration: {{registration_id}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ PRE-EVENT CHECKLIST

☐ Confirm your travel bookings
☐ Pack your conference essentials
☐ Review the scientific program
☐ Download the event app

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

See you in 7 days!

Best regards,
Organizing Committee`,
        message_body: null,
        variables: ["name", "registration_id", "event_date", "venue"],
        is_system: false,
        is_active: true,
      },
      {
        event_id: eventId,
        name: "Reminder - Event Tomorrow!",
        description: "Reminder sent 1 day before event",
        channel: "all",
        email_subject: `🔔 Tomorrow is the Day! ${eventName} Final Reminder`,
        email_body: `Dear Dr. {{name}},

This is your final reminder! ${eventName} begins TOMORROW!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 VENUE & TIMING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Date: {{event_date}}
🏛️ Venue: {{venue}}
⏰ Registration Desk Opens: 8:00 AM
🎯 Inauguration: 9:00 AM

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PLEASE BRING

✓ Government Photo ID
✓ Registration confirmation
✓ Business cards for networking

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

See you tomorrow! 🎉

Warm regards,
${COMPANY_CONFIG.name} Team`,
        message_body: `🔔 *Tomorrow: ${eventName}!*

Dear Dr. {{name}},

Final reminder! Event starts tomorrow.

📍 *Details:*
• Date: {{event_date}}
• Venue: {{venue}}
• Registration: 8:00 AM

✅ *Bring:*
• Photo ID
• Confirmation

See you there! 🎯

_Team ${COMPANY_CONFIG.name}_`,
        variables: ["name", "event_date", "venue"],
        is_system: false,
        is_active: true,
      },
      {
        event_id: eventId,
        name: "Faculty Invitation",
        description: "Invitation to speakers and faculty members",
        channel: "email",
        email_subject: `🎤 Invitation to Speak at ${eventName} - {{name}}`,
        email_body: `Dear Dr. {{name}},

Warm Greetings from ${COMPANY_CONFIG.name}!

We are honored to invite you as a distinguished faculty member for ${eventName}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 EVENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Event: ${eventName}
Date: {{event_date}}
Venue: {{venue}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 YOUR SESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Topic: {{session_name}}
Date: {{session_date}}
Time: {{session_time}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌟 AS A FACULTY MEMBER, YOU WILL RECEIVE:

✓ Complimentary registration
✓ Travel assistance
✓ Accommodation arrangement
✓ Certificate of appreciation
✓ Faculty dinner invitation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please confirm your participation through your Speaker Portal.

With warm regards,
${COMPANY_CONFIG.name} Scientific Committee`,
        message_body: null,
        variables: ["name", "event_date", "venue", "session_name", "session_date", "session_time"],
        is_system: false,
        is_active: true,
      },
      {
        event_id: eventId,
        name: "Payment Reminder",
        description: "Reminder for pending payment",
        channel: "all",
        email_subject: `⚠️ Action Required: Complete Your ${eventName} Registration Payment`,
        email_body: `Dear Dr. {{name}},

We noticed that your registration payment for ${eventName} is still pending.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💳 PAYMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Registration ID: {{registration_id}}
Amount Due: ₹{{amount}}
Payment Deadline: {{deadline}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Secure your spot before seats fill up!

Best regards,
${COMPANY_CONFIG.name} Registration Team`,
        message_body: `⚠️ *Payment Reminder*

Dear Dr. {{name}},

Your ${eventName} payment is pending.

💳 *Details:*
• Amount: ₹{{amount}}
• Deadline: {{deadline}}

Please complete payment to confirm your seat.

_Team ${COMPANY_CONFIG.name}_`,
        variables: ["name", "registration_id", "amount", "deadline"],
        is_system: false,
        is_active: true,
      },
      {
        event_id: eventId,
        name: "Certificate Ready",
        description: "Notification when certificate is generated",
        channel: "all",
        email_subject: `🎓 Your ${eventName} Certificate is Ready, {{name}}!`,
        email_body: `Dear Dr. {{name}},

Congratulations on completing ${eventName}! 🎉

Your Certificate of Participation is now ready for download.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📜 CERTIFICATE DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Event: ${eventName}
Date: {{event_date}}
Certificate Type: Participation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Download your certificate from your portal.

With best wishes,
${COMPANY_CONFIG.name} Team`,
        message_body: `🎓 *Certificate Ready!*

Dear Dr. {{name}},

Your ${eventName} certificate is ready.

📜 Download from your portal.

Thank you for joining us!

_Team ${COMPANY_CONFIG.name}_`,
        variables: ["name", "event_date"],
        is_system: false,
        is_active: true,
      },
      {
        event_id: eventId,
        name: "Thank You - Post Event",
        description: "Thank you message after event",
        channel: "email",
        email_subject: `🙏 Thank You for Attending ${eventName}, {{name}}!`,
        email_body: `Dear Dr. {{name}},

Thank you for being part of ${eventName}!

Your presence made this event truly special.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 WE VALUE YOUR FEEDBACK

Help us improve! Share your experience:
[Feedback Form Link]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎓 CERTIFICATE

Your participation certificate will be emailed within 7 days.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Until we meet again!

With gratitude,
${COMPANY_CONFIG.name} Organizing Committee`,
        message_body: null,
        variables: ["name"],
        is_system: false,
        is_active: true,
      },
      {
        event_id: eventId,
        name: "SMS - Quick Reminder",
        description: "Short SMS reminder",
        channel: "sms",
        email_subject: null,
        email_body: null,
        message_body: `${COMPANY_CONFIG.name}: Dear Dr. {{name}}, Reminder: ${eventName} on {{event_date}} at {{venue}}. See you there! -${COMPANY_CONFIG.name}`,
        variables: ["name", "event_date", "venue"],
        is_system: false,
        is_active: true,
      },
      {
        event_id: eventId,
        name: "General Announcement",
        description: "Template for general announcements",
        channel: "all",
        email_subject: `📢 Important Update: ${eventName}`,
        email_body: `Dear Dr. {{name}},

We have an important update regarding ${eventName}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📢 ANNOUNCEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Your announcement content here]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For queries, contact: ${COMPANY_CONFIG.supportEmail}

Best regards,
${COMPANY_CONFIG.name} Team`,
        message_body: `📢 *Update: ${eventName}*

Dear Dr. {{name}},

[Your announcement here]

_Team ${COMPANY_CONFIG.name}_`,
        variables: ["name"],
        is_system: false,
        is_active: true,
      },
    ]

    // Check if templates already exist
    const { data: existing } = await (supabase as any)
      .from("message_templates")
      .select("id")
      .eq("event_id", eventId)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({
        success: false,
        error: "Templates already exist for this event. Delete existing templates first.",
      }, { status: 400 })
    }

    // Insert templates
    const { error } = await (supabase as any)
      .from("message_templates")
      .insert(templates)

    if (error) {
      console.error("Error inserting templates:", error)
      return NextResponse.json({
        error: "Failed to create templates"
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Created ${templates.length} beautiful templates for ${eventName}`,
      count: templates.length,
    })
  } catch (error: any) {
    console.error("Error seeding templates:", error)
    return NextResponse.json({ error: "Failed to seed templates" }, { status: 500 })
  }
}
