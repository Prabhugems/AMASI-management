import { describe, it, expect } from "vitest"
import { checkTimeWindow } from "./checkin-time-window"

describe("checkTimeWindow", () => {
  const now = new Date("2026-07-18T12:00:00Z")

  it("warns when scanned before starts_at", () => {
    const result = checkTimeWindow({ starts_at: "2026-07-19T00:00:00Z", ends_at: null }, now)
    expect(result.withinWindow).toBe(false)
    expect(result.warning).toMatch(/Early check-in/)
  })

  it("warns when scanned after ends_at", () => {
    const result = checkTimeWindow({ starts_at: null, ends_at: "2026-07-17T00:00:00Z" }, now)
    expect(result.withinWindow).toBe(false)
    expect(result.warning).toMatch(/Late check-in/)
  })

  it("never warns when starts_at and ends_at are both null", () => {
    const result = checkTimeWindow({ starts_at: null, ends_at: null }, now)
    expect(result.withinWindow).toBe(true)
    expect(result.warning).toBeNull()
  })

  it("does not warn when scanned inside the window", () => {
    const result = checkTimeWindow(
      { starts_at: "2026-07-17T00:00:00Z", ends_at: "2026-07-19T00:00:00Z" },
      now
    )
    expect(result.withinWindow).toBe(true)
    expect(result.warning).toBeNull()
  })
})
