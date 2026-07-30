import { describe, it, expect } from "vitest"
import { computeSessionCheckinWindow } from "./agenda-session-checkin-window"

describe("computeSessionCheckinWindow", () => {
  it("converts a session's local date/time in Asia/Kolkata (UTC+5:30, no DST) to UTC with a 15-minute default grace buffer", () => {
    const result = computeSessionCheckinWindow(
      { session_date: "2026-08-15", start_time: "09:00", end_time: "10:00" },
      "Asia/Kolkata"
    )
    // 09:00 IST = 03:30 UTC; opens 15 min early = 03:15 UTC
    expect(result.opensAt).toBe("2026-08-15T03:15:00.000Z")
    // 10:00 IST = 04:30 UTC; closes 15 min late = 04:45 UTC
    expect(result.closesAt).toBe("2026-08-15T04:45:00.000Z")
  })

  it("respects a custom grace buffer", () => {
    const result = computeSessionCheckinWindow(
      { session_date: "2026-08-15", start_time: "09:00", end_time: "10:00" },
      "Asia/Kolkata",
      30
    )
    expect(result.opensAt).toBe("2026-08-15T03:00:00.000Z")
    expect(result.closesAt).toBe("2026-08-15T05:00:00.000Z")
  })

  it("works for UTC directly (zero offset)", () => {
    const result = computeSessionCheckinWindow(
      { session_date: "2026-08-15", start_time: "09:00", end_time: "10:00" },
      "UTC",
      0
    )
    expect(result.opensAt).toBe("2026-08-15T09:00:00.000Z")
    expect(result.closesAt).toBe("2026-08-15T10:00:00.000Z")
  })
})
