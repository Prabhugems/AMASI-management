import Razorpay from "razorpay"
import crypto from "crypto"

// Cache for event-specific Razorpay instances
const razorpayInstances: Map<string, Razorpay> = new Map()

// Default instance using env vars (fallback)
let defaultInstance: Razorpay | null = null

export interface RazorpayCredentials {
  key_id: string
  key_secret: string
  webhook_secret?: string
}

/**
 * Get Razorpay instance for specific event credentials
 * @param credentials - Event-specific Razorpay credentials
 * @returns Razorpay instance
 */
export function getRazorpayForEvent(credentials: RazorpayCredentials): Razorpay {
  const cacheKey = credentials.key_id

  if (!razorpayInstances.has(cacheKey)) {
    razorpayInstances.set(cacheKey, new Razorpay({
      key_id: credentials.key_id,
      key_secret: credentials.key_secret,
    }))
  }

  return razorpayInstances.get(cacheKey)!
}

/**
 * Get default Razorpay instance (using environment variables)
 * Used as fallback when event doesn't have specific credentials
 */
function getRazorpay(): Razorpay {
  if (!defaultInstance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay credentials not configured")
    }
    defaultInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  }
  return defaultInstance
}

export interface CreateOrderOptions {
  amount: number // Amount in smallest currency unit (paise for INR)
  currency?: string
  receipt: string
  notes?: Record<string, string>
  credentials?: RazorpayCredentials // Event-specific credentials
}

export interface RazorpayOrderResponse {
  id: string
  entity: string
  amount: number
  amount_paid: number
  amount_due: number
  currency: string
  receipt: string
  status: string
  attempts: number
  created_at: number
}

/**
 * Create a Razorpay order
 * @param options - Order creation options (can include event-specific credentials)
 * @returns Razorpay order object
 */
export async function createOrder(options: CreateOrderOptions): Promise<RazorpayOrderResponse> {
  const { amount, currency = "INR", receipt, notes = {}, credentials } = options

  // Use event-specific credentials if provided, otherwise use default
  const razorpay = credentials
    ? getRazorpayForEvent(credentials)
    : getRazorpay()

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100), // Convert to paise
    currency,
    receipt,
    notes,
  })

  return order as RazorpayOrderResponse
}

/**
 * Verify Razorpay payment signature
 * @param orderId - Razorpay order ID
 * @param paymentId - Razorpay payment ID
 * @param signature - Razorpay signature
 * @param keySecret - Event-specific key secret (optional, uses env var if not provided)
 * @returns boolean indicating if signature is valid
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret?: string
): boolean {
  const secret = keySecret || process.env.RAZORPAY_KEY_SECRET!
  const body = orderId + "|" + paymentId
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex")

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    )
  } catch {
    return false
  }
}

/**
 * Verify Razorpay webhook signature
 * @param body - Raw webhook body as string
 * @param signature - X-Razorpay-Signature header
 * @param webhookSecret - Event-specific webhook secret (optional, uses env var if not provided)
 * @returns boolean indicating if signature is valid
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  webhookSecret?: string
): boolean {
  const secret = webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET!
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex")

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    )
  } catch {
    return false
  }
}

/**
 * Fetch payment details from Razorpay
 * @param paymentId - Razorpay payment ID
 * @param credentials - Event-specific credentials (optional)
 */
export async function fetchPayment(paymentId: string, credentials?: RazorpayCredentials) {
  const razorpay = credentials
    ? getRazorpayForEvent(credentials)
    : getRazorpay()
  return razorpay.payments.fetch(paymentId)
}

/**
 * Create a refund
 * @param paymentId - Razorpay payment ID
 * @param amount - Amount to refund (in rupees)
 * @param notes - Optional notes
 * @param credentials - Event-specific credentials (optional)
 */
export async function createRefund(
  paymentId: string,
  amount: number,
  notes?: Record<string, string>,
  credentials?: RazorpayCredentials
) {
  const razorpay = credentials
    ? getRazorpayForEvent(credentials)
    : getRazorpay()
  return razorpay.payments.refund(paymentId, {
    amount: Math.round(amount * 100), // Convert to paise
    notes,
  })
}

/**
 * Generate payment number in format PAY-YYYY-XXXXX
 */
export function generatePaymentNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `PAY-${year}-${random}`
}

/**
 * Generate registration number in format EVENT-XXXX
 * @param eventShortName - Short name/code for the event
 * @param sequence - Sequence number
 */
export function generateRegistrationNumber(eventShortName: string, sequence: number): string {
  return `${eventShortName}-${sequence.toString().padStart(4, "0")}`
}

export { getRazorpay as razorpay }
