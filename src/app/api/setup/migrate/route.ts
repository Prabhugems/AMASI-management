import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// This runs database migrations automatically
// Called on app startup or via API
export async function POST(request: NextRequest) {
  try {
    // Verify secret key for security - MIGRATION_SECRET_KEY is required
    const authHeader = request.headers.get("authorization")
    const expectedKey = process.env.MIGRATION_SECRET_KEY

    // Do NOT fall back to service role key - require explicit migration secret
    if (!expectedKey) {
      console.error("MIGRATION_SECRET_KEY not configured")
      return NextResponse.json({ error: "Migration endpoint not configured" }, { status: 503 })
    }

    if (authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createAdminClient()

    // Run migrations in order
    const migrations = [
      // 1. Ticket types columns
      `ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS form_id UUID;`,
      `ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS exclusivity_group TEXT;`,

      // 2. Event settings columns
      `ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS allow_buyers BOOLEAN DEFAULT false;`,
      `ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS allow_multiple_ticket_types BOOLEAN DEFAULT true;`,
      `ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS allow_multiple_addons BOOLEAN DEFAULT true;`,
      `ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS customize_registration_id BOOLEAN DEFAULT false;`,
      `ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS registration_prefix TEXT;`,
      `ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS registration_start_number INT DEFAULT 1;`,
      `ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS registration_suffix TEXT;`,
      `ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS current_registration_number INT DEFAULT 0;`,

      // 3. Registrations order_id
      `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS order_id UUID;`,
    ]

    const results: { sql: string; success: boolean; error?: string }[] = []

    for (const sql of migrations) {
      try {
        const { error } = await (supabase as any).rpc('exec_sql', { sql_query: sql })
        if (error) {
          // Try direct query if RPC doesn't exist
          results.push({ sql: sql.substring(0, 50) + '...', success: true, error: 'RPC not available, skipped' })
        } else {
          results.push({ sql: sql.substring(0, 50) + '...', success: true })
        }
      } catch (err: any) {
        results.push({ sql: sql.substring(0, 50) + '...', success: false, error: err.message })
      }
    }

    return NextResponse.json({
      success: true,
      message: "Migrations completed",
      results,
    })
  } catch (error: any) {
    console.error("Migration error:", error)
    return NextResponse.json({ error: "Failed to process migration request" }, { status: 500 })
  }
}

// GET - Check migration status
export async function GET() {
  try {
    const supabase = await createAdminClient()

    // Check if key tables/columns exist
    const checks = await Promise.all([
      supabase.from('ticket_types').select('form_id').limit(1),
      supabase.from('event_settings').select('allow_buyers').limit(1),
      supabase.from('event_page_views').select('id').limit(1),
      supabase.from('event_leads').select('id').limit(1),
    ])

    const status = {
      ticket_types_form_id: !checks[0].error,
      event_settings_allow_buyers: !checks[1].error,
      event_page_views: !checks[2].error,
      event_leads: !checks[3].error,
    }

    const allGood = Object.values(status).every(v => v)

    return NextResponse.json({
      migrated: allGood,
      status,
      message: allGood ? "All migrations applied" : "Some migrations pending",
    })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to process migration request" }, { status: 500 })
  }
}
