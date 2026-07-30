import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-1111-1111-111111111111"
const LIST_ID = "22222222-2222-2222-2222-222222222222"
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
  return `http://localhost/api/kiosk/collected-status?${qs}`
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

describe("GET /api/kiosk/collected-status", () => {
  it("400s on a missing or invalid event_id", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: "not-a-uuid", station_token: STATION_TOKEN, list_id: LIST_ID })))
    expect(res.status).toBe(400)
  })

  it("401s when station_token is missing", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "", list_id: LIST_ID })))
    expect(res.status).toBe(401)
  })

  it("400s on a missing or invalid list_id", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_id: "not-a-uuid" })))
    expect(res.status).toBe(400)
  })

  it("401s when the station doesn't resolve (not found)", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_id: LIST_ID })))
    expect(res.status).toBe(401)
  })

  it("401s when the station is revoked", async () => {
    mock.queueResponse("kiosk_stations", {
      data: baseStation({ revoked_at: "2026-01-01T00:00:00Z" }),
      error: null,
    })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_id: LIST_ID })))
    expect(res.status).toBe(401)
  })

  it("401s when the station mode isn't checkin or checkin_and_print", async () => {
    mock.queueResponse("kiosk_stations", { data: baseStation({ mode: "print" }), error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_id: LIST_ID })))
    expect(res.status).toBe(401)
  })

  it("404s when station.event_id doesn't match the requested event_id", async () => {
    mock.queueResponse("kiosk_stations", { data: baseStation({ event_id: OTHER_EVENT_ID }), error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_id: LIST_ID })))
    expect(res.status).toBe(404)
  })

  it("404s when the station isn't a member of the requested list", async () => {
    mock.queueResponse("kiosk_stations", { data: baseStation(), error: null })
    mock.queueResponse("kiosk_station_lists", { data: null, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_id: LIST_ID })))
    expect(res.status).toBe(404)
  })

  it("503s (not 404) when the station-membership lookup errors", async () => {
    mock.queueResponse("kiosk_stations", { data: baseStation(), error: null })
    mock.queueResponse("kiosk_station_lists", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_id: LIST_ID })))
    expect(res.status).toBe(503)
  })

  it("503s when the station lookup itself errors", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_id: LIST_ID })))
    expect(res.status).toBe(503)
  })

  it("returns blocked: true and an empty roster when the station resolves and is a member but is NOT attended", async () => {
    mock.queueResponse("kiosk_stations", { data: baseStation({ attended: false }), error: null })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_id: LIST_ID })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.blocked).toBe(true)
    expect(body.registrations).toEqual([])
    expect(mock.calls.some((c) => c.table === "checkin_records")).toBe(false)
  })

  it("fails closed: `attended` missing/undefined on the station row still results in blocked: true, never an error and never true", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_id: LIST_ID })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.blocked).toBe(true)
    expect(body.registrations).toEqual([])
  })

  it("returns blocked: false with correctly-shaped registrations when attended and checkin_records returns rows", async () => {
    mock.queueResponse("kiosk_stations", { data: baseStation(), error: null })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    mock.queueResponse("checkin_records", {
      data: [
        { registration_id: "reg-1", checked_in_at: "2026-07-30T10:00:00Z", station_id: "st-2" },
        { registration_id: "reg-2", checked_in_at: "2026-07-30T10:05:00Z", station_id: null },
      ],
      error: null,
    })

    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_id: LIST_ID })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.blocked).toBe(false)
    expect(body.registrations).toEqual([
      { registration_id: "reg-1", checked_in_at: "2026-07-30T10:00:00Z", station_id: "st-2" },
      { registration_id: "reg-2", checked_in_at: "2026-07-30T10:05:00Z", station_id: null },
    ])
    expect(
      mock.calls.some((c) => c.table === "checkin_records" && c.method === "eq" && c.args[0] === "checkin_list_id" && c.args[1] === LIST_ID)
    ).toBe(true)
    expect(
      mock.calls.some((c) => c.table === "checkin_records" && c.method === "is" && c.args[0] === "checked_out_at" && c.args[1] === null)
    ).toBe(true)
  })

  it("paginates past Supabase's 1,000-row cap, accumulating all pages", async () => {
    mock.queueResponse("kiosk_stations", { data: baseStation(), error: null })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({
      registration_id: `reg-${i}`,
      checked_in_at: "2026-07-30T10:00:00Z",
      station_id: "st-2",
    }))
    mock.queueResponse("checkin_records", { data: fullPage, error: null })
    mock.queueResponse("checkin_records", {
      data: [{ registration_id: "reg-1000", checked_in_at: "2026-07-30T10:00:00Z", station_id: "st-2" }],
      error: null,
    })

    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_id: LIST_ID })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.registrations).toHaveLength(1001)

    const rangeCalls = mock.calls.filter((c) => c.table === "checkin_records" && c.method === "range")
    expect(rangeCalls).toHaveLength(2)
    expect(rangeCalls[0].args).toEqual([0, 999])
    expect(rangeCalls[1].args).toEqual([1000, 1999])
  })

  it("500s if the checkin_records query errors", async () => {
    mock.queueResponse("kiosk_stations", { data: baseStation(), error: null })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    mock.queueResponse("checkin_records", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: STATION_TOKEN, list_id: LIST_ID })))
    expect(res.status).toBe(500)
  })
})
