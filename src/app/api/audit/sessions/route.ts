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

    // 1. Fetch all users with login activity data
    let usersQuery = adminClient
      .from("users")
      .select("id, email, name, platform_role, is_active, last_login_at, last_active_at, logged_out_at, login_count, created_at")
      .order("last_login_at", { ascending: false, nullsFirst: false })

    if (userEmail) {
      usersQuery = usersQuery.ilike("email", `%${userEmail}%`)
    }

    const { data: users, error: usersError } = await usersQuery
    if (usersError) throw usersError

    // 2. Fetch team members for cross-reference
    const { data: teamMembers } = await adminClient
      .from("team_members")
      .select("email, name, role, is_active")

    const teamMap = new Map<string, { name: string; role: string; is_active: boolean }>()
    for (const tm of teamMembers || []) {
      if (tm.email) teamMap.set(tm.email.toLowerCase(), tm)
    }

    // 3. Fetch login/logout activity logs for timeline
    let logsQuery = adminClient
      .from("activity_logs")
      .select("*", { count: "exact" })
      .in("action", ["login", "logout"])
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (startDate) logsQuery = logsQuery.gte("created_at", startDate)
    if (endDate) logsQuery = logsQuery.lte("created_at", endDate)
    if (userEmail) logsQuery = logsQuery.ilike("user_email", `%${userEmail}%`)

    const { data: activityLogs, count: logsCount } = await logsQuery

    // 4. Fetch auth users for sign-in data
    const { data: authData } = await adminClient.auth.admin.listUsers()
    const authMap = new Map<string, { last_sign_in_at: string | null; created_at: string }>()
    for (const authUser of authData?.users || []) {
      if (authUser.email) {
        authMap.set(authUser.email.toLowerCase(), {
          last_sign_in_at: authUser.last_sign_in_at ?? null,
          created_at: authUser.created_at,
        })
      }
    }

    // 5. Build enriched user data
    const enrichedUsers = (users || []).map((u: any) => {
      const email = (u.email || "").toLowerCase()
      const team = teamMap.get(email)
      const auth = authMap.get(email)

      // Calculate session duration (last_login_at to logged_out_at or last_active_at)
      let sessionDurationMs: number | null = null
      if (u.last_login_at) {
        const loginTime = new Date(u.last_login_at).getTime()
        if (u.logged_out_at) {
          const logoutTime = new Date(u.logged_out_at).getTime()
          if (logoutTime > loginTime) {
            sessionDurationMs = logoutTime - loginTime
          }
        } else if (u.last_active_at) {
          const activeTime = new Date(u.last_active_at).getTime()
          if (activeTime > loginTime) {
            sessionDurationMs = activeTime - loginTime
          }
        }
      }

      // Determine status
      let status = "offline"
      if (!u.last_login_at) {
        status = "never"
      } else if (u.last_active_at) {
        const diff = Date.now() - new Date(u.last_active_at).getTime()
        if (diff < 15 * 60 * 1000) status = "online"
        else if (diff < 60 * 60 * 1000) status = "away"
        else if (u.logged_out_at) status = "logged_out"
        else status = "offline"
      } else if (u.logged_out_at) {
        status = "logged_out"
      }

      return {
        id: u.id,
        email: u.email,
        name: u.name || team?.name || u.email?.split("@")[0],
        platform_role: u.platform_role,
        team_role: team?.role || null,
        is_active: u.is_active,
        is_team_member: !!team,
        status,
        last_login_at: u.last_login_at,
        last_active_at: u.last_active_at,
        logged_out_at: u.logged_out_at,
        login_count: u.login_count || 0,
        last_sign_in_at: auth?.last_sign_in_at || null,
        session_duration_ms: sessionDurationMs,
        created_at: u.created_at,
      }
    })

    // 6. Calculate summary stats
    const now = Date.now()
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
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: recentLogins } = await adminClient
      .from("activity_logs")
      .select("created_at")
      .eq("action", "login")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: true })

    // Aggregate logins per day
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
    const loginsPerDay = Object.entries(loginsByDay).map(([date, count]) => ({ date, count }))

    // 8. Top users by login count
    const topUsers = [...enrichedUsers]
      .sort((a: any, b: any) => b.login_count - a.login_count)
      .slice(0, 10)
      .map((u: any) => ({ name: u.name, email: u.email, login_count: u.login_count, status: u.status }))

    return NextResponse.json({
      users: enrichedUsers,
      activity_logs: activityLogs || [],
      activity_logs_total: logsCount || 0,
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
    console.error("[Audit] Error:", error)
    return NextResponse.json({ error: "Failed to fetch audit data" }, { status: 500 })
  }
}
