import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-1111-1111-111111111111"
const LIST_ID = "22222222-2222-2222-2222-222222222222"
const TOKEN = "test-access-token-abc123"
const ADDON_ID = "88888888-8888-8888-8888-888888888888"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

function url(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  return `http://localhost/api/kiosk/delegates?${qs}`
}

function baseList(overrides: Record<string, unknown> = {}) {
  return {
    id: LIST_ID,
    event_id: EVENT_ID,
    list_purpose: "entry",
    access_token: TOKEN,
    access_token_expires_at: "2099-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("GET /api/kiosk/delegates", () => {
  it("400s on a missing or invalid event_id", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: "not-a-uuid", token: TOKEN })))
    expect(res.status).toBe(400)
  })

  it("401s when token is missing", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, token: "" })))
    expect(res.status).toBe(401)
  })

  it("401s when token doesn't match any list", async () => {
    mock.queueResponse("checkin_lists", { data: null, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, token: TOKEN })))
    expect(res.status).toBe(401)
    // Pins the security property, not just the mocked behavior: a route
    // that dropped the token filter (and so never actually scoped the
    // lookup by it) would still pass a mock-driven "return null" test.
    expect(
      mock.calls.some((c) => c.table === "checkin_lists" && c.method === "eq" && c.args[0] === "access_token" && c.args[1] === TOKEN)
    ).toBe(true)
  })

  it("401s when the matched list's token has expired", async () => {
    mock.queueResponse("checkin_lists", {
      data: baseList({ access_token_expires_at: "2020-01-01T00:00:00Z" }),
      error: null,
    })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, token: TOKEN })))
    expect(res.status).toBe(401)
  })

  it("404s when the matched list belongs to a different event", async () => {
    mock.queueResponse("checkin_lists", {
      data: baseList({ event_id: "99999999-9999-9999-9999-999999999999" }),
      error: null,
    })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, token: TOKEN })))
    expect(res.status).toBe(404)
  })

  it("returns an empty roster for a collection-purpose list without querying registrations", async () => {
    mock.queueResponse("checkin_lists", { data: baseList({ list_purpose: "collection" }), error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, token: TOKEN })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.delegates).toEqual([])
    expect(body.list_purpose).toBe("collection")
    expect(mock.calls.some((c) => c.table === "registrations")).toBe(false)
  })

  it("returns the full mapped roster for an entry-purpose list", async () => {
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    mock.queueResponse("registrations", {
      data: [
        {
          id: "reg-1",
          registration_number: "REG-001",
          attendee_name: "Jane Doe",
          attendee_email: "jane@example.com",
          attendee_phone: "9999999999",
          attendee_designation: "Consultant",
          attendee_institution: "AMASI",
        },
      ],
      error: null,
    })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, token: TOKEN })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.delegates).toEqual([
      {
        id: "reg-1",
        registration_number: "REG-001",
        attendee_name: "Jane Doe",
        attendee_email: "jane@example.com",
        attendee_phone: "9999999999",
        attendee_designation: "Consultant",
        attendee_institution: "AMASI",
      },
    ])
    expect(body.list_purpose).toBe("entry")
    // Unrestricted list (baseList() sets no ticket_type_ids/addon_ids), so
    // no .in() filter should be applied to the registrations query -- a
    // restricted list DOES get one now (see the addon-eligibility tests
    // below), but an unrestricted list's scope must stay event-wide, matching
    // /api/kiosk/checkin's server-side gate exactly.
    expect(mock.calls.some((c) => c.table === "registrations" && c.method === "in")).toBe(false)
    // Pins the security property, not just the mocked behavior: a route
    // that dropped either filter would still pass without these.
    expect(
      mock.calls.some((c) => c.table === "checkin_lists" && c.method === "eq" && c.args[0] === "access_token" && c.args[1] === TOKEN)
    ).toBe(true)
    expect(
      mock.calls.some((c) => c.table === "registrations" && c.method === "eq" && c.args[0] === "event_id" && c.args[1] === EVENT_ID)
    ).toBe(true)
  })

  it("paginates past Supabase's 1,000-row cap, accumulating all pages", async () => {
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({
      id: `reg-${i}`,
      registration_number: `REG-${i}`,
      attendee_name: `Delegate ${i}`,
      attendee_email: `delegate${i}@example.com`,
      attendee_phone: "9999999999",
      attendee_designation: "Consultant",
      attendee_institution: "AMASI",
    }))
    mock.queueResponse("registrations", { data: fullPage, error: null })
    mock.queueResponse("registrations", {
      data: [
        {
          id: "reg-1000",
          registration_number: "REG-1000",
          attendee_name: "Last Delegate",
          attendee_email: "last@example.com",
          attendee_phone: "9999999999",
          attendee_designation: "Consultant",
          attendee_institution: "AMASI",
        },
      ],
      error: null,
    })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, token: TOKEN })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.delegates).toHaveLength(1001)

    const rangeCalls = mock.calls.filter((c) => c.table === "registrations" && c.method === "range")
    expect(rangeCalls).toHaveLength(2)
    expect(rangeCalls[0].args).toEqual([0, 999])
    expect(rangeCalls[1].args).toEqual([1000, 1999])
  })

  it("500s if the registrations query errors", async () => {
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    mock.queueResponse("registrations", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, token: TOKEN })))
    expect(res.status).toBe(500)
  })

  it("includes a registration that holds the list's restricted addon", async () => {
    const ELIGIBLE_REG_ID = "reg-addon-yes"
    mock.queueResponse("checkin_lists", { data: baseList({ addon_ids: [ADDON_ID] }), error: null })
    mock.queueResponse("registration_addons", { data: [{ registration_id: ELIGIBLE_REG_ID }], error: null })
    mock.queueResponse("registrations", {
      data: [
        {
          id: ELIGIBLE_REG_ID,
          registration_number: "REG-002",
          attendee_name: "Addon Holder",
          attendee_email: "addon@example.com",
          attendee_phone: "8888888888",
          attendee_designation: null,
          attendee_institution: null,
        },
      ],
      error: null,
    })

    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, token: TOKEN })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.delegates.map((d: any) => d.id)).toEqual([ELIGIBLE_REG_ID])
    expect(
      mock.calls.some(
        (c) => c.table === "registration_addons" && c.method === "in" && c.args[0] === "addon_id" && (c.args[1] as string[]).includes(ADDON_ID)
      )
    ).toBe(true)
    expect(
      mock.calls.some(
        (c) => c.table === "registrations" && c.method === "in" && c.args[0] === "id" && (c.args[1] as string[]).includes(ELIGIBLE_REG_ID)
      )
    ).toBe(true)
  })

  it("excludes a registration that lacks the list's restricted addon from the eligible roster", async () => {
    const ELIGIBLE_REG_ID = "reg-addon-yes"
    const INELIGIBLE_REG_ID = "reg-addon-no"
    mock.queueResponse("checkin_lists", { data: baseList({ addon_ids: [ADDON_ID] }), error: null })
    // Only the eligible registration holds the addon -- registration_addons
    // never returns a row for INELIGIBLE_REG_ID, so it must never make it
    // into the eligible-ID set passed to the roster query.
    mock.queueResponse("registration_addons", { data: [{ registration_id: ELIGIBLE_REG_ID }], error: null })
    mock.queueResponse("registrations", {
      data: [
        {
          id: ELIGIBLE_REG_ID,
          registration_number: "REG-002",
          attendee_name: "Addon Holder",
          attendee_email: "addon@example.com",
          attendee_phone: "8888888888",
          attendee_designation: null,
          attendee_institution: null,
        },
      ],
      error: null,
    })

    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, token: TOKEN })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.delegates.some((d: any) => d.id === INELIGIBLE_REG_ID)).toBe(false)
    // Pins that the roster is actually narrowed by the eligible-ID set, not
    // just unfiltered-and-coincidentally-missing-the-ineligible-row: assert
    // the .in("id", ...) filter passed to the registrations query excludes
    // the ineligible registration and includes the eligible one.
    const inCall = mock.calls.find((c) => c.table === "registrations" && c.method === "in" && c.args[0] === "id")
    expect(inCall).toBeDefined()
    expect(inCall!.args[1] as string[]).not.toContain(INELIGIBLE_REG_ID)
    expect(inCall!.args[1] as string[]).toContain(ELIGIBLE_REG_ID)
  })

  it("401s when station_token doesn't resolve to any station", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "bad-token", list_id: LIST_ID })))
    expect(res.status).toBe(401)
  })

  it("401s when the station is revoked", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: "2026-01-01T00:00:00Z" },
      error: null,
    })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "some-token", list_id: LIST_ID })))
    expect(res.status).toBe(401)
  })

  it("404s when the station's event doesn't match", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: "99999999-9999-9999-9999-999999999999", mode: "checkin", revoked_at: null },
      error: null,
    })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "some-token", list_id: LIST_ID })))
    expect(res.status).toBe(404)
  })

  it("resolves the roster via a valid station_token without ever querying checkin_lists.access_token", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    mock.queueResponse("registrations", { data: [], error: null })

    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "some-token", list_id: LIST_ID })))

    expect(res.status).toBe(200)
    // Pins the security property: the checkin_lists lookup on this path must
    // never filter by access_token -- the list's own token is not part of
    // this request at all.
    expect(mock.calls.some((c) => c.table === "checkin_lists" && c.method === "eq" && c.args[0] === "access_token")).toBe(false)
    expect(mock.calls.some((c) => c.table === "checkin_lists" && c.method === "eq" && c.args[0] === "id" && c.args[1] === LIST_ID)).toBe(true)
  })
})

describe("GET /api/kiosk/delegates -- station_token multi-list", () => {
  it("400s when station_token is present without list_id", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "st-tok" })))
    expect(res.status).toBe(400)
  })

  it("404s when the station doesn't serve the requested list", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: null, error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "st-tok", list_id: LIST_ID })))
    expect(res.status).toBe(404)
  })

  it("accepts a checkin_and_print station serving the requested list", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin_and_print", revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "st-tok", list_id: LIST_ID })))
    expect(res.status).toBe(200)
  })

  it("503s (not 404) when the station-membership lookup errors, distinguishing a transient failure from a genuine miss", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, station_token: "st-tok", list_id: LIST_ID })))
    expect(res.status).toBe(503)
  })
})
