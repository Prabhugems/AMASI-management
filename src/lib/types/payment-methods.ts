// Single source of truth for which payment methods an event can enable.
// Previously defined independently (and inconsistently) in the checkout
// page, the payment-settings admin page, and left untyped in the generated
// Supabase types -- this is the shared shape all three now import.

export interface PaymentMethodsEnabled {
  razorpay: boolean
  icici: boolean
  bank_transfer: boolean
  cash: boolean
  free: boolean
}

export const DEFAULT_PAYMENT_METHODS_ENABLED: PaymentMethodsEnabled = {
  razorpay: true,
  icici: false,
  bank_transfer: false,
  cash: false,
  free: true,
}
