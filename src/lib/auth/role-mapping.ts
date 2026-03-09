import type { PlatformRole } from './api-auth'

/**
 * Map a team_members role to the corresponding platform_role for the users table.
 * Used when auto-creating user profiles for invited team members.
 */
export function mapTeamRoleToPlatformRole(teamRole: string): PlatformRole {
  switch (teamRole) {
    case 'admin':
      return 'admin'
    case 'coordinator':
      return 'event_admin'
    case 'travel':
      return 'staff'
    default:
      return 'member'
  }
}
