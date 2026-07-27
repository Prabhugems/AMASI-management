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
      data: { id: "cr-1", registration_id: REG_ID, checked_in_at: "2026-07-27T00:00:00Z" },
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
      data: { id: "cr-1", registration_id: REG_ID, checked_in_at: "2026-07-27T00:00:00Z" },
      error: null,
    })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_records", {
      data: { id: "cr-1", registration_id: REG_ID, checked_in_at: "2026-07-27T00:00:00Z" },
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
      data: { id: "cr-1", registration_id: REG_ID, checked_in_at: "2026-07-27T00:00:00Z" },
      error: null,
    })
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })

    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ registration_id: OTHER_REG_ID })))
    const body = await res.json()

    expect(body.registration.id).toBe(REG_ID)
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

  it("400s on a missing registration_id", async () => {
    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ registration_id: undefined })))
    expect(res.status).toBe(400)
  })

  it("400s on a missing scan_id", async () => {
    const { POST } = await import("./route")
    const res = await POST(checkinRequest(baseBody({ scan_id: undefined })))
    expect(res.status).toBe(400)
  })
})
