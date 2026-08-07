import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-4111-8111-111111111111"
const OTHER_EVENT = "99999999-9999-4999-8999-999999999999"
const SESSION_ID = "22222222-2222-4222-8222-222222222222"
const TALK_ID = "33333333-3333-4333-8333-333333333333"

let mock: ReturnType<typeof createSupabaseMock>
let requireEventAndPermissionMock: any

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))

vi.mock("@/lib/auth/api-auth", () => ({
  // Deliberately permissive: if the route ever drops to bare getApiUser(),
  // this lets it through and the authorisation test below fails loudly.
  getApiUser: vi.fn().mockResolvedValue({ user: { id: "u1" }, error: null }),
  requireEventAndPermission: (...args: unknown[]) => requireEventAndPermissionMock(...args),
}))

const params = (eventId = EVENT_ID) => ({ params: Promise.resolve({ eventId }) })

beforeEach(() => {
  mock = createSupabaseMock()
  requireEventAndPermissionMock = vi.fn().mockResolvedValue({ user: { id: "u1" }, error: null })
})

describe("GET /api/events/[eventId]/talks", () => {
  it("is gated on the programme permission", async () => {
    requireEventAndPermissionMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    })

    const { GET } = await import("./route")
    const res = await GET(makeRequest("http://localhost/api/events/x/talks"), params())

    expect(res.status).toBe(403)
    expect(requireEventAndPermissionMock).toHaveBeenCalledWith(EVENT_ID, "program")
    expect(mock.calls.length).toBe(0)
  })

  it("scopes to the event and pages the read", async () => {
    mock.queueResponse("talks", { data: [{ id: TALK_ID }], error: null })

    const { GET } = await import("./route")
    const res = await GET(makeRequest("http://localhost/api/events/x/talks"), params())

    expect(res.status).toBe(200)
    expect((await res.json()).data).toHaveLength(1)
    expect(mock.calls).toContainEqual({ table: "talks", method: "eq", args: ["event_id", EVENT_ID] })
    // fetchAllPages, not a bare await — an event over PostgREST's cap would
    // otherwise silently lose talks.
    expect(mock.calls.some((c) => c.table === "talks" && c.method === "range")).toBe(true)
  })

  it("filters to one block when session_id is given", async () => {
    mock.queueResponse("talks", { data: [], error: null })

    const { GET } = await import("./route")
    await GET(makeRequest(`http://localhost/api/events/x/talks?session_id=${SESSION_ID}`), params())

    expect(mock.calls).toContainEqual({ table: "talks", method: "eq", args: ["session_id", SESSION_ID] })
  })
})

describe("POST /api/events/[eventId]/talks", () => {
  it("refuses a block belonging to another event", async () => {
    // The core scoping rule: a talk must never be filed under another event's
    // session, even though the caller supplied a real session id.
    mock.queueResponse("sessions", { data: { id: SESSION_ID, event_id: OTHER_EVENT }, error: null })

    const { POST } = await import("./route")
    const res = await POST(
      makeRequest("http://localhost/api/events/x/talks", {
        method: "POST",
        body: { session_id: SESSION_ID, title: "Smuggled talk" },
      }),
      params()
    )

    expect(res.status).toBe(404)
    // Nothing was written.
    expect(mock.calls.some((c) => c.table === "talks" && c.method === "insert")).toBe(false)
  })

  it("derives event_id from the route, never from the caller", async () => {
    mock.queueResponse("sessions", { data: { id: SESSION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("talks", { data: null, error: null }) // no existing talks
    mock.queueResponse("talks", { data: { id: TALK_ID }, error: null })

    const { POST } = await import("./route")
    const res = await POST(
      makeRequest("http://localhost/api/events/x/talks", {
        method: "POST",
        // A caller trying to set event_id directly.
        body: { session_id: SESSION_ID, title: "Talk", event_id: OTHER_EVENT },
      }),
      params()
    )

    expect(res.status).toBe(201)
    const insert = mock.calls.find((c) => c.table === "talks" && c.method === "insert")
    expect((insert!.args[0] as any).event_id).toBe(EVENT_ID)
  })

  it("appends after the last talk in the block", async () => {
    mock.queueResponse("sessions", { data: { id: SESSION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("talks", { data: { display_order: 4 }, error: null })
    mock.queueResponse("talks", { data: { id: TALK_ID }, error: null })

    const { POST } = await import("./route")
    await POST(
      makeRequest("http://localhost/api/events/x/talks", {
        method: "POST",
        body: { session_id: SESSION_ID, title: "Talk" },
      }),
      params()
    )

    const insert = mock.calls.find((c) => c.table === "talks" && c.method === "insert")
    expect((insert!.args[0] as any).display_order).toBe(5)
  })

  it("rejects an unknown talk_type rather than storing it", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      makeRequest("http://localhost/api/events/x/talks", {
        method: "POST",
        body: { session_id: SESSION_ID, talk_type: "keynote-ish" },
      }),
      params()
    )

    expect(res.status).toBe(400)
    expect(mock.calls.length).toBe(0)
  })

  it("rejects a body with no session_id", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      makeRequest("http://localhost/api/events/x/talks", { method: "POST", body: { title: "Orphan" } }),
      params()
    )
    expect(res.status).toBe(400)
  })
})
