export type Tenant = "amasi" | "college" | "technosurg" | "essurg"

const ALLOWED_TENANTS: readonly Tenant[] = ["amasi", "college", "technosurg", "essurg"] as const

/**
 * Read a NEXT_PUBLIC_* env var that must be inlined into the client bundle.
 *
 * Critical: Next.js (and Turbopack) inline `NEXT_PUBLIC_*` env vars ONLY when
 * they are referenced as a *direct property access* on `process.env`. Passing
 * the name through a helper that does `process.env[name]` loses the static
 * trace, and the browser bundle ends up with `undefined` — even when the var
 * is set in the Vercel project. Caused 4+ hours of false "missing env"
 * debugging on the AMASI deployment rollout (2026-05-12). Don't refactor
 * the literal accesses below back into a `getRequiredEnv()` call.
 */
function requireValue(name: string, value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed || trimmed.includes("placeholder")) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return trimmed
}

/**
 * Tenant slug for the current deployment. Throws on missing / invalid env —
 * a silent fallback would either show wrong-org events in the admin UI or
 * send wrong-org links in member emails. Both are worse than a startup error.
 */
export function getTenant(): Tenant {
  // Direct literal access so Next.js inlines this into the client bundle.
  const raw = requireValue(
    "NEXT_PUBLIC_TENANT",
    process.env.NEXT_PUBLIC_TENANT,
  ).toLowerCase()
  if (!ALLOWED_TENANTS.includes(raw as Tenant)) {
    throw new Error(
      `NEXT_PUBLIC_TENANT must be one of ${ALLOWED_TENANTS.join(", ")}; got "${raw}"`,
    )
  }
  return raw as Tenant
}

/**
 * Public app URL with trailing slash stripped. Required — never falls back to
 * a hardcoded org URL. An AMASI deployment quietly sending links pointing at
 * collegeofmas.org.in (or vice versa) is a worse failure mode than a startup
 * crash, which gets noticed in minutes.
 */
export function getRequiredAppUrl(): string {
  // Direct literal access so Next.js inlines this into the client bundle.
  return requireValue(
    "NEXT_PUBLIC_APP_URL",
    process.env.NEXT_PUBLIC_APP_URL,
  ).replace(/\/$/, "")
}

/**
 * Build a SELECT query against public.events, pre-filtered to the current tenant.
 *
 * High-value read sites in Phase 2 are migrated to this helper. The ~150
 * admin sub-pages scoped by `eventId` in the URL are not migrated yet —
 * tracked in the follow-up ticket. Any *new* code reading `events` should
 * go through here or be flagged in review.
 *
 *   const { data } = await selectEventsForTenant(supabase, "id, name, slug")
 *     .eq("status", "active")
 *     .order("start_date")
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function selectEventsForTenant(supabase: any, columns: string = "*") {
  // `any` on `supabase` is deliberate: most callers cast `createAdminClient()`
  // result to `any` already (the codebase's existing convention — see the
  // `(supabase as any)` casts in src/app/api/events/route.ts etc.) and a
  // strictly-typed SupabaseClient here would force every call site to add
  // back casts on the returned row shape. The DB-side CHECK constraint and
  // the explicit columns string are the real safety boundaries.
  return supabase.from("events").select(columns).eq("tenant", getTenant())
}

/**
 * Decorate an event insert payload with the current tenant. Callers must NOT
 * pass `tenant` themselves — it's always derived from env so two deployments
 * sharing the same DB can never mis-tag a new event. Throws if `tenant` is
 * already present on the payload — silent overwrite would hide caller bugs
 * (someone thinking they could override the deployment's tenant from code).
 */
export function withTenant<T extends Record<string, unknown>>(
  payload: T,
): T & { tenant: Tenant } {
  if ("tenant" in payload) {
    throw new Error(
      "withTenant: payload already has 'tenant' field; do not set it manually.",
    )
  }
  return { ...payload, tenant: getTenant() }
}
