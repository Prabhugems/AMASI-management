import { createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Check if table already exists
    const { error: checkError } = await db
      .from("faculty_assignments")
      .select("id")
      .limit(1)

    if (!checkError) {
      return NextResponse.json({
        success: true,
        message: "Table faculty_assignments already exists",
      })
    }

    // Create the tables using raw SQL via RPC
    // Since we can't execute DDL directly, we'll create the table structure via inserts
    // The actual table creation needs to be done in Supabase dashboard

    return NextResponse.json({
      success: false,
      message: "Table does not exist. Please run the migration SQL manually.",
      instructions: [
        "1. Go to https://supabase.com/dashboard/project/jmdwxymbgxwdsmcwbahp/sql",
        "2. Open file: supabase/migrations/20260113_faculty_assignments.sql",
        "3. Copy all contents and paste in SQL Editor",
        "4. Click 'Run' to execute the migration"
      ],
      sqlFile: "supabase/migrations/20260113_faculty_assignments.sql"
    })

  } catch (error) {
    console.error("Setup error:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to check/create tables",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Check table status
    const { data, error } = await db
      .from("faculty_assignments")
      .select("id")
      .limit(1)

    if (error) {
      return NextResponse.json({
        exists: false,
        message: "Table faculty_assignments does not exist",
        action: "Run POST /api/setup/faculty-assignments for instructions"
      })
    }

    // Count records
    const { count } = await db
      .from("faculty_assignments")
      .select("*", { count: "exact", head: true })

    return NextResponse.json({
      exists: true,
      message: "Table faculty_assignments exists",
      recordCount: count || 0
    })

  } catch (error) {
    return NextResponse.json({
      exists: false,
      error: error instanceof Error ? error.message : "Unknown error"
    })
  }
}
