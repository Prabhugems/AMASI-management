import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

interface ImportRow {
  name: string
  email: string
  phone?: string
  status?: string
  registered_on?: string
  total_amount?: string | number
  ticket_name?: string
  [key: string]: any
}

/**
 * Sanitize a string value to prevent CSV formula injection.
 * When imported data is later exported to CSV/Excel, values starting with
 * =, +, -, @, \t, or \r can be interpreted as formulas.
 */
function sanitizeCsvValue(value: string): string {
  if (!value) return value
  const trimmed = value.trim()
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    // Prefix with a single quote to neutralize formula interpretation
    return "'" + trimmed
  }
  return trimmed
}

// POST /api/import/registrations - Import registrations for an event
export async function POST(request: NextRequest) {
  // Rate limit: bulk tier for import operations
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "bulk")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    // Authentication check - only authenticated users can import
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - please login to import registrations' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { event_id, ticket_type_id, rows, registration_prefix, fixed_amount } = body

    if (!event_id || !rows || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: "event_id and rows are required" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // Get event details
    const { data: event } = await (supabase as any)
      .from("events")
      .select("id, name, short_name")
      .eq("id", event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Get all ticket types for this event (for matching by name)
    const { data: allTickets } = await (supabase as any)
      .from("ticket_types")
      .select("id, name, price")
      .eq("event_id", event_id)

    // Get all member emails and phone numbers for auto-lookup (case-insensitive)
    // Fetch members matching any of the emails (use ilike for case-insensitive)
    const { data: membersData } = await (supabase as any)
      .from("members")
      .select("email, phone")

    // Create a map of email -> phone from members
    const memberPhones: Record<string, string> = {}
    if (membersData) {
      membersData.forEach((m: any) => {
        if (m.email && m.phone) {
          memberPhones[m.email.toLowerCase().trim()] = m.phone
        }
      })
    }

    const ticketsByName: Record<string, { id: string; price: number; name: string }> = {}
    const ticketsList: { id: string; price: number; name: string; nameLower: string }[] = []
    if (allTickets) {
      allTickets.forEach((t: any) => {
        const nameLower = t.name.toLowerCase().trim()
        ticketsByName[nameLower] = { id: t.id, price: t.price, name: t.name }
        ticketsList.push({ id: t.id, price: t.price, name: t.name, nameLower })
      })
    }

    // Fuzzy match function for ticket names
    const findTicketByName = (csvTicketName: string): string | null => {
      const searchName = csvTicketName.toLowerCase().trim()

      // 1. Exact match
      if (ticketsByName[searchName]) {
        return ticketsByName[searchName].id
      }

      // 2. Check if CSV name contains system ticket name or vice versa
      for (const ticket of ticketsList) {
        if (searchName.includes(ticket.nameLower) || ticket.nameLower.includes(searchName)) {
          return ticket.id
        }
      }

      // 3. Keyword pairs - check both variations (surgeon/surgery, etc.)
      const keywordPairs: [string[], string][] = [
        [["gynaecology", "gynecology", "gynae"], "gynaecology"],
        [["surgeon", "surgery", "surgical"], "surgery"],
        [["skill course only", "only skill course", "skill only"], "only skill"],
        [["pg", "postgraduate"], "pg"],
      ]

      for (const [csvKeywords, _systemKeyword] of keywordPairs) {
        // Check if CSV name contains any of the CSV keywords
        const csvHasKeyword = csvKeywords.some(k => searchName.includes(k))
        if (csvHasKeyword) {
          // Find ticket that contains the system keyword or any related keyword
          for (const ticket of ticketsList) {
            const ticketHasKeyword = csvKeywords.some(k => ticket.nameLower.includes(k))
            if (ticketHasKeyword) {
              return ticket.id
            }
          }
        }
      }

      return null
    }

    // Get default ticket if provided or first available
    let defaultTicketId = ticket_type_id
    if (!defaultTicketId && allTickets?.length > 0) {
      defaultTicketId = allTickets[0].id
    }

    // Get the last registration number to continue sequence
    const prefix = registration_prefix || event.short_name || "REG"

    // Find the highest number for this prefix pattern (e.g., 121A1005 -> 1005)
    const { data: existingRegs } = await (supabase as any)
      .from("registrations")
      .select("registration_number")
      .eq("event_id", event_id)
      .like("registration_number", `${prefix}A%`)

    let nextNumber = 1001 // Default starting number
    if (existingRegs && existingRegs.length > 0) {
      // Find the highest number in the sequence
      let maxNumber = 1000
      existingRegs.forEach((reg: any) => {
        if (reg.registration_number) {
          const match = reg.registration_number.match(new RegExp(`${prefix}A(\\d+)`))
          if (match) {
            const num = parseInt(match[1])
            if (num > maxNumber) {
              maxNumber = num
            }
          }
        }
      })
      nextNumber = maxNumber + 1
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as { row: number; error: string }[]
    }

    for (let i = 0; i < rows.length; i++) {
      const row: ImportRow = rows[i]
      const rowNum = i + 2 // Account for header row and 0-index

      try {
        // Validate required fields
        if (!row.name || !row.email) {
          results.failed++
          results.errors.push({ row: rowNum, error: "Name and email are required" })
          continue
        }

        // Check if registration already exists
        const { data: existing } = await (supabase as any)
          .from("registrations")
          .select("id")
          .eq("event_id", event_id)
          .eq("attendee_email", row.email.toLowerCase())
          .single()

        if (existing) {
          results.failed++
          results.errors.push({ row: rowNum, error: `${row.email} already registered` })
          continue
        }

        // Parse registration date if provided
        let registeredAt = new Date().toISOString()
        if (row.registered_on) {
          // Handle various date formats
          const dateStr = row.registered_on.toString()

          // Try DD/MM/YYYY format
          const dateParts = dateStr.split("/")
          if (dateParts.length === 3) {
            const [day, month, year] = dateParts
            const parsed = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
            if (!isNaN(parsed.getTime())) {
              registeredAt = parsed.toISOString()
            }
          } else {
            // Try other formats
            const parsed = new Date(dateStr)
            if (!isNaN(parsed.getTime())) {
              registeredAt = parsed.toISOString()
            }
          }
        }

        // Generate registration number: PREFIX + A + NUMBER (e.g., 121A1001)
        const regNumber = `${prefix}A${nextNumber.toString().padStart(4, '0')}`
        nextNumber++

        // Find ticket type by name if provided (fuzzy match)
        let ticketId = defaultTicketId
        if (row.ticket_name) {
          const matchedTicketId = findTicketByName(row.ticket_name)
          if (matchedTicketId) {
            ticketId = matchedTicketId
          }
        }

        // Determine amount: row.total_amount > fixed_amount > ticket price > 0
        let amount = 0

        // First try to get amount from CSV row - check multiple possible field names
        const amountValue = row.total_amount || row.amount || row.amount_paid || row.price || row.fee
        if (amountValue !== undefined && amountValue !== null && amountValue !== '') {
          // Remove currency symbols, commas, spaces and parse
          const amountStr = amountValue.toString().replace(/[₹$,\s]/g, '').replace(/,/g, '')
          const parsed = parseFloat(amountStr)
          if (!isNaN(parsed) && parsed > 0) {
            amount = parsed
          }
        }

        // If no amount from CSV, use fixed_amount if set
        if (amount === 0 && fixed_amount && fixed_amount > 0) {
          amount = fixed_amount
        }

        // If still no amount, get price from matched ticket
        if (amount === 0 && ticketId) {
          const matchedTicket = ticketsList.find(t => t.id === ticketId)
          if (matchedTicket && matchedTicket.price > 0) {
            amount = matchedTicket.price
          }
        }

        // Get phone: CSV phone > member phone > null
        // Treat "N/A", "NA", empty, null as no phone
        let phoneNumber: string | null = null
        const csvPhone = row.phone?.toString().trim()
        if (csvPhone && csvPhone.toLowerCase() !== 'n/a' && csvPhone.toLowerCase() !== 'na' && csvPhone !== '-') {
          phoneNumber = csvPhone
        }

        // If no phone from CSV, lookup from members table
        if (!phoneNumber) {
          const emailLower = row.email.toLowerCase().trim()
          if (memberPhones[emailLower]) {
            phoneNumber = memberPhones[emailLower].toString()
          }
        }

        // Create registration with only existing columns
        const registrationData: any = {
          event_id,
          ticket_type_id: ticketId,
          attendee_name: sanitizeCsvValue(row.name),
          attendee_email: row.email.toLowerCase().trim(),
          attendee_phone: phoneNumber,
          status: row.status?.toLowerCase() || "confirmed",
          registration_number: regNumber,
          payment_status: "completed",
          total_amount: amount,
          unit_price: amount,
          tax_amount: 0,
          discount_amount: 0,
          currency: "INR",
          checked_in: false,
          created_at: registeredAt,
        }

        const { error: insertError } = await (supabase as any)
          .from("registrations")
          .insert(registrationData)

        if (insertError) {
          results.failed++
          results.errors.push({ row: rowNum, error: insertError.message })
        } else {
          results.success++
        }
      } catch (err: any) {
        results.failed++
        results.errors.push({ row: rowNum, error: err.message })
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    console.error("Error in POST /api/import/registrations:", error)
    return NextResponse.json({ error: "Failed to import registrations" }, { status: 500 })
  }
}
