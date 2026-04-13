import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/server"

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const body = await request.json()
    const { leads } = body

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: "leads array is required and must not be empty" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: existingLeads } = await db
      .from("event_leads")
      .select("email")
      .eq("event_id", eventId)

    const existingEmails = new Set(
      (existingLeads || []).map((l: { email: string }) => l.email.toLowerCase())
    )

    let imported = 0
    let skipped = 0
    const errors: string[] = []
    const toInsert: any[] = []

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i]
      if (!lead.email) {
        errors.push(`Row ${i + 1}: missing email`)
        continue
      }

      const email = lead.email.toLowerCase().trim()
      if (!EMAIL_REGEX.test(email)) {
        errors.push(`Row ${i + 1}: invalid email "${lead.email}"`)
        continue
      }

      if (existingEmails.has(email)) {
        skipped++
        continue
      }

      existingEmails.add(email)
      toInsert.push({
        event_id: eventId,
        email,
        name: lead.name || null,
        phone: lead.phone || null,
        source: lead.source || "import",
        notes: lead.notes || null,
        status: "new",
      })
    }

    if (toInsert.length > 0) {
      const { error } = await db
        .from("event_leads")
        .insert(toInsert)

      if (error) {
        console.error("Error importing leads:", error)
        return NextResponse.json({ error: "Failed to import leads" }, { status: 500 })
      }

      imported = toInsert.length
    }

    return NextResponse.json({ imported, skipped, errors })
  } catch (error: any) {
    console.error("Error in POST /api/events/[eventId]/leads/import:", error)
    return NextResponse.json({ error: error.message || "Server error" }, { status: error.status || 500 })
  }
}
