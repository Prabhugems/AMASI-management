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
  // Deliberately permissive: if a future edit reverts this route to bare
  // getApiUser() instead of requireEventAndPermission(), this mock would let
  // it through — exactly the regression PR #108 fixed on this route.
  getApiUser: vi.fn().mockResolvedValue({ user: { id: "u1", platform_role: "member", is_super_admin: false }, error: null }),
  requireEventAndPermission: (...args: unknown[]) => requireEventAndPermissionMock(...args),
}))

beforeEach(() => {
  mock = createSupabaseMock()
  requireEventAndPermissionMock = vi.fn().mockResolvedValue({ user: { id: "u1" }, error: null })
})

describe("GET /api/checkin/stats", () => {
  it("excludes registrations outside the list's ticket_type_ids from the eligible total", async () => {
    mock.queueResponse("checkin_lists", {
      data: { id: LIST_ID, name: "Main Entry", description: null, addon_ids: [], ticket_type_ids: ["allowed-id"], access_token: "tok", access_token_expires_at: null },
      error: null,
    })
    mock.queueResponse("registrations", { data: [{ id: "r1", ticket_type_id: "allowed-id" }], error: null })
    mock.queueResponse("checkin_records", { data: [], error: null }) // activeCheckins
    mock.queueResponse("ticket_types", { data: [{ id: "allowed-id", name: "Delegate" }], error: null })
    mock.queueResponse("checkin_records", { data: [], error: null }) // recentCheckins
    mock.queueResponse("checkin_records", { data: [], error: null }) // todayCheckins

    const { GET } = await import("./route")
    const res = await GET(
      makeRequest(`http://localhost/api/checkin/stats?event_id=${EVENT_ID}&checkin_list_id=${LIST_ID}`)
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.total).toBe(1)

    const eligibilityFilter = mock.calls.find(
      (c) => c.table === "registrations" && c.method === "in" && c.args[0] === "ticket_type_id"
    )
    expect(eligibilityFilter).toBeDefined()
    expect(eligibilityFilter!.args[1]).toEqual(["allowed-id"])
  })

  it("is gated by requireEventAndPermission, not just any authenticated user", async () => {
    requireEventAndPermissionMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Forbidden - You do not have access to this event" }, { status: 403 }),
    })

    const { GET } = await import("./route")
    const res = await GET(
      makeRequest(`http://localhost/api/checkin/stats?event_id=${EVENT_ID}&checkin_list_id=${LIST_ID}`)
    )

    expect(res.status).toBe(403)
    expect(requireEventAndPermissionMock).toHaveBeenCalledWith(EVENT_ID, "checkin")
    // No DB call should have happened before the auth check rejected the request.
    expect(mock.calls.length).toBe(0)
  })
})
