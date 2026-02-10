import { createServerSupabaseClient } from "@/lib/supabase/server"

export type TemplateType =
  | "registration_confirmation"
  | "payment_receipt"
  | "badge_email"
  | "certificate_email"
  | "speaker_invitation"
  | "speaker_reminder"
  | "custom"

export interface TemplateVariables {
  // Attendee/Registration
  attendee_name?: string
  attendee_email?: string
  registration_number?: string
  ticket_type?: string
  amount?: string
  payment_id?: string

  // Event
  event_name?: string
  event_date?: string
  venue_name?: string
  venue_address?: string

  // Speaker
  speaker_name?: string
  speaker_role?: string
  session_name?: string
  session_date?: string
  session_time?: string
  hall_name?: string
  response_url?: string

  // URLs
  badge_url?: string
  certificate_url?: string

  // Organizer
  organizer_name?: string
  organizer_email?: string
  year?: string

  // Custom variables
  [key: string]: string | undefined
}

/**
 * Replace template variables with actual data
 */
export function renderTemplate(
  template: string,
  variables: TemplateVariables
): string {
  let result = template

  // Add default year if not provided
  if (!variables.year) {
    variables.year = new Date().getFullYear().toString()
  }

  // Replace all {{variable}} patterns with actual values
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      result = result.replace(new RegExp(`{{${key}}}`, "g"), value)
    }
  }

  // Remove any remaining unreplaced variables (replace with empty string)
  result = result.replace(/{{[^}]+}}/g, "")

  return result
}

/**
 * Fetch the appropriate template for a given type and event
 * Returns the event-specific template if available, otherwise falls back to global default
 */
export async function getEmailTemplate(
  templateType: TemplateType,
  eventId?: string
): Promise<{
  id: string
  subject: string
  body_html: string
  body_text: string | null
} | null> {
  const supabase = await createServerSupabaseClient()

  // First, try to get event-specific template that is default
  if (eventId) {
    const { data: eventTemplate } = await (supabase as any)
      .from("email_templates")
      .select("id, subject, body_html, body_text")
      .eq("event_id", eventId)
      .eq("template_type", templateType)
      .eq("is_active", true)
      .eq("is_default", true)
      .single()

    if (eventTemplate) {
      return eventTemplate
    }

    // If no default, get any active template for this event
    const { data: anyEventTemplate } = await (supabase as any)
      .from("email_templates")
      .select("id, subject, body_html, body_text")
      .eq("event_id", eventId)
      .eq("template_type", templateType)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (anyEventTemplate) {
      return anyEventTemplate
    }
  }

  // Fall back to global default template
  const { data: globalTemplate } = await (supabase as any)
    .from("email_templates")
    .select("id, subject, body_html, body_text")
    .is("event_id", null)
    .eq("template_type", templateType)
    .eq("is_default", true)
    .single()

  return globalTemplate || null
}

/**
 * Render an email template with variables
 * Convenience function that combines getEmailTemplate and renderTemplate
 */
export async function renderEmailTemplate(
  templateType: TemplateType,
  variables: TemplateVariables,
  eventId?: string
): Promise<{
  subject: string
  body_html: string
  body_text: string | null
} | null> {
  const template = await getEmailTemplate(templateType, eventId)

  if (!template) {
    console.warn(`No template found for type: ${templateType}`)
    return null
  }

  return {
    subject: renderTemplate(template.subject, variables),
    body_html: renderTemplate(template.body_html, variables),
    body_text: template.body_text
      ? renderTemplate(template.body_text, variables)
      : null,
  }
}

/**
 * Build common variables from registration data
 */
export function buildRegistrationVariables(
  registration: {
    attendee_name: string
    attendee_email: string
    registration_number: string
    total_amount: number
    currency?: string
    badge_url?: string | null
    certificate_url?: string | null
    ticket_type?: { name: string } | null
  },
  event: {
    name: string
    start_date: string
    end_date?: string
    venue_name?: string | null
    venue_address?: string | null
    city?: string | null
  },
  organizerEmail?: string
): TemplateVariables {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const eventDate = event.end_date
    ? `${formatDate(event.start_date)} - ${formatDate(event.end_date)}`
    : formatDate(event.start_date)

  return {
    attendee_name: registration.attendee_name,
    attendee_email: registration.attendee_email,
    registration_number: registration.registration_number,
    ticket_type: registration.ticket_type?.name || "Standard",
    amount: `${registration.currency || "₹"}${registration.total_amount.toLocaleString()}`,
    badge_url: registration.badge_url || undefined,
    certificate_url: registration.certificate_url || undefined,
    event_name: event.name,
    event_date: eventDate,
    venue_name: event.venue_name || "",
    venue_address: event.venue_address || event.city || "",
    organizer_name: "AMASI",
    organizer_email: organizerEmail || "support@amasi.org",
    year: new Date().getFullYear().toString(),
  }
}

/**
 * Build variables for speaker/faculty communications
 */
export function buildSpeakerVariables(
  speaker: {
    name: string
    email: string
    role?: string
  },
  session: {
    name: string
    date: string
    start_time?: string
    end_time?: string
    hall?: string | null
  },
  event: {
    name: string
    venue_name?: string | null
  },
  responseUrl: string,
  organizerEmail?: string
): TemplateVariables {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const formatTime = (time?: string) => {
    if (!time || !time.includes(":")) return time || ""
    const [hours, minutes] = time.split(":")
    const hour = parseInt(hours)
    if (isNaN(hour)) return time
    const ampm = hour >= 12 ? "PM" : "AM"
    const hour12 = hour % 12 || 12
    return `${hour12}:${minutes || "00"} ${ampm}`
  }

  const sessionTime =
    session.start_time && session.end_time
      ? `${formatTime(session.start_time)} - ${formatTime(session.end_time)}`
      : session.start_time
      ? formatTime(session.start_time)
      : ""

  return {
    speaker_name: speaker.name,
    speaker_role: speaker.role || "Speaker",
    session_name: session.name,
    session_date: formatDate(session.date),
    session_time: sessionTime,
    hall_name: session.hall || "TBA",
    response_url: responseUrl,
    event_name: event.name,
    venue_name: event.venue_name || "",
    organizer_name: "AMASI",
    organizer_email: organizerEmail || "support@amasi.org",
    year: new Date().getFullYear().toString(),
  }
}
