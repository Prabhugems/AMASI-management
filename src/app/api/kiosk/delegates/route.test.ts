import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-1111-1111-111111111111"
const LIST_ID = "22222222-2222-2222-2222-222222222222"
const TOKEN = "test-access-token-abc123"

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
    // event-wide, no ticket_type_ids/addon_ids filter -- must match
    // /api/kiosk/checkin's existing scope exactly.
    expect(mock.calls.some((c) => c.table === "registrations" && c.method === "in")).toBe(false)
  })

  it("500s if the registrations query errors", async () => {
    mock.queueResponse("checkin_lists", { data: baseList(), error: null })
    mock.queueResponse("registrations", { data: null, error: { message: "boom" } })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(url({ event_id: EVENT_ID, token: TOKEN })))
    expect(res.status).toBe(500)
  })
})
