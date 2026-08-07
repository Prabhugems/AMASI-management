import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

// Zod 4 validates the UUID version/variant nibbles, so fixtures must be real
// v4 shapes (13th digit 4, 17th in 8/9/a/b) or every request 400s.
const EVENT_ID = "11111111-1111-4111-8111-111111111111"
const OTHER_EVENT = "99999999-9999-4999-8999-999999999999"
const SESSION_ID = "22222222-2222-4222-8222-222222222222"
const OTHER_SESSION = "44444444-4444-4444-8444-444444444444"
const TALK_ID = "33333333-3333-4333-8333-333333333333"

let mock: ReturnType<typeof createSupabaseMock>
let requireEventAndPermissionMock: any

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))

vi.mock("@/lib/auth/api-auth", () => ({
  getApiUser: vi.fn().mockResolvedValue({ user: { id: "u1" }, error: null }),
  requireEventAndPermission: (...args: unknown[]) => requireEventAndPermissionMock(...args),
}))

const params = (eventId = EVENT_ID) => ({ params: Promise.resolve({ eventId }) })

beforeEach(() => {
  mock = createSupabaseMock()
  requireEventAndPermissionMock = vi.fn().mockResolvedValue({ user: { id: "u1" }, error: null })
})

const put = async (body: unknown) => {
  const { PUT } = await import("./route")
  return PUT(
    makeRequest("http://localhost/api/events/x/role-requirements", { method: "PUT", body }),
    params()
  )
}

describe("GET /api/events/[eventId]/role-requirements", () => {
  it("is gated on the programme permission", async () => {
    requireEventAndPermissionMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    })

    const { GET } = await import("./route")
    const res = await GET(makeRequest("http://localhost/api/events/x/role-requirements"), params())

    expect(res.status).toBe(403)
    expect(mock.calls.length).toBe(0)
  })

  it("scopes through the event's own sessions, and pages both reads", async () => {
    // The table carries no event_id of its own, so scoping has to come from
    // the session list — which is itself over the 1,000-row cap on one event.
    mock.queueResponse("sessions", { data: [{ id: SESSION_ID }], error: null })
    mock.queueResponse("session_role_requirements", { data: [{ id: "r1" }], error: null })

    const { GET } = await import("./route")
    const res = await GET(makeRequest("http://localhost/api/events/x/role-requirements"), params())

    expect(res.status).toBe(200)
    expect(mock.calls).toContainEqual({ table: "sessions", method: "eq", args: ["event_id", EVENT_ID] })
    expect(mock.calls).toContainEqual({
      table: "session_role_requirements",
      method: "in",
      args: ["session_id", [SESSION_ID]],
    })
    expect(mock.calls.filter((c) => c.method === "range").length).toBe(2)
  })

  it("returns nothing for an event with no sessions instead of an unscoped read", async () => {
    mock.queueResponse("sessions", { data: [], error: null })

    const { GET } = await import("./route")
    const res = await GET(makeRequest("http://localhost/api/events/x/role-requirements"), params())

    expect((await res.json()).data).toEqual([])
    expect(mock.calls.some((c) => c.table === "session_role_requirements")).toBe(false)
  })
})

describe("PUT /api/events/[eventId]/role-requirements", () => {
  it("refuses a block from another event", async () => {
    mock.queueResponse("sessions", { data: { id: SESSION_ID, event_id: OTHER_EVENT }, error: null })

    const res = await put({
      session_id: SESSION_ID,
      requirements: [{ role: "chairperson", required_count: 1 }],
    })

    expect(res.status).toBe(404)
    expect(mock.calls.some((c) => c.table === "session_role_requirements")).toBe(false)
  })

  it("refuses a talk that belongs to a different block in the same event", async () => {
    // Event-scoping alone is not enough: a requirement must not be hung on a
    // talk from another block.
    mock.queueResponse("sessions", { data: { id: SESSION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("talks", {
      data: { id: TALK_ID, session_id: OTHER_SESSION, event_id: EVENT_ID },
      error: null,
    })

    const res = await put({
      session_id: SESSION_ID,
      talk_id: TALK_ID,
      requirements: [{ role: "speaker", required_count: 1 }],
    })

    expect(res.status).toBe(404)
    expect(mock.calls.some((c) => c.table === "session_role_requirements")).toBe(false)
  })

  it("rejects the same role listed twice rather than surfacing a 23505", async () => {
    const res = await put({
      session_id: SESSION_ID,
      requirements: [
        { role: "speaker", required_count: 1 },
        { role: "speaker", required_count: 2 },
      ],
    })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Each role can only be listed once")
    expect(mock.calls.length).toBe(0)
  })

  it("rejects a role outside the shared vocabulary", async () => {
    const res = await put({
      session_id: SESSION_ID,
      requirements: [{ role: "co-chair", required_count: 1 }],
    })
    expect(res.status).toBe(400)
  })

  it("matches block-level rows with IS NULL, not eq(null)", async () => {
    // `.eq("talk_id", null)` matches nothing in Postgres, so the delete would
    // silently no-op and the insert would then collide with the old rows.
    mock.queueResponse("sessions", { data: { id: SESSION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("session_role_requirements", { data: null, error: null })
    mock.queueResponse("session_role_requirements", { data: [{ id: "r1" }], error: null })

    await put({ session_id: SESSION_ID, requirements: [{ role: "chairperson", required_count: 2 }] })

    expect(mock.calls).toContainEqual({
      table: "session_role_requirements",
      method: "is",
      args: ["talk_id", null],
    })
  })

  it("replaces the set, so an omitted role is a removed role", async () => {
    mock.queueResponse("sessions", { data: { id: SESSION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("session_role_requirements", { data: null, error: null })
    mock.queueResponse("session_role_requirements", { data: [{ id: "r1" }], error: null })

    const res = await put({
      session_id: SESSION_ID,
      requirements: [{ role: "chairperson", required_count: 2 }],
    })

    expect(res.status).toBe(200)
    const del = mock.calls.find((c) => c.table === "session_role_requirements" && c.method === "delete")
    const ins = mock.calls.find((c) => c.table === "session_role_requirements" && c.method === "insert")
    expect(del).toBeDefined()
    expect(ins!.args[0]).toEqual([
      { session_id: SESSION_ID, talk_id: null, role: "chairperson", required_count: 2, notes: null },
    ])
  })

  it("clears the set when given an empty list, without inserting", async () => {
    mock.queueResponse("sessions", { data: { id: SESSION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("session_role_requirements", { data: null, error: null })

    const res = await put({ session_id: SESSION_ID, requirements: [] })

    expect(res.status).toBe(200)
    expect(
      mock.calls.some((c) => c.table === "session_role_requirements" && c.method === "insert")
    ).toBe(false)
  })

  it("accepts required_count 0 — an explicit 'needs no chair'", async () => {
    // Distinct from having no row at all, which means never declared.
    mock.queueResponse("sessions", { data: { id: SESSION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("session_role_requirements", { data: null, error: null })
    mock.queueResponse("session_role_requirements", { data: [{ id: "r1" }], error: null })

    const res = await put({
      session_id: SESSION_ID,
      requirements: [{ role: "chairperson", required_count: 0 }],
    })

    expect(res.status).toBe(200)
    const ins = mock.calls.find((c) => c.table === "session_role_requirements" && c.method === "insert")
    expect((ins!.args[0] as any[])[0].required_count).toBe(0)
  })

  it("scopes the talk-level delete to that talk", async () => {
    mock.queueResponse("sessions", { data: { id: SESSION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("talks", { data: { id: TALK_ID, session_id: SESSION_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("session_role_requirements", { data: null, error: null })
    mock.queueResponse("session_role_requirements", { data: [{ id: "r1" }], error: null })

    await put({
      session_id: SESSION_ID,
      talk_id: TALK_ID,
      requirements: [{ role: "panelist", required_count: 6 }],
    })

    expect(mock.calls).toContainEqual({
      table: "session_role_requirements",
      method: "eq",
      args: ["talk_id", TALK_ID],
    })
    const ins = mock.calls.find((c) => c.table === "session_role_requirements" && c.method === "insert")
    expect((ins!.args[0] as any[])[0].talk_id).toBe(TALK_ID)
  })
})
