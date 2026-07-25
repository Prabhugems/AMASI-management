import { describe, it, expect } from "vitest"
import { shouldUseEssurgLetterhead, ESSURG_EVENT_ID } from "./essurg-letterhead"

describe("shouldUseEssurgLetterhead", () => {
  it("returns true for the ESSURG 2026 event id", () => {
    expect(shouldUseEssurgLetterhead(ESSURG_EVENT_ID)).toBe(true)
  })

  it("returns false for any other event id", () => {
    expect(shouldUseEssurgLetterhead("11111111-2222-3333-4444-555555555555")).toBe(false)
  })

  it("returns false for null or undefined", () => {
    expect(shouldUseEssurgLetterhead(null)).toBe(false)
    expect(shouldUseEssurgLetterhead(undefined)).toBe(false)
  })

  it("returns false for an empty string", () => {
    expect(shouldUseEssurgLetterhead("")).toBe(false)
  })
})
