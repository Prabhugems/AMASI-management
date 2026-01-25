"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export type Permission =
  | "flights" | "hotels" | "transfers" | "trains"
  | "speakers" | "program" | "checkin" | "badges" | "certificates" | "registrations"

export type Role = "admin" | "travel" | "coordinator"

export interface UserPermissions {
  permissions: Permission[]
  role: Role | null
  isAdmin: boolean
  isTeamUser: boolean
  hasFullAccess: boolean
  isEventScoped: boolean // NEW: true if user only has access to specific events
  eventIds: string[] // NEW: list of events user has access to
  userName: string
  userEmail: string
  isLoading: boolean
  hasPermission: (permission: Permission) => boolean
  hasAnyPermission: (permissions: Permission[]) => boolean
  hasAllPermissions: (permissions: Permission[]) => boolean
  hasEventAccess: (eventId: string) => boolean // NEW: check if user can access specific event
}

export function usePermissions(): UserPermissions {
  const supabase = createClient()

  const { data, isLoading } = useQuery({
    queryKey: ["user-permissions"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user?.email) {
        return {
          permissions: [] as Permission[],
          role: null,
          isAdmin: false,
          isTeamUser: false,
          hasFullAccess: false,
          isEventScoped: false,
          eventIds: [] as string[],
          userName: "",
          userEmail: "",
        }
      }

      type TeamMemberType = {
        permissions: string[] | null
        role: string | null
        name: string
        event_ids: string[] | null
      }
      const { data: teamMemberData } = await supabase
        .from("team_members")
        .select("permissions, role, name, event_ids")
        .eq("email", session.user.email.toLowerCase())
        .eq("is_active", true)
        .single()
      const teamMember = teamMemberData as TeamMemberType | null

      // If user is NOT in team_members table, they're a main app admin with full access
      if (!teamMember) {
        return {
          permissions: [] as Permission[],
          role: "admin" as Role,
          isAdmin: true,
          isTeamUser: false,
          hasFullAccess: true,
          isEventScoped: false,
          eventIds: [] as string[],
          userName: session.user.email.split("@")[0],
          userEmail: session.user.email,
        }
      }

      // Check if user is event-scoped (has specific event_ids assigned)
      const isEventScoped = teamMember.event_ids && teamMember.event_ids.length > 0
      const eventIds = teamMember.event_ids || []

      // Event-scoped users should NOT have main dashboard admin access
      // They can only access their assigned events
      const isAdmin = !isEventScoped && (teamMember.role?.includes("admin") || false)
      const isTeamUser = !isAdmin
      const hasFullAccess = !isEventScoped && (!teamMember.permissions || teamMember.permissions.length === 0)

      return {
        permissions: (teamMember.permissions || []) as Permission[],
        role: teamMember.role as Role,
        isAdmin,
        isTeamUser,
        hasFullAccess,
        isEventScoped,
        eventIds,
        userName: teamMember.name || session.user.email,
        userEmail: session.user.email,
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  const hasPermission = (permission: Permission): boolean => {
    if (!data) return false
    if (data.isAdmin || data.hasFullAccess) return true
    return data.permissions.includes(permission)
  }

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    if (!data) return false
    if (data.isAdmin || data.hasFullAccess) return true
    return permissions.some(p => data.permissions.includes(p))
  }

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    if (!data) return false
    if (data.isAdmin || data.hasFullAccess) return true
    return permissions.every(p => data.permissions.includes(p))
  }

  // Check if user has access to a specific event
  const hasEventAccess = (eventId: string): boolean => {
    if (!data) return false
    // Main admins have access to all events
    if (data.isAdmin || data.hasFullAccess) return true
    // Event-scoped users can only access their assigned events
    if (data.isEventScoped) {
      return data.eventIds.includes(eventId)
    }
    // Non-scoped team members have access to all events
    return true
  }

  return {
    permissions: data?.permissions || [],
    role: data?.role || null,
    isAdmin: data?.isAdmin || false,
    isTeamUser: data?.isTeamUser || false,
    hasFullAccess: data?.hasFullAccess || false,
    isEventScoped: data?.isEventScoped || false,
    eventIds: data?.eventIds || [],
    userName: data?.userName || "",
    userEmail: data?.userEmail || "",
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasEventAccess,
  }
}

// Hook for checking specific module access
export function useModuleAccess(module: Permission) {
  const permissions = usePermissions()
  
  return {
    ...permissions,
    hasAccess: permissions.hasPermission(module),
  }
}
