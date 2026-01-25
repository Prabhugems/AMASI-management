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
 * Client-side function to log activity via API
 * Use this from client components
 */
export async function logActivityClient(params: LogActivityParams): Promise<boolean> {
  try {
    const response = await fetch("/api/activity-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    })
    return response.ok
  } catch (error) {
    console.error("Error logging activity:", error)
    return false
  }
}
