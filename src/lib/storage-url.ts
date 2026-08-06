/**
 * Signed-URL handling for the `form-uploads` bucket.
 *
 * `form-uploads` holds 423 documents uploaded through public registration and
 * membership forms — MCI certificates, pass certificates, payment screenshots.
 * The bucket is `public = true`, so every one of them resolves for anyone
 * holding the URL, with no credentials at all.
 *
 * The root cause was in code, not just configuration: `api/forms/upload`
 * created the bucket with `public: true` and returned `getPublicUrl(...)`,
 * which is then stored inside `form_submissions.responses`. That is fixed at
 * the write side; this module is the read side.
 *
 * Sequencing matters and is deliberate. Signing goes in FIRST and ships, and
 * only then does the bucket flip to `public = false`. Flipping first would
 * break every already-stored URL the instant it landed — the same order used
 * for the uploads bucket in the sibling amasi-membership repo.
 *
 * Until the flip, `signStorageValue` returns working signed URLs for anything
 * it recognises, so behaviour is unchanged for callers either way.
 */

import { createAdminClient } from "@/lib/supabase/server"

export const FORM_UPLOADS_BUCKET = "form-uploads"

/** Long enough for an admin to work through a submission, short enough that a
 *  leaked URL ages out. */
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60

// .../storage/v1/object/public/form-uploads/<path>
// .../storage/v1/object/sign/form-uploads/<path>?token=...
const OBJECT_URL_RE =
  /\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?form-uploads\/(.+)$/

/**
 * Normalise a stored value to a bare object path inside form-uploads.
 *
 * Returns null for anything that is not a form-uploads reference — a different
 * bucket, a legacy S3 link, a bare filename — so callers can leave those
 * untouched rather than mangling them.
 */
export function toStoragePath(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^https?:\/\//i.test(trimmed)) return null // bare paths are not what this bucket stores

  const match = trimmed.match(OBJECT_URL_RE)
  if (!match) return null
  const path = match[1].split("?")[0]
  if (!path || path.includes("..")) return null
  return decodeURIComponent(path)
}

/** Sign one value. Non-form-uploads values are returned untouched; a signing
 *  failure yields null rather than falling back to a public URL. */
export async function signStorageValue(
  value: unknown,
  ttlSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<unknown> {
  const path = toStoragePath(value)
  if (!path) return value

  const supabase = await createAdminClient()
  const { data, error } = await supabase.storage
    .from(FORM_UPLOADS_BUCKET)
    .createSignedUrl(path, ttlSeconds)

  if (error || !data?.signedUrl) {
    console.error("[storage-url] sign failed", { path, error: error?.message })
    return null
  }
  return data.signedUrl
}

/**
 * Walk an arbitrary JSON value and sign every form-uploads URL found in it.
 *
 * `form_submissions.responses` is a JSONB blob keyed by form-field UUID, and a
 * file answer can be a bare string, an array of strings, or an array of
 * `{ url, name }` objects depending on which form builder version produced it.
 * Rather than encode those shapes, this walks everything and rewrites any
 * string that parses as a form-uploads URL.
 *
 * All paths are collected first and signed in ONE batched call, so a submission
 * with twenty attachments costs one round trip rather than twenty.
 */
export async function signFormUploadUrlsDeep<T>(
  value: T,
  ttlSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<T> {
  const paths = new Set<string>()
  collectPaths(value, paths)
  if (paths.size === 0) return value

  const unique = Array.from(paths)
  const supabase = await createAdminClient()
  const { data, error } = await supabase.storage
    .from(FORM_UPLOADS_BUCKET)
    .createSignedUrls(unique, ttlSeconds)

  const signedByPath = new Map<string, string | null>()
  if (error || !data) {
    console.error("[storage-url] batch sign failed", { count: unique.length, error: error?.message })
    for (const p of unique) signedByPath.set(p, null)
  } else {
    for (const row of data) {
      if (row.path) signedByPath.set(row.path, row.signedUrl ?? null)
    }
  }

  return rewrite(value, signedByPath) as T
}

function collectPaths(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    const p = toStoragePath(value)
    if (p) out.add(p)
    return
  }
  if (Array.isArray(value)) {
    for (const v of value) collectPaths(v, out)
    return
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectPaths(v, out)
  }
}

function rewrite(value: unknown, signed: Map<string, string | null>): unknown {
  if (typeof value === "string") {
    const p = toStoragePath(value)
    return p ? signed.get(p) ?? null : value
  }
  if (Array.isArray(value)) return value.map((v) => rewrite(v, signed))
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = rewrite(v, signed)
    }
    return out
  }
  return value
}
