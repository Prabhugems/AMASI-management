import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-1111-1111-111111111111"
const LIST_ID = "22222222-2222-2222-2222-222222222222"

let mock: ReturnType<typeof createSupabaseMock>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let requireEventAndPermissionMock: any

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))

vi.mock("@/lib/auth/api-auth", () => ({
  // Deliberately permissive — same regression-guard shape as
  // checkin/stats/route.test.ts: if this route reverts to bare getApiUser(),
  // this mock lets it through and the test below fails.
  getApiUser: vi.fn().mockResolvedValue({ user: { id: "u1", platform_role: "member", is_super_admin: false }, error: null }),
  requireEventAndPermission: (...args: unknown[]) => requireEventAndPermissionMock(...args),
}))

beforeEach(() => {
  mock = createSupabaseMock()
  requireEventAndPermissionMock = vi.fn().mockResolvedValue({ user: { id: "u1" }, error: null })
})

describe("GET /api/checkin-lists", () => {
  it("is gated by requireEventAndPermission — an out-of-scope caller never sees access_token data", async () => {
    requireEventAndPermissionMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Forbidden - You do not have access to this event" }, { status: 403 }),
    })

    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/checkin-lists?event_id=${EVENT_ID}`))

    expect(res.status).toBe(403)
    expect(requireEventAndPermissionMock).toHaveBeenCalledWith(EVENT_ID, "checkin")
    expect(mock.calls.length).toBe(0)
  })
})

describe("POST /api/checkin-lists", () => {
  it("creates a list with kiosk schedule fields persisted on the insert call", async () => {
    // Queued in the order the route hits "checkin_lists": (1) max sort_order
    // lookup, then (2) the events.end_date lookup for access_token_expires_at,
    // then (3) the insert().select().single() result.
    mock.queueResponse("checkin_lists", { data: [{ sort_order: 2 }], error: null })
    mock.queueResponse("events", { data: { end_date: "2026-08-01T00:00:00Z" }, error: null })
    mock.queueResponse("checkin_lists", {
      data: { id: LIST_ID, event_id: EVENT_ID, name: "Lunch", list_purpose: "collection" },
      error: null,
    })

    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/checkin-lists", {
      method: "POST",
      body: {
        event_id: EVENT_ID,
        name: "Lunch",
        list_purpose: "collection",
        kiosk_opens_at: "2026-08-01T09:00:00Z",
        kiosk_closes_at: "2026-08-01T11:00:00Z",
        kiosk_force_state: "open",
      },
    }))

    expect(res.status).toBe(200)
    const insertCall = mock.calls.find((c) => c.table === "checkin_lists" && c.method === "insert")
    expect(insertCall).toBeTruthy()
    expect((insertCall!.args[0] as any).kiosk_opens_at).toBe("2026-08-01T09:00:00Z")
    expect((insertCall!.args[0] as any).kiosk_closes_at).toBe("2026-08-01T11:00:00Z")
    expect((insertCall!.args[0] as any).kiosk_force_state).toBe("open")
  })
})

describe("PUT /api/checkin-lists", () => {
  it("400s when kiosk_force_state is neither open, closed, nor null", async () => {
    const { PUT } = await import("./route")
    const res = await PUT(makeRequest("http://localhost/api/checkin-lists", {
      method: "PUT",
      body: { id: LIST_ID, kiosk_force_state: "sideways" },
    }))
    expect(res.status).toBe(400)
  })
})
