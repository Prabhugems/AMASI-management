// Idempotency-Key cache for public write endpoints, Stripe-pattern.
//
// Claim:  caller asks for a slot keyed by (endpoint, key). The first request
//         wins by INSERTing a 'processing' row; followers either see a
//         cached 'done' response or get told the leader is in-flight.
// Commit: leader writes status + body to the row on success.
// Release: leader can DELETE the row when the request fails before success,
//         so the caller's retry isn't blocked until TTL.
//
// Validation errors should NOT claim a slot — only call this immediately
// before the operation that actually writes.

import crypto from "node:crypto"
import { createAdminClient } from "./supabase/server"

export type ClaimResult =
  | { kind: "cached"; status: number; body: unknown }
  | { kind: "in_progress" }
  | { kind: "key_conflict" }
  | {
      kind: "leader"
      commit: (status: number, body: unknown) => Promise<void>
      release: () => Promise<void>
    }

const NO_OP_LEADER: Extract<ClaimResult, { kind: "leader" }> = {
  kind: "leader",
  commit: async () => {},
  release: async () => {},
}

function canonicalize(value: unknown): string {
  // Stable JSON: object keys sorted at every level so accidental key reordering
  // doesn't look like a different request body.
  const seen = new WeakSet<object>()
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v
    if (seen.has(v as object)) return null
    seen.add(v as object)
    if (Array.isArray(v)) return v.map(walk)
    const obj = v as Record<string, unknown>
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = walk(obj[k])
        return acc
      }, {})
  }
  return JSON.stringify(walk(value))
}

function hashBody(body: unknown): string {
  return crypto.createHash("sha256").update(canonicalize(body)).digest("hex")
}

export async function claimIdempotency(
  endpoint: string,
  key: string | null,
  requestBody: unknown
): Promise<ClaimResult> {
  if (!key) return NO_OP_LEADER

  const supabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const requestHash = hashBody(requestBody)

  // Try to claim leader by INSERT. (endpoint, key) is PK so a second insert
  // collides — that's our race signal.
  const { error: insErr } = await sb
    .from("submission_idempotency")
    .insert({ endpoint, key, status: "processing", request_hash: requestHash })

  if (!insErr) {
    return {
      kind: "leader",
      commit: async (status, body) => {
        await sb
          .from("submission_idempotency")
          .update({ status: "done", response_status: status, response_body: body })
          .eq("endpoint", endpoint)
          .eq("key", key)
      },
      release: async () => {
        await sb
          .from("submission_idempotency")
          .delete()
          .eq("endpoint", endpoint)
          .eq("key", key)
          .eq("status", "processing")
      },
    }
  }

  // Insert failed — either PK collision (someone else has this key) or RLS/etc.
  // Fetch existing row to disambiguate.
  const { data: existing } = await sb
    .from("submission_idempotency")
    .select("status, request_hash, response_status, response_body, expires_at")
    .eq("endpoint", endpoint)
    .eq("key", key)
    .maybeSingle()

  if (!existing) return NO_OP_LEADER // degenerate; act as leader

  // Same key, different body → caller misuse; Stripe-style 422 signal.
  if (existing.request_hash && existing.request_hash !== requestHash) {
    return { kind: "key_conflict" }
  }

  if (existing.status === "done") {
    return {
      kind: "cached",
      status: existing.response_status ?? 200,
      body: existing.response_body,
    }
  }

  // status === 'processing'
  return { kind: "in_progress" }
}
