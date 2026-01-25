import { createAdminClient } from "@/lib/supabase/server"

export type EmailType =
  | "registration_confirmation"
  | "speaker_invitation"
  | "travel_itinerary"
  | "travel_request"
  | "form_notification"
  | "reminder"
  | "other"

export interface LogEmailParams {
  resendEmailId: string
  emailType: EmailType
  fromEmail: string
  toEmail: string
  subject: string
  eventId?: string
  registrationId?: string
  metadata?: Record<string, any>
}

/**
 * Log an email that was sent for tracking purposes
 */
export async function logEmail(params: LogEmailParams): Promise<string | null> {
  try {
    const supabase = await createAdminClient()

    const { data, error } = await (supabase as any)
      .from("email_logs")
      .insert({
        resend_email_id: params.resendEmailId,
        email_type: params.emailType,
        from_email: params.fromEmail,
        to_email: params.toEmail,
        subject: params.subject,
        event_id: params.eventId || null,
        registration_id: params.registrationId || null,
        status: "sent",
        sent_at: new Date().toISOString(),
        metadata: params.metadata || {},
      })
      .select("id")
      .single()

    if (error) {
      console.error("Failed to log email:", error)
      return null
    }

    return data.id
  } catch (err) {
    console.error("Error logging email:", err)
    return null
  }
}

/**
 * Mark an email as responded (e.g., form submitted, travel details submitted)
 */
export async function markEmailResponded(
  resendEmailId: string,
  responseType: string
): Promise<boolean> {
  try {
    const supabase = await createAdminClient()

    const { error } = await (supabase as any)
      .from("email_logs")
      .update({
        responded_at: new Date().toISOString(),
        response_type: responseType,
      })
      .eq("resend_email_id", resendEmailId)

    if (error) {
      console.error("Failed to mark email responded:", error)
      return false
    }

    return true
  } catch (err) {
    console.error("Error marking email responded:", err)
    return false
  }
}

/**
 * Get email tracking status for a registration
 */
export async function getEmailsForRegistration(registrationId: string) {
  try {
    const supabase = await createAdminClient()

    const { data, error } = await (supabase as any)
      .from("email_logs")
      .select("*")
      .eq("registration_id", registrationId)
      .order("sent_at", { ascending: false })

    if (error) {
      console.error("Failed to get emails for registration:", error)
      return []
    }

    return data || []
  } catch (err) {
    console.error("Error getting emails:", err)
    return []
  }
}

/**
 * Get email statistics for an event
 */
export async function getEmailStatsForEvent(eventId: string, emailType?: EmailType) {
  try {
    const supabase = await createAdminClient()

    let query = (supabase as any)
      .from("email_logs")
      .select("status, delivered_at, opened_at, clicked_at, bounced_at, responded_at")
      .eq("event_id", eventId)

    if (emailType) {
      query = query.eq("email_type", emailType)
    }

    const { data, error } = await query

    if (error) {
      console.error("Failed to get email stats:", error)
      return null
    }

    const emails = data || []
    const total = emails.length

    return {
      total,
      sent: total,
      delivered: emails.filter((e: any) => e.delivered_at).length,
      opened: emails.filter((e: any) => e.opened_at).length,
      clicked: emails.filter((e: any) => e.clicked_at).length,
      bounced: emails.filter((e: any) => e.status === "bounced").length,
      responded: emails.filter((e: any) => e.responded_at).length,
      deliveryRate: total > 0 ? Math.round((emails.filter((e: any) => e.delivered_at).length / total) * 100) : 0,
      openRate: total > 0 ? Math.round((emails.filter((e: any) => e.opened_at).length / total) * 100) : 0,
      clickRate: total > 0 ? Math.round((emails.filter((e: any) => e.clicked_at).length / total) * 100) : 0,
      responseRate: total > 0 ? Math.round((emails.filter((e: any) => e.responded_at).length / total) * 100) : 0,
    }
  } catch (err) {
    console.error("Error getting email stats:", err)
    return null
  }
}

/**
 * Get status label and color for display
 */
export function getEmailStatusDisplay(email: any): { label: string; color: string; icon: string } {
  if (email.responded_at) {
    return { label: "Responded", color: "text-green-600 bg-green-50", icon: "check-circle" }
  }
  if (email.clicked_at) {
    return { label: "Clicked", color: "text-blue-600 bg-blue-50", icon: "mouse-pointer-click" }
  }
  if (email.opened_at) {
    return { label: "Opened", color: "text-purple-600 bg-purple-50", icon: "eye" }
  }
  if (email.status === "bounced") {
    return { label: "Bounced", color: "text-red-600 bg-red-50", icon: "x-circle" }
  }
  if (email.status === "complained") {
    return { label: "Spam", color: "text-red-600 bg-red-50", icon: "alert-triangle" }
  }
  if (email.delivered_at) {
    return { label: "Delivered", color: "text-teal-600 bg-teal-50", icon: "inbox" }
  }
  if (email.status === "sent") {
    return { label: "Sent", color: "text-gray-600 bg-gray-50", icon: "send" }
  }
  return { label: "Unknown", color: "text-gray-400 bg-gray-50", icon: "help-circle" }
}
