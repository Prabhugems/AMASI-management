import { NextRequest, NextResponse, after } from "next/server"
import { mapTeamRoleToPlatformRole } from "@/lib/auth/role-mapping"
import { getClientIp } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/server"

// POST /api/auth/login-complete
// Validates user, tracks login, returns redirect URL.
//
// Performance: only the work needed to decide the redirect is awaited. The
// non-critical writes (login-activity update, team_members linking, audit log)
// are deferred with after() so they run post-response instead of adding extra
// cross-region DB round-trips to the login critical path.
export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json()

    if (!accessToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = (await createAdminClient()) as any

    // Verify the token and get the user
    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const now = new Date().toISOString()
    // Capture request-derived values now; the request is not readable inside after().
    const clientIp = getClientIp(request)
    const userAgent = request.headers.get("user-agent") || null

    // Get current user profile and team member info
    const [userResult, teamResult] = await Promise.all([
      adminClient
        .from("users")
        .select("login_count, platform_role, name")
        .eq("id", user.id)
        .maybeSingle(),
      user.email
        ? adminClient
            .from("team_members")
            .select("name, role")
            .eq("email", user.email.toLowerCase())
            .eq("is_active", true)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const currentUser = userResult.data
    const teamMemberName = teamResult.data?.name
    // Resolve the role we need for the redirect without an extra SELECT later.
    let platformRole: string | null = currentUser?.platform_role ?? null

    if (currentUser) {
      // Existing user - update login activity (deferred: not needed for redirect)
      const updateData: Record<string, unknown> = {
        last_login_at: now,
        last_active_at: now,
        login_count: (currentUser.login_count || 0) + 1,
      }
      if (
        teamMemberName &&
        (!currentUser.name ||
          currentUser.name === "User" ||
          currentUser.name === user.email?.split("@")[0])
      ) {
        updateData.name = teamMemberName
      }
      after(async () => {
        await adminClient.from("users").update(updateData).eq("id", user.id)
      })
    } else if (teamResult.data) {
      // New user but is an active team member - auto-create profile.
      // Awaited: the profile must exist before the destination page loads to
      // avoid a duplicate-insert race with getApiUser's own profile creation.
      platformRole = mapTeamRoleToPlatformRole(teamResult.data.role)
      await adminClient.from("users").insert({
        id: user.id,
        email: user.email || "",
        name:
          teamMemberName ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User",
        platform_role: platformRole,
        is_super_admin: false,
        is_active: true,
        is_verified: true,
        login_count: 1,
        last_login_at: now,
        last_active_at: now,
        created_at: now,
        updated_at: now,
      })
    } else {
      // Unknown user - block access
      console.warn(
        `[Login Complete] Blocked login for unknown user: ${user.email}`
      )
      // Log blocked login attempt with IP/UA (deferred - response is a 403 either way)
      after(async () => {
        await adminClient.from("activity_logs").insert({
          user_email: user.email || "",
          user_name: user.email?.split("@")[0] || "",
          action: "failed_login",
          entity_type: "user",
          entity_name: user.email || "",
          description: `Blocked login completion for unknown user: ${user.email}`,
          ip_address: clientIp,
          user_agent: userAgent,
          metadata: { reason: "unknown_user" },
        })
      })
      return NextResponse.json({ error: "unauthorized" }, { status: 403 })
    }

    // Deferred side-effects: link unlinked team_members + write the login audit
    // log. Neither is needed to compute the redirect, and getApiUser/usePermissions
    // resolve team members by email regardless, so linking can happen post-response.
    const loginCount = (currentUser?.login_count || 0) + 1
    after(async () => {
      if (user.email) {
        await adminClient
          .from("team_members")
          .update({ user_id: user.id })
          .eq("email", user.email.toLowerCase())
          .is("user_id", null)
      }
      await adminClient.from("activity_logs").insert({
        user_id: user.id,
        user_email: user.email || "",
        user_name: user.user_metadata?.name || user.email?.split("@")[0] || "",
        action: "login",
        entity_type: "user",
        entity_id: user.id,
        entity_name: user.email || "",
        description: "User logged in via magic link",
        ip_address: clientIp,
        user_agent: userAgent,
        metadata: { login_count: loginCount, method: "magic_link" },
      })
    })

    // Determine redirect based on role (uses the role resolved above - no re-select)
    let redirectTo = "/"

    if (platformRole === "super_admin" || platformRole === "admin") {
      redirectTo = "/"
    } else if (platformRole === "event_admin" || platformRole === "staff") {
      const { data: eventAccess } = await adminClient
        .from("event_faculty")
        .select("event_id")
        .eq("faculty_id", user.id)
        .limit(1)
        .maybeSingle()

      if (eventAccess?.event_id) {
        redirectTo = `/events/${eventAccess.event_id}`
      }
    } else if (platformRole === "faculty") {
      const { data: facultyRecord } = await adminClient
        .from("faculty")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (facultyRecord) {
        const { data: eventAssignment } = await adminClient
          .from("event_faculty")
          .select("event_id")
          .eq("faculty_id", facultyRecord.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (eventAssignment?.event_id) {
          redirectTo = `/events/${eventAssignment.event_id}`
        }
      }
    }

    return NextResponse.json({ redirectTo })
  } catch (error) {
    console.error("[Login Complete] Error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
