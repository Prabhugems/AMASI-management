import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-1111-1111-111111111111"
const LIST_A = "22222222-2222-2222-2222-222222222222"
const LIST_B = "33333333-3333-3333-3333-333333333333"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))

vi.mock("@/lib/auth/api-auth", () => ({
  requireEventAndPermission: vi.fn(async () => ({ user: { id: "admin-1" }, error: null })),
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

function url(params: Record<string, string>) {
  return `http://localhost/api/kiosk-stations/list-counts?${new URLSearchParams(params).toString()}`
}

describe("GET /api/kiosk-stations/list-counts", () => {
  it("400s on a missing or invalid event_id", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: "not-a-uuid" })))
    expect(res.status).toBe(400)
  })

  it("returns a count per list in the event", async () => {
    mock.queueResponse("checkin_lists", { data: [{ id: LIST_A }, { id: LIST_B }], error: null })
    mock.queueResponse("checkin_records", { data: null, error: null, count: 142 })
    mock.queueResponse("checkin_records", { data: null, error: null, count: 0 })

    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(Object.values(body.counts).sort()).toEqual([0, 142])
  })

  it("500s when the event's list of check-in lists fails to load", async () => {
    mock.queueResponse("checkin_lists", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID })))
    expect(res.status).toBe(500)
  })

  it("omits a list's count (rather than erroring the whole request) if its count query fails", async () => {
    mock.queueResponse("checkin_lists", { data: [{ id: LIST_A }, { id: LIST_B }], error: null })
    mock.queueResponse("checkin_records", { data: null, error: { message: "boom" } })
    mock.queueResponse("checkin_records", { data: null, error: null, count: 7 })

    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(Object.keys(body.counts)).toHaveLength(1)
    expect(Object.values(body.counts)).toEqual([7])
  })
})
