import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// Force dynamic - never cache this route
export const dynamic = "force-dynamic"

// GET /api/certificate-templates - Get all templates for an event
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { data, error } = await (supabase as any)
      .from("certificate_templates")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching certificate templates:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [], {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (error: any) {
    console.error("Error fetching certificate templates:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/certificate-templates - Create a new template
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
        .from("certificate_templates")
        .update({ is_default: false })
        .eq("event_id", event_id)
    }

    const insertData: any = {
      event_id,
      name,
      description: description || null,
      size: size || "A4-landscape",
      template_image_url: template_image_url || null,
      template_data: template_data || {},
      ticket_type_ids: ticket_type_ids || null,
      is_default: is_default || false,
    }

    // Try with is_active first, fallback without it if column doesn't exist yet
    let result = await (supabase as any)
      .from("certificate_templates")
      .insert({ ...insertData, is_active: true })
      .select()
      .single()

    if (result.error?.message?.includes("is_active")) {
      result = await (supabase as any)
        .from("certificate_templates")
        .insert(insertData)
        .select()
        .single()
    }

    const { data, error } = result

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error creating certificate template:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/certificate-templates - Update a template
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, description, size, template_image_url, template_data, ticket_type_ids, is_default, is_active, event_id } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // If this is set as default, unset other defaults
    if (is_default && event_id) {
      await (supabase as any)
        .from("certificate_templates")
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
    if (is_active !== undefined) updateData.is_active = is_active

    let result = await (supabase as any)
      .from("certificate_templates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    // If is_active column doesn't exist yet, retry without it
    if (result.error?.message?.includes("is_active") && is_active !== undefined) {
      delete updateData.is_active
      result = await (supabase as any)
        .from("certificate_templates")
        .update(updateData)
        .eq("id", id)
        .select()
        .single()
    }

    const { data, error } = result

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error updating certificate template:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/certificate-templates - Delete a template
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { error } = await (supabase as any)
      .from("certificate_templates")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting certificate template:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
