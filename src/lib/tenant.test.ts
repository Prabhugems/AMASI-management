import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { getTenant, withTenant, getRequiredAppUrl } from "./tenant"

describe("getTenant", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("throws when NEXT_PUBLIC_TENANT is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_TENANT", "")
    expect(() => getTenant()).toThrow(/NEXT_PUBLIC_TENANT/)
  })

  it("throws when NEXT_PUBLIC_TENANT is not one of the allowed values", () => {
    vi.stubEnv("NEXT_PUBLIC_TENANT", "fictional-org")
    expect(() => getTenant()).toThrow(/must be one of amasi, college/)
  })

  it("lowercases input — accepts 'AMASI' as 'amasi'", () => {
    vi.stubEnv("NEXT_PUBLIC_TENANT", "AMASI")
    expect(getTenant()).toBe("amasi")
  })
})

describe("withTenant", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_TENANT", "college")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("adds tenant when payload has no tenant field", () => {
    const result = withTenant({ name: "Test Event", slug: "test" })
    expect(result).toEqual({ name: "Test Event", slug: "test", tenant: "college" })
  })

  it("throws when payload already has a tenant field — prevents caller bugs", () => {
    expect(() =>
      withTenant({ name: "X", tenant: "amasi" }),
    ).toThrow(/already has 'tenant'/)
  })
})

describe("getRequiredAppUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("strips a trailing slash so callers can safely template `${url}/path`", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://events.amasi.org/")
    expect(getRequiredAppUrl()).toBe("https://events.amasi.org")
  })
})
