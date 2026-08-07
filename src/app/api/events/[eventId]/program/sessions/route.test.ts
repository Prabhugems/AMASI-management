import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-4111-8111-111111111111"
const OTHER_EVENT = "99999999-9999-4999-8999-999999999999"
const SESSION_ID = "22222222-2222-4222-8222-222222222222"
const HALL_ID = "55555555-5555-4555-8555-555555555555"

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

const post = async (body: unknown) => {
  const { POST } = await import("./route")
  return POST(
    makeRequest("http://localhost/api/events/x/program/sessions", { method: "POST", body }),
    params()
  )
}

describe("GET /api/events/[eventId]/program/sessions", () => {
  it("is gated on the programme permission", async () => {
    requireEventAndPermissionMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    })

    const { GET } = await import("./route")
    const res = await GET(makeRequest("http://localhost/api/events/x/program/sessions"), params())

    expect(res.status).toBe(403)
    expect(mock.calls.length).toBe(0)
  })

  it("pages the read — one archived event holds 1,195 sessions", async () => {
    // Unpaged, that event returns 1,000 rows and says nothing, and the Session
    // Builder renders a programme missing 195 blocks.
    mock.queueResponse("sessions", { data: [{ id: SESSION_ID }], error: null })

    const { GET } = await import("./route")
    const res = await GET(makeRequest("http://localhost/api/events/x/program/sessions"), params())

    expect(res.status).toBe(200)
    expect(mock.calls).toContainEqual({ table: "sessions", method: "eq", args: ["event_id", EVENT_ID] })
    expect(mock.calls.some((c) => c.table === "sessions" && c.method === "range")).toBe(true)
  })
})

describe("POST /api/events/[eventId]/program/sessions", () => {
  it("refuses a location belonging to another event", async () => {
    mock.queueResponse("halls", { data: { id: HALL_ID, event_id: OTHER_EVENT }, error: null })

    const res = await post({ session_name: "GALL BLADDER", hall_id: HALL_ID })

    expect(res.status).toBe(400)
    expect(mock.calls.some((c) => c.table === "sessions" && c.method === "insert")).toBe(false)
  })

  it("seeds the roster from the session type", async () => {
    // The mechanism that makes each event cheaper to set up than the last: a
    // symposium arrives already asking for 2 chairs and 4 speakers.
    mock.queueResponse("sessions", { data: { id: SESSION_ID }, error: null })
    mock.queueResponse("session_role_requirements", {
      data: [{ id: "r1" }, { id: "r2" }],
      error: null,
    })

    const res = await post({ session_name: "GALL BLADDER", session_type: "symposium" })

    expect(res.status).toBe(201)
    expect((await res.json()).seeded_requirements).toBe(2)

    const ins = mock.calls.find(
      (c) => c.table === "session_role_requirements" && c.method === "insert"
    )
    expect(ins!.args[0]).toEqual([
      { session_id: SESSION_ID, talk_id: null, role: "speaker", required_count: 4 },
      { session_id: SESSION_ID, talk_id: null, role: "chairperson", required_count: 2 },
    ])
  })

  it("seeds nothing for a session type that needs nobody", async () => {
    mock.queueResponse("sessions", { data: { id: SESSION_ID }, error: null })

    const res = await post({ session_name: "LUNCH", session_type: "break" })

    expect(res.status).toBe(201)
    expect((await res.json()).seeded_requirements).toBe(0)
    expect(mock.calls.some((c) => c.table === "session_role_requirements")).toBe(false)
  })

  it("seeds nothing for an unrecognised type rather than inheriting another roster", async () => {
    mock.queueResponse("sessions", { data: { id: SESSION_ID }, error: null })

    const res = await post({ session_name: "Fireside", session_type: "fireside_chat" })

    expect((await res.json()).seeded_requirements).toBe(0)
  })

  it("honours seed_roster: false", async () => {
    mock.queueResponse("sessions", { data: { id: SESSION_ID }, error: null })

    const res = await post({
      session_name: "Imported block",
      session_type: "symposium",
      seed_roster: false,
    })

    expect((await res.json()).seeded_requirements).toBe(0)
    expect(mock.calls.some((c) => c.table === "session_role_requirements")).toBe(false)
  })

  it("keeps the block when seeding fails, rather than losing both", async () => {
    // A roster the coordinator can re-add is a nuisance; a block that vanished
    // because of it is not.
    mock.queueResponse("sessions", { data: { id: SESSION_ID }, error: null })
    mock.queueResponse("session_role_requirements", { data: null, error: { message: "boom" } })

    const res = await post({ session_name: "GALL BLADDER", session_type: "symposium" })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe(SESSION_ID)
    expect(body.seeded_requirements).toBe(0)
  })

  it("never lets the caller set event_id", async () => {
    mock.queueResponse("sessions", { data: { id: SESSION_ID }, error: null })

    await post({ session_name: "Block", event_id: OTHER_EVENT })

    const ins = mock.calls.find((c) => c.table === "sessions" && c.method === "insert")
    expect((ins!.args[0] as any).event_id).toBe(EVENT_ID)
  })

  it("rejects a nameless block", async () => {
    const res = await post({ session_name: "" })
    expect(res.status).toBe(400)
    expect(mock.calls.length).toBe(0)
  })
})
