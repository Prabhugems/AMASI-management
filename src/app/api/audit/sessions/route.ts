import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

// GET /api/audit/sessions - Fetch login/logout session history for all users
export async function GET(request: NextRequest) {
  try {
    // Verify auth + admin role (super_admin, admin, event_admin, or is_super_admin)
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")
    const userEmail = searchParams.get("email")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    const adminClientRaw = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = adminClientRaw as any

    // 1. PRIMARY DATA SOURCE: auth.admin.listUsers() - always works
    let authUsers: any[] = []
    try {
      const result = await adminClient.auth.admin.listUsers()
      // Handle both formats: { data: { users: [...] } } and { data: [...] }
      if (Array.isArray(result?.data)) {
        authUsers = result.data
      } else if (result?.data?.users) {
        authUsers = result.data.users
      }
    } catch (e: any) {
      console.error("[Audit] Failed to list auth users:", e)
    }

    // Filter by email if needed
    if (userEmail) {
      authUsers = authUsers.filter((u: any) =>
        u.email?.toLowerCase().includes(userEmail.toLowerCase())
      )
    }

    // 2. Try to fetch from users table (may have extra columns like login_count, etc.)
    const usersMap = new Map<string, any>()
    try {
      // Use basic columns that are guaranteed to exist
      const { data: dbUsers, error: usersError } = await adminClient
        .from("users")
        .select("id, email, name, platform_role, is_active, last_login_at, last_active_at, login_count, created_at")

      if (!usersError && dbUsers) {
        for (const u of dbUsers) {
          usersMap.set(u.id, u)
        }
      } else if (usersError) {
        console.warn("[Audit] users table query failed:", usersError.message)
        // Fallback: try with just basic columns
        const { data: basicUsers } = await adminClient
          .from("users")
          .select("id, email, name, platform_role, is_active, created_at")
        if (basicUsers) {
          for (const u of basicUsers) {
            usersMap.set(u.id, u)
          }
        }
      }
    } catch (e) {
      console.warn("[Audit] Could not query users table:", e)
    }

    // 3. Fetch team members for cross-reference
    const teamMap = new Map<string, { name: string; role: string; is_active: boolean }>()
    try {
      const { data: teamMembers } = await adminClient
        .from("team_members")
        .select("email, name, role, is_active")
      for (const tm of teamMembers || []) {
        if (tm.email) teamMap.set(tm.email.toLowerCase(), tm)
      }
    } catch (e) {
      console.warn("[Audit] Could not query team_members:", e)
    }

    // 4. Fetch login/logout activity logs for timeline
    let activityLogs: any[] = []
    let logsCount = 0
    try {
      let logsQuery = adminClient
        .from("activity_logs")
        .select("*", { count: "exact" })
        .in("action", ["login", "logout"])
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)

      if (startDate) logsQuery = logsQuery.gte("created_at", startDate)
      if (endDate) logsQuery = logsQuery.lte("created_at", endDate)
      if (userEmail) logsQuery = logsQuery.ilike("user_email", `%${userEmail}%`)

      const { data, count } = await logsQuery
      activityLogs = data || []
      logsCount = count || 0
    } catch (e) {
      console.warn("[Audit] Could not query activity_logs:", e)
    }

    // 5. Build a map of last logout time per user from activity_logs
    const lastLogoutMap = new Map<string, string>()
    try {
      const { data: logoutLogs } = await adminClient
        .from("activity_logs")
        .select("user_id, created_at")
        .eq("action", "logout")
        .order("created_at", { ascending: false })
      for (const log of logoutLogs || []) {
        if (log.user_id && !lastLogoutMap.has(log.user_id)) {
          lastLogoutMap.set(log.user_id, log.created_at)
        }
      }
    } catch (e) {
      console.warn("[Audit] Could not fetch logout logs:", e)
    }

    // 6. Build enriched user data from AUTH users + DB users + team data
    const enrichedUsers = authUsers.map((authUser: any) => {
      const dbUser = usersMap.get(authUser.id)
      const email = (authUser.email || "").toLowerCase()
      const team = teamMap.get(email)

      const lastLoginAt = dbUser?.last_login_at || authUser.last_sign_in_at || null
      const lastActiveAt = dbUser?.last_active_at || null
      const loggedOutAt = lastLogoutMap.get(authUser.id) || null
      const loginCount = dbUser?.login_count || 0

      // Calculate session duration
      let sessionDurationMs: number | null = null
      if (lastLoginAt) {
        const loginTime = new Date(lastLoginAt).getTime()
        if (loggedOutAt) {
          const logoutTime = new Date(loggedOutAt).getTime()
          if (logoutTime > loginTime) {
            sessionDurationMs = logoutTime - loginTime
          }
        } else if (lastActiveAt) {
          const activeTime = new Date(lastActiveAt).getTime()
          if (activeTime > loginTime) {
            sessionDurationMs = activeTime - loginTime
          }
        }
      }

      // Determine status
      let status = "offline"
      if (!lastLoginAt && !authUser.last_sign_in_at) {
        status = "never"
      } else if (lastActiveAt) {
        const diff = Date.now() - new Date(lastActiveAt).getTime()
        if (diff < 15 * 60 * 1000) status = "online"
        else if (diff < 60 * 60 * 1000) status = "away"
        else if (loggedOutAt && new Date(loggedOutAt).getTime() > new Date(lastActiveAt).getTime()) status = "logged_out"
        else status = "offline"
      } else if (loggedOutAt) {
        status = "logged_out"
      }

      return {
        id: authUser.id,
        email: authUser.email || "",
        name: dbUser?.name || team?.name || authUser.user_metadata?.name || authUser.email?.split("@")[0] || "Unknown",
        platform_role: dbUser?.platform_role || "member",
        team_role: team?.role || null,
        is_active: dbUser?.is_active ?? true,
        is_team_member: !!team,
        status,
        last_login_at: lastLoginAt,
        last_active_at: lastActiveAt,
        logged_out_at: loggedOutAt,
        login_count: loginCount,
        last_sign_in_at: authUser.last_sign_in_at || null,
        session_duration_ms: sessionDurationMs,
        created_at: dbUser?.created_at || authUser.created_at,
      }
    })

    // Sort by last login (most recent first, nulls last)
    enrichedUsers.sort((a: any, b: any) => {
      if (!a.last_login_at && !b.last_login_at) return 0
      if (!a.last_login_at) return 1
      if (!b.last_login_at) return -1
      return new Date(b.last_login_at).getTime() - new Date(a.last_login_at).getTime()
    })

    // 6. Calculate summary stats
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const totalUsers = enrichedUsers.length
    const onlineNow = enrichedUsers.filter((u: any) => u.status === "online").length
    const activeToday = enrichedUsers.filter((u: any) =>
      u.last_login_at && new Date(u.last_login_at).getTime() > todayStart.getTime()
    ).length
    const neverLoggedIn = enrichedUsers.filter((u: any) => u.status === "never").length

    const sessionsWithDuration = enrichedUsers.filter((u: any) => u.session_duration_ms !== null)
    const avgSessionMs = sessionsWithDuration.length > 0
      ? sessionsWithDuration.reduce((sum: number, u: any) => sum + u.session_duration_ms, 0) / sessionsWithDuration.length
      : 0

    // 7. Fetch logins per day for the last 30 days (for chart)
    let loginsPerDay: { date: string; count: number }[] = []
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: recentLogins } = await adminClient
        .from("activity_logs")
        .select("created_at")
        .eq("action", "login")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true })

      const loginsByDay: Record<string, number> = {}
      for (let d = 0; d < 30; d++) {
        const day = new Date()
        day.setDate(day.getDate() - (29 - d))
        loginsByDay[day.toISOString().split("T")[0]] = 0
      }
      for (const log of recentLogins || []) {
        const day = new Date(log.created_at).toISOString().split("T")[0]
        if (loginsByDay[day] !== undefined) loginsByDay[day]++
      }
      loginsPerDay = Object.entries(loginsByDay).map(([date, count]) => ({ date, count }))
    } catch (e) {
      console.warn("[Audit] Could not fetch logins per day:", e)
    }

    // 8. Top users by login count
    const topUsers = [...enrichedUsers]
      .sort((a: any, b: any) => b.login_count - a.login_count)
      .slice(0, 10)
      .map((u: any) => ({ name: u.name, email: u.email, login_count: u.login_count, status: u.status }))

    return NextResponse.json({
      users: enrichedUsers,
      activity_logs: activityLogs,
      activity_logs_total: logsCount,
      logins_per_day: loginsPerDay,
      top_users: topUsers,
      stats: {
        total_users: totalUsers,
        online_now: onlineNow,
        active_today: activeToday,
        never_logged_in: neverLoggedIn,
        avg_session_duration_ms: Math.round(avgSessionMs),
      },
    })
  } catch (error: any) {
    console.error("[Audit] Error:", error?.message || error)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch audit data" },
      { status: 500 }
    )
  }
}
