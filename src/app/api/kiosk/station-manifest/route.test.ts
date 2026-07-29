import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-1111-1111-111111111111"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))
vi.mock("@/lib/kiosk-station-auth", () => ({
  hashStationToken: (t: string) => `hashed:${t}`,
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

function url(params: Record<string, string>) {
  return `http://localhost/api/kiosk/station-manifest?${new URLSearchParams(params).toString()}`
}

describe("GET /api/kiosk/station-manifest", () => {
  it("400s on a missing or invalid event_id", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: "not-a-uuid", station_token: "tok" })))
    expect(res.status).toBe(400)
  })

  it("401s when station_token is missing", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID })))
    expect(res.status).toBe(401)
  })

  it("401s when the token doesn't resolve, is revoked, or is print-only mode", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "tok" })))
    expect(res.status).toBe(401)
  })

  it("404s when the station belongs to a different event", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: "99999999-9999-9999-9999-999999999999", name: "Front Desk", mode: "checkin", print_station_id: null, auto_print_badge: false, revoked_at: null },
      error: null,
    })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "tok" })))
    expect(res.status).toBe(404)
  })

  it("returns the station's assigned lists joined with their schedule fields", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, name: "Food Area", mode: "checkin", print_station_id: null, auto_print_badge: false, revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: [{ checkin_list_id: "list-1" }, { checkin_list_id: "list-2" }], error: null })
    mock.queueResponse("checkin_lists", {
      data: [
        { id: "list-1", name: "Breakfast", kiosk_opens_at: null, kiosk_closes_at: null, kiosk_force_state: null },
        { id: "list-2", name: "Lunch", kiosk_opens_at: null, kiosk_closes_at: null, kiosk_force_state: "closed" },
      ],
      error: null,
    })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "tok" })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.station_name).toBe("Food Area")
    expect(body.lists).toHaveLength(2)
    expect(body.lists.find((l: any) => l.id === "list-2").kiosk_force_state).toBe("closed")
  })
})
