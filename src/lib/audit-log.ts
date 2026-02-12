import { createClient } from "@/lib/supabase/client"

export type AuditAction = 
  | "create" 
  | "update" 
  | "delete" 
  | "login" 
  | "logout"
  | "permission_change"
  | "status_change"
  | "send_invite"

export type AuditEntity = 
  | "team_member" 
  | "event" 
  | "speaker" 
  | "registration"
  | "flight"
  | "hotel"
  | "certificate"
  | "badge"

interface AuditLogEntry {
  action: AuditAction
  entity: AuditEntity
  entity_id: string
  entity_name?: string
  changes?: Record<string, { old: any; new: any }>
  metadata?: Record<string, any>
}

/**
 * Log an audit entry for tracking changes
 * Falls back to console.log if audit_logs table doesn't exist
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  const supabase = createClient()
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    const auditEntry = {
      ...entry,
      user_email: session?.user?.email || "system",
      user_id: session?.user?.id || null,
      created_at: new Date().toISOString(),
    }

    // Try to insert into audit_logs table
    const { error } = await (supabase as any)
      .from("audit_logs")
      .insert(auditEntry)

    if (error) {
      // Table might not exist, log to console instead
      console.log("[AUDIT]", auditEntry)
    }
  } catch (_err) {
    // Fallback to console logging
    console.log("[AUDIT]", entry)
  }
}

/**
 * Helper to create change diff for audit log
 */
export function createChangeDiff(
  oldData: Record<string, any>,
  newData: Record<string, any>,
  fieldsToTrack: string[]
): Record<string, { old: any; new: any }> | undefined {
  const changes: Record<string, { old: any; new: any }> = {}
  
  for (const field of fieldsToTrack) {
    const oldValue = oldData[field]
    const newValue = newData[field]
    
    // Compare arrays
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      if (JSON.stringify(oldValue.sort()) !== JSON.stringify(newValue.sort())) {
        changes[field] = { old: oldValue, new: newValue }
      }
    } 
    // Compare other values
    else if (oldValue !== newValue) {
      changes[field] = { old: oldValue, new: newValue }
    }
  }
  
  return Object.keys(changes).length > 0 ? changes : undefined
}

/**
 * Hook-friendly audit logger
 */
export function useAuditLog() {
  return {
    log: logAudit,
    
    // Convenience methods
    logCreate: (entity: AuditEntity, id: string, name?: string, metadata?: Record<string, any>) =>
      logAudit({ action: "create", entity, entity_id: id, entity_name: name, metadata }),
    
    logUpdate: (entity: AuditEntity, id: string, name?: string, changes?: Record<string, { old: any; new: any }>) =>
      logAudit({ action: "update", entity, entity_id: id, entity_name: name, changes }),
    
    logDelete: (entity: AuditEntity, id: string, name?: string) =>
      logAudit({ action: "delete", entity, entity_id: id, entity_name: name }),
    
    logStatusChange: (entity: AuditEntity, id: string, name: string, oldStatus: any, newStatus: any) =>
      logAudit({
        action: "status_change",
        entity,
        entity_id: id,
        entity_name: name,
        changes: { status: { old: oldStatus, new: newStatus } },
      }),
  }
}
