import { describe, it, expect } from "vitest"
import { getLetterheadBackgroundUrl } from "./essurg-letterhead"

describe("getLetterheadBackgroundUrl", () => {
  it("returns the URL when set to an allowed Supabase storage domain", () => {
    expect(
      getLetterheadBackgroundUrl({
        letterhead_background_url: "https://mirixhqvxxqedihjuxpu.supabase.co/storage/v1/object/public/uploads/letterhead.png",
      })
    ).toBe("https://mirixhqvxxqedihjuxpu.supabase.co/storage/v1/object/public/uploads/letterhead.png")
  })

  it("returns undefined when settings is null or undefined", () => {
    expect(getLetterheadBackgroundUrl(null)).toBeUndefined()
    expect(getLetterheadBackgroundUrl(undefined)).toBeUndefined()
  })

  it("returns undefined when no URL is configured", () => {
    expect(getLetterheadBackgroundUrl({})).toBeUndefined()
    expect(getLetterheadBackgroundUrl({ letterhead_background_url: "" })).toBeUndefined()
  })

  it("rejects a URL on a disallowed domain (SSRF guard)", () => {
    expect(
      getLetterheadBackgroundUrl({ letterhead_background_url: "https://evil.example.com/letterhead.png" })
    ).toBeUndefined()
  })

  it("rejects a non-HTTPS URL even on an allowed domain", () => {
    expect(
      getLetterheadBackgroundUrl({ letterhead_background_url: "http://mirixhqvxxqedihjuxpu.supabase.co/letterhead.png" })
    ).toBeUndefined()
  })

  it("rejects a malformed URL", () => {
    expect(getLetterheadBackgroundUrl({ letterhead_background_url: "not-a-url" })).toBeUndefined()
  })
})
