import { createAdminClient } from '@/lib/supabase/server'

export interface LogTeamActionParams {
  actorId: string
  actorEmail: string
  action: string
  targetType?: string
  targetId?: string
  targetEmail?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Log a team-related action to the team_activity_logs table.
 * Fire-and-forget: errors are logged to console but never thrown,
 * so calling code is never disrupted.
 */
export async function logTeamAction(params: LogTeamActionParams): Promise<void> {
  try {
    const adminClient = await createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (adminClient as any)
      .from('team_activity_logs')
      .insert({
        actor_id: params.actorId,
        actor_email: params.actorEmail,
        action: params.action,
        target_type: params.targetType ?? 'team_member',
        target_id: params.targetId ?? null,
        target_email: params.targetEmail ?? null,
        metadata: params.metadata ?? {},
        ip_address: params.ipAddress ?? null,
      })

    if (error) {
      console.error('Failed to log team action:', error)
    }
  } catch (err) {
    console.error('Error in logTeamAction:', err)
  }
}
