// Stub ICICI Payment Gateway implementation. Not wired into any API route
// yet -- ICICI merchant credentials and API integration details are not
// yet available. When they are, replace these method bodies with real
// ICICI API calls; see docs/superpowers/specs/2026-07-31-multi-payment-
// gateway-scaffold-design.md for the follow-on integration notes.

import type { PaymentGatewayService, CreateOrderParams, GatewayOrder, VerifySignatureParams } from "./payment-gateway"

const NOT_CONFIGURED_MESSAGE =
  "ICICI Payment Gateway integration is not yet configured -- merchant credentials and API integration are pending."

export const iciciGateway: PaymentGatewayService = {
  name: "icici",
  async createOrder(_params: CreateOrderParams): Promise<GatewayOrder> {
    throw new Error(NOT_CONFIGURED_MESSAGE)
  },
  verifySignature(_params: VerifySignatureParams): boolean {
    throw new Error(NOT_CONFIGURED_MESSAGE)
  },
}
