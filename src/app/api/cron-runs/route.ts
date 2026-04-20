import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireSuperAdmin } from "@/lib/auth/api-auth"

// GET /api/cron-runs — last 7 days of cron job runs grouped by job
export async function GET() {
  const { error: authError } = await requireSuperAdmin()
  if (authError) return authError

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createAdminClient()) as any
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("cron_runs")
    .select("id, job, started_at, finished_at, status, synced_count, error")
    .gte("started_at", sevenDaysAgo)
    .order("started_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group by job: latest run + counts per status
  const byJob: Record<
    string,
    {
      job: string
      latest: typeof data[number] | null
      success: number
      error: number
      running: number
    }
  > = {}
  for (const row of data || []) {
    const j = byJob[row.job] || {
      job: row.job,
      latest: null,
      success: 0,
      error: 0,
      running: 0,
    }
    if (!j.latest) j.latest = row
    if (row.status === "success") j.success++
    else if (row.status === "error") j.error++
    else if (row.status === "running") j.running++
    byJob[row.job] = j
  }

  return NextResponse.json({ jobs: Object.values(byJob).sort((a, b) => a.job.localeCompare(b.job)) })
}
