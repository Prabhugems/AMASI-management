import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

// GET /api/events/[eventId]/members — List event members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    const { error: authError } = await requireEventAndPermission(eventId, 'events')
    if (authError) return authError

    const supabase = await createAdminClient()

    // Fetch event members joined with users for name/email
    const { data: members, error } = await (supabase as any)
      .from("event_members")
      .select(`
        id,
        event_id,
        user_id,
        role,
        invited_by,
        invited_at,
        accepted_at,
        created_at,
        email,
        users:user_id ( id, name, email )
      `)
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching event members:", error)
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    // Flatten user data into the member record
    const result = (members || []).map((m: any) => ({
      id: m.id,
      event_id: m.event_id,
      user_id: m.user_id,
      role: m.role,
      invited_at: m.invited_at,
      accepted_at: m.accepted_at,
      created_at: m.created_at,
      name: m.users?.name || null,
      email: m.email || m.users?.email || null,
    }))

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error in GET /api/events/[eventId]/members:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/events/[eventId]/members — Invite a member
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    const { user, error: authError } = await requireEventAndPermission(eventId, 'events')
    if (authError) return authError

    const body = await request.json()
    const { email, role } = body

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 })
    }

    const validRoles = ['owner', 'admin', 'editor', 'viewer', 'checkin_staff']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    if (role === 'owner') {
      return NextResponse.json({ error: "Cannot assign owner role" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Check if member already exists for this event
    const { data: existing } = await (supabase as any)
      .from("event_members")
      .select("id")
      .eq("event_id", eventId)
      .eq("email", email.toLowerCase().trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "This email is already a member of this event" }, { status: 409 })
    }

    // Check if user exists in users table
    const { data: existingUser } = await (supabase as any)
      .from("users")
      .select("id, email")
      .ilike("email", email.trim())
      .maybeSingle()

    const insertData: any = {
      event_id: eventId,
      role,
      email: email.toLowerCase().trim(),
      invited_by: user!.id,
      invited_at: new Date().toISOString(),
    }

    if (existingUser) {
      insertData.user_id = existingUser.id
    }

    const { data: member, error } = await (supabase as any)
      .from("event_members")
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error("Error inserting event member:", error)
      return NextResponse.json({ error: "Failed to invite member" }, { status: 500 })
    }

    return NextResponse.json(member, { status: 201 })
  } catch (error: any) {
    console.error("Error in POST /api/events/[eventId]/members:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/events/[eventId]/members — Update member role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    const { error: authError } = await requireEventAndPermission(eventId, 'events')
    if (authError) return authError

    const body = await request.json()
    const { member_id, role } = body

    if (!member_id || !role) {
      return NextResponse.json({ error: "member_id and role are required" }, { status: 400 })
    }

    const validRoles = ['owner', 'admin', 'editor', 'viewer', 'checkin_staff']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Check existing member
    const { data: existing } = await (supabase as any)
      .from("event_members")
      .select("id, role")
      .eq("id", member_id)
      .eq("event_id", eventId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    if (existing.role === 'owner') {
      return NextResponse.json({ error: "Cannot change the owner's role" }, { status: 403 })
    }

    const { data, error } = await (supabase as any)
      .from("event_members")
      .update({ role })
      .eq("id", member_id)
      .eq("event_id", eventId)
      .select()
      .single()

    if (error) {
      console.error("Error updating event member:", error)
      return NextResponse.json({ error: "Failed to update member role" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error in PATCH /api/events/[eventId]/members:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/events/[eventId]/members — Remove member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    const { error: authError } = await requireEventAndPermission(eventId, 'events')
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get("member_id")

    if (!memberId) {
      return NextResponse.json({ error: "member_id query parameter is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Check existing member
    const { data: existing } = await (supabase as any)
      .from("event_members")
      .select("id, role")
      .eq("id", memberId)
      .eq("event_id", eventId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    if (existing.role === 'owner') {
      return NextResponse.json({ error: "Cannot remove the event owner" }, { status: 403 })
    }

    const { error } = await (supabase as any)
      .from("event_members")
      .delete()
      .eq("id", memberId)
      .eq("event_id", eventId)

    if (error) {
      console.error("Error removing event member:", error)
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error in DELETE /api/events/[eventId]/members:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
