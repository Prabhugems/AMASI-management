import { createServerSupabaseClient } from "@/lib/supabase/server"
import { COMPANY_CONFIG } from "@/lib/config"

export type TemplateType =
  | "registration_confirmation"
  | "payment_receipt"
  | "badge_email"
  | "certificate_email"
  | "speaker_invitation"
  | "speaker_reminder"
  | "abstract_accepted"
  | "abstract_rejected"
  | "abstract_revision"
  | "abstract_schedule"
  | "abstract_reminder"
  | "team_invitation"
  | "team_role_changed"
  | "team_deactivated"
  | "team_activated"
  | "team_welcome"
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

  // Abstract
  abstract_number?: string
  abstract_title?: string
  abstract_status?: string
  abstract_decision?: string
  accepted_as?: string
  presentation_type?: string
  presentation_date?: string
  presentation_time?: string
  presentation_location?: string
  category_name?: string
  reviewer_comments?: string
  decision_notes?: string
  author_name?: string
  author_email?: string
  portal_url?: string

  // URLs
  badge_url?: string
  certificate_url?: string

  // Organizer
  organizer_name?: string
  organizer_email?: string
  year?: string

  // Team
  name?: string
  role?: string
  old_role?: string
  new_role?: string
  org_name?: string
  invite_link?: string
  login_link?: string

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
      // Escape regex special characters in the key to prevent injection
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      result = result.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, "g"), value)
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
      .maybeSingle()

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
      .maybeSingle()

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
    .maybeSingle()

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
    organizer_name: COMPANY_CONFIG.name,
    organizer_email: organizerEmail || COMPANY_CONFIG.supportEmail,
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
    organizer_name: COMPANY_CONFIG.name,
    organizer_email: organizerEmail || COMPANY_CONFIG.supportEmail,
    year: new Date().getFullYear().toString(),
  }
}

/**
 * Build variables for abstract notifications
 */
export function buildAbstractVariables(
  abstract: {
    abstract_number: string
    title: string
    status: string
    decision?: string | null
    accepted_as?: string | null
    decision_notes?: string | null
    presenting_author_name: string
    presenting_author_email: string
    category_name?: string | null
    session_date?: string | null
    session_time?: string | null
    session_location?: string | null
  },
  event: {
    name: string
    short_name?: string | null
    start_date?: string | null
    city?: string | null
  },
  portalUrl?: string,
  organizerEmail?: string
): TemplateVariables {
  const formatDate = (date: string | null | undefined) => {
    if (!date) return ""
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const formatTime = (time?: string | null) => {
    if (!time || !time.includes(":")) return time || ""
    const [hours, minutes] = time.split(":")
    const hour = parseInt(hours)
    if (isNaN(hour)) return time
    const ampm = hour >= 12 ? "PM" : "AM"
    const hour12 = hour % 12 || 12
    return `${hour12}:${minutes || "00"} ${ampm}`
  }

  const statusLabels: Record<string, string> = {
    accepted: "Accepted",
    rejected: "Rejected",
    revision_requested: "Revision Requested",
    under_review: "Under Review",
    submitted: "Submitted",
  }

  return {
    abstract_number: abstract.abstract_number,
    abstract_title: abstract.title,
    abstract_status: statusLabels[abstract.status] || abstract.status,
    abstract_decision: abstract.decision || "",
    accepted_as: abstract.accepted_as || "",
    presentation_type: abstract.accepted_as || "",
    presentation_date: formatDate(abstract.session_date),
    presentation_time: formatTime(abstract.session_time),
    presentation_location: abstract.session_location || "",
    category_name: abstract.category_name || "",
    decision_notes: abstract.decision_notes || "",
    author_name: abstract.presenting_author_name,
    author_email: abstract.presenting_author_email,
    event_name: event.name,
    event_date: formatDate(event.start_date),
    venue_address: event.city || "",
    portal_url: portalUrl || "",
    organizer_name: COMPANY_CONFIG.name,
    organizer_email: organizerEmail || COMPANY_CONFIG.supportEmail,
    year: new Date().getFullYear().toString(),
  }
}

// ─── Team Email Templates ────────────────────────────────────────────

const teamEmailWrapper = (content: string) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
  <div style="background-color: #2563eb; padding: 24px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 22px;">${COMPANY_CONFIG.name}</h1>
  </div>
  <div style="padding: 32px 24px;">
    ${content}
  </div>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
  <div style="padding: 16px 24px; text-align: center;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">${COMPANY_CONFIG.fullName}</p>
  </div>
</div>
`

const teamButton = (href: string, label: string) => `
<p style="margin: 24px 0;">
  <a href="${href}"
     style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
    ${label}
  </a>
</p>
<p style="color: #6b7280; font-size: 14px;">
  Or copy and paste this link:<br/>
  <a href="${href}" style="color: #2563eb;">${href}</a>
</p>
`

/**
 * Team Invitation Email
 */
export function teamInvitation(vars: {
  name?: string
  role: string
  org_name: string
  invite_link: string
}): { subject: string; html: string } {
  const greeting = vars.name ? `Hi ${vars.name},` : "Hi,"
  return {
    subject: `You're invited to join ${vars.org_name} team`,
    html: teamEmailWrapper(`
      <h2 style="color: #1f2937; margin-top: 0;">Team Invitation</h2>
      <p style="color: #374151;">${greeting}</p>
      <p style="color: #374151;">You have been invited to join the <strong>${vars.org_name}</strong> team as <strong>${vars.role}</strong>.</p>
      <p style="color: #374151;">Click the button below to accept the invitation:</p>
      ${teamButton(vars.invite_link, "Accept Invitation")}
      <p style="color: #6b7280; font-size: 14px;">This invitation expires in 7 days.</p>
    `),
  }
}

/**
 * Role Changed Email
 */
export function teamRoleChanged(vars: {
  name: string
  old_role: string
  new_role: string
  org_name: string
}): { subject: string; html: string } {
  return {
    subject: "Your role has been updated",
    html: teamEmailWrapper(`
      <h2 style="color: #1f2937; margin-top: 0;">Role Updated</h2>
      <p style="color: #374151;">Hi ${vars.name},</p>
      <p style="color: #374151;">Your role in the <strong>${vars.org_name}</strong> team has been changed from <strong>${vars.old_role}</strong> to <strong>${vars.new_role}</strong>.</p>
      <p style="color: #374151;">This may affect the features and sections you can access within the platform. Your updated permissions are effective immediately.</p>
      <p style="color: #6b7280; font-size: 14px;">If you have any questions about this change, please contact your administrator.</p>
    `),
  }
}

/**
 * Account Deactivated Email
 */
export function teamDeactivated(vars: {
  name: string
  org_name: string
}): { subject: string; html: string } {
  return {
    subject: "Your account has been deactivated",
    html: teamEmailWrapper(`
      <h2 style="color: #1f2937; margin-top: 0;">Account Deactivated</h2>
      <p style="color: #374151;">Hi ${vars.name},</p>
      <p style="color: #374151;">Your access to the <strong>${vars.org_name}</strong> team platform has been deactivated. You will no longer be able to sign in or access team resources.</p>
      <p style="color: #6b7280; font-size: 14px;">If you believe this was done in error, please contact your administrator to have your account reactivated.</p>
    `),
  }
}

/**
 * Account Activated Email
 */
export function teamActivated(vars: {
  name: string
  org_name: string
  login_link: string
}): { subject: string; html: string } {
  return {
    subject: "Your account has been reactivated",
    html: teamEmailWrapper(`
      <h2 style="color: #1f2937; margin-top: 0;">Account Reactivated</h2>
      <p style="color: #374151;">Hi ${vars.name},</p>
      <p style="color: #374151;">Your access to the <strong>${vars.org_name}</strong> team platform has been restored. You can now sign in and access all resources associated with your role.</p>
      ${teamButton(vars.login_link, "Sign In")}
    `),
  }
}

/**
 * Welcome Email (after invite accepted)
 */
export function teamWelcome(vars: {
  name: string
  role: string
  org_name: string
  login_link: string
}): { subject: string; html: string } {
  return {
    subject: `Welcome to ${vars.org_name} team!`,
    html: teamEmailWrapper(`
      <h2 style="color: #1f2937; margin-top: 0;">Welcome to the Team!</h2>
      <p style="color: #374151;">Hi ${vars.name},</p>
      <p style="color: #374151;">You are now part of the <strong>${vars.org_name}</strong> team as <strong>${vars.role}</strong>. Here are a few things to get you started:</p>
      <ul style="color: #374151; padding-left: 20px;">
        <li>Sign in to the platform to explore your dashboard</li>
        <li>Review the events and resources available to you</li>
        <li>Update your profile information if needed</li>
      </ul>
      ${teamButton(vars.login_link, "Go to Dashboard")}
      <p style="color: #6b7280; font-size: 14px;">If you need help, reach out to your administrator or contact us at ${COMPANY_CONFIG.supportEmail}.</p>
    `),
  }
}
