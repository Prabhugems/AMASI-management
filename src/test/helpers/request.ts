import { NextRequest } from "next/server"

// src/lib/rate-limit.ts keys its in-memory limiter by client IP in a
// module-level Map that persists for the whole Vitest process. Reusing one
// fake IP across many tests risks a spurious 429 late in a run (e.g.
// /api/verify/[token]'s "public" tier is 30/min) — so every request built
// here gets a fresh synthetic IP.
let ipCounter = 0

export function makeRequest(
  url: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> }
): NextRequest {
  ipCounter += 1
  const req = new Request(url, {
    method: init?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `10.0.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`,
      ...(init?.headers ?? {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  return new NextRequest(req)
}
