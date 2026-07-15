// Hardware-lane requirement: no request on this app may hang indefinitely on
// bad venue wifi. `fetch` alone never times out — a TCP connection that
// opens but never gets a response sits in `await fetch(...)` forever, and
// `navigator.onLine` stays `true` the whole time (it only reflects the OS
// network interface, not request health). This wraps any fetch with a hard
// abort after `timeoutMs`, so a hang becomes a normal, catchable failure.
//
// A timeout-triggered abort rejects with `DOMException("AbortError")`, not
// `TypeError` — callers that already branch on `err instanceof TypeError` to
// detect "offline" must also check for this (see `isNetworkFailure` in
// offline-scan-queue.ts, which now covers both).
export const DEFAULT_FETCH_TIMEOUT_MS = 3000

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // Respect a caller-supplied signal (e.g. the roster search's
  // cancel-on-new-keystroke signal) by also aborting ours when it aborts —
  // composing two AbortControllers manually rather than relying on
  // AbortSignal.any, which isn't universally supported on the older Android
  // WebViews these tablets may run.
  const externalSignal = init.signal
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true })
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}
