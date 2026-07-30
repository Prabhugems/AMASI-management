import { describe, it, expect } from "vitest"
import { computeStationStatus } from "./kiosk-station-status"

const NOON = new Date("2026-07-29T12:00:00.000Z")

describe("computeStationStatus", () => {
  it("is revoked when revoked_at is set, regardless of last_seen_at", () => {
    expect(computeStationStatus({
      revoked_at: "2026-07-29T11:00:00.000Z",
      last_seen_at: "2026-07-29T11:59:59.000Z", // 1 second ago, would otherwise be online
    }, NOON)).toBe("revoked")
  })

  it("is revoked even with a null last_seen_at", () => {
    expect(computeStationStatus({
      revoked_at: "2026-07-29T11:00:00.000Z",
      last_seen_at: null,
    }, NOON)).toBe("revoked")
  })

  it("is pending when never connected and not revoked", () => {
    expect(computeStationStatus({
      revoked_at: null,
      last_seen_at: null,
    }, NOON)).toBe("pending")
  })

  it("is online when last seen 5 minutes ago", () => {
    expect(computeStationStatus({
      revoked_at: null,
      last_seen_at: "2026-07-29T11:55:00.000Z",
    }, NOON)).toBe("online")
  })

  it("is online exactly at the 15 minute boundary (elapsed == threshold)", () => {
    expect(computeStationStatus({
      revoked_at: null,
      last_seen_at: "2026-07-29T11:45:00.000Z",
    }, NOON)).toBe("online")
  })

  it("is quiet one second past the 15 minute boundary", () => {
    expect(computeStationStatus({
      revoked_at: null,
      last_seen_at: "2026-07-29T11:44:59.000Z",
    }, NOON)).toBe("quiet")
  })

  it("is quiet when last seen 20 minutes ago", () => {
    expect(computeStationStatus({
      revoked_at: null,
      last_seen_at: "2026-07-29T11:40:00.000Z",
    }, NOON)).toBe("quiet")
  })
})
