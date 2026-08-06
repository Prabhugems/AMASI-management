/**
 * form-uploads path normalisation.
 *
 * `form_submissions.responses` is a JSONB blob keyed by form-field UUID, and a
 * file answer may be a bare string, an array of strings, or an array of
 * `{ url, name }` objects depending on which form-builder version wrote it.
 * That is why the signer walks the whole structure rather than assuming a
 * shape, and why this normaliser has to be strict about what it claims.
 */
import { describe, it, expect } from "vitest"
import { toStoragePath } from "@/lib/storage-url"

const PUB = "https://jmdwxymbgxwdsmcwbahp.supabase.co/storage/v1/object/public/form-uploads"
const SIGN = "https://jmdwxymbgxwdsmcwbahp.supabase.co/storage/v1/object/sign/form-uploads"

describe("toStoragePath", () => {
  it("extracts the path from a stored public URL", () => {
    expect(toStoragePath(`${PUB}/evt-uuid/sub-uuid/123_scan.pdf`)).toBe("evt-uuid/sub-uuid/123_scan.pdf")
  })

  it("strips the token from an already-signed URL so it can be re-signed", () => {
    expect(toStoragePath(`${SIGN}/a/b.pdf?token=eyJhbGciOi.x.y`)).toBe("a/b.pdf")
  })

  it("decodes percent-encoding, so legacy WhatsApp filenames survive", () => {
    expect(toStoragePath(`${PUB}/e/WhatsApp%20Image%202026.jpeg`)).toBe("e/WhatsApp Image 2026.jpeg")
  })

  it("leaves other buckets alone — event-assets and uploads must pass through untouched", () => {
    const base = "https://jmdwxymbgxwdsmcwbahp.supabase.co/storage/v1/object/public"
    expect(toStoragePath(`${base}/event-assets/badge-templates/x.png`)).toBeNull()
    expect(toStoragePath(`${base}/uploads/mci_certificate/x.pdf`)).toBeNull()
  })

  it("leaves unrelated absolute URLs and non-strings alone", () => {
    expect(toStoragePath("https://member2025.s3.ap-south-1.amazonaws.com/x.png")).toBeNull()
    expect(toStoragePath(null)).toBeNull()
    expect(toStoragePath(undefined)).toBeNull()
    expect(toStoragePath(42)).toBeNull()
    expect(toStoragePath("")).toBeNull()
    expect(toStoragePath("   ")).toBeNull()
  })

  it("rejects traversal", () => {
    expect(toStoragePath(`${PUB}/../../etc/passwd`)).toBeNull()
  })

  it("treats a bare path as not-a-URL — this bucket only ever stored full URLs", () => {
    expect(toStoragePath("evt-uuid/sub-uuid/scan.pdf")).toBeNull()
  })
})
