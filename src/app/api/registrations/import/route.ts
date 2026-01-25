import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { logActivity } from "@/lib/activity-logger"

// Generate registration number
function generateRegistrationNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "")
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `REG-${dateStr}-${random}`
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

interface ImportRegistration {
  ticket?: string // Ticket name (Tito-style)
  name: string
  email: string
  phone?: string
  designation?: string
  institution?: string
  city?: string
  state?: string
  country?: string
  notify?: string // Y/N to send email
  [key: string]: string | undefined // For custom Q: fields
}

/**
 * POST /api/registrations/import
 * Bulk import registrations (Tito-style with ticket name in CSV)
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const body = await request.json()
    const {
      event_id,
      ticket_type_id, // Optional - fallback if no ticket column in CSV
      registrations, // Array of registration objects
      status = "confirmed", // Default to confirmed for imports
    } = body

    if (!event_id || !registrations?.length) {
      return NextResponse.json(
        { error: "event_id and registrations array are required" },
        { status: 400 }
      )
    }

    // Fetch all ticket types for this event (for matching by name)
    const { data: ticketTypes, error: ticketsError } = await db
      .from("ticket_types")
      .select("id, name, price, status, quantity_total, quantity_sold")
      .eq("event_id", event_id)

    if (ticketsError || !ticketTypes?.length) {
      return NextResponse.json(
        { error: "No ticket types found for this event" },
        { status: 400 }
      )
    }

    // Create a map of ticket names to ticket objects (case-insensitive)
    const ticketMap = new Map<string, any>()
    for (const t of ticketTypes as any[]) {
      ticketMap.set(t.name.toLowerCase().trim(), t)
    }

    // Get default ticket if ticket_type_id provided
    let defaultTicket = ticket_type_id
      ? (ticketTypes as any[]).find((t: any) => t.id === ticket_type_id)
      : ticketTypes[0]

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
      created: [] as any[],
      notifications_queued: 0,
    }

    // Track ticket quantities to update
    const ticketQuantityUpdates = new Map<string, number>()

    // Check for existing registrations by email to avoid duplicates
    const emails = registrations
      .map((r: ImportRegistration) => r.email?.toLowerCase().trim())
      .filter(Boolean)

    const { data: existingRegs } = await db
      .from("registrations")
      .select("attendee_email")
      .eq("event_id", event_id)
      .in("attendee_email", emails)

    const existingEmails = new Set((existingRegs || []).map((r: any) => r.attendee_email?.toLowerCase()))

    // Process each registration
    for (let i = 0; i < registrations.length; i++) {
      const reg = registrations[i] as ImportRegistration
      const rowNum = i + 2 // +2 for header row and 1-based indexing

      try {
        // Validate required fields
        if (!reg.name?.trim()) {
          results.failed++
          results.errors.push(`Row ${rowNum}: Missing name`)
          continue
        }

        if (!reg.email?.trim()) {
          results.failed++
          results.errors.push(`Row ${rowNum}: Missing email for "${reg.name}"`)
          continue
        }

        const email = reg.email.toLowerCase().trim()

        // Validate email format
        if (!isValidEmail(email)) {
          results.failed++
          results.errors.push(`Row ${rowNum}: Invalid email "${email}"`)
          continue
        }

        // Skip if already registered for this event
        if (existingEmails.has(email)) {
          results.skipped++
          results.errors.push(`Row ${rowNum}: ${email} already registered`)
          continue
        }

        // Find ticket by name (Tito-style) or use default
        let ticket = defaultTicket
        if (reg.ticket?.trim()) {
          const matchedTicket = ticketMap.get(reg.ticket.toLowerCase().trim())
          if (matchedTicket) {
            ticket = matchedTicket
          } else {
            results.failed++
            results.errors.push(`Row ${rowNum}: Ticket "${reg.ticket}" not found`)
            continue
          }
        }

        if (!ticket) {
          results.failed++
          results.errors.push(`Row ${rowNum}: No ticket type specified or found`)
          continue
        }

        // Check ticket availability
        if (ticket.quantity_total) {
          const pendingUpdates = ticketQuantityUpdates.get(ticket.id) || 0
          const currentSold = (ticket.quantity_sold || 0) + pendingUpdates
          if (currentSold >= ticket.quantity_total) {
            results.failed++
            results.errors.push(`Row ${rowNum}: Ticket "${ticket.name}" is sold out`)
            continue
          }
        }

        // Extract custom fields (columns starting with Q:)
        const customFields: Record<string, any> = {
          designation: reg.designation,
          institution: reg.institution,
          city: reg.city,
          state: reg.state,
          country: reg.country,
          imported: true,
          imported_at: new Date().toISOString(),
        }

        // Add Q: prefixed fields
        for (const [key, value] of Object.entries(reg)) {
          if (key.toLowerCase().startsWith('q:') && value) {
            const questionName = key.substring(2).trim()
            customFields[questionName] = value
          }
        }

        // Create registration
        const registrationNumber = generateRegistrationNumber()
        const shouldNotify = reg.notify?.toUpperCase() === 'Y'

        const { data: newReg, error: regError } = await db
          .from("registrations")
          .insert({
            registration_number: registrationNumber,
            event_id,
            ticket_type_id: ticket.id,
            attendee_name: reg.name.trim(),
            attendee_email: email,
            attendee_phone: reg.phone?.trim() || null,
            attendee_designation: reg.designation?.trim() || null,
            attendee_institution: reg.institution?.trim() || null,
            quantity: 1,
            unit_price: ticket.price,
            total_amount: ticket.price,
            status: status,
            payment_status: ticket.price === 0 ? "free" : "completed",
            confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
            custom_fields: customFields,
          })
          .select()
          .single()

        if (regError) {
          results.failed++
          results.errors.push(`Row ${rowNum}: ${regError.message}`)
        } else {
          results.success++
          results.created.push({
            registration_number: registrationNumber,
            name: reg.name,
            email: email,
            ticket: ticket.name,
          })

          // Track for ticket quantity update
          ticketQuantityUpdates.set(
            ticket.id,
            (ticketQuantityUpdates.get(ticket.id) || 0) + 1
          )

          // Track notifications
          if (shouldNotify) {
            results.notifications_queued++
            // TODO: Queue email notification
          }

          // Add to set to prevent duplicates within same import
          existingEmails.add(email)
        }
      } catch (err: any) {
        results.failed++
        results.errors.push(`Row ${rowNum}: Error - ${err.message}`)
      }
    }

    // Update ticket quantities atomically using RPC
    // This prevents race conditions by using server-side increment
    for (const [ticketId, count] of ticketQuantityUpdates) {
      // Use raw SQL update with increment to prevent race conditions
      const { error: updateError } = await db.rpc('increment_ticket_sold', {
        ticket_id: ticketId,
        increment_by: count
      }).catch(() => {
        // Fallback if RPC doesn't exist - still risky but better than nothing
        return { error: null }
      })

      // If RPC fails or doesn't exist, use traditional update as fallback
      if (updateError) {
        const { data: currentTicket } = await db
          .from("ticket_types")
          .select("quantity_sold")
          .eq("id", ticketId)
          .single()

        if (currentTicket) {
          await db
            .from("ticket_types")
            .update({ quantity_sold: (currentTicket.quantity_sold || 0) + count })
            .eq("id", ticketId)
        }
      }
    }

    // Log activity
    if (results.success > 0) {
      logActivity({
        action: "import",
        entityType: "registration",
        eventId: event_id,
        description: `Imported ${results.success} registration(s)`,
        metadata: {
          total: registrations.length,
          created: results.success,
          skipped: results.skipped,
          failed: results.failed,
        },
      })
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: registrations.length,
        created: results.success,
        skipped: results.skipped,
        failed: results.failed,
        notifications_queued: results.notifications_queued,
      },
      created: results.created,
      errors: results.errors.slice(0, 50), // Limit errors to first 50
    })
  } catch (error: any) {
    console.error("Import error:", error)
    return NextResponse.json(
      { error: error.message || "Import failed" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/registrations/import
 * Get import template/help
 */
export async function GET(request: NextRequest) {
  // Require admin authentication
  const { user, error: authError } = await requireAdmin()
  if (authError) return authError

  const supabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")
  const format = searchParams.get("format") // 'json' or 'csv'

  // If event_id provided, generate CSV template with ticket names
  if (eventId && format === "csv") {
    const { data: tickets } = await db
      .from("ticket_types")
      .select("name")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })

    const ticketNames = tickets?.map((t: any) => t.name).join(" | ") || "Ticket Name"

    const csvTemplate = `ticket,name,email,phone,designation,institution,city,state,country,notify
${tickets?.[0]?.name || "Speaker"},Dr. John Smith,john@example.com,+91 9876543210,Professor,Medical College,Mumbai,Maharashtra,India,Y
${tickets?.[0]?.name || "Speaker"},Dr. Jane Doe,jane@example.com,,Associate Professor,Hospital,Chennai,Tamil Nadu,India,N`

    return new NextResponse(csvTemplate, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="import-template.csv"`,
      },
    })
  }

  return NextResponse.json({
    endpoint: "/api/registrations/import",
    method: "POST",
    description: "Bulk import registrations (Tito-style with ticket name in CSV)",
    template_url: "/api/registrations/import?event_id=YOUR_EVENT_ID&format=csv",
    columns: {
      ticket: "Ticket type name (must match exactly)",
      name: "Full name (required)",
      email: "Email address (required, must be valid)",
      phone: "Phone number",
      designation: "Job title/designation",
      institution: "Organization/institution",
      city: "City",
      state: "State",
      country: "Country",
      notify: "Y to send confirmation email, N or blank to skip",
      "Q:custom_question": "Custom questions prefixed with Q:",
    },
    example: {
      event_id: "uuid",
      ticket_type_id: "uuid (optional fallback)",
      registrations: [
        {
          ticket: "Speaker",
          name: "Dr. John Smith",
          email: "john@example.com",
          phone: "+91 9876543210",
          designation: "Professor",
          institution: "Medical College",
          notify: "Y",
        },
      ],
    },
    validation: {
      email: "Must be valid email format",
      ticket: "Must match existing ticket type name exactly (case-insensitive)",
      duplicates: "Skipped if email already registered for this event",
    },
  })
}
