import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

/**
 * POST /api/events/[eventId]/duplicate
 * Duplicate an event with all its structure (tickets, forms) but no registrations/orders
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const supabaseClient = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = supabaseClient as any
  try {
    const { eventId } = await params
    const body = await request.json().catch(() => ({}))
    const {
      name, // Optional new name, defaults to "Event Name (Copy)"
      start_date,
      end_date,
      venue,
    } = body

    // 1. Fetch the original event
    const { data: originalEvent, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single()

    if (eventError || !originalEvent) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      )
    }

    // 2. Generate new slug
    const baseSlug = originalEvent.slug || originalEvent.short_name?.toLowerCase().replace(/\s+/g, "-")
    const timestamp = Date.now().toString(36)
    const newSlug = `${baseSlug}-${timestamp}`

    // 3. Create new event (excluding id, created_at, and resetting counts)
    const newEventData = {
      ...originalEvent,
      id: undefined, // Let Supabase generate new ID
      name: name || `${originalEvent.name} (Copy)`,
      slug: newSlug,
      short_name: originalEvent.short_name ? `${originalEvent.short_name}-${timestamp.slice(-4).toUpperCase()}` : null,
      start_date: start_date || originalEvent.start_date,
      end_date: end_date || originalEvent.end_date,
      venue_name: venue || originalEvent.venue_name,
      status: "draft", // Start as draft
      total_registrations: 0,
      total_revenue: 0,
      created_at: undefined,
      updated_at: undefined,
    }

    // Remove undefined fields
    Object.keys(newEventData).forEach(key => {
      if (newEventData[key] === undefined) {
        delete newEventData[key]
      }
    })

    const { data: newEvent, error: createError } = await supabase
      .from("events")
      .insert(newEventData)
      .select()
      .single()

    if (createError || !newEvent) {
      console.error("Failed to create event:", createError)
      return NextResponse.json(
        { error: "Failed to duplicate event" },
        { status: 500 }
      )
    }

    // 4. Duplicate ticket types
    const { data: originalTickets } = await supabase
      .from("ticket_types")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })

    let ticketsCopied = 0
    if (originalTickets && originalTickets.length > 0) {
      const newTickets = originalTickets.map((ticket: any) => ({
        event_id: newEvent.id,
        name: ticket.name,
        description: ticket.description,
        price: ticket.price,
        currency: ticket.currency,
        quantity_total: ticket.quantity_total,
        quantity_sold: 0, // Reset sold count
        min_per_order: ticket.min_per_order,
        max_per_order: ticket.max_per_order,
        sale_start_date: ticket.sale_start_date,
        sale_end_date: ticket.sale_end_date,
        status: "draft", // Start as draft
        is_hidden: ticket.is_hidden,
        requires_approval: ticket.requires_approval,
        tax_percentage: ticket.tax_percentage,
        sort_order: ticket.sort_order,
        // Note: form_id is event-specific, we'll need to duplicate forms too
      }))

      const { data: createdTickets, error: ticketsError } = await supabase
        .from("ticket_types")
        .insert(newTickets)
        .select()

      if (!ticketsError && createdTickets) {
        ticketsCopied = createdTickets.length
      }
    }

    // 5. Duplicate discount codes (if any)
    const { data: originalDiscounts } = await supabase
      .from("discount_codes")
      .select("*")
      .eq("event_id", eventId)

    let discountsCopied = 0
    if (originalDiscounts && originalDiscounts.length > 0) {
      const newDiscounts = originalDiscounts.map((discount: any) => ({
        event_id: newEvent.id,
        code: discount.code,
        description: discount.description,
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        max_discount_amount: discount.max_discount_amount,
        min_order_amount: discount.min_order_amount,
        max_uses: discount.max_uses,
        current_uses: 0, // Reset usage count
        valid_from: discount.valid_from,
        valid_until: discount.valid_until,
        is_active: discount.is_active,
        applicable_ticket_ids: null, // Would need to map to new ticket IDs
      }))

      const { data: createdDiscounts, error: discountsError } = await supabase
        .from("discount_codes")
        .insert(newDiscounts)
        .select()

      if (!discountsError && createdDiscounts) {
        discountsCopied = createdDiscounts.length
      }
    }

    // 6. Duplicate event-specific forms (if any)
    const { data: originalForms } = await supabase
      .from("forms")
      .select("*")
      .eq("event_id", eventId)

    let formsCopied = 0
    if (originalForms && originalForms.length > 0) {
      for (const form of originalForms) {
        // Create new form
        const { data: newForm, error: formError } = await supabase
          .from("forms")
          .insert({
            name: form.name,
            description: form.description,
            slug: `${form.slug}-${timestamp}`,
            form_type: form.form_type,
            event_id: newEvent.id,
            status: "draft",
            is_public: form.is_public,
            requires_auth: form.requires_auth,
            allow_multiple_submissions: form.allow_multiple_submissions,
            submit_button_text: form.submit_button_text,
            success_message: form.success_message,
            redirect_url: form.redirect_url,
            logo_url: form.logo_url,
            header_image_url: form.header_image_url,
            primary_color: form.primary_color,
            background_color: form.background_color,
            notify_on_submission: form.notify_on_submission,
            notification_emails: form.notification_emails,
            max_submissions: form.max_submissions,
            submission_deadline: form.submission_deadline,
          })
          .select()
          .single()

        if (!formError && newForm) {
          formsCopied++

          // Duplicate form fields
          const { data: originalFields } = await supabase
            .from("form_fields")
            .select("*")
            .eq("form_id", form.id)
            .order("sort_order", { ascending: true })

          if (originalFields && originalFields.length > 0) {
            const newFields = originalFields.map((field: any) => ({
              form_id: newForm.id,
              field_type: field.field_type,
              label: field.label,
              placeholder: field.placeholder,
              help_text: field.help_text,
              is_required: field.is_required,
              min_length: field.min_length,
              max_length: field.max_length,
              min_value: field.min_value,
              max_value: field.max_value,
              pattern: field.pattern,
              options: field.options,
              conditional_logic: field.conditional_logic,
              sort_order: field.sort_order,
              width: field.width,
              section_id: field.section_id,
              settings: field.settings,
            }))

            await supabase.from("form_fields").insert(newFields)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      event: newEvent,
      copied: {
        tickets: ticketsCopied,
        discounts: discountsCopied,
        forms: formsCopied,
      },
      message: `Event duplicated successfully! ${ticketsCopied} tickets, ${discountsCopied} discount codes, and ${formsCopied} forms copied.`,
    })
  } catch (error: any) {
    console.error("Event duplication error:", error)
    return NextResponse.json(
      { error: "Failed to duplicate event" },
      { status: 500 }
    )
  }
}
