import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-1111-1111-111111111111"
const LIST_ID = "22222222-2222-2222-2222-222222222222"
const OTHER_LIST_ID = "33333333-3333-3333-3333-333333333333"
const OTHER_EVENT_ID = "99999999-9999-9999-9999-999999999999"
const STATION_TOKEN = "test-station-token-abc123"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

function url(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  return `http://localhost/api/kiosk/list-counts?${qs}`
}

function baseStation(overrides: Record<string, unknown> = {}) {
  return {
    id: "st-1",
    event_id: EVENT_ID,
    mode: "checkin",
    revoked_at: null,
    attended: true,
    ...overrides,
  }
}

describe("GET /api/kiosk/list-counts", () => {
  it("400s on a missing or invalid event_id", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: "not-a-uuid", station_token: STATION_TOKEN, list_ids: LIST_ID })))
    expect(res.status).toBe(400)
  })

  it("401s when station_token is missing", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "", list_ids: LIST_ID })))
    expect(res.status).toBe(401)
  })

  it("400s when list_ids is missing", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_ids: "" })))
    expect(res.status).toBe(400)
  })

  it("400s when list_ids contains an invalid uuid", async () => {
    const { GET } = await import("./route")
    const res = await GET(
      makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_ids: `${LIST_ID},not-a-uuid` }))
    )
    expect(res.status).toBe(400)
  })

  it("400s when list_ids exceeds the cap", async () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `22222222-2222-2222-2222-${String(i).padStart(12, "0")}`).join(",")
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_ids: tooMany })))
    expect(res.status).toBe(400)
  })

  it("401s when the station doesn't resolve (not found)", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_ids: LIST_ID })))
    expect(res.status).toBe(401)
  })

  it("401s when the station is revoked", async () => {
    mock.queueResponse("kiosk_stations", { data: baseStation({ revoked_at: "2026-01-01T00:00:00Z" }), error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_ids: LIST_ID })))
    expect(res.status).toBe(401)
  })

  it("401s when the station mode isn't checkin or checkin_and_print", async () => {
    mock.queueResponse("kiosk_stations", { data: baseStation({ mode: "print" }), error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_ids: LIST_ID })))
    expect(res.status).toBe(401)
  })

  it("404s when station.event_id doesn't match the requested event_id", async () => {
    mock.queueResponse("kiosk_stations", { data: baseStation({ event_id: OTHER_EVENT_ID }), error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_ids: LIST_ID })))
    expect(res.status).toBe(404)
  })

  it("503s when the station lookup itself errors", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_ids: LIST_ID })))
    expect(res.status).toBe(503)
  })

  it("503s when the membership lookup errors", async () => {
    mock.queueResponse("kiosk_stations", { data: baseStation(), error: null })
    mock.queueResponse("kiosk_station_lists", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_ids: LIST_ID })))
    expect(res.status).toBe(503)
  })

  it("silently drops a requested list id the station isn't a member of, returning counts only for the rest", async () => {
    mock.queueResponse("kiosk_stations", { data: baseStation(), error: null })
    mock.queueResponse("kiosk_station_lists", { data: [{ checkin_list_id: LIST_ID }], error: null })
    mock.queueResponse("checkin_records", { data: null, error: null, count: 5 })

    const { GET } = await import("./route")
    const res = await GET(
      makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_ids: `${LIST_ID},${OTHER_LIST_ID}` }))
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.counts).toEqual({ [LIST_ID]: 5 })
    expect(mock.calls.filter((c) => c.table === "checkin_records" && c.method === "from")).toHaveLength(1)
  })

  it("returns event-wide counts for every membered list, keyed by list id", async () => {
    mock.queueResponse("kiosk_stations", { data: baseStation(), error: null })
    mock.queueResponse("kiosk_station_lists", {
      data: [{ checkin_list_id: LIST_ID }, { checkin_list_id: OTHER_LIST_ID }],
      error: null,
    })
    mock.queueResponse("checkin_records", { data: null, error: null, count: 142 })
    mock.queueResponse("checkin_records", { data: null, error: null, count: 0 })

    const { GET } = await import("./route")
    const res = await GET(
      makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_ids: `${LIST_ID},${OTHER_LIST_ID}` }))
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.counts[LIST_ID]).toBeTypeOf("number")
    expect(body.counts[OTHER_LIST_ID]).toBeTypeOf("number")
    expect(Object.values(body.counts).sort()).toEqual([0, 142])
    expect(
      mock.calls.some(
        (c) => c.table === "checkin_records" && c.method === "eq" && c.args[0] === "checkin_list_id"
      )
    ).toBe(true)
  })

  it("omits a list's count (rather than erroring the whole request) when its count query fails", async () => {
    mock.queueResponse("kiosk_stations", { data: baseStation(), error: null })
    mock.queueResponse("kiosk_station_lists", {
      data: [{ checkin_list_id: LIST_ID }, { checkin_list_id: OTHER_LIST_ID }],
      error: null,
    })
    mock.queueResponse("checkin_records", { data: null, error: { message: "boom" } })
    mock.queueResponse("checkin_records", { data: null, error: null, count: 7 })

    const { GET } = await import("./route")
    const res = await GET(
      makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_ids: `${LIST_ID},${OTHER_LIST_ID}` }))
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(Object.keys(body.counts)).toHaveLength(1)
    expect(Object.values(body.counts)).toEqual([7])
  })
})
