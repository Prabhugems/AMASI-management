import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const STATION_ID = "33333333-3333-3333-3333-333333333333"
const EVENT_ID = "11111111-1111-1111-1111-111111111111"
const LIST_ID = "22222222-2222-2222-2222-222222222222"

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

  it("replaces the station's assigned lists on PATCH with list_ids", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: "st-1", event_id: EVENT_ID }, error: null })
    mock.queueResponse("checkin_lists", { data: [{ id: LIST_ID, event_id: EVENT_ID }], error: null })
    mock.queueResponse("kiosk_station_lists", { data: null, error: null }) // delete
    mock.queueResponse("kiosk_station_lists", { data: null, error: null }) // insert
    mock.queueResponse("kiosk_stations", { data: { id: "st-1", event_id: EVENT_ID, name: "Front Desk" }, error: null })
    const { PATCH } = await import("./route")
    const res = await PATCH(
      makeRequest("http://localhost/api/kiosk-stations/st-1", { method: "PATCH", body: { list_ids: [LIST_ID] } }),
      { params: Promise.resolve({ id: "st-1" }) }
    )
    expect(res.status).toBe(200)
    expect(mock.calls.some((c) => c.table === "kiosk_station_lists" && c.method === "delete")).toBe(true)
    expect(mock.calls.some((c) => c.table === "kiosk_station_lists" && c.method === "insert")).toBe(true)
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

const PRINT_STATION_ID = "44444444-4444-4444-4444-444444444444"

describe("PATCH /api/kiosk-stations/[id] -- print_station_id / auto_print_badge", () => {
  it("updates print_station_id when it resolves to a usb-type Print Station in the station's event", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("print_stations", {
      data: { id: PRINT_STATION_ID, event_id: EVENT_ID, print_settings: { printer_type: "usb" } },
      error: null,
    })
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, print_station_id: PRINT_STATION_ID }, error: null })
    const { PATCH } = await import("./route")
    const res = await PATCH(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`, { method: "PATCH", body: { print_station_id: PRINT_STATION_ID } }), params())
    expect(res.status).toBe(200)
  })

  it("400s when the new print_station_id isn't printer_type usb", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("print_stations", {
      data: { id: PRINT_STATION_ID, event_id: EVENT_ID, print_settings: { printer_type: "thermal" } },
      error: null,
    })
    const { PATCH } = await import("./route")
    const res = await PATCH(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`, { method: "PATCH", body: { print_station_id: PRINT_STATION_ID } }), params())
    expect(res.status).toBe(400)
  })

  it("updates auto_print_badge", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, auto_print_badge: true }, error: null })
    const { PATCH } = await import("./route")
    const res = await PATCH(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`, { method: "PATCH", body: { auto_print_badge: true } }), params())
    expect(res.status).toBe(200)
  })
})
