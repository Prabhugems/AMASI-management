import { describe, it, expect } from "vitest"
import { DEFAULT_PAYMENT_METHODS_ENABLED, type PaymentMethodsEnabled } from "./payment-methods"

describe("DEFAULT_PAYMENT_METHODS_ENABLED", () => {
  it("has exactly the five expected keys, all boolean", () => {
    const keys = Object.keys(DEFAULT_PAYMENT_METHODS_ENABLED).sort()
    expect(keys).toEqual(["bank_transfer", "cash", "free", "icici", "razorpay"])
    for (const key of keys) {
      expect(typeof DEFAULT_PAYMENT_METHODS_ENABLED[key as keyof PaymentMethodsEnabled]).toBe("boolean")
    }
  })

  it("defaults razorpay and free to true, everything else to false", () => {
    expect(DEFAULT_PAYMENT_METHODS_ENABLED.razorpay).toBe(true)
    expect(DEFAULT_PAYMENT_METHODS_ENABLED.free).toBe(true)
    expect(DEFAULT_PAYMENT_METHODS_ENABLED.icici).toBe(false)
    expect(DEFAULT_PAYMENT_METHODS_ENABLED.bank_transfer).toBe(false)
    expect(DEFAULT_PAYMENT_METHODS_ENABLED.cash).toBe(false)
  })
})
