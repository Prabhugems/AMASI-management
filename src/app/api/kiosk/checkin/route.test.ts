import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-1111-1111-111111111111"
const LIST_ID = "22222222-2222-2222-2222-222222222222"
const REG_ID = "33333333-3333-3333-3333-333333333333"
const OTHER_REG_ID = "44444444-4444-4444-4444-444444444444"
const SCAN_ID = "55555555-5555-5555-5555-555555555555"
const TICKET_TYPE_ID = "66666666-6666-6666-6666-666666666666"
const OTHER_TICKET_TYPE_ID = "77777777-7777-7777-7777-777777777777"
const ADDON_ID = "88888888-8888-8888-8888-888888888888"
// The list's own checkin_lists.access_token -- required on every request
// unless a station_token resolves instead (bug-audit fix, 2026-08).
const LIST_TOKEN = "list-access-token"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

function checkinRequest(body: Record<string, unknown>) {
  return makeRequest("http://localhost/api/kiosk/checkin", { method: "POST", body })
}

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    event_id: EVENT_ID,
    checkin_list_id: LIST_ID,
    registration_id: REG_ID,
    scan_id: SCAN_ID,
    search: "125A1001",
    token: LIST_TOKEN,
    ...overrides,
  }
}

function baseList(overrides: Record<string, unknown> = {}) {
  return {
    id: LIST_ID,
    event_id: EVENT_ID,
    list_purpose: "entry",
    ticket_type_ids: null,
    addon_ids: null,
    starts_at: null,
    ends_at: null,
    access_token: LIST_TOKEN,
    access_token_expires_at: null,
    ...overrides,
  }
}

function baseRegistration(overrides: Record<string, unknown> = {}) {
  return {
    id: REG_ID,
    event_id: EVENT_ID,
    registration_number: "125A1001",
    attendee_name: "Jane Doe",
    attendee_email: "jane@example.com",
    attendee_phone: "9999999999",
    attendee_designation: null,
    attendee_institution: null,
    ticket_type_id: TICKET_TYPE_ID,
    ...overrides,
  }
}

describe("POST /api/kiosk/checkin", () => {
  it("replays a scan_id that already has a checkin_records row, without touching registrations/checkin_lists", async () => {
    mock.queueResponse("checkin_records", {
      data: { id: "cr-1", registration_id: REG_ID, checkin_list_id: LIST_ID, checked_in_at: "2026-07-27T00:00:00Z" },
      error: null,
    })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.alreadyCheckedIn).toBe(false)
    expect(body.registration.id).toBe(REG_ID)
    expect(mock.calls.some((c) => c.table === "checkin_lists")).toBe(false)
  })

  it("replays the same scan_id identically on a second call (deterministic)", async () => {
    mock.queueResponse("checkin_records", {
      data: { id: "cr-1", registration_id: REG_ID, checkin_list_id: LIST_ID, checked_in_at: "2026-07-27T00:00:00Z" },
      error: null,
    })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_records", {
      data: { id: "cr-1", registration_id: REG_ID, checkin_list_id: LIST_ID, checked_in_at: "2026-07-27T00:00:00Z" },
      error: null,
    })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })

    const { POST } = await import("./route")
    const first = await (await POST(checkinRequest(baseBody()))).json()
    const second = await (await POST(checkinRequest(baseBody()))).json()

    expect(first.alreadyCheckedIn).toBe(second.alreadyCheckedIn)
    expect(first.success).toBe(second.success)
  })

  it("ignores a mismatched registration_id on a scan_id replay and returns the original registration", async () => {
    mock.queueResponse("checkin_records", {
      data: { id: "cr-1", registration_id: REG_ID, checkin_list_id: LIST_ID, checked_in_at: "2026-07-27T00:00:00Z" },
      error: null,
    })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ registration_id: OTHER_REG_ID })))
    const body = await res.json()

    expect(body.registration.id).toBe(REG_ID)
  })

  it("404s a scan_id replay whose recorded checkin_list_id doesn't match the request's list", async () => {
    mock.queueResponse("checkin_records", {
      data: { id: "cr-1", registration_id: REG_ID, checkin_list_id: "99999999-9999-9999-9999-999999999999", checked_in_at: "2026-07-27T00:00:00Z" },
      error: null,
    })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))

    expect(res.status).toBe(404)
    expect(mock.calls.some((c) => c.table === "registrations")).toBe(false)
  })

  it("404s when registration_id doesn't resolve at all", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("registrations", { data: null, error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))

    expect(res.status).toBe(404)
  })

  it("404s when the registration belongs to a different event", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("registrations", { data: baseRegistration({ event_id: "99999999-9999-9999-9999-999999999999" }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))

    expect(res.status).toBe(404)
  })

  it("404s when the registration's ticket_type_id isn't in the list's ticket_type_ids", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("registrations", { data: baseRegistration({ ticket_type_id: OTHER_TICKET_TYPE_ID }), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [TICKET_TYPE_ID] }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))

    expect(res.status).toBe(404)
  })

  it("allows check-in when ticket_type_ids is empty (unrestricted)", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // registrations update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.alreadyCheckedIn).toBe(false)
  })

  it("403s for a collection-purpose list", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ list_purpose: "collection", ticket_type_ids: [] }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))

    expect(res.status).toBe(403)
  })

  it("returns alreadyCheckedIn true when an active record already exists for this registration+list", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: { id: "cr-existing" }, error: null }) // existing-active-record check

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.alreadyCheckedIn).toBe(true)
  })

  it("treats a 23505 insert race as an idempotent success", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check (not found yet)
    mock.queueResponse("checkin_records", { data: null, error: { code: "23505" } }) // insert races and loses

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.alreadyCheckedIn).toBe(true)
  })

  it("400s on a present-but-malformed registration_id", async () => {
    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ registration_id: "not-a-uuid" })))
    expect(res.status).toBe(400)
  })

  it("400s on a missing scan_id", async () => {
    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ scan_id: undefined })))
    expect(res.status).toBe(400)
  })

  it("400s when both registration_id and search are missing (nothing to fall back to)", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ registration_id: undefined, search: "" })))

    expect(res.status).toBe(400)
  })

  it("persists scan_id on the insert payload", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // registrations update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    expect(res.status).toBe(200)

    const insertCall = mock.calls.find((c) => c.table === "checkin_records" && c.method === "insert")
    expect(insertCall).toBeDefined()
    expect((insertCall!.args[0] as any).scan_id).toBe(SCAN_ID)
  })

  it("allows check-in when addon_ids is restricted and the registration has the addon", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [], addon_ids: [ADDON_ID] }), error: null })
    mock.queueResponse("registration_addons", { data: { registration_id: REG_ID }, error: null }) // addon eligibility hit
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // registrations update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.alreadyCheckedIn).toBe(false)
  })

  it("404s when addon_ids is restricted and the registration lacks the addon", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [], addon_ids: [ADDON_ID] }), error: null })
    mock.queueResponse("registration_addons", { data: null, error: null }) // no matching addon row

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))

    expect(res.status).toBe(404)
  })

  it("ANDs ticket_type_ids and addon_ids -- satisfying only one isn't enough", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration({ ticket_type_id: TICKET_TYPE_ID }), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [TICKET_TYPE_ID], addon_ids: [ADDON_ID] }), error: null })
    mock.queueResponse("registration_addons", { data: null, error: null }) // ticket_type_id matches, addon doesn't

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))

    expect(res.status).toBe(404)
  })

  it("404s when registration.ticket_type_id is null against a ticket_type_ids-restricted list", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration({ ticket_type_id: null }), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [TICKET_TYPE_ID] }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))

    expect(res.status).toBe(404)
  })

  it("falls back to the old fuzzy search when registration_id is absent (pre-Stage-2 kiosk bundle)", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null }) // fuzzy match hit
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // registrations update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ registration_id: undefined })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.registration.id).toBe(REG_ID)
  })

  it("returns the OLD bare-200 not-found shape when the fallback fuzzy search misses", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    mock.queueResponse("registrations", { data: null, error: null }) // fuzzy match miss

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ registration_id: undefined })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(false)
    expect(body.message).toBe("Registration not found. Please check your registration number.")
  })

  it("classifies a scan_id-constraint race as our own twin succeeding, not a prior check-in", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup (no replay yet)
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check (not found)
    mock.queueResponse("checkin_records", { data: null, error: { code: "23505" } }) // insert races and loses
    mock.queueResponse("checkin_records", { data: { id: "cr-twin" }, error: null }) // scan_id re-check: our OWN twin won

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.alreadyCheckedIn).toBe(false)
    expect(body.message).toBe("Check-in successful!")
  })

  it("persists station_id on the insert when a valid station_token resolves", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // registrations update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "some-station-token" })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    const insertCall = mock.calls.find((c) => c.table === "checkin_records" && c.method === "insert")
    expect((insertCall!.args[0] as any).station_id).toBe("st-1")
  })

  it("never blocks a check-in when station_token is present but doesn't resolve, and omits station_id from the insert", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", { data: null, error: null }) // station_token doesn't resolve
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // registrations update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "bad-token" })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    const insertCall = mock.calls.find((c) => c.table === "checkin_records" && c.method === "insert")
    // Defense-in-depth (Fix 1): the key must be entirely absent, not present
    // with a null value -- there's simply nothing to attribute when station
    // resolution didn't succeed.
    expect("station_id" in (insertCall!.args[0] as any)).toBe(false)
  })

  it("succeeds and omits station_id when station_token resolves to a real station bound to a DIFFERENT list", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", {
      // Real, valid, unrevoked station -- but not a member of the list this
      // request is checking into.
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: null, error: null })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // registrations update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "some-station-token" })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    const insertCall = mock.calls.find((c) => c.table === "checkin_records" && c.method === "insert")
    expect("station_id" in (insertCall!.args[0] as any)).toBe(false)
  })
})

describe("POST /api/kiosk/checkin -- set-membership station attribution", () => {
  it("attributes to the station when it serves the requested list (checkin_and_print)", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin_and_print", revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // checked_in update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "st-tok" })))
    expect(res.status).toBe(200)
    const insertCall = mock.calls.find((c) => c.table === "checkin_records" && c.method === "insert")
    expect((insertCall!.args[0] as any).station_id).toBe("st-1")
  })

  it("falls through to unattributed (never blocks) when the station doesn't serve this list", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: null, error: null })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // checked_in update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "st-tok" })))
    expect(res.status).toBe(200)
    const insertCall = mock.calls.find((c) => c.table === "checkin_records" && c.method === "insert")
    expect((insertCall!.args[0] as any).station_id).toBeUndefined()
  })

  it("still succeeds and never blocks the check-in when stationServesList itself errors -- falls through to unattributed", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: null, error: { message: "boom" } }) // membership query errors
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // registrations update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "st-tok" })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    const insertCall = mock.calls.find((c) => c.table === "checkin_records" && c.method === "insert")
    expect("station_id" in (insertCall!.args[0] as any)).toBe(false)
  })
})

describe("POST /api/kiosk/checkin -- attended-station collection-list exception", () => {
  it("allows an attended station to check in against a collection-purpose list (fresh-resolution path)", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null, attended: true },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ list_purpose: "collection", ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // registrations update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "attended-station-token" })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.alreadyCheckedIn).toBe(false)
  })

  it("still 403s an attended station on a collection-purpose list via the pre-Stage-2 fallback path (no eligibility check exists on this path, so it must never honor the attended exception)", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null, attended: true },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ list_purpose: "collection" }), error: null })

    const { POST } = await import("./route")
    const res = await POST(
      checkinRequest(baseBody({ registration_id: undefined, station_token: "attended-station-token" }))
    )
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.success).toBe(false)
  })

  it("still 403s a collection-purpose list when the station resolves but is NOT attended", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null, attended: false },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ list_purpose: "collection", ticket_type_ids: [] }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "unattended-station-token" })))

    expect(res.status).toBe(403)
  })

  it("still 403s a collection-purpose list when no station_token is present at all", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ list_purpose: "collection", ticket_type_ids: [] }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))

    expect(res.status).toBe(403)
  })

  it("fails closed: 403s a collection-purpose list when the station_token resolves to a station that is attended but NOT a member of this list", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null, attended: true },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: null, error: null }) // not a member of this list
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ list_purpose: "collection", ticket_type_ids: [] }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "non-member-station-token" })))

    expect(res.status).toBe(403)
  })

  it("fails closed: 403s a collection-purpose list when the station_token resolves to a revoked (would-be-attended) station", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: "2026-01-01T00:00:00Z", attended: true },
      error: null,
    })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ list_purpose: "collection", ticket_type_ids: [] }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "revoked-station-token" })))

    expect(res.status).toBe(403)
  })

  it("503s (not 403) a collection-purpose list when stationServesList itself errors on an otherwise-valid, attended-eligible station", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null, attended: true },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: null, error: { message: "boom" } }) // membership query errors
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ list_purpose: "collection", ticket_type_ids: [] }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "attended-station-token" })))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.success).toBe(false)
  })

  it("503s (not 403) a collection-purpose list when resolveStationByToken itself errors", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", { data: null, error: { message: "boom" } }) // station lookup errors
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ list_purpose: "collection", ticket_type_ids: [] }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "erroring-station-token" })))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.success).toBe(false)
  })

  it("does not regress the entry-list case when resolveStationByToken itself errors -- still unattributed, still succeeds", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", { data: null, error: { message: "boom" } }) // station lookup errors
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null }) // entry list
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // registrations update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "erroring-station-token" })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    const insertCall = mock.calls.find((c) => c.table === "checkin_records" && c.method === "insert")
    expect("station_id" in (insertCall!.args[0] as any)).toBe(false)
  })

  it("still 403s (not 503) a collection-purpose list when the station genuinely isn't a member of this list (no error)", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null, attended: true },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: null, error: null }) // clean "not a member", no error
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ list_purpose: "collection", ticket_type_ids: [] }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "non-member-station-token" })))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.success).toBe(false)
  })

  it("still 403s (not 503) a collection-purpose list on a station that's simply not attended, with no errors anywhere", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null, attended: false },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null }) // is a member, just not attended
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ list_purpose: "collection", ticket_type_ids: [] }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ station_token: "unattended-station-token" })))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.success).toBe(false)
  })
})

describe("POST /api/kiosk/checkin -- already-checked-in response widening", () => {
  it("includes checked_in_at and attributed_station_id matching the existing record's stored values", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", {
      data: { id: "cr-existing", checked_in_at: "2026-07-20T10:00:00Z", station_id: "st-existing" },
      error: null,
    }) // existing-active-record check

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.alreadyCheckedIn).toBe(true)
    expect(body.checked_in_at).toBe("2026-07-20T10:00:00Z")
    expect(body.attributed_station_id).toBe("st-existing")
  })
})

describe("POST /api/kiosk/checkin -- duplicate/conflict audit trail", () => {
  it("writes a checkin_audit_log row when an active record already exists (pre-insert duplicate)", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", {
      data: { id: "cr-existing", checked_in_at: "2026-07-20T10:00:00Z", station_id: "st-existing" },
      error: null,
    }) // existing-active-record check

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    expect(res.status).toBe(200)

    const auditCall = mock.calls.find((c) => c.table === "checkin_audit_log" && c.method === "insert")
    expect(auditCall).toBeDefined()
    const auditRow = auditCall!.args[0] as any
    expect(auditRow.event_id).toBe(EVENT_ID)
    expect(auditRow.checkin_list_id).toBe(LIST_ID)
    expect(auditRow.registration_id).toBe(REG_ID)
    expect(auditRow.performed_via).toBe("kiosk")
    expect(auditRow.success).toBe(true)
    expect(auditRow.device_info.duplicate).toBe(true)
  })

  it("writes a checkin_audit_log row when a 23505 race is a genuine prior check-in (not our own twin)", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check (not found yet)
    mock.queueResponse("checkin_records", { data: null, error: { code: "23505" } }) // insert races and loses
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id re-check: not our own twin

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.alreadyCheckedIn).toBe(true)
    const auditCall = mock.calls.find((c) => c.table === "checkin_audit_log" && c.method === "insert")
    expect(auditCall).toBeDefined()
  })

  it("does NOT write a checkin_audit_log row on a fresh, first-time check-in", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // registrations update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    expect(res.status).toBe(200)

    expect(mock.calls.some((c) => c.table === "checkin_audit_log")).toBe(false)
  })

  it("does NOT write a checkin_audit_log row when a 23505 race is our own twin succeeding", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: { code: "23505" } }) // insert races and loses
    mock.queueResponse("checkin_records", { data: { id: "cr-twin" }, error: null }) // our own twin won

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(body.alreadyCheckedIn).toBe(false)
    expect(mock.calls.some((c) => c.table === "checkin_audit_log")).toBe(false)
  })

  it("never fails the check-in response even if the audit log insert itself errors", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", {
      data: { id: "cr-existing", checked_in_at: "2026-07-20T10:00:00Z", station_id: null },
      error: null,
    })
    mock.queueResponse("checkin_audit_log", { data: null, error: { message: "insert failed" } })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.alreadyCheckedIn).toBe(true)
  })
})

describe("POST /api/kiosk/checkin -- authorization gate (bug-audit fix)", () => {
  it("401s immediately when neither token nor station_token is present -- no DB calls made", async () => {
    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ token: undefined })))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
    expect(mock.calls.length).toBe(0)
  })

  it("401s when token doesn't match this list's own access_token", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ token: "wrong-token" })))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
  })

  it("401s when token belongs to a different list (even if otherwise well-formed)", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    // access_token doesn't match the token this request sent
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [], access_token: "someone-elses-list-token" }), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
  })

  it("401s when the token is valid but expired", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", {
      data: baseList({ ticket_type_ids: [], access_token_expires_at: "2020-01-01T00:00:00Z" }),
      error: null,
    })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody()))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.message).toBe("This link has expired.")
  })

  it("succeeds via station_token alone, with no token needed at all, when the station resolves", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, mode: "checkin", revoked_at: null },
      error: null,
    })
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // existing-active-record check
    mock.queueResponse("checkin_records", { data: null, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // registrations update

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ token: undefined, station_token: "st-tok" })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("401s the pre-Stage-2 fallback path too when no credential validates", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ registration_id: undefined, token: "wrong-token" })))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
  })
})

describe("POST /api/kiosk/checkin -- fallback search wildcard escaping (bug-audit fix)", () => {
  it("escapes a bare '%' so it can't match every registration in the event", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    mock.queueResponse("registrations", { data: null, error: null }) // no match -- the escaped pattern matches nothing

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ registration_id: undefined, search: "%" })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(false)

    const orCall = mock.calls.find((c) => c.table === "registrations" && c.method === "or")
    expect(orCall).toBeDefined()
    // The literal '%' must be escaped to '\%' inside the .or() filter string
    // -- otherwise it's an ilike wildcard matching every row.
    expect(orCall!.args[0] as string).toContain("\\%")
    expect(orCall!.args[0] as string).not.toMatch(/ilike\.%%%/)
  })

  it("escapes an underscore so it matches literally, not as an ilike single-char wildcard", async () => {
    mock.queueResponse("checkin_records", { data: null, error: null }) // scan_id lookup
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ registration_id: undefined, search: "a_b" })))
    expect(res.status).toBe(200)

    const orCall = mock.calls.find((c) => c.table === "registrations" && c.method === "or")
    expect(orCall!.args[0] as string).toContain("a\\_b")
  })
})
