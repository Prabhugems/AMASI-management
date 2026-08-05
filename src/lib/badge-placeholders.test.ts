import { describe, it, expect } from "vitest"
import { replacePlaceholders, applyTextCase } from "./badge-placeholders"

describe("replacePlaceholders", () => {
  it("substitutes real registration values when a registration is given", () => {
    const result = replacePlaceholders(
      "{{name}} - {{registration_number}}",
      { attendee_name: "Dr Anjali Deshmukh", registration_number: "AMASI-2026-0417" },
      undefined
    )
    expect(result).toBe("Dr Anjali Deshmukh - AMASI-2026-0417")
  })

  it("falls back to generic sample values when no registration is given", () => {
    const result = replacePlaceholders("{{name}} - {{registration_number}}", undefined, undefined)
    expect(result).toBe("John Doe - REG001")
  })

  it("substitutes the ticket type name from the nested ticket_types relation", () => {
    const result = replacePlaceholders("{{ticket_type}}", { ticket_types: { name: "Faculty" } }, undefined)
    expect(result).toBe("Faculty")
  })

  it("joins purchased addon names with a comma", () => {
    const result = replacePlaceholders(
      "{{addons}}",
      { registration_addons: [{ addons: { name: "Workshop" } }, { addons: { name: "Gala Dinner" } }] },
      undefined
    )
    expect(result).toBe("Workshop, Gala Dinner")
  })

  it("formats the event date range when both start and end dates are present", () => {
    // Mid-day UTC timestamps (not bare date-only strings) so this assertion
    // doesn't flake depending on the test runner's local timezone -- a
    // date-only string parses as UTC midnight, and toLocaleDateString
    // renders in local time, which can shift the calendar day at the
    // extremes. Noon UTC is safe across every real-world UTC offset.
    const result = replacePlaceholders(
      "{{event_date}}",
      undefined,
      { start_date: "2026-02-12T12:00:00Z", end_date: "2026-02-15T12:00:00Z" }
    )
    expect(result).toBe("12 Feb - 15 Feb 2026")
  })

  it("falls back to a placeholder label when the event has no dates", () => {
    const result = replacePlaceholders("{{event_date}}", undefined, undefined)
    expect(result).toBe("Event Date")
  })

  it("returns an empty string for empty input", () => {
    expect(replacePlaceholders("", undefined, undefined)).toBe("")
  })
})

describe("applyTextCase", () => {
  it("uppercases when textCase is uppercase", () => {
    expect(applyTextCase("Dr Anjali", "uppercase")).toBe("DR ANJALI")
  })

  it("lowercases when textCase is lowercase", () => {
    expect(applyTextCase("Dr Anjali", "lowercase")).toBe("dr anjali")
  })

  it("capitalizes each word when textCase is capitalize", () => {
    expect(applyTextCase("dr anjali deshmukh", "capitalize")).toBe("Dr Anjali Deshmukh")
  })

  it("returns text unchanged when textCase is none or undefined", () => {
    expect(applyTextCase("Dr Anjali", "none")).toBe("Dr Anjali")
    expect(applyTextCase("Dr Anjali", undefined)).toBe("Dr Anjali")
  })
})
