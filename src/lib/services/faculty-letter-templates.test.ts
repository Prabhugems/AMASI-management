import { describe, it, expect } from "vitest"
import { LETTER_TEMPLATES, renderFields } from "./faculty-letter-templates"

describe("LETTER_TEMPLATES", () => {
  it("has exactly the 6 expected templates", () => {
    expect(Object.keys(LETTER_TEMPLATES).sort()).toEqual([
      "assignment_confirmation",
      "chairperson_invitation",
      "initial_invitation",
      "live_surgery_faculty",
      "visa_support",
      "workshop_faculty",
    ])
  })

  it("every template's fields have unique keys", () => {
    for (const template of Object.values(LETTER_TEMPLATES)) {
      const keys = template.fields.map((f) => f.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it("only visa_support uses consular addressee mode", () => {
    const event = { name: "ESSURG 2026", edition: 28, dateRange: "27-29 November 2026", venue: "Kalakriti Cultural & Convention Centre", city: "Agra" }
    for (const [key, template] of Object.entries(LETTER_TEMPLATES)) {
      const fields: Record<string, string> = {}
      for (const f of template.fields) fields[f.key] = "x"
      const content = template.build(fields, event)
      expect(content.addresseeMode).toBe(key === "visa_support" ? "consular" : "recipient")
    }
  })
})

describe("initial_invitation", () => {
  const event = { name: "ESSURG 2026", edition: 28, dateRange: "27-29 November 2026", venue: "Kalakriti Cultural & Convention Centre", city: "Agra" }

  it("interpolates fields into the narrative paragraphs", () => {
    const template = LETTER_TEMPLATES.initial_invitation
    const fields: Record<string, string> = {
      specialty: "Laparoscopic Surgery",
      facultyRole: "Invited Speaker",
      trackSession: "Advanced Laparoscopy Track",
      contributionFormat: "Lecture",
      proposedTitle: "Innovations in Hernia Repair",
      duration: "20 minutes",
      mainRegistration: "Complimentary",
      workshopSocialEvents: "Not included",
      travel: "Not covered",
      accommodation: "Not covered",
      localTransport: "Not covered",
      honorariumVisa: "Nil",
      acceptanceDeadline: "15 October 2026",
    }
    const content = template.build(fields, event)
    expect(content.subject).toContain("ESSURG 2026")
    expect(content.paragraphs.join(" ")).toContain("28th Annual Conference of the European Society of Surgery")
    expect(content.paragraphs.join(" ")).toContain("Laparoscopic Surgery")
    expect(content.paragraphs.join(" ")).toContain('"Innovations in Hernia Repair"')
    expect(content.detailRows).toContainEqual({ label: "Main registration", value: "Complimentary" })
    expect(content.closingParagraphs.join(" ")).toContain("15 October 2026")
  })
})

describe("visa_support", () => {
  it("builds a consular addressee block from embassyName/embassyCity", () => {
    const template = LETTER_TEMPLATES.visa_support
    expect(template.fields.some((f) => f.key === "embassyName")).toBe(true)
    expect(template.fields.some((f) => f.key === "embassyCity")).toBe(true)
    const fields: Record<string, string> = {}
    for (const f of template.fields) fields[f.key] = "x"
    fields.fullLegalName = "Dr. Jane Smith"
    fields.nationality = "British"
    const event = { name: "ESSURG 2026", edition: 28, dateRange: "27-29 November 2026", venue: "Kalakriti Cultural & Convention Centre", city: "Agra" }
    const content = template.build(fields, event)
    expect(content.subject).toContain("Dr. Jane Smith")
    expect(content.paragraphs.join(" ")).toContain("British")
  })
})

describe("renderFields", () => {
  it("formats date-typed fields to a display string and leaves others untouched", () => {
    const template = LETTER_TEMPLATES.assignment_confirmation
    const raw: Record<string, string> = {}
    for (const f of template.fields) raw[f.key] = f.type === "date" ? "2026-10-15" : "plain text"
    const out = renderFields(template, raw)
    expect(out.sessionDate).toBe("15 October 2026")
    expect(out.trackSession).toBe("plain text")
  })

  it("returns an empty string for a missing field instead of throwing", () => {
    const template = LETTER_TEMPLATES.chairperson_invitation
    const out = renderFields(template, {})
    for (const f of template.fields) expect(out[f.key]).toBe("")
  })
})
