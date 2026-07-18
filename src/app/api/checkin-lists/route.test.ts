import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-1111-1111-111111111111"

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
