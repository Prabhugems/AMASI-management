import { createAdminClient } from "@/lib/supabase/server"

export type CronRunHandle = {
  runId: number | null
  ok: (result?: { syncedCount?: number; metadata?: Record<string, unknown> }) => Promise<void>
  err: (error: unknown, metadata?: Record<string, unknown>) => Promise<void>
}

// Wrap a cron job with a cron_runs row. The helper must never throw — if the
// logging insert fails, we still return a handle whose ok/err become no-ops so
// the cron job itself can complete and return its normal response.
export async function logCronRun(job: string): Promise<CronRunHandle> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any
  try {
    db = await createAdminClient()
  } catch {
    return { runId: null, ok: async () => {}, err: async () => {} }
  }

  let runId: number | null = null
  try {
    const { data } = await db
      .from("cron_runs")
      .insert({ job, status: "running" })
      .select("id")
      .single()
    runId = (data as { id: number } | null)?.id ?? null
  } catch {
    // swallow — logging must never break the underlying cron
  }

  return {
    runId,
    async ok(result) {
      if (runId === null) return
      try {
        await db
          .from("cron_runs")
          .update({
            status: "success",
            finished_at: new Date().toISOString(),
            synced_count: result?.syncedCount ?? null,
            metadata: result?.metadata ?? null,
          })
          .eq("id", runId)
      } catch {
        // swallow
      }
    },
    async err(error, metadata) {
      if (runId === null) return
      const message = error instanceof Error ? error.message : String(error)
      try {
        await db
          .from("cron_runs")
          .update({
            status: "error",
            finished_at: new Date().toISOString(),
            error: message.slice(0, 2000),
            metadata: metadata ?? null,
          })
          .eq("id", runId)
      } catch {
        // swallow
      }
    },
  }
}
