/**
 * Sync speaker confirmation status across registrations and faculty_assignments.
 *
 * Three places store "confirmed/declined" independently:
 *   1. registrations.status
 *   2. registrations.custom_fields.invitation_status
 *   3. faculty_assignments.status
 *
 * This utility updates all three so admin-facing pages stay consistent.
 */

type SyncableStatus = "confirmed" | "declined" | "cancelled"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncSpeakerStatus(
  db: any,
  eventId: string,
  email: string,
  status: SyncableStatus
) {
  if (!email) return

  const emailLower = email.toLowerCase()

  // 1. Update registrations.status + custom_fields.invitation_status
  const { data: registration } = await db
    .from("registrations")
    .select("id, custom_fields")
    .eq("event_id", eventId)
    .ilike("attendee_email", emailLower)
    .maybeSingle()

  if (registration) {
    const existingFields = registration.custom_fields || {}
    await db
      .from("registrations")
      .update({
        status,
        ...(status === "confirmed" ? { confirmed_at: new Date().toISOString() } : {}),
        custom_fields: {
          ...existingFields,
          invitation_status: status,
          response_date: new Date().toISOString(),
        },
      })
      .eq("id", registration.id)
  }

  // 2. Update all faculty_assignments.status for this speaker in this event
  await db
    .from("faculty_assignments")
    .update({
      status,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("event_id", eventId)
    .ilike("faculty_email", emailLower)
}
