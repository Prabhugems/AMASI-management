import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"
import { makeRequest } from "@/test/helpers/request"

const EVENT_ID = "11111111-1111-1111-1111-111111111111"
const LIST_ID = "22222222-2222-2222-2222-222222222222"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => mock.client,
}))

vi.mock("@/lib/auth/api-auth", () => ({
  requireEventAndPermission: vi.fn(async () => ({ user: { id: "admin-1" }, error: null })),
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

describe("GET /api/kiosk-stations", () => {
  it("400s on a missing or invalid event_id", async () => {
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations?event_id=not-a-uuid`))
    expect(res.status).toBe(400)
  })

  it("lists stations for the event, never exposing access_token_hash", async () => {
    mock.queueResponse("kiosk_stations", {
      data: [{ id: "st-1", event_id: EVENT_ID, name: "Front Desk", mode: "checkin", list_id: LIST_ID, last_seen_at: null, revoked_at: null, created_at: "2026-07-27T00:00:00Z" }],
      error: null,
    })
    const { GET } = await import("./route")
    const res = await GET(makeRequest(`http://localhost/api/kiosk-stations?event_id=${EVENT_ID}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.stations).toHaveLength(1)
    expect(body.stations[0].access_token_hash).toBeUndefined()
    // Pins the security property: the select must not even ask for the hash.
    expect(mock.calls.some((c) => c.table === "kiosk_stations" && c.method === "select" && String(c.args[0]).includes("access_token_hash"))).toBe(false)
  })
})

describe("POST /api/kiosk-stations", () => {
  it("400s on a missing name", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", { method: "POST", body: { event_id: EVENT_ID, list_id: LIST_ID, name: "" } }))
    expect(res.status).toBe(400)
  })

  it("404s when the target list doesn't belong to this event", async () => {
    mock.queueResponse("checkin_lists", { data: { id: LIST_ID, event_id: "99999999-9999-9999-9999-999999999999" }, error: null })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", { method: "POST", body: { event_id: EVENT_ID, list_id: LIST_ID, name: "Front Desk" } }))
    expect(res.status).toBe(404)
  })

  it("creates a station and returns the plaintext token exactly once", async () => {
    mock.queueResponse("checkin_lists", { data: { id: LIST_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, name: "Front Desk", mode: "checkin", list_id: LIST_ID, created_at: "2026-07-27T00:00:00Z" },
      error: null,
    })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", { method: "POST", body: { event_id: EVENT_ID, list_id: LIST_ID, name: "Front Desk" } }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.access_token).toMatch(/^[0-9a-f]{48}$/)
    expect(body.mode).toBe("checkin")
    // The insert must store a hash, never the plaintext.
    const insertCall = mock.calls.find((c) => c.table === "kiosk_stations" && c.method === "insert")
    expect((insertCall!.args[0] as any).access_token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect((insertCall!.args[0] as any).access_token).toBeUndefined()
  })
})

const USB_PRINT_STATION_ID = "99999999-9999-9999-9999-999999999999"

describe("POST /api/kiosk-stations -- checkin_and_print mode", () => {
  it("creates a checkin_and_print station when print_station_id resolves to a usb-type Print Station in the same event", async () => {
    mock.queueResponse("checkin_lists", { data: { id: LIST_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("print_stations", {
      data: { id: USB_PRINT_STATION_ID, event_id: EVENT_ID, print_settings: { printer_type: "usb" } },
      error: null,
    })
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: EVENT_ID, name: "Front Desk", mode: "checkin_and_print", list_id: LIST_ID, print_station_id: USB_PRINT_STATION_ID, auto_print_badge: true, created_at: "2026-07-28T00:00:00Z" },
      error: null,
    })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", {
      method: "POST",
      body: { event_id: EVENT_ID, list_id: LIST_ID, name: "Front Desk", mode: "checkin_and_print", print_station_id: USB_PRINT_STATION_ID, auto_print_badge: true },
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.mode).toBe("checkin_and_print")
    const insertCall = mock.calls.find((c) => c.table === "kiosk_stations" && c.method === "insert")
    expect((insertCall!.args[0] as any).mode).toBe("checkin_and_print")
    expect((insertCall!.args[0] as any).print_station_id).toBe(USB_PRINT_STATION_ID)
    expect((insertCall!.args[0] as any).auto_print_badge).toBe(true)
  })

  it("400s when mode is checkin_and_print but print_station_id is missing", async () => {
    mock.queueResponse("checkin_lists", { data: { id: LIST_ID, event_id: EVENT_ID }, error: null })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", {
      method: "POST",
      body: { event_id: EVENT_ID, list_id: LIST_ID, name: "Front Desk", mode: "checkin_and_print" },
    }))
    expect(res.status).toBe(400)
  })

  it("404s when print_station_id belongs to a different event", async () => {
    mock.queueResponse("checkin_lists", { data: { id: LIST_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("print_stations", {
      data: { id: USB_PRINT_STATION_ID, event_id: "88888888-8888-8888-8888-888888888888", print_settings: { printer_type: "usb" } },
      error: null,
    })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", {
      method: "POST",
      body: { event_id: EVENT_ID, list_id: LIST_ID, name: "Front Desk", mode: "checkin_and_print", print_station_id: USB_PRINT_STATION_ID },
    }))
    expect(res.status).toBe(404)
  })

  it("400s when the linked Print Station isn't printer_type usb", async () => {
    mock.queueResponse("checkin_lists", { data: { id: LIST_ID, event_id: EVENT_ID }, error: null })
    mock.queueResponse("print_stations", {
      data: { id: USB_PRINT_STATION_ID, event_id: EVENT_ID, print_settings: { printer_type: "zebra" } },
      error: null,
    })
    const { POST } = await import("./route")
    const res = await POST(makeRequest("http://localhost/api/kiosk-stations", {
      method: "POST",
      body: { event_id: EVENT_ID, list_id: LIST_ID, name: "Front Desk", mode: "checkin_and_print", print_station_id: USB_PRINT_STATION_ID },
    }))
    expect(res.status).toBe(400)
  })
})
