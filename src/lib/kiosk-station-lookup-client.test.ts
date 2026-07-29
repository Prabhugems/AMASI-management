import { describe, it, expect } from "vitest"
import { resolveStationName } from "./kiosk-station-lookup-client"
import type { CachedStationName } from "./kiosk-offline-store"

const STATIONS: CachedStationName[] = [
  { id: "st-1", name: "Front Desk" },
  { id: "st-2", name: "VIP Lounge" },
]

describe("resolveStationName", () => {
  it("returns 'collected earlier' when stationId is null", () => {
    expect(resolveStationName(null, STATIONS)).toBe("collected earlier")
  })

  it("returns 'collected earlier' when stationId doesn't match any cached station", () => {
    expect(resolveStationName("st-999", STATIONS)).toBe("collected earlier")
  })

  it("returns the matching station's exact cached name", () => {
    expect(resolveStationName("st-2", STATIONS)).toBe("VIP Lounge")
  })

  it("returns 'collected earlier' for a non-null stationId against an empty cache, not a crash or undefined", () => {
    expect(resolveStationName("st-1", [])).toBe("collected earlier")
  })
})
