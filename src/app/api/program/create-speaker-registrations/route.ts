import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { DEFAULTS } from "@/lib/config"

// Generate speaker registration number with faculty-specific prefix
async function generateRegistrationNumber(supabase: any, eventId: string): Promise<string> {
  const { data: settings } = await supabase
    .from("event_settings")
    .select("customize_registration_id, registration_prefix, registration_start_number, registration_suffix, current_registration_number")
    .eq("event_id", eventId)
    .maybeSingle()

  if (settings?.customize_registration_id) {
    const delegatePrefix = settings.registration_prefix || ""
    const suffix = settings.registration_suffix || ""
    const startNumber = settings.registration_start_number || 1
    const currentNumber = (settings.current_registration_number || 0) + 1
    const regNumber = Math.max(startNumber, currentNumber)

    await supabase
      .from("event_settings")
      .update({ current_registration_number: regNumber })
      .eq("event_id", eventId)

    // Derive speaker prefix: replace last letter(s) before end with "F"
    // e.g., "MMAS-BA" → "MMAS-BF", "EVENT-D" → "EVENT-F"
    let speakerPrefix = delegatePrefix
    if (delegatePrefix.length >= 2) {
      speakerPrefix = delegatePrefix.slice(0, -1) + "F"
    }

    return `${speakerPrefix}${regNumber}${suffix}`
  }

  const date = new Date()
  const dateStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    date.getDate().toString().padStart(2, "0")
  const random = Math.floor(1000 + Math.random() * 9000)
  return `SPK-${dateStr}-${random}`
}

export async function POST(request: NextRequest) {
  try {
    const { event_id } = await request.json()

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get sessions with faculty info for this event
    // AI import stores faculty in speakers_text, chairpersons_text, moderators_text columns
    // Legacy format stores in description as "Name | Email | Phone"
    const { data: sessions } = await (supabase as any)
      .from("sessions")
      .select("session_name, description, speakers_text, chairpersons_text, moderators_text")
      .eq("event_id", event_id)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: "No sessions found" }, { status: 400 })
    }

    // Helper to strip title from name
    const stripTitle = (name: string) => {
      return name.replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Shri\.?)\s+/i, "").trim()
    }

    // Parse contact text format: "Name (email, phone) | Name2 (email, phone)"
    const parseContactText = (text: string): Array<{ name: string; email: string; phone: string }> => {
      if (!text) return []
      return text.split(" | ").map(part => {
        const nameMatch = part.split("(")[0].trim()
        const name = stripTitle(nameMatch)
        const detailsMatch = part.match(/\(([^)]*)\)/)
        if (detailsMatch) {
          const details = detailsMatch[1].split(",").map(s => s.trim())
          const email = details.find(d => d.includes("@"))?.toLowerCase() || ""
          const phone = details.find(d => !d.includes("@") && /[\d+]/.test(d)) || ""
          return { name, email, phone }
        }
        return { name, email: "", phone: "" }
      }).filter(p => p.name)
    }

    // Extract unique faculty from sessions, tracking online/offline session counts
    const facultyMap = new Map<string, { name: string; email: string; phone: string }>()
    // Track online vs offline session counts per faculty key
    const facultySessionCounts = new Map<string, { online: number; offline: number }>()

    const isOnlineSession = (sessionName: string | null) =>
      sessionName ? /online/i.test(sessionName) : false

    const trackSession = (key: string, sessionOnline: boolean) => {
      const counts = facultySessionCounts.get(key) || { online: 0, offline: 0 }
      if (sessionOnline) counts.online++
      else counts.offline++
      facultySessionCounts.set(key, counts)
    }

    sessions.forEach((session: any) => {
      const sessionIsOnline = isOnlineSession(session.session_name)

      // Parse from *_text columns (AI import format: "Name (email, phone) | Name2 (email, phone)")
      const textFields = [session.speakers_text, session.chairpersons_text, session.moderators_text]
      textFields.forEach((text: string | null) => {
        if (text) {
          const people = parseContactText(text)
          people.forEach(person => {
            if (person.email && person.email.includes("@")) {
              facultyMap.set(person.email, person)
              trackSession(person.email, sessionIsOnline)
            } else if (person.name) {
              // Use name as key if no email
              const key = `name:${person.name.toLowerCase()}`
              if (!facultyMap.has(key)) {
                facultyMap.set(key, person)
              }
              trackSession(key, sessionIsOnline)
            }
          })
        }
      })

      // Parse from description field
      if (session.description) {
        // Legacy pipe-separated format: "Name | Email | Phone"
        const pipeParts = session.description.split(" | ")
        if (pipeParts.length >= 2 && pipeParts[1]?.includes("@")) {
          const rawName = pipeParts[0]?.trim()
          const name = stripTitle(rawName)
          const email = pipeParts[1]?.trim()?.toLowerCase()
          const phone = pipeParts[2]?.trim() || ""

          if (email && !facultyMap.has(email)) {
            facultyMap.set(email, { name, email, phone })
          }
          if (email) trackSession(email, sessionIsOnline)
        } else {
          // CSV import format: comma-separated names like "Dr Chirag Parikh, Dr Shaishav Patel (Chairperson)"
          const names = session.description.split(",").map((s: string) => s.trim()).filter(Boolean)
          names.forEach((entry: string) => {
            // Remove role in parentheses e.g. "Dr Name (Chairperson)" -> "Dr Name"
            const nameWithoutRole = entry.replace(/\s*\([^)]*\)\s*$/, "").trim()
            if (nameWithoutRole) {
              const name = stripTitle(nameWithoutRole)
              if (name) {
                const key = `name:${name.toLowerCase()}`
                if (!facultyMap.has(key)) {
                  facultyMap.set(key, { name, email: "", phone: "" })
                }
                trackSession(key, sessionIsOnline)
              }
            }
          })
        }
      }
    })

    // For name-only entries, try to look up email from the faculty table
    const nameOnlyKeys = Array.from(facultyMap.keys()).filter(k => k.startsWith("name:"))
    if (nameOnlyKeys.length > 0) {
      const { data: knownFaculty } = await (supabase as any)
        .from("faculty")
        .select("name, email, phone")

      if (knownFaculty && knownFaculty.length > 0) {
        nameOnlyKeys.forEach(key => {
          const entry = facultyMap.get(key)!
          // Find matching faculty by name (case-insensitive)
          const match = knownFaculty.find((f: any) =>
            f.name?.toLowerCase() === entry.name.toLowerCase() ||
            stripTitle(f.name || "").toLowerCase() === entry.name.toLowerCase()
          )
          if (match?.email) {
            // Upgrade from name-based key to email-based key
            const oldCounts = facultySessionCounts.get(key)
            facultyMap.delete(key)
            facultySessionCounts.delete(key)
            if (!facultyMap.has(match.email)) {
              facultyMap.set(match.email, {
                name: entry.name,
                email: match.email,
                phone: match.phone || entry.phone,
              })
              if (oldCounts) {
                const existing = facultySessionCounts.get(match.email) || { online: 0, offline: 0 }
                facultySessionCounts.set(match.email, {
                  online: existing.online + oldCounts.online,
                  offline: existing.offline + oldCounts.offline,
                })
              }
            }
          }
        })
      }
    }

    if (facultyMap.size === 0) {
      return NextResponse.json({ error: "No faculty found in sessions" }, { status: 400 })
    }

    // Find or create Speaker ticket
    let { data: speakerTicket } = await (supabase as any)
      .from("ticket_types")
      .select("id, name")
      .eq("event_id", event_id)
      .or("name.ilike.%speaker%,name.ilike.%faculty%")
      .limit(1)
      .maybeSingle()

    if (!speakerTicket) {
      const { data: newTicket, error: ticketError } = await (supabase as any)
        .from("ticket_types")
        .insert({
          event_id: event_id,
          name: "Speaker",
          description: "Complimentary ticket for speakers and faculty",
          price: 0,
          quantity_total: 1000,
          quantity_sold: 0,
          status: "active",
          sort_order: 0,
        })
        .select()
        .single()

      if (ticketError) {
        return NextResponse.json({ error: "Failed to create Speaker ticket" }, { status: 500 })
      }
      speakerTicket = newTicket
    }

    // Create registrations for each faculty
    let created = 0
    let skipped = 0

    for (const [key, faculty] of facultyMap.entries()) {
      const email = key.startsWith("name:") ? null : key

      // Check if already registered (by email or by name)
      let existing = null
      if (email) {
        const { data } = await (supabase as any)
          .from("registrations")
          .select("id")
          .eq("event_id", event_id)
          .eq("attendee_email", email)
          .maybeSingle()
        existing = data
      } else {
        const { data } = await (supabase as any)
          .from("registrations")
          .select("id")
          .eq("event_id", event_id)
          .ilike("attendee_name", faculty.name)
          .maybeSingle()
        existing = data
      }

      if (existing) {
        skipped++
        continue
      }

      const registrationNumber = await generateRegistrationNumber(supabase, event_id)

      // Generate portal token for speaker to accept/decline
      const portalToken = crypto.randomUUID()

      // Generate placeholder email if none available
      const attendeeEmail = email || `${faculty.name.toLowerCase().replace(/\s+/g, ".")}@placeholder.speaker`

      // Determine participation_mode from session counts
      const counts = facultySessionCounts.get(key) || { online: 0, offline: 0 }
      let participationMode: "online" | "offline" | "hybrid" = "offline"
      if (counts.online > 0 && counts.offline > 0) {
        participationMode = "hybrid"
      } else if (counts.online > 0) {
        participationMode = "online"
      }

      // Generate checkin token for QR code on badges
      const checkinToken = crypto.randomUUID()

      const { error: regError } = await (supabase as any)
        .from("registrations")
        .insert({
          event_id: event_id,
          ticket_type_id: speakerTicket.id,
          registration_number: registrationNumber,
          attendee_name: faculty.name,
          attendee_email: attendeeEmail,
          attendee_phone: faculty.phone || null,
          attendee_designation: "Speaker",
          attendee_country: DEFAULTS.country,
          checkin_token: checkinToken,
          quantity: 1,
          unit_price: 0,
          tax_amount: 0,
          discount_amount: 0,
          total_amount: 0,
          status: "pending", // Speaker needs to confirm via portal
          payment_status: "completed",
          participation_mode: participationMode,
          custom_fields: {
            portal_token: portalToken,
            invitation_sent: new Date().toISOString(),
            needs_travel: false,
          },
        })

      if (!regError) {
        created++
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total_faculty: facultyMap.size,
      ticket_name: speakerTicket.name,
    })
  } catch (error: any) {
    console.error("Error creating speaker registrations:", error)
    return NextResponse.json({ error: "Failed to create speaker registrations" }, { status: 500 })
  }
}
