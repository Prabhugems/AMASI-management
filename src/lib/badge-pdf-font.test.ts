import { describe, it, expect } from "vitest"
import { resolvePdfFontFamily } from "./badge-pdf-font"

describe("resolvePdfFontFamily", () => {
  it("maps Arial to sans", () => {
    expect(resolvePdfFontFamily("Arial, sans-serif")).toBe("sans")
  })

  it("maps Helvetica to sans", () => {
    expect(resolvePdfFontFamily("Helvetica, sans-serif")).toBe("sans")
  })

  it("maps Georgia to serif", () => {
    expect(resolvePdfFontFamily("Georgia, serif")).toBe("serif")
  })

  it("maps Times New Roman to serif", () => {
    expect(resolvePdfFontFamily("Times New Roman, serif")).toBe("serif")
  })

  it("maps a quoted Google serif font to serif", () => {
    expect(resolvePdfFontFamily("'Playfair Display', serif")).toBe("serif")
  })

  it("maps a quoted Google serif font (Merriweather) to serif", () => {
    expect(resolvePdfFontFamily("'Merriweather', serif")).toBe("serif")
  })

  it("maps a quoted Google sans-serif font to sans", () => {
    expect(resolvePdfFontFamily("'Roboto', sans-serif")).toBe("sans")
  })

  it("defaults to sans when fontFamily is undefined", () => {
    expect(resolvePdfFontFamily(undefined)).toBe("sans")
  })

  it("defaults to sans for an unrecognized font string", () => {
    expect(resolvePdfFontFamily("'Comic Sans MS', fantasy")).toBe("sans")
  })
})
