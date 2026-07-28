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

describe("POST /api/kiosk-stations/[id]/access-token", () => {
  it("404s when the station doesn't exist", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { POST } = await import("./route")
    const res = await POST(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/access-token`, { method: "POST" }), params())
    expect(res.status).toBe(404)
  })

  it("rotates the token, storing only a hash, and clears any prior revocation", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, name: "Front Desk" }, error: null })

    const { POST } = await import("./route")
    const res = await POST(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/access-token`, { method: "POST" }), params())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.access_token).toMatch(/^[0-9a-f]{48}$/)
    const updateCall = mock.calls.find((c) => c.table === "kiosk_stations" && c.method === "update")
    expect((updateCall!.args[0] as any).access_token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect((updateCall!.args[0] as any).revoked_at).toBeNull()
  })
})

describe("DELETE /api/kiosk-stations/[id]/access-token", () => {
  it("404s when the station doesn't exist", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { DELETE } = await import("./route")
    const res = await DELETE(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/access-token`, { method: "DELETE" }), params())
    expect(res.status).toBe(404)
  })

  it("sets revoked_at", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("kiosk_stations", { data: null, error: null })

    const { DELETE } = await import("./route")
    const res = await DELETE(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/access-token`, { method: "DELETE" }), params())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    const updateCall = mock.calls.find((c) => c.table === "kiosk_stations" && c.method === "update")
    expect((updateCall!.args[0] as any).revoked_at).toBeTruthy()
  })
})
