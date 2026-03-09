import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { mapTeamRoleToPlatformRole } from "@/lib/auth/role-mapping"

// POST /api/auth/login-complete
// Validates user, tracks login, returns redirect URL
export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json()

    if (!accessToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Verify the token and get the user
    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(accessToken)

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const now = new Date().toISOString()

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

    if (currentUser) {
      // Existing user - update login activity
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
      await adminClient.from("users").update(updateData).eq("id", user.id)
    } else if (teamResult.data) {
      // New user but is an active team member - auto-create profile
      const platformRole = mapTeamRoleToPlatformRole(teamResult.data.role)
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
      return NextResponse.json({ error: "unauthorized" }, { status: 403 })
    }

    // Auto-link unlinked team_members records
    if (user.email) {
      await adminClient
        .from("team_members")
        .update({ user_id: user.id })
        .eq("email", user.email.toLowerCase())
        .is("user_id", null)
    }

    // Log login event
    await adminClient.from("activity_logs").insert({
      user_id: user.id,
      user_email: user.email || "",
      user_name:
        user.user_metadata?.name || user.email?.split("@")[0] || "",
      action: "login",
      entity_type: "user",
      entity_id: user.id,
      entity_name: user.email || "",
      description: "User logged in via magic link",
      metadata: {
        login_count: (currentUser?.login_count || 0) + 1,
        method: "magic_link",
      },
    })

    // Determine redirect based on role
    const { data: profile } = await adminClient
      .from("users")
      .select("platform_role")
      .eq("id", user.id)
      .maybeSingle()

    let redirectTo = "/"

    if (
      profile?.platform_role === "super_admin" ||
      profile?.platform_role === "admin"
    ) {
      redirectTo = "/"
    } else if (
      profile?.platform_role === "event_admin" ||
      profile?.platform_role === "staff"
    ) {
      const { data: eventAccess } = await adminClient
        .from("event_faculty")
        .select("event_id")
        .eq("faculty_id", user.id)
        .limit(1)
        .maybeSingle()

      if (eventAccess?.event_id) {
        redirectTo = `/events/${eventAccess.event_id}`
      }
    } else if (profile?.platform_role === "faculty") {
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
