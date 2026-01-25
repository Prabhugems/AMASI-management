import { createServerSupabaseClient } from "@/lib/supabase/server"

export type ActivityAction =
  | "create"
  | "update"
  | "delete"
  | "view"
  | "export"
  | "import"
  | "send_email"
  | "send_bulk_email"
  | "generate_badge"
  | "generate_certificate"
  | "check_in"
  | "check_out"
  | "confirm"
  | "cancel"
  | "refund"
  | "invite"
  | "remind"
  | "login"
  | "logout"
  | "bulk_action"

export type EntityType =
  | "registration"
  | "event"
  | "ticket"
  | "badge"
  | "certificate"
  | "speaker"
  | "session"
  | "checkin_list"
  | "email_template"
  | "discount_code"
  | "payment"
  | "team_member"
  | "settings"
  | "user"

export interface LogActivityParams {
  action: ActivityAction | string
  entityType: EntityType | string
  entityId?: string
  entityName?: string
  eventId?: string
  eventName?: string
  description?: string
  metadata?: Record<string, any>
  userEmail?: string
  userName?: string
}

/**
 * Log an activity to the audit trail
 * Use this to track important admin actions
 */
export async function logActivity(params: LogActivityParams): Promise<string | null> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user if not provided
    let userEmail = params.userEmail
    let userName = params.userName

    if (!userEmail) {
      const { data: { user } } = await supabase.auth.getUser()
      userEmail = user?.email || "system"
      userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "System"
    }

    const { data, error } = await (supabase as any)
      .from("activity_logs")
      .insert({
        user_email: userEmail,
        user_name: userName,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        entity_name: params.entityName,
        event_id: params.eventId,
        event_name: params.eventName,
        description: params.description || generateDescription(params),
        metadata: params.metadata || {},
      })
      .select("id")
      .single()

    if (error) {
      console.error("Failed to log activity:", error)
      return null
    }

    return data?.id
  } catch (error) {
    console.error("Error logging activity:", error)
    return null
  }
}

/**
 * Generate a human-readable description for the activity
 */
function generateDescription(params: LogActivityParams): string {
  const entity = params.entityName || params.entityType
  const action = formatAction(params.action)

  switch (params.action) {
    case "create":
      return `Created ${params.entityType}: ${entity}`
    case "update":
      return `Updated ${params.entityType}: ${entity}`
    case "delete":
      return `Deleted ${params.entityType}: ${entity}`
    case "send_email":
      return `Sent email to ${entity}`
    case "send_bulk_email":
      return `Sent bulk email to ${params.metadata?.count || "multiple"} recipients`
    case "generate_badge":
      return `Generated badge for ${entity}`
    case "generate_certificate":
      return `Generated certificate for ${entity}`
    case "check_in":
      return `Checked in: ${entity}`
    case "check_out":
      return `Checked out: ${entity}`
    case "confirm":
      return `Confirmed ${params.entityType}: ${entity}`
    case "cancel":
      return `Cancelled ${params.entityType}: ${entity}`
    case "invite":
      return `Sent invitation to ${entity}`
    case "bulk_action":
      return `Performed bulk ${params.metadata?.bulkAction || "action"} on ${params.metadata?.count || "multiple"} items`
    default:
      return `${action} ${params.entityType}: ${entity}`
  }
}

function formatAction(action: string): string {
  return action
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

// For client-side logging, use: import { logActivityClient } from "@/lib/activity-logger-client"
