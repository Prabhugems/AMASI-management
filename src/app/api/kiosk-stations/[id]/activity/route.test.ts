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

describe("GET /api/kiosk-stations/[id]/activity", () => {
  it("400s on an invalid station id", async () => {
    const { GET } = await import("./route")
    const res = await GET(
      makeRequest("http://localhost/api/kiosk-stations/not-a-uuid/activity"),
      { params: Promise.resolve({ id: "not-a-uuid" }) }
    )
    expect(res.status).toBe(400)
  })

  it("404s when the station doesn't exist", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/activity`), params())
    expect(res.status).toBe(404)
  })

  it("returns check-ins and duplicate attempts merged and sorted, most recent first", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("checkin_records", {
      data: [
        {
          checked_in_at: "2026-07-30T12:00:00Z",
          registrations: { attendee_name: "Dr K. Thomas", registration_number: "R-001" },
          checkin_lists: { name: "Lunch" },
        },
      ],
      error: null,
    })
    mock.queueResponse("checkin_audit_log", {
      data: [
        {
          created_at: "2026-07-30T12:05:00Z",
          device_info: { station_id: STATION_ID, duplicate: true },
          registrations: { attendee_name: "Dr P. Iyer", registration_number: "R-002" },
          checkin_lists: { name: "Lunch" },
        },
        {
          created_at: "2026-07-30T11:00:00Z",
          device_info: { station_id: "some-other-station", duplicate: true },
          registrations: { attendee_name: "Someone Else", registration_number: "R-003" },
          checkin_lists: { name: "Lunch" },
        },
      ],
      error: null,
    })

    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/activity`), params())
    const body = await res.json()

    expect(res.status).toBe(200)
    // The other station's duplicate row must be filtered out.
    expect(body.activity).toHaveLength(2)
    // Most recent first.
    expect(body.activity[0]).toMatchObject({ type: "duplicate", registration_name: "Dr P. Iyer" })
    expect(body.activity[1]).toMatchObject({ type: "check_in", registration_name: "Dr K. Thomas" })
  })

  it("500s when the checkin_records query errors", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("checkin_records", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/activity`), params())
    expect(res.status).toBe(500)
  })

  it("500s when the checkin_audit_log query errors", async () => {
    mock.queueResponse("kiosk_stations", { data: { id: STATION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("checkin_records", { data: [], error: null })
    mock.queueResponse("checkin_audit_log", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations/${STATION_ID}/activity`), params())
    expect(res.status).toBe(500)
  })
})
