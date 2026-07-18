import { describe, it, expect, vi, beforeEach } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const ACCESS_TOKEN = "staff-access-token-abc123"
const SECURE_TOKEN = "a".repeat(32) // >= 32 chars => treated as a secure checkin_token
const LIST_ID = "22222222-2222-2222-2222-222222222222"
const EVENT_A = "11111111-1111-1111-1111-111111111111"
const EVENT_B = "99999999-9999-9999-9999-999999999999"
const REG_ID = "33333333-3333-3333-3333-333333333333"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

function baseCheckinList(overrides: Record<string, unknown> = {}) {
  return {
    id: LIST_ID,
    event_id: EVENT_A,
    name: "Main Entry",
    access_token_expires_at: null,
    starts_at: null,
    ends_at: null,
    ...overrides,
  }
}

describe("POST /api/verify/[token]", () => {
  it("returns already_checked_in (never an error) for a repeat scan — this route's own idempotency implementation", async () => {
    mock.queueResponse("checkin_lists", { data: baseCheckinList(), error: null })
    mock.queueResponse("registrations", {
      data: {
        id: REG_ID,
        registration_number: "REG-001",
        attendee_name: "Jane Doe",
        status: "confirmed",
        event_id: EVENT_A,
        ticket_types: { id: "t1", name: "Delegate" },
        events: { id: EVENT_A, name: "AMASICON" },
      },
      error: null,
    })
    mock.queueResponse("checkin_records", { data: { id: "rec-1", checked_in_at: "2026-07-18T10:00:00Z" }, error: null })

    const { POST } = await import("./route")
    const res = await POST(
      makeRequest(`http://localhost/api/verify/${SECURE_TOKEN}`, {
        method: "POST",
        body: { access_token: ACCESS_TOKEN, action: "check_in" },
      }),
      { params: Promise.resolve({ token: SECURE_TOKEN }) }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.action).toBe("already_checked_in")
    expect(body.alreadyCheckedIn).toBe(true)
  })

  it("rejects a badge from a different event with error_code wrong_event, and logs the failure", async () => {
    mock.queueResponse("checkin_lists", { data: baseCheckinList({ event_id: EVENT_A }), error: null })
    mock.queueResponse("registrations", {
      data: {
        id: REG_ID,
        registration_number: "REG-002",
        attendee_name: "John Roe",
        status: "confirmed",
        event_id: EVENT_B, // different event than the access token's list
        ticket_types: { id: "t1", name: "Delegate" },
        events: { id: EVENT_B, name: "Other Conference" },
      },
      error: null,
    })

    const { POST } = await import("./route")
    const res = await POST(
      makeRequest(`http://localhost/api/verify/${SECURE_TOKEN}`, {
        method: "POST",
        body: { access_token: ACCESS_TOKEN, action: "check_in" },
      }),
      { params: Promise.resolve({ token: SECURE_TOKEN }) }
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error_code).toBe("wrong_event")

    const auditInsert = mock.calls.find((c) => c.table === "checkin_audit_log" && c.method === "insert")
    expect(auditInsert).toBeDefined()
    expect((auditInsert!.args[0] as { success: boolean }).success).toBe(false)
  })
})
