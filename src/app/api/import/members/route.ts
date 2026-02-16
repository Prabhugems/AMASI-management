import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { DEFAULTS } from "@/lib/config"

interface MemberImportRow {
  name?: string
  amasi_number?: string | number
  email?: string
  phone?: string | number
  membership_type?: string
  status?: string
  father_name?: string
  date_of_birth?: string
  nationality?: string
  gender?: string
  application_no?: string
  application_date?: string
  mobile_code?: string
  landline?: string
  std_code?: string
  street_address_1?: string
  street_address_2?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
  ug_college?: string
  ug_university?: string
  ug_year?: string
  pg_degree?: string
  pg_college?: string
  pg_university?: string
  pg_year?: string
  mci_council_number?: string
  mci_council_state?: string
  imr_registration_no?: string
  asi_membership_no?: string
  asi_state?: string
  other_intl_org?: string
  other_intl_org_value?: string
  voting_eligible?: string | boolean
  [key: string]: any
}

/** Clean "N/A", "-", "--", empty strings to null */
function clean(val: any): string | null {
  if (val === undefined || val === null) return null
  const s = String(val).trim()
  if (s === "" || s === "N/A" || s === "n/a" || s === "-" || s === "--") return null
  return s
}

/** Parse DD/MM/YYYY to YYYY-MM-DD */
function parseDate(val: any): string | null {
  const s = clean(val)
  if (!s) return null
  // DD/MM/YYYY
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
  return null
}

/** Parse membership status from CSV */
function parseStatus(val: any): string {
  const s = clean(val)?.toLowerCase()
  if (!s) return "active"
  if (s.includes("allotted") || s.includes("active") || s.includes("approved")) return "active"
  if (s.includes("pending")) return "pending"
  if (s.includes("expired")) return "expired"
  if (s.includes("rejected") || s.includes("inactive")) return "inactive"
  return "active"
}

// POST /api/import/members - Import members from CSV
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "bulk")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    // Authentication check
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - please login to import members" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { rows } = body

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: "rows array is required" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    const results = {
      success: 0,
      failed: 0,
      errors: [] as { row: number; error: string }[],
    }

    for (let i = 0; i < rows.length; i++) {
      const row: MemberImportRow = rows[i]
      const rowNum = i + 2

      try {
        const name = clean(row.name)
        const amasiNumber = row.amasi_number ? parseInt(String(row.amasi_number)) : null

        if (!name) {
          results.failed++
          results.errors.push({ row: rowNum, error: "Name is required" })
          continue
        }

        const isLifeMember = row.membership_type?.includes("Life Member [LM]") ||
          row.membership_type === "LM"
        const votingEligible = row.voting_eligible === "true" ||
          row.voting_eligible === true ||
          isLifeMember

        const memberData: Record<string, any> = {
          name,
          email: clean(row.email)?.toLowerCase() || null,
          phone: clean(row.phone) ? parseInt(String(row.phone).replace(/\D/g, "")) || null : null,
          membership_type: clean(row.membership_type) || null,
          status: parseStatus(row.status),
          voting_eligible: votingEligible,
          father_name: clean(row.father_name),
          date_of_birth: parseDate(row.date_of_birth),
          nationality: clean(row.nationality),
          gender: clean(row.gender),
          application_no: clean(row.application_no),
          application_date: parseDate(row.application_date),
          mobile_code: clean(row.mobile_code),
          landline: clean(row.landline),
          std_code: clean(row.std_code),
          street_address_1: clean(row.street_address_1),
          street_address_2: clean(row.street_address_2),
          city: clean(row.city),
          state: clean(row.state),
          country: clean(row.country) || DEFAULTS.country,
          postal_code: clean(row.postal_code),
          ug_college: clean(row.ug_college),
          ug_university: clean(row.ug_university),
          ug_year: clean(row.ug_year),
          pg_degree: clean(row.pg_degree),
          pg_college: clean(row.pg_college),
          pg_university: clean(row.pg_university),
          pg_year: clean(row.pg_year),
          mci_council_number: clean(row.mci_council_number),
          mci_council_state: clean(row.mci_council_state),
          imr_registration_no: clean(row.imr_registration_no),
          asi_membership_no: clean(row.asi_membership_no),
          asi_state: clean(row.asi_state),
          other_intl_org: clean(row.other_intl_org),
          other_intl_org_value: clean(row.other_intl_org_value),
          updated_at: new Date().toISOString(),
        }

        // Try to match by amasi_number first
        if (amasiNumber) {
          const { data: existing } = await (supabase as any)
            .from("members")
            .select("id")
            .eq("amasi_number", amasiNumber)
            .maybeSingle()

          if (existing) {
            // Update existing
            const { error: updateError } = await (supabase as any)
              .from("members")
              .update(memberData)
              .eq("id", existing.id)

            if (updateError) {
              results.failed++
              results.errors.push({ row: rowNum, error: updateError.message })
            } else {
              results.success++
            }
            continue
          }
        }

        // No match by amasi_number - create new
        const insertData = {
          ...memberData,
          amasi_number: amasiNumber,
        }

        const { error: insertError } = await (supabase as any)
          .from("members")
          .insert(insertData)

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
    console.error("Error in POST /api/import/members:", error)
    return NextResponse.json({ error: "Failed to import members" }, { status: 500 })
  }
}
