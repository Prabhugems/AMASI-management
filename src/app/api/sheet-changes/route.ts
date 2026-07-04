// Server-Sent Events stream. Every open dashboard tab keeps this connection
// open and receives `change` events pushed from the sheet-webhook handler.
//
//   const es = new EventSource("/api/sheet-changes")
//   es.addEventListener("change", (e) => toast(JSON.parse(e.data)))
//
// Payload matches SheetChange in ./broadcast.ts.

import { NextResponse } from "next/server"
import { subscribe } from "./broadcast"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const write = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          /* client gone */
        }
      }

      write("hello", { ok: true, ts: new Date().toISOString() })
      const unsub = subscribe((change) => write("change", change))
      const hb = setInterval(
        () => write("heartbeat", { ts: new Date().toISOString() }),
        25_000
      )

      // Ensure cleanup even if the stream is torn down abnormally.
      const cleanup = () => {
        clearInterval(hb)
        unsub()
      }
      // Node's ReadableStream doesn't expose a close hook, so stash
      // the cleanup on the controller and rely on cancel() calling it.
      ;(controller as unknown as { _cleanup?: () => void })._cleanup = cleanup
    },
    cancel() {
      const c = this as unknown as { _cleanup?: () => void }
      c._cleanup?.()
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
