// Shared contract for a payment gateway integration, formalizing the shape
// src/lib/services/razorpay.ts already implements informally. razorpay.ts
// itself is NOT refactored to implement this interface -- it's live,
// working, production payment code, and conforming it here is a separate,
// deliberately deferred change. This interface exists so a new gateway
// (icici.ts, and any future one) has a contract to implement against.

export interface CreateOrderParams {
  amount: number // smallest currency unit (paise for INR), matching Razorpay's convention
  currency: string
  receipt: string
}

export interface GatewayOrder {
  gatewayOrderId: string
  amount: number
  currency: string
}

export interface VerifySignatureParams {
  gatewayOrderId: string
  gatewayPaymentId: string
  signature: string
}

export interface PaymentGatewayService {
  readonly name: string
  createOrder(params: CreateOrderParams): Promise<GatewayOrder>
  verifySignature(params: VerifySignatureParams): boolean
}
