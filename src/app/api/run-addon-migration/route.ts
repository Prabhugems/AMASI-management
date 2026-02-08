import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// One-time migration endpoint - DELETE AFTER USE
export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      {
        db: {
          schema: 'public'
        }
      }
    )

    // Test if columns already exist
    const { data: testData, error: testError } = await supabase
      .from('addons')
      .select('is_course')
      .limit(1)

    if (!testError) {
      return NextResponse.json({
        success: true,
        message: "Migration already applied - columns exist"
      })
    }

    // Columns don't exist, need to run migration via raw SQL
    // Since Supabase JS client doesn't support raw SQL, we'll do it via REST

    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!
      .replace('https://', '')
      .replace('.supabase.co', '')

    // Use the Database REST API directly
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()}`,
        },
        body: JSON.stringify({
          sql: `
            ALTER TABLE addons
            ADD COLUMN IF NOT EXISTS image_url TEXT,
            ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS variant_type TEXT,
            ADD COLUMN IF NOT EXISTS is_course BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS certificate_template_id UUID,
            ADD COLUMN IF NOT EXISTS course_description TEXT,
            ADD COLUMN IF NOT EXISTS course_duration TEXT,
            ADD COLUMN IF NOT EXISTS course_instructor TEXT;
          `
        })
      }
    )

    if (!response.ok) {
      // RPC doesn't exist, return SQL for manual execution
      return NextResponse.json({
        success: false,
        message: "Please run this SQL manually in Supabase Dashboard -> SQL Editor",
        sql: `
ALTER TABLE addons
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS variant_type TEXT,
ADD COLUMN IF NOT EXISTS is_course BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS certificate_template_id UUID,
ADD COLUMN IF NOT EXISTS course_description TEXT,
ADD COLUMN IF NOT EXISTS course_duration TEXT,
ADD COLUMN IF NOT EXISTS course_instructor TEXT;

CREATE TABLE IF NOT EXISTS addon_ticket_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  max_quantity_per_attendee INTEGER DEFAULT 1,
  is_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(addon_id, ticket_type_id)
);
        `
      })
    }

    return NextResponse.json({ success: true, message: "Migration completed" })
  } catch (error) {
    console.error("Migration error:", error)
    return NextResponse.json({
      success: false,
      error: String(error),
      message: "Please run migration manually in Supabase Dashboard"
    }, { status: 500 })
  }
}
