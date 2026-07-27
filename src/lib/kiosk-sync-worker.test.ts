import { describe, it, expect } from "vitest"
import { computeBackoffMs } from "./kiosk-sync-worker"

describe("computeBackoffMs", () => {
  it("starts at 1 second on the first attempt", () => {
    expect(computeBackoffMs(0)).toBe(1000)
  })

  it("doubles with each attempt", () => {
    expect(computeBackoffMs(1)).toBe(2000)
    expect(computeBackoffMs(2)).toBe(4000)
    expect(computeBackoffMs(3)).toBe(8000)
  })

  it("caps at 30 seconds so a long outage doesn't leave a multi-minute gap", () => {
    expect(computeBackoffMs(10)).toBe(30000)
    expect(computeBackoffMs(100)).toBe(30000)
  })
})
