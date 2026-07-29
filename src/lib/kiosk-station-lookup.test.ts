import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/helpers/supabase-mock"

let mock: ReturnType<typeof createSupabaseMock>

vi.mock("@/lib/kiosk-station-auth", () => ({
  hashStationToken: (token: string) => `hashed:${token}`,
}))

beforeEach(() => {
  mock = createSupabaseMock()
})

describe("resolveStationByToken", () => {
  it("queries kiosk_stations by the token's hash and returns the row", async () => {
    mock.queueResponse("kiosk_stations", {
      data: { id: "st-1", event_id: "ev-1", mode: "checkin", revoked_at: null },
      error: null,
    })
    const { resolveStationByToken } = await import("./kiosk-station-lookup")
    const { station, error } = await resolveStationByToken(mock.client, "plaintext-token")

    expect(error).toBeNull()
    expect(station).toEqual({ id: "st-1", event_id: "ev-1", mode: "checkin", revoked_at: null })
    expect(
      mock.calls.some((c) => c.table === "kiosk_stations" && c.method === "eq" && c.args[0] === "access_token_hash" && c.args[1] === "hashed:plaintext-token")
    ).toBe(true)
  })

  it("returns null station and no error on no match", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: null })
    const { resolveStationByToken } = await import("./kiosk-station-lookup")
    const { station, error } = await resolveStationByToken(mock.client, "wrong-token")
    expect(station).toBeNull()
    expect(error).toBeNull()
  })

  it("passes through a lookup error without throwing", async () => {
    mock.queueResponse("kiosk_stations", { data: null, error: { message: "boom" } })
    const { resolveStationByToken } = await import("./kiosk-station-lookup")
    const { error } = await resolveStationByToken(mock.client, "any-token")
    expect(error).toEqual({ message: "boom" })
  })
})

describe("stationServesList", () => {
  it("returns isMember true and no error when a kiosk_station_lists row exists for this pair", async () => {
    mock.queueResponse("kiosk_station_lists", { data: { station_id: "st-1" }, error: null })
    const { stationServesList } = await import("./kiosk-station-lookup")
    const result = await stationServesList(mock.client, "st-1", "list-1")
    expect(result).toEqual({ isMember: true, error: null })
    expect(mock.calls.some((c) => c.table === "kiosk_station_lists" && c.method === "eq" && c.args[0] === "checkin_list_id" && c.args[1] === "list-1")).toBe(true)
  })

  it("returns isMember false and no error when no membership row exists", async () => {
    mock.queueResponse("kiosk_station_lists", { data: null, error: null })
    const { stationServesList } = await import("./kiosk-station-lookup")
    const result = await stationServesList(mock.client, "st-1", "list-1")
    expect(result).toEqual({ isMember: false, error: null })
  })

  it("returns isMember false and passes through a query error without throwing, so a transient failure is distinguishable from a genuine miss", async () => {
    mock.queueResponse("kiosk_station_lists", { data: null, error: { message: "boom" } })
    const { stationServesList } = await import("./kiosk-station-lookup")
    const result = await stationServesList(mock.client, "st-1", "list-1")
    expect(result).toEqual({ isMember: false, error: { message: "boom" } })
  })
})
