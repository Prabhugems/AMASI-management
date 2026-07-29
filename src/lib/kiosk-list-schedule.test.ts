import { describe, it, expect } from "vitest"
import { computeListState, minutesUntilClose } from "./kiosk-list-schedule"

const NOON = new Date("2026-07-29T12:00:00.000Z")

describe("computeListState", () => {
  it("is open when nothing is set", () => {
    expect(computeListState({ kiosk_opens_at: null, kiosk_closes_at: null, kiosk_force_state: null }, NOON)).toBe("open")
  })

  it("force_state open wins even past closes_at", () => {
    expect(computeListState({
      kiosk_opens_at: null,
      kiosk_closes_at: "2026-07-29T11:00:00.000Z",
      kiosk_force_state: "open",
    }, NOON)).toBe("open")
  })

  it("force_state closed wins even inside the window", () => {
    expect(computeListState({
      kiosk_opens_at: "2026-07-29T09:00:00.000Z",
      kiosk_closes_at: "2026-07-29T18:00:00.000Z",
      kiosk_force_state: "closed",
    }, NOON)).toBe("closed")
  })

  it("is closed before opens_at", () => {
    expect(computeListState({ kiosk_opens_at: "2026-07-29T13:00:00.000Z", kiosk_closes_at: null, kiosk_force_state: null }, NOON)).toBe("closed")
  })

  it("is closed after closes_at", () => {
    expect(computeListState({ kiosk_opens_at: null, kiosk_closes_at: "2026-07-29T11:00:00.000Z", kiosk_force_state: null }, NOON)).toBe("closed")
  })

  it("is open inside the window", () => {
    expect(computeListState({
      kiosk_opens_at: "2026-07-29T09:00:00.000Z",
      kiosk_closes_at: "2026-07-29T18:00:00.000Z",
      kiosk_force_state: null,
    }, NOON)).toBe("open")
  })
})

describe("minutesUntilClose", () => {
  it("returns null when there's no closes_at", () => {
    expect(minutesUntilClose({ kiosk_opens_at: null, kiosk_closes_at: null, kiosk_force_state: null }, NOON)).toBeNull()
  })

  it("returns null when force_state is set (schedule is irrelevant)", () => {
    expect(minutesUntilClose({ kiosk_opens_at: null, kiosk_closes_at: "2026-07-29T12:03:00.000Z", kiosk_force_state: "open" }, NOON)).toBeNull()
  })

  it("returns null once already closed", () => {
    expect(minutesUntilClose({ kiosk_opens_at: null, kiosk_closes_at: "2026-07-29T11:00:00.000Z", kiosk_force_state: null }, NOON)).toBeNull()
  })

  it("returns whole minutes remaining", () => {
    expect(minutesUntilClose({ kiosk_opens_at: null, kiosk_closes_at: "2026-07-29T12:05:30.000Z", kiosk_force_state: null }, NOON)).toBe(5)
  })
})
