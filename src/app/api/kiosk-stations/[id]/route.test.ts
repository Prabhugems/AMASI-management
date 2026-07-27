import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const STATION_ID = "33333333-3333-3333-3333-333333333333"
const EVENT_ID = "11111111-1111-1111-1111-111111111111"

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

function params() {
  return { params: Promise.resolve({ id: STATION_ID }) }
}

describe("PATCH /api/kiosk-stations/[id]", () => {
  it("404s when the station doesn't exist", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { PATCH } = await import("./route")
    const res = await PATCH(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`, { method: "PATCH", body: { name: "New Name" } }), params())
    expect(res.status).toBe(404)
  })

  it("updates the name", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, name: "New Name" }, error: null })
    const { PATCH } = await import("./route")
    const res = await PATCH(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`, { method: "PATCH", body: { name: "New Name" } }), params())
    expect(res.status).toBe(200)
  })
})

describe("DELETE /api/kiosk-stations/[id]", () => {
  it("404s when the station doesn't exist", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { DELETE } = await import("./route")
    const res = await DELETE(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`, { method: "DELETE" }), params())
    expect(res.status).toBe(404)
  })

  it("deletes the row", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { DELETE } = await import("./route")
    const res = await DELETE(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`, { method: "DELETE" }), params())
    expect(res.status).toBe(200)
  })
})
