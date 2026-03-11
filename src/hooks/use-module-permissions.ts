"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Permission } from "./use-permissions"

type TeamMemberType = {
  permissions: string[] | null
  role: string | null
  name: string
  event_ids: string[] | null
}

export interface ModulePermissions {
  permissions: string[]
  isAdmin: boolean
  isTeamUser: boolean
  hasFullAccess: boolean
  hasAccess: boolean
  userName: string
  isLoading: boolean
}

/**
 * Shared hook for checking module-level permissions within an event.
 * Replaces duplicated permission logic across layout files.
 *
 * @param eventId - The event to check access for
 * @param moduleKey - The permission key (e.g. "speakers", "checkin")
 *                    Pass null for modules that don't require a specific permission
 */
export function useModulePermissions(
  eventId: string,
  moduleKey: Permission | Permission[] | null
): ModulePermissions {
  const supabase = createClient()

  const { data, isLoading } = useQuery({
    queryKey: ["module-permissions", eventId, moduleKey],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) {
        return {
          permissions: [] as string[],
          isAdmin: false,
          isTeamUser: false,
          hasFullAccess: false,
          hasAccess: false,
          userName: "",
        }
      }

      const { data: teamMemberData } = await supabase
        .from("team_members")
        .select("permissions, role, name, event_ids")
        .eq("email", session.user.email.toLowerCase())
        .eq("is_active", true)
        .maybeSingle()
      const teamMember = teamMemberData as TeamMemberType | null

      // Not in team_members = main app admin with full access
      if (!teamMember) {
        return {
          permissions: [] as string[],
          isAdmin: true,
          isTeamUser: false,
          hasFullAccess: true,
          hasAccess: true,
          userName: session.user.email,
        }
      }

      // Check event-scoped access
      const isEventScoped = teamMember.event_ids && teamMember.event_ids.length > 0
      const hasEventAccess = !isEventScoped || teamMember.event_ids?.includes(eventId)

      if (!hasEventAccess) {
        return {
          permissions: teamMember.permissions || [],
          isAdmin: false,
          isTeamUser: true,
          hasFullAccess: false,
          hasAccess: false,
          userName: teamMember.name || session.user.email,
        }
      }

      const isAdmin = teamMember.role?.includes("admin") || false
      const isTeamUser = !isAdmin
      const hasFullAccess = !teamMember.permissions || teamMember.permissions.length === 0

      // Check specific module permission
      let hasModulePermission = false
      if (moduleKey === null) {
        hasModulePermission = true
      } else if (Array.isArray(moduleKey)) {
        hasModulePermission = moduleKey.some(k => teamMember.permissions?.includes(k))
      } else {
        hasModulePermission = teamMember.permissions?.includes(moduleKey) || false
      }

      return {
        permissions: teamMember.permissions || [],
        isAdmin,
        isTeamUser,
        hasFullAccess,
        hasAccess: isAdmin || hasFullAccess || hasModulePermission,
        userName: teamMember.name || session.user.email,
      }
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always" as const,
  })

  return {
    permissions: data?.permissions || [],
    isAdmin: data?.isAdmin || false,
    isTeamUser: data?.isTeamUser || false,
    hasFullAccess: data?.hasFullAccess || false,
    hasAccess: data?.hasAccess || false,
    userName: data?.userName || "",
    isLoading,
  }
}
