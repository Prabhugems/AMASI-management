import { createAdminClient } from "@/lib/supabase/server"

/**
 * Generate a fallback registration number when custom format is not configured
 * or when the atomic increment fails.
 */
function generateFallbackNumber(): string {
  const date = new Date()
  const dateStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    date.getDate().toString().padStart(2, "0")
  const random = Math.random().toString(36).substring(2, 9).toUpperCase()
  return `REG-${dateStr}-${random}`
}

/**
 * Get the next registration number for an event, using an atomic
 * optimistic-lock pattern to prevent duplicate numbers under concurrent requests.
 *
 * If custom registration IDs are enabled in event_settings, this will
 * atomically increment `current_registration_number` and return the formatted
 * number. If not enabled, it falls back to a date+random format.
 *
 * @param supabaseOrNull - An existing Supabase admin client, or null to create one
 * @param eventId - The event ID to generate a registration number for
 * @param maxRetries - Maximum number of retries on optimistic lock conflict (default 5)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getNextRegistrationNumber(
  supabaseOrNull: any,
  eventId: string,
  maxRetries = 5,
): Promise<string> {
  const supabase = supabaseOrNull || await createAdminClient()

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Step 1: Read current settings
    const { data: settings } = await (supabase as any)
      .from("event_settings")
      .select("customize_registration_id, registration_prefix, registration_start_number, registration_suffix, current_registration_number")
      .eq("event_id", eventId)
      .maybeSingle()

    const useCustomFormat = settings?.customize_registration_id === true
      || settings?.customize_registration_id === "true"
      || settings?.customize_registration_id === 1

    if (!useCustomFormat) {
      return generateFallbackNumber()
    }

    const prefix = settings.registration_prefix || ""
    const suffix = settings.registration_suffix || ""
    const startNumber = settings.registration_start_number || 1
    const currentNum = settings.current_registration_number || 0
    const nextNum = currentNum + 1
    const regNumber = Math.max(startNumber, nextNum)

    // Step 2: Atomic increment with optimistic lock.
    // The .eq("current_registration_number", currentNum) clause ensures that
    // if another request incremented the counter between our read and this
    // update, the update will match zero rows and return null — triggering a retry.
    const { data: updated, error } = await (supabase as any)
      .from("event_settings")
      .update({ current_registration_number: regNumber })
      .eq("event_id", eventId)
      .eq("current_registration_number", currentNum)
      .select("current_registration_number")
      .maybeSingle()

    if (error) {
      console.error(`[REG-NUMBER] Update error on attempt ${attempt + 1}:`, error)
      continue
    }

    if (!updated) {
      // Another request incremented first — retry
      console.log(`[REG-NUMBER] Optimistic lock conflict on attempt ${attempt + 1}, retrying...`)
      continue
    }

    return `${prefix}${regNumber}${suffix}`
  }

  // All retries exhausted — fall back to a unique random number
  console.error(`[REG-NUMBER] All ${maxRetries} retry attempts exhausted for event ${eventId}, using fallback`)
  return generateFallbackNumber()
}
