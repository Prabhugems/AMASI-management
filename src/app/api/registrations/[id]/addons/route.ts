import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireEventAccess, getEventIdFromRegistration } from "@/lib/auth/api-auth"

// GET - Fetch addons for a registration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get event ID from registration and check authorization
    const eventId = await getEventIdFromRegistration(id)
    if (!eventId) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    const { error: authError } = await requireEventAccess(eventId)
    if (authError) return authError

    const supabase = await createServerSupabaseClient()

    const { data, error } = await (supabase as any)
      .from("registration_addons")
      .select(`
        *,
        addon:addons(id, name, price, is_course),
        addon_variant:addon_variants(id, name, price_adjustment)
      `)
      .eq("registration_id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Add addons to a registration (for recovery or manual addition)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: registrationId } = await params

    // Get event ID from registration and check authorization
    const eventId = await getEventIdFromRegistration(registrationId)
    if (!eventId) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    const { error: authError } = await requireEventAccess(eventId)
    if (authError) return authError

    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const { addons, recover_from_backup } = body

    // If recovering from backup, get addons from custom_fields
    let addonsToSave = addons
    if (recover_from_backup) {
      const { data: registration, error: regError } = await (supabase as any)
        .from("registrations")
        .select("custom_fields")
        .eq("id", registrationId)
        .single()

      if (regError) {
        return NextResponse.json({ error: "Registration not found" }, { status: 404 })
      }

      const backupAddons = registration?.custom_fields?.addons_backup
      if (!backupAddons || !Array.isArray(backupAddons) || backupAddons.length === 0) {
        return NextResponse.json({ error: "No addon backup found in registration" }, { status: 400 })
      }

      addonsToSave = backupAddons
    }

    if (!addonsToSave || !Array.isArray(addonsToSave) || addonsToSave.length === 0) {
      return NextResponse.json({ error: "No addons provided" }, { status: 400 })
    }

    // Verify registration exists
    const { data: registration, error: regError } = await (supabase as any)
      .from("registrations")
      .select("id, event_id")
      .eq("id", registrationId)
      .single()

    if (regError || !registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    // Prepare addon records
    const addonRecords = addonsToSave.map((addon: {
      addonId: string
      variantId?: string
      quantity: number
      unitPrice: number
      totalPrice: number
    }) => ({
      registration_id: registrationId,
      addon_id: addon.addonId,
      quantity: addon.quantity,
      price: addon.totalPrice, // Use totalPrice as the price column
    }))

    // Insert addons (upsert to handle duplicates)
    const { data, error } = await (supabase as any)
      .from("registration_addons")
      .upsert(addonRecords, {
        onConflict: "registration_id,addon_id,addon_variant_id",
        ignoreDuplicates: false,
      })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update registration custom_fields to mark addons as recovered
    if (recover_from_backup) {
      const { data: reg } = await (supabase as any)
        .from("registrations")
        .select("custom_fields")
        .eq("id", registrationId)
        .single()

      await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...(reg?.custom_fields || {}),
            addons_save_status: 'recovered',
            addons_recovered_at: new Date().toISOString(),
          }
        })
        .eq("id", registrationId)
    }

    return NextResponse.json({
      success: true,
      data,
      message: `${addonRecords.length} addon(s) saved successfully`
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Remove an addon from a registration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: registrationId } = await params

    // Get event ID from registration and check authorization
    const eventId = await getEventIdFromRegistration(registrationId)
    if (!eventId) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    const { error: authError } = await requireEventAccess(eventId)
    if (authError) return authError

    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const addonId = searchParams.get("addon_id")
    const variantId = searchParams.get("variant_id")

    if (!addonId) {
      return NextResponse.json({ error: "addon_id is required" }, { status: 400 })
    }

    let query = (supabase as any)
      .from("registration_addons")
      .delete()
      .eq("registration_id", registrationId)
      .eq("addon_id", addonId)

    if (variantId) {
      query = query.eq("addon_variant_id", variantId)
    }

    const { error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Addon removed" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
