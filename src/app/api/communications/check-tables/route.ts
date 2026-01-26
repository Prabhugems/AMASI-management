import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

// GET /api/communications/check-tables
// Diagnostic endpoint to check if communications tables exist (requires admin)
export async function GET() {
  // Require admin access for diagnostic endpoints
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  try {
    const supabase = await createAdminClient()

    const results: Record<string, { exists: boolean; error?: string; count?: number }> = {}

    // Check communication_settings
    const { error: settingsError, count: settingsCount } = await (supabase as any)
      .from("communication_settings")
      .select("*", { count: "exact", head: true })

    results.communication_settings = {
      exists: !settingsError,
      error: settingsError?.message,
      count: settingsCount ?? 0,
    }

    // Check message_templates
    const { error: templatesError, count: templatesCount } = await (supabase as any)
      .from("message_templates")
      .select("*", { count: "exact", head: true })

    results.message_templates = {
      exists: !templatesError,
      error: templatesError?.message,
      count: templatesCount ?? 0,
    }

    // Check message_logs
    const { error: logsError, count: logsCount } = await (supabase as any)
      .from("message_logs")
      .select("*", { count: "exact", head: true })

    results.message_logs = {
      exists: !logsError,
      error: logsError?.message,
      count: logsCount ?? 0,
    }

    const allExist = Object.values(results).every(r => r.exists)

    return NextResponse.json({
      success: allExist,
      message: allExist
        ? "All communications tables exist"
        : "Some tables are missing - please run the migration",
      tables: results,
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}
