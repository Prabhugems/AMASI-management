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

  it("replaces the station's assigned lists on PATCH with list_ids -- inserting the new set and removing only what's dropped", async () => {
    const OLD_LIST_ID = "55555555-5555-5555-5555-555555555555"
    mock.queueResponse("kiosk_stations", { data: { id: "st-1", event_id: EVENT_ID }, error: null }) // find
    mock.queueResponse("checkin_lists", { data: [{ id: LIST_ID, event_id: EVENT_ID }], error: null }) // list_ids validation
    mock.queueResponse("kiosk_stations", { data: { id: "st-1", event_id: EVENT_ID, name: "Front Desk" }, error: null }) // station field update
    mock.queueResponse("kiosk_station_lists", { data: [{ checkin_list_id: OLD_LIST_ID }], error: null }) // existing assignments
    mock.queueResponse("kiosk_station_lists", { data: null, error: null }) // insert new
    mock.queueResponse("kiosk_station_lists", { data: null, error: null }) // delete dropped
    const { PATCH } = await import("./route")
    const res = await PATCH(
      makeRequest("http://localhost/api/kiosk-stations/st-1", { method: "PATCH", body: { list_ids: [LIST_ID] } }),
      { params: Promise.resolve({ id: "st-1" }) }
    )
    expect(res.status).toBe(200)
    expect(mock.calls.some((c) => c.table === "kiosk_station_lists" && c.method === "insert")).toBe(true)
    expect(mock.calls.some((c) => c.table === "kiosk_station_lists" && c.method === "delete")).toBe(true)
  })

  it("500s when the kiosk_station_lists insert fails, and never deletes the original assignments (station is left non-listless)", async () => {
    const OLD_LIST_ID = "55555555-5555-5555-5555-555555555555"
    mock.queueResponse("kiosk_stations", { data: { id: "st-1", event_id: EVENT_ID }, error: null }) // find
    mock.queueResponse("checkin_lists", { data: [{ id: LIST_ID, event_id: EVENT_ID }], error: null }) // list_ids validation
    mock.queueResponse("kiosk_stations", { data: { id: "st-1", event_id: EVENT_ID, name: "Front Desk" }, error: null }) // station field update
    mock.queueResponse("kiosk_station_lists", { data: [{ checkin_list_id: OLD_LIST_ID }], error: null }) // existing assignments
    mock.queueResponse("kiosk_station_lists", { data: null, error: { message: "insert failed" } }) // insert fails
    const { PATCH } = await import("./route")
    const res = await PATCH(
      makeRequest("http://localhost/api/kiosk-stations/st-1", { method: "PATCH", body: { list_ids: [LIST_ID] } }),
      { params: Promise.resolve({ id: "st-1" }) }
    )
    expect(res.status).toBe(500)
    // The old assignment must never be deleted when the insert of the new
    // set failed -- otherwise the station would be left with zero lists.
    expect(mock.calls.some((c) => c.table === "kiosk_station_lists" && c.method === "delete")).toBe(false)
  })

  it("does not touch the station's own fields at all when list_ids is invalid", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: "st-1", event_id: EVENT_ID }, error: null }) // find only
    const { PATCH } = await import("./route")
    const res = await PATCH(
      makeRequest("http://localhost/api/kiosk-stations/st-1", { method: "PATCH", body: { name: "New Name", list_ids: [] } }),
      { params: Promise.resolve({ id: "st-1" }) }
    )
    expect(res.status).toBe(400)
    // Only the initial find should have hit kiosk_stations -- the station's
    // own `.update()` must never run when list_ids fails validation, so the
    // name change must never land either.
    expect(mock.calls.filter((c) => c.table === "kiosk_stations" && c.method === "from").length).toBe(1)
    expect(mock.calls.some((c) => c.table === "kiosk_stations" && c.method === "update")).toBe(false)
  })

  it("404s (list not found for event) without ever updating the station's own fields", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: "st-1", event_id: EVENT_ID }, error: null }) // find
    mock.queueResponse("checkin_lists", { data: [], error: null }) // requested list doesn't exist
    const { PATCH } = await import("./route")
    const res = await PATCH(
      makeRequest("http://localhost/api/kiosk-stations/st-1", { method: "PATCH", body: { name: "New Name", list_ids: [LIST_ID] } }),
      { params: Promise.resolve({ id: "st-1" }) }
    )
    expect(res.status).toBe(404)
    expect(mock.calls.filter((c) => c.table === "kiosk_stations" && c.method === "from").length).toBe(1)
    expect(mock.calls.some((c) => c.table === "kiosk_stations" && c.method === "update")).toBe(false)
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

describe("GET /api/kiosk-stations/[id]", () => {
  it("400s on an invalid station id", async () => {
    const { GET } = await import("./route")
    const res = await GET(
      makeRequest("http://localhost/api/kiosk-stations/not-a-uuid"),
      { params: Promise.resolve({ id: "not-a-uuid" }) }
    )
    expect(res.status).toBe(400)
  })

  it("404s when the station doesn't exist", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`), params())
    expect(res.status).toBe(404)
  })

  it("500s when the station lookup errors", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`), params())
    expect(res.status).toBe(500)
  })

  it("returns the station with its list_ids merged in", async () => {
    mock.queueResponse("kiosk_stations", {
      data: {
        id: STATION_ID,
        event_id: EVENT_ID,
        name: "Tablet 1",
        mode: "checkin",
        print_station_id: null,
        auto_print_badge: false,
        attended: true,
        last_seen_at: null,
        revoked_at: null,
        created_at: "2026-07-30T00:00:00Z",
      },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: [{ checkin_list_id: LIST_ID }], error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`), params())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.id).toBe(STATION_ID)
    expect(body.list_ids).toEqual([LIST_ID])
  })

  it("500s when the list-membership lookup errors", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: STATION_ID, event_id: EVENT_ID, name: "Tablet 1" },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`), params())
    expect(res.status).toBe(500)
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

  it("updates attended", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, attended: true }, error: null })
    const { PATCH } = await import("./route")
    const res = await PATCH(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}`, { method: "PATCH", body: { attended: true } }), params())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.attended).toBe(true)
    const updateCall = mock.calls.find((c) => c.table === "kiosk_stations" && c.method === "update")
    expect((updateCall!.args[0] as any).attended).toBe(true)
  })
})
