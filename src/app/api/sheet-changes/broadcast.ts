// In-memory SSE fan-out. Each open dashboard tab connects to
// /api/sheet-changes and gets pushed new sheet edits as they land.
// Small ops team — fine for now. Swap for Vercel KV / Pub-Sub / Ably if we
// grow past a handful of concurrent subscribers.

export type SheetChange = {
  id: string
  ts: string
  kind: "modified" | "added" | "removed"
  day: string
  hall: string
  session: string
  time: string
  topic: string
  editor: string | null
}

type Subscriber = (change: SheetChange) => void

const subscribers = new Set<Subscriber>()

export function subscribe(fn: Subscriber) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

export function broadcastChange(change: SheetChange) {
  subscribers.forEach((fn) => {
    try {
      fn(change)
    } catch {
      /* ignore */
    }
  })
}
