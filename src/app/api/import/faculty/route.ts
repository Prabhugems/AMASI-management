import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { DEFAULTS } from "@/lib/config"

interface FacultyImportRow {
  name: string
  email: string
  phone?: string
  title?: string
  designation?: string
  department?: string
  institution?: string
  specialty?: string
  city?: string
  state?: string
  country?: string
  status?: string
  is_reviewer?: string | boolean
  [key: string]: any
}

// POST /api/import/faculty - Import faculty members
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
        { error: 'Unauthorized - please login to import faculty' },
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
      errors: [] as { row: number; error: string }[]
    }

    for (let i = 0; i < rows.length; i++) {
      const row: FacultyImportRow = rows[i]
      const rowNum = i + 2 // Account for header row and 0-index

      try {
        // Validate required fields
        if (!row.name || !row.email) {
          results.failed++
          results.errors.push({ row: rowNum, error: "Name and email are required" })
          continue
        }

        // Check if faculty already exists (use maybeSingle since record may not exist)
        const { data: existing } = await (supabase as any)
          .from("faculty")
          .select("id")
          .eq("email", row.email.toLowerCase())
          .maybeSingle()

        if (existing) {
          // Update existing faculty
          const { error: updateError } = await (supabase as any)
            .from("faculty")
            .update({
              name: row.name,
              phone: row.phone || null,
              title: row.title || null,
              designation: row.designation || null,
              department: row.department || null,
              institution: row.institution || null,
              specialty: row.specialty || null,
              city: row.city || null,
              state: row.state || null,
              country: row.country || DEFAULTS.country,
              status: row.status?.toLowerCase() || "active",
              is_reviewer: row.is_reviewer === "true" || row.is_reviewer === true || row.is_reviewer === "yes",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)

          if (updateError) {
            results.failed++
            results.errors.push({ row: rowNum, error: updateError.message })
          } else {
            results.success++
          }
          continue
        }

        // Create new faculty
        const facultyData = {
          name: row.name,
          email: row.email.toLowerCase(),
          phone: row.phone || null,
          title: row.title || null,
          designation: row.designation || null,
          department: row.department || null,
          institution: row.institution || null,
          specialty: row.specialty || null,
          city: row.city || null,
          state: row.state || null,
          country: row.country || DEFAULTS.country,
          status: row.status?.toLowerCase() || "active",
          is_reviewer: row.is_reviewer === "true" || row.is_reviewer === true || row.is_reviewer === "yes",
          total_events: 0,
          total_sessions: 0,
        }

        const { error: insertError } = await (supabase as any)
          .from("faculty")
          .insert(facultyData)

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
    console.error("Error in POST /api/import/faculty:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
