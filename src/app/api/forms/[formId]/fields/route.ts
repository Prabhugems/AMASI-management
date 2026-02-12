import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireFormAccess } from "@/lib/auth/api-auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// GET /api/forms/[formId]/fields - Get all fields for a form
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params

    const { error: authError } = await requireFormAccess(formId)
    if (authError) return authError

    const supabase: SupabaseClient = await createServerSupabaseClient()

    const { data: fields, error } = await supabase
      .from("form_fields")
      .select("*")
      .eq("form_id", formId)
      .order("sort_order", { ascending: true })

    if (error) {
      console.error("Error fetching fields:", error)
      return NextResponse.json(
        { error: "Failed to fetch fields" },
        { status: 500 }
      )
    }

    return NextResponse.json(fields)
  } catch (error) {
    console.error("Error in GET /api/forms/[formId]/fields:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/forms/[formId]/fields - Add a new field
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params

    const { error: formAuthError } = await requireFormAccess(formId)
    if (formAuthError) return formAuthError

    const supabase: SupabaseClient = await createServerSupabaseClient()
    const body = await request.json()

    // Get current max sort_order
    const { data: maxFields } = await supabase
      .from("form_fields")
      .select("sort_order")
      .eq("form_id", formId)
      .order("sort_order", { ascending: false })
      .limit(1)

    const maxSortOrder = maxFields && maxFields.length > 0 ? maxFields[0].sort_order : -1
    const nextSortOrder = maxSortOrder + 1

    const fieldData = {
      form_id: formId,
      field_type: body.field_type,
      label: body.label,
      placeholder: body.placeholder,
      help_text: body.help_text,
      is_required: body.is_required ?? false,
      min_length: body.min_length,
      max_length: body.max_length,
      min_value: body.min_value,
      max_value: body.max_value,
      pattern: body.pattern,
      options: body.options,
      conditional_logic: body.conditional_logic,
      sort_order: body.sort_order ?? nextSortOrder,
      width: body.width || "full",
      section_id: body.section_id,
      settings: body.settings,
    }

    const { data: field, error } = await supabase
      .from("form_fields")
      .insert(fieldData)
      .select()
      .single()

    if (error) {
      console.error("Error creating field:", error)
      return NextResponse.json(
        { error: "Failed to create field" },
        { status: 500 }
      )
    }

    return NextResponse.json(field, { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/forms/[formId]/fields:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PATCH /api/forms/[formId]/fields - Update a field
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params

    const { error: formAuthError } = await requireFormAccess(formId)
    if (formAuthError) return formAuthError

    const supabase: SupabaseClient = await createServerSupabaseClient()
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { error: "Field ID is required" },
        { status: 400 }
      )
    }

    // Build update object
    const updates: Record<string, any> = {}
    const allowedFields = [
      "field_type", "label", "placeholder", "help_text",
      "is_required", "min_length", "max_length", "min_value", "max_value",
      "pattern", "options", "conditional_logic", "sort_order", "width",
      "section_id", "settings"
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    const { data: field, error } = await supabase
      .from("form_fields")
      .update(updates)
      .eq("id", body.id)
      .eq("form_id", formId)
      .select()
      .single()

    if (error) {
      console.error("Error updating field:", error)
      return NextResponse.json(
        { error: "Failed to update field" },
        { status: 500 }
      )
    }

    return NextResponse.json(field)
  } catch (error) {
    console.error("Error in PATCH /api/forms/[formId]/fields:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/forms/[formId]/fields - Delete a field
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params

    const { error: formAuthError } = await requireFormAccess(formId)
    if (formAuthError) return formAuthError

    const supabase: SupabaseClient = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const fieldId = searchParams.get("field_id")

    if (!fieldId) {
      return NextResponse.json(
        { error: "Field ID is required" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("form_fields")
      .delete()
      .eq("id", fieldId)
      .eq("form_id", formId)

    if (error) {
      console.error("Error deleting field:", error)
      return NextResponse.json(
        { error: "Failed to delete field" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/forms/[formId]/fields:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PUT /api/forms/[formId]/fields - Bulk sync fields (create, update, delete)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params

    const { error: formAuthError } = await requireFormAccess(formId)
    if (formAuthError) return formAuthError

    const _supabase: SupabaseClient = await createServerSupabaseClient()
    const body = await request.json()

    if (!Array.isArray(body.fields)) {
      return NextResponse.json(
        { error: "Fields array is required" },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS for field operations
    const adminClient: SupabaseClient = await createAdminClient()

    // Get existing fields from database
    const { data: existingFields } = await adminClient
      .from("form_fields")
      .select("id")
      .eq("form_id", formId)

    const existingIds = new Set<string>((existingFields || []).map((f: { id: string }) => f.id))
    const incomingIds = new Set<string>(body.fields.map((f: any) => f.id))

    // Determine which fields to insert, update, or delete
    const fieldsToInsert: any[] = []
    const fieldsToUpdate: any[] = []
    const idsToDelete: string[] = []

    // Process incoming fields
    body.fields.forEach((field: any, index: number) => {
      const fieldData = {
        form_id: formId,
        field_type: field.field_type,
        label: field.label,
        placeholder: field.placeholder,
        help_text: field.help_text,
        is_required: field.is_required ?? false,
        min_length: field.min_length,
        max_length: field.max_length,
        min_value: field.min_value,
        max_value: field.max_value,
        pattern: field.pattern,
        options: field.options,
        conditional_logic: field.conditional_logic,
        sort_order: index,
        width: field.width || "full",
        section_id: field.section_id,
        settings: field.settings,
      }

      if (existingIds.has(field.id)) {
        // Update existing field
        fieldsToUpdate.push({ id: field.id, ...fieldData })
      } else {
        // Insert new field
        fieldsToInsert.push({ id: field.id, ...fieldData })
      }
    })

    // Find fields to delete (exist in DB but not in incoming)
    existingIds.forEach((id) => {
      if (!incomingIds.has(id)) {
        idsToDelete.push(id)
      }
    })

    // Execute inserts
    if (fieldsToInsert.length > 0) {
      const { error: insertError } = await adminClient
        .from("form_fields")
        .insert(fieldsToInsert)

      if (insertError) {
        console.error("Error inserting fields:", insertError)
        return NextResponse.json(
          { error: "Failed to create new fields" },
          { status: 500 }
        )
      }
    }

    // Execute updates
    for (const field of fieldsToUpdate) {
      const { id, ...updates } = field
      const { error: updateError } = await adminClient
        .from("form_fields")
        .update(updates)
        .eq("id", id)
        .eq("form_id", formId)

      if (updateError) {
        console.error("Error updating field:", updateError)
      }
    }

    // Execute deletes
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await adminClient
        .from("form_fields")
        .delete()
        .in("id", idsToDelete)
        .eq("form_id", formId)

      if (deleteError) {
        console.error("Error deleting fields:", deleteError)
      }
    }

    // Fetch updated fields
    const { data: fields, error } = await adminClient
      .from("form_fields")
      .select("*")
      .eq("form_id", formId)
      .order("sort_order", { ascending: true })

    if (error) {
      console.error("Error fetching updated fields:", error)
      return NextResponse.json(
        { error: "Failed to sync fields" },
        { status: 500 }
      )
    }

    return NextResponse.json(fields)
  } catch (error) {
    console.error("Error in PUT /api/forms/[formId]/fields:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
