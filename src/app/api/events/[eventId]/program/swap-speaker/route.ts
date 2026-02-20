import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { logActivity } from "@/lib/activity-logger"
import crypto from "crypto"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const body = await request.json()

    const {
      assignment_id,
      new_faculty_name,
      new_faculty_email,
      new_faculty_phone,
      send_invitation,
      reason,
    } = body

    if (!assignment_id || !new_faculty_name?.trim()) {
      return NextResponse.json(
        { error: "assignment_id and new_faculty_name are required" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()
    const db = supabase as any

    // Fetch current assignment
    const { data: oldAssignment, error: fetchError } = await db
      .from("faculty_assignments")
      .select("*")
      .eq("id", assignment_id)
      .eq("event_id", eventId)
      .single()

    if (fetchError || !oldAssignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      )
    }

    // Check UNIQUE constraint (session_id + email + role) if email is provided
    const trimmedEmail = new_faculty_email?.trim()?.toLowerCase() || null
    if (trimmedEmail && oldAssignment.session_id) {
      const { data: existing } = await db
        .from("faculty_assignments")
        .select("id")
        .eq("session_id", oldAssignment.session_id)
        .eq("faculty_email", trimmedEmail)
        .eq("role", oldAssignment.role)
        .neq("id", assignment_id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: "A speaker with this email already exists in this session with the same role" },
          { status: 409 }
        )
      }
    }

    // Generate new invitation token
    const invitationToken = crypto.randomUUID().replace(/-/g, "")

    // Update assignment in-place (only columns that exist in the actual table)
    const { data: updatedAssignment, error: updateError } = await db
      .from("faculty_assignments")
      .update({
        faculty_name: new_faculty_name.trim(),
        faculty_email: trimmedEmail,
        faculty_phone: new_faculty_phone?.trim() || null,
        status: "pending",
        invitation_token: invitationToken,
        invitation_sent_at: null,
        responded_at: null,
        response_notes: null,
      })
      .eq("id", assignment_id)
      .select("*")
      .single()

    if (updateError) {
      console.error("Error updating assignment:", updateError)
      return NextResponse.json(
        { error: "Failed to update assignment" },
        { status: 500 }
      )
    }

    // Sync speakers/speakers_text on the sessions table
    if (oldAssignment.session_id) {
      try {
        // Fetch all current assignments for this session to rebuild speaker fields
        const { data: sessionAssignments } = await db
          .from("faculty_assignments")
          .select("faculty_name, faculty_email, faculty_phone, role")
          .eq("session_id", oldAssignment.session_id)

        if (sessionAssignments) {
          const speakers = sessionAssignments
            .filter((a: any) => a.role === "speaker")
          const chairpersons = sessionAssignments
            .filter((a: any) => a.role === "chairperson")
          const moderators = sessionAssignments
            .filter((a: any) => a.role === "moderator")

          const formatText = (list: any[]) =>
            list.map((a: any) => {
              const parts = [a.faculty_name]
              const details = [a.faculty_email, a.faculty_phone].filter(Boolean)
              if (details.length) parts.push(`(${details.join(", ")})`)
              return parts.join(" ")
            }).join(", ") || null

          await db
            .from("sessions")
            .update({
              speakers: speakers.map((a: any) => a.faculty_name).join(", ") || null,
              speakers_text: formatText(speakers),
              chairpersons: chairpersons.map((a: any) => a.faculty_name).join(", ") || null,
              chairpersons_text: formatText(chairpersons),
              moderators: moderators.map((a: any) => a.faculty_name).join(", ") || null,
              moderators_text: formatText(moderators),
            })
            .eq("id", oldAssignment.session_id)
        }
      } catch (syncError) {
        console.error("Error syncing session speakers:", syncError)
        // Non-critical — don't fail the swap
      }
    }

    // Auto-create registration for new speaker (complimentary offline ticket)
    let registrationId = null
    if (trimmedEmail) {
      try {
        // Check if new speaker already has a registration for this event
        const { data: existingReg } = await db
          .from("registrations")
          .select("id")
          .eq("event_id", eventId)
          .eq("attendee_email", trimmedEmail)
          .maybeSingle()

        if (existingReg) {
          registrationId = existingReg.id
        } else {
          // Find or create Speaker ticket type
          let speakerTicket = null
          const { data: existingTicket } = await db
            .from("ticket_types")
            .select("id, name")
            .eq("event_id", eventId)
            .or("name.ilike.%speaker%,name.ilike.%faculty%")
            .limit(1)
            .maybeSingle()

          if (existingTicket) {
            speakerTicket = existingTicket
          } else {
            const { data: newTicket } = await db
              .from("ticket_types")
              .insert({
                event_id: eventId,
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
            speakerTicket = newTicket
          }

          if (speakerTicket) {
            // Generate registration number
            const { data: settings } = await db
              .from("event_settings")
              .select("customize_registration_id, registration_prefix, registration_start_number, registration_suffix, current_registration_number")
              .eq("event_id", eventId)
              .maybeSingle()

            let regNumber: string
            if (settings?.customize_registration_id) {
              const prefix = settings.registration_prefix || ""
              const suffix = settings.registration_suffix || ""
              const startNumber = settings.registration_start_number || 1
              const currentNumber = (settings.current_registration_number || 0) + 1
              const num = Math.max(startNumber, currentNumber)
              await db.from("event_settings").update({ current_registration_number: num }).eq("event_id", eventId)
              regNumber = `${prefix}${num}${suffix}`
            } else {
              const d = new Date()
              const ds = d.getFullYear().toString() + (d.getMonth() + 1).toString().padStart(2, "0") + d.getDate().toString().padStart(2, "0")
              regNumber = `SPK-${ds}-${Math.floor(1000 + Math.random() * 9000)}`
            }

            const { data: newReg } = await db
              .from("registrations")
              .insert({
                event_id: eventId,
                ticket_type_id: speakerTicket.id,
                registration_number: regNumber,
                attendee_name: new_faculty_name.trim(),
                attendee_email: trimmedEmail,
                attendee_phone: new_faculty_phone?.trim() || null,
                attendee_designation: "Speaker",
                attendee_country: "India",
                quantity: 1,
                unit_price: 0,
                tax_amount: 0,
                discount_amount: 0,
                total_amount: 0,
                status: "confirmed",
                payment_status: "completed",
                participation_mode: "offline",
                custom_fields: {
                  portal_token: crypto.randomUUID(),
                  source: "speaker_swap",
                  swap_date: new Date().toISOString(),
                },
              })
              .select("id")
              .single()

            if (newReg) {
              registrationId = newReg.id
            }
          }
        }

        // Link registration to assignment
        if (registrationId) {
          await db
            .from("faculty_assignments")
            .update({ registration_id: registrationId })
            .eq("id", assignment_id)
        }
      } catch (regError) {
        console.error("Error creating registration for new speaker:", regError)
        // Non-critical — don't fail the swap
      }
    }

    // Log to program_change_log
    const oldValues = {
      faculty_name: oldAssignment.faculty_name,
      faculty_email: oldAssignment.faculty_email,
      faculty_phone: oldAssignment.faculty_phone,
      status: oldAssignment.status,
    }
    const newValues = {
      faculty_name: new_faculty_name.trim(),
      faculty_email: trimmedEmail,
      faculty_phone: new_faculty_phone?.trim() || null,
      status: "pending",
    }

    const summary = `Replaced ${oldAssignment.faculty_name} with ${new_faculty_name.trim()} in session "${oldAssignment.session_name || "Unknown"}"`

    await db.from("program_change_log").insert({
      event_id: eventId,
      change_type: "speaker_swap",
      session_id: oldAssignment.session_id,
      session_name: oldAssignment.session_name,
      assignment_id,
      old_values: oldValues,
      new_values: newValues,
      summary,
      changed_by_email: user?.email || null,
      changed_by_name: user?.name || user?.email || null,
      notification_sent: !!send_invitation,
      notification_type: send_invitation ? "email" : null,
      reason: reason?.trim() || null,
    })

    // Log to activity_logs
    await logActivity({
      action: "update",
      entityType: "session",
      entityId: assignment_id,
      entityName: summary,
      eventId,
      description: summary,
      metadata: { old_values: oldValues, new_values: newValues, reason },
      userEmail: user?.email || undefined,
    })

    // Send invitation email if requested
    let invitationStatus = null
    if (send_invitation && trimmedEmail) {
      try {
        // Fetch event details for the invitation email
        const { data: eventData } = await db
          .from("events")
          .select("name, start_date, end_date, venue")
          .eq("id", eventId)
          .single()

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || ""
        const inviteRes = await fetch(`${baseUrl}/api/email/faculty-invitation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignment_id,
            event_id: eventId,
            event_name: eventData?.name || "Event",
            event_start_date: eventData?.start_date || "",
            event_end_date: eventData?.end_date || "",
            event_venue: eventData?.venue || "",
          }),
        })

        invitationStatus = inviteRes.ok ? "sent" : "failed"
      } catch (emailError) {
        console.error("Error sending invitation email:", emailError)
        invitationStatus = "failed"
      }
    }

    return NextResponse.json({
      success: true,
      assignment: updatedAssignment,
      invitation_status: invitationStatus,
      registration_id: registrationId,
      registration_created: !!registrationId,
      summary,
    })
  } catch (error: any) {
    console.error("Error in swap-speaker:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
