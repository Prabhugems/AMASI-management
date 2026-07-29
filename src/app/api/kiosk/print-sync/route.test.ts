import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const PRINT_STATION_ID = "99999999-9999-9999-9999-999999999999"
const REG_ID = "33333333-3333-3333-3333-333333333333"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

describe("POST /api/kiosk/print-sync", () => {
  it("400s on a missing print_station_id", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk/print-sync", { method: "POST", body: { registration_id: REG_ID, printed_at: Date.now(), status: "completed" } }))
    expect(res.status).toBe(400)
  })

  it("inserts a print_jobs row with status completed for a successful print", async () => {
    mock.queueResponse("print_jobs", { data: { id: "pj-1" }, error: null })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk/print-sync", {
      method: "POST",
      body: { print_station_id: PRINT_STATION_ID, registration_id: REG_ID, printed_at: Date.now(), status: "completed" },
    }))
    expect(res.status).toBe(200)
    const insertCall = mock.calls.find((c) => c.table === "print_jobs" && c.method === "insert")
    expect((insertCall!.args[0] as any).print_station_id).toBe(PRINT_STATION_ID)
    expect((insertCall!.args[0] as any).registration_id).toBe(REG_ID)
    expect((insertCall!.args[0] as any).status).toBe("completed")
  })

  it("400s when status is \"failed\" -- only successful local prints are ever synced here", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk/print-sync", {
      method: "POST",
      body: { print_station_id: PRINT_STATION_ID, registration_id: REG_ID, printed_at: Date.now(), status: "failed" },
    }))
    expect(res.status).toBe(400)
  })

  it("400s on the old pre-fix \"success\" status value", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk/print-sync", {
      method: "POST",
      body: { print_station_id: PRINT_STATION_ID, registration_id: REG_ID, printed_at: Date.now(), status: "success" },
    }))
    expect(res.status).toBe(400)
  })
})
