import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET /api/badge-templates - Get all templates for an event
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { data, error } = await (supabase as any)
      .from("badge_templates")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error("Error fetching badge templates:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/badge-templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_id, name, description, size, template_image_url, template_data, ticket_type_ids, is_default } = body

    if (!event_id || !name) {
      return NextResponse.json({ error: "event_id and name are required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // If this is set as default, unset other defaults
    if (is_default) {
      await (supabase as any)
        .from("badge_templates")
        .update({ is_default: false })
        .eq("event_id", event_id)
    }

    const { data, error } = await (supabase as any)
      .from("badge_templates")
      .insert({
        event_id,
        name,
        description: description || null,
        size: size || "4x3",
        template_image_url: template_image_url || null,
        template_data: template_data || {},
        ticket_type_ids: ticket_type_ids || null,
        is_default: is_default || false,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error creating badge template:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/badge-templates - Update a template
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, description, size, template_image_url, template_data, ticket_type_ids, is_default, event_id, force_unlock } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Check if template is locked
    const { data: existing } = await (supabase as any)
      .from("badge_templates")
      .select("is_locked, locked_at, badges_generated_count")
      .eq("id", id)
      .single()

    if (existing?.is_locked && !force_unlock) {
      // Only allow updating name, description, is_default on locked templates
      const hasDesignChanges = size !== undefined || template_image_url !== undefined || template_data !== undefined
      if (hasDesignChanges) {
        return NextResponse.json({
          error: "Template is locked",
          message: `This template has been locked since ${new Date(existing.locked_at).toLocaleDateString()}. ${existing.badges_generated_count} badges have been generated. Design changes are not allowed.`,
          is_locked: true,
          badges_generated: existing.badges_generated_count,
        }, { status: 403 })
      }
    }

    // If this is set as default, unset other defaults
    if (is_default && event_id) {
      await (supabase as any)
        .from("badge_templates")
        .update({ is_default: false })
        .eq("event_id", event_id)
        .neq("id", id)
    }

    const updateData: any = { updated_at: new Date().toISOString() }
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (size !== undefined) updateData.size = size
    if (template_image_url !== undefined) updateData.template_image_url = template_image_url
    if (template_data !== undefined) updateData.template_data = template_data
    if (ticket_type_ids !== undefined) updateData.ticket_type_ids = ticket_type_ids
    if (is_default !== undefined) updateData.is_default = is_default

    // Handle force unlock (admin override)
    if (force_unlock && existing?.is_locked) {
      updateData.is_locked = false
      updateData.locked_at = null
      updateData.locked_by = null
    }

    const { data, error } = await (supabase as any)
      .from("badge_templates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error updating badge template:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/badge-templates - Delete a template
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const force = searchParams.get("force") === "true"

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Check if template is locked
    const { data: existing } = await (supabase as any)
      .from("badge_templates")
      .select("is_locked, locked_at, badges_generated_count")
      .eq("id", id)
      .single()

    if (existing?.is_locked && !force) {
      return NextResponse.json({
        error: "Template is locked",
        message: `This template has been locked since ${new Date(existing.locked_at).toLocaleDateString()}. ${existing.badges_generated_count} badges have been generated. Cannot delete.`,
        is_locked: true,
        badges_generated: existing.badges_generated_count,
      }, { status: 403 })
    }

    const { error } = await (supabase as any)
      .from("badge_templates")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting badge template:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
