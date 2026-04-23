import { createAdminClient } from "@/lib/supabase/server"

export type AmasiMember = {
  id: string
  amasi_number: number
  email: string
  name: string
  membership_type: string
}

export type VerifyResult =
  | { ok: true; member: AmasiMember }
  | { ok: false; reason: "no-identifier" | "not-a-member" | "db-error"; detail?: string }

// Verifies an applicant is an ACTIVE AMASI member via the shared Supabase view
// `public.active_amasi_members` (populated by the amasi-membership project).
// Accepts any one of: email, amasi number, or phone. Returns the minimal member
// projection — use it to gate course/event flows and attach member.id to the row.
export async function verifyAmasiMembership(
  identifier: { email?: string; amasiNumber?: number; phone?: number }
): Promise<VerifyResult> {
  const supabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  let query = db
    .from("active_amasi_members")
    .select("id, amasi_number, email, name, membership_type")

  if (identifier.email) {
    query = query.ilike("email", identifier.email.trim())
  } else if (typeof identifier.amasiNumber === "number") {
    query = query.eq("amasi_number", identifier.amasiNumber)
  } else if (typeof identifier.phone === "number") {
    query = query.eq("phone", identifier.phone)
  } else {
    return { ok: false, reason: "no-identifier" }
  }

  const { data, error } = await query.maybeSingle()
  if (error) return { ok: false, reason: "db-error", detail: error.message }
  if (!data) return { ok: false, reason: "not-a-member" }
  return { ok: true, member: data as AmasiMember }
}
