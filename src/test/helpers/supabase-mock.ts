// Minimal chainable mock for the Supabase query builder, covering the exact
// call shapes the check-in routes use: .from().select().eq()...maybeSingle(),
// .insert().select().maybeSingle(), a bare awaited .update()/.insert() (no
// terminal call — the chain itself must be thenable), and count-only queries
// (`{ count: "exact", head: true }`, resolved by awaiting the chain).
//
// Responses are queued per-table, FIFO: each `.from(table)` call shifts the
// next queued response for that table. Tests must queue responses in the
// exact order the route under test calls that table. Every chain method call
// is recorded in `calls[]` so a test can assert a filter was actually applied
// (e.g. `.in("ticket_type_id", [...])`), not just trust the canned data.

export interface MockResponse<T = unknown> {
  data: T | null
  error: unknown | null
  count?: number | null
}

export interface RecordedCall {
  table: string
  method: string
  args: unknown[]
}

const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "delete",
  "eq",
  "neq",
  "in",
  "is",
  "ilike",
  "or",
  "order",
  "range",
  "limit",
  "gte",
  "gt",
  "lte",
  "lt",
] as const

export function createSupabaseMock() {
  const queues = new Map<string, MockResponse[]>()
  const calls: RecordedCall[] = []

  function queueResponse(table: string, response: MockResponse) {
    if (!queues.has(table)) queues.set(table, [])
    queues.get(table)!.push(response)
  }

  function makeChain(table: string, response: MockResponse): any {
    const chain: any = {
      then: (resolve: (v: MockResponse) => unknown, reject?: (e: unknown) => unknown) => {
        try {
          return Promise.resolve(resolve(response))
        } catch (e) {
          if (reject) return Promise.resolve(reject(e))
          throw e
        }
      },
    }
    for (const method of CHAIN_METHODS) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ table, method, args })
        return chain
      }
    }
    chain.maybeSingle = async () => response
    chain.single = async () => response
    return chain
  }

  const client = {
    from(table: string) {
      const q = queues.get(table)
      const response: MockResponse = q && q.length > 0 ? q.shift()! : { data: null, error: null }
      calls.push({ table, method: "from", args: [] })
      return makeChain(table, response)
    },
  }

  return { client, queueResponse, calls }
}
