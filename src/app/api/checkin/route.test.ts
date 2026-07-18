import { describe, it, expect, vi, beforeEach } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-1111-1111-111111111111"
const LIST_ID = "22222222-2222-2222-2222-222222222222"
const REG_ID = "33333333-3333-3333-3333-333333333333"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))

vi.mock("@/lib/auth/api-auth", () => ({
  getApiUser: vi.fn().mockResolvedValue({ user: { id: "u1", platform_role: "admin", is_super_admin: false }, error: null }),
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

function baseRegistration(overrides: Record<string, unknown> = {}) {
  return {
    id: REG_ID,
    registration_number: "REG-001",
    attendee_name: "Jane Doe",
    attendee_email: "jane@example.com",
    ticket_type_id: "ticket-1",
    status: "confirmed",
    participation_mode: "onsite",
    ticket_types: { id: "ticket-1", name: "Delegate" },
    ...overrides,
  }
}

function baseList(overrides: Record<string, unknown> = {}) {
  return {
    id: LIST_ID,
    name: "Main Entry",
    ticket_type_ids: [],
    addon_ids: [],
    starts_at: null,
    ends_at: null,
    ...overrides,
  }
}

describe("POST /api/checkin", () => {
  it("returns already_checked_in (never an error) when an active record already exists", async () => {
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    mock.queueResponse("checkin_records", { data: { checked_in_at: "2026-07-18T10:00:00Z" }, error: null })

    const { POST } = await import("./route")
    const res = await POST(
      makeRequest("http://localhost/api/checkin", {
        method: "POST",
        body: { event_id: EVENT_ID, checkin_list_id: LIST_ID, registration_id: REG_ID, action: "check_in" },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.action).toBe("already_checked_in")
  })

  it("treats a 23505 unique-violation race on insert as an idempotent success, not an error", async () => {
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // activeRecord: none
    mock.queueResponse("checkin_records", { data: null, error: null }) // previousRecord: none
    mock.queueResponse("checkin_records", { data: null, error: { code: "23505" } }) // insert races
    mock.queueResponse("checkin_records", { data: { checked_in_at: "2026-07-18T10:05:00Z" }, error: null }) // raced select

    const { POST } = await import("./route")
    const res = await POST(
      makeRequest("http://localhost/api/checkin", {
        method: "POST",
        body: { event_id: EVENT_ID, checkin_list_id: LIST_ID, registration_id: REG_ID, action: "check_in" },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.action).toBe("already_checked_in")
  })

  it("rejects a ticket type not allowed for the list with a 400", async () => {
    mock.queueResponse("registrations", { data: baseRegistration({ ticket_type_id: "ticket-1" }), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: ["ticket-2"] }), error: null })

    const { POST } = await import("./route")
    const res = await POST(
      makeRequest("http://localhost/api/checkin", {
        method: "POST",
        body: { event_id: EVENT_ID, checkin_list_id: LIST_ID, registration_id: REG_ID, action: "check_in" },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/not allowed/)
  })

  it("allows an unrestricted list (no ticket_type_ids) to proceed to a fresh check-in", async () => {
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ ticket_type_ids: [] }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null }) // activeRecord: none
    mock.queueResponse("checkin_records", { data: null, error: null }) // previousRecord: none
    mock.queueResponse("checkin_records", { data: { id: "rec-1", checked_in_at: "2026-07-18T10:10:00Z" }, error: null }) // insert
    mock.queueResponse("registrations", { data: null, error: null }) // sync update (bare awaited, no maybeSingle)

    const { POST } = await import("./route")
    const res = await POST(
      makeRequest("http://localhost/api/checkin", {
        method: "POST",
        body: { event_id: EVENT_ID, checkin_list_id: LIST_ID, registration_id: REG_ID, action: "check_in" },
      })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.action).toBe("checked_in")
  })

  it("attaches a non-blocking time-window warning on success, and omits it when no window is configured", async () => {
    // Outside window: starts_at in the future.
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList({ starts_at: "2099-01-01T00:00:00Z" }), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("checkin_records", { data: { id: "rec-2", checked_in_at: "2026-07-18T10:15:00Z" }, error: null })
    mock.queueResponse("registrations", { data: null, error: null })

    const { POST } = await import("./route")
    const outsideRes = await POST(
      makeRequest("http://localhost/api/checkin", {
        method: "POST",
        body: { event_id: EVENT_ID, checkin_list_id: LIST_ID, registration_id: REG_ID, action: "check_in" },
      })
    )
    const outsideBody = await outsideRes.json()
    expect(outsideBody.warning).toMatch(/Early check-in/)

    // Within window (no window configured): warning must be absent.
    mock = createSupabaseMock()
    mock.queueResponse("registrations", { data: baseRegistration(), error: null })
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("checkin_records", { data: null, error: null })
    mock.queueResponse("checkin_records", { data: { id: "rec-3", checked_in_at: "2026-07-18T10:20:00Z" }, error: null })
    mock.queueResponse("registrations", { data: null, error: null })

    const withinRes = await POST(
      makeRequest("http://localhost/api/checkin", {
        method: "POST",
        body: { event_id: EVENT_ID, checkin_list_id: LIST_ID, registration_id: REG_ID, action: "check_in" },
      })
    )
    const withinBody = await withinRes.json()
    expect(withinBody.warning).toBeUndefined()
  })
})
