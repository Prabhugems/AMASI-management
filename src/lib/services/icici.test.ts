import { describe, it, expect } from "vitest"
import { iciciGateway } from "./icici"

describe("iciciGateway", () => {
  it("has the name 'icici'", () => {
    expect(iciciGateway.name).toBe("icici")
  })

  it("createOrder rejects with a clear not-configured message", async () => {
    await expect(
      iciciGateway.createOrder({ amount: 10000, currency: "INR", receipt: "test-receipt" })
    ).rejects.toThrow(/not yet configured/i)
  })

  it("verifySignature throws a clear not-configured message", () => {
    expect(() =>
      iciciGateway.verifySignature({ gatewayOrderId: "o1", gatewayPaymentId: "p1", signature: "sig" })
    ).toThrow(/not yet configured/i)
  })
})
