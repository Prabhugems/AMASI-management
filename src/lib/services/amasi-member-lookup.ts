// Replaces the decommissioned application.amasi.org/api/member_detail_data
// endpoint — members are now imported into the local `members` table and that
// is the source of truth for membership lookups during exam sync.

export type AmasiMember = {
  amasi_number: number
  name: string | null
  email: string | null
  phone: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export async function lookupAmasiMember(
  input: { email?: string | null; phone?: string | null },
  db: Db,
): Promise<AmasiMember | null> {
  const email = input.email?.trim()
  const phoneDigits = input.phone ? String(input.phone).replace(/[^0-9]/g, "") : ""
  const last10 = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : ""

  if (email) {
    const { data } = await db
      .from("members")
      .select("amasi_number, name, email, phone")
      .eq("status", "active")
      .ilike("email", email)
      .limit(1)
    if (data?.[0]?.amasi_number) return shape(data[0])
  }

  if (last10) {
    const n = Number(last10)
    if (Number.isFinite(n)) {
      const { data } = await db
        .from("members")
        .select("amasi_number, name, email, phone")
        .eq("status", "active")
        .eq("phone", n)
        .limit(1)
      if (data?.[0]?.amasi_number) return shape(data[0])
    }
  }

  return null
}

function shape(row: { amasi_number: number | string; name: string | null; email: string | null; phone: number | string | null }): AmasiMember {
  return {
    amasi_number: Number(row.amasi_number),
    name: row.name ?? null,
    email: row.email ?? null,
    phone: row.phone != null ? String(row.phone) : null,
  }
}
