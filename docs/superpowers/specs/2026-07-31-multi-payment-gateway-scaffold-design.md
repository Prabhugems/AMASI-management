# Multi-Payment-Gateway Scaffold (ICICI) — Design

**Status**: Approved for spec.
**Scope**: Architecture scaffold only — a shared payment-methods type, an `icici` capability flag, a disabled "coming soon" admin toggle, and a stubbed `PaymentGatewayService` implementation for ICICI. No live ICICI API calls, no changes to the delegate-facing checkout flow, no changes to the Razorpay webhook/create-order/verify routes.

## Context

A client message (relayed 2026-07-30) requested ICICI as a second payment gateway alongside Razorpay, specifically for ESSURG 2026, with both options available to the applicant/delegate at checkout. ICICI merchant credentials and API documentation are not yet available — getting them is a separate, ongoing process outside this repo's scope.

A research pass into the current payment architecture found:

- Per-event Razorpay credentials already work today (`events.razorpay_key_id`/`razorpay_key_secret`, `src/lib/services/razorpay.ts:getRazorpayForEvent`) — ESSURG having its own distinct Razorpay account is not new work. This spec is about a genuinely different gateway provider.
- `events.payment_methods_enabled` is a jsonb column already gating which payment options appear at checkout (`src/app/register/[eventSlug]/checkout/page.tsx:534-561`) — adding a new key needs no migration.
- The type for `payment_methods_enabled` is inconsistent across the codebase: a local `interface PaymentMethodsEnabled` in the checkout page (`checkout/page.tsx:124-129`), `any` in the payment-settings admin page (`payment-settings/page.tsx:66`), untyped `Json` in generated Supabase types, and a differently-shaped `PaymentMethod` union in `src/lib/types/index.ts:339` (which includes `cheque`/`complimentary` but not `free`, and is missing from the other two). This spec fixes that by introducing one shared type.
- `isFeatureEnabled('razorpay')` in `src/lib/env.ts` is dead code — never called anywhere in the codebase. The real gating is entirely event-level (`payment_methods_enabled.razorpay`), with `process.env.RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` used only as a fallback default account, not a feature flag.
- The `payments` table (`amount, currency, event_id, metadata, payment_method, payment_number, payment_type, razorpay_order_id, razorpay_payment_id, razorpay_signature, status, ...`) has Razorpay-specific column names for gateway IDs/signatures, alongside a generic `metadata: Json` column already used by the group-registration flow to carry gateway-attempt details not modeled as dedicated columns.

## 1. Shared `PaymentMethodsEnabled` type

New file: `src/lib/types/payment-methods.ts`

```typescript
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
```

Three existing call sites are updated to import this instead of their own ad hoc shape:
- `src/app/register/[eventSlug]/checkout/page.tsx` — replaces its local `interface PaymentMethodsEnabled` (lines 124-129) and local `defaultMethods` object (lines 535-536) with the shared import. **The checkout page's `availablePaymentMethods` computation (lines 540-561) is NOT modified to add an ICICI branch** — it continues checking only `razorpay`/`bank_transfer`/`cash`/`free`, exactly as today. Adding `icici: boolean` to the type doesn't expose it in the UI; the UI change is deliberately deferred to the real-integration pass.
- `src/app/events/[eventId]/payment-settings/page.tsx` — replaces its `payment_methods_enabled: any` field typing with the shared type.
- `src/app/api/events/[eventId]/payment-settings/route.ts` — replaces its inline default-fallback object with `DEFAULT_PAYMENT_METHODS_ENABLED`.

`src/lib/types/index.ts`'s separate `PaymentMethod` union (used elsewhere for `Payment`/registration domain types, includes `cheque`/`complimentary`) is left untouched — reconciling it with this new type is out of scope; it's a distinct concept (a payment's recorded method, not an event's enabled-methods config) despite the naming overlap, and forcing them into one type risks an unrelated, unreviewed behavior change to existing payment records.

## 2. Admin UI — disabled "coming soon" toggle

`src/app/events/[eventId]/payment-settings/page.tsx` gets one more row in its payment-methods toggle list, alongside Razorpay/bank transfer/cash/free: an "ICICI Payment Gateway" checkbox, rendered **disabled** (not clickable) regardless of the stored value, with copy: "Coming soon — pending ICICI merchant credentials." The underlying `payment_methods_enabled.icici` value stays `false` for every event, including ESSURG's, until the real integration lands and this disabled state is removed.

This is the safety mechanism that matters most in this scaffold: nothing in the admin UI can accidentally turn ICICI on for a real event before it actually works. The checkbox is visible (so the client/admin can see it's coming) but structurally inert.

## 3. `PaymentGatewayService` interface

New file: `src/lib/services/payment-gateway.ts` — formalizes the shape `razorpay.ts` already implements informally, so `icici.ts` (§4) can mirror it exactly and any future third gateway has a contract to implement against.

```typescript
export interface CreateOrderParams {
  amount: number // in the smallest currency unit (paise for INR), matching Razorpay's convention
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
```

`razorpay.ts` itself is **not refactored** to implement this interface in this pass — it's live, working, production payment code processing real money today, and conforming it to a new interface is a real-risk change that belongs in its own reviewed pass, not bundled into a scaffold for a gateway that doesn't work yet. The interface exists now purely so `icici.ts` has a contract to stub against.

## 4. `src/lib/services/icici.ts` — stub implementation

```typescript
import type { PaymentGatewayService, CreateOrderParams, GatewayOrder, VerifySignatureParams } from "./payment-gateway"

const NOT_CONFIGURED_MESSAGE =
  "ICICI Payment Gateway integration is not yet configured — merchant credentials and API integration are pending."

export const iciciGateway: PaymentGatewayService = {
  name: "icici",
  async createOrder(_params: CreateOrderParams): Promise<GatewayOrder> {
    throw new Error(NOT_CONFIGURED_MESSAGE)
  },
  verifySignature(_params: VerifySignatureParams): boolean {
    throw new Error(NOT_CONFIGURED_MESSAGE)
  },
}
```

Not wired into any API route in this pass — it exists as a ready-to-implement placeholder, imported by nothing yet. When real credentials/API docs arrive, the follow-on work is: replace the stub bodies with real ICICI API calls, decide where gateway-specific IDs/signatures are recorded (reuse `payments.metadata` jsonb rather than adding `icici_order_id`/`icici_payment_id`/`icici_signature` columns mirroring Razorpay's pattern — avoids a schema migration and matches how the group-registration flow already uses `metadata` for gateway-attempt details not modeled as dedicated columns), add the corresponding `/api/payments/icici/create-order` and `/api/payments/icici/webhook` routes mirroring the Razorpay ones, add the `icici` branch to the checkout page's `availablePaymentMethods`/`handlePayment`, and remove the admin toggle's disabled state.

## Explicitly out of scope for this pass

- Any real ICICI API integration (no credentials/docs exist yet).
- Any change to `src/app/api/payments/razorpay/**` (create-order, verify, webhook) — all untouched.
- Any change to the checkout page's delegate-facing payment method selection or `handlePayment` branching.
- Reconciling `src/lib/types/index.ts`'s separate `PaymentMethod` union with the new `PaymentMethodsEnabled` type.
- Deciding the final DB representation for ICICI-specific transaction fields (recommended above as reusing `metadata`, but not implemented — no columns are added, no migration in this pass).

## Migration note

No database migration in this pass. `payment_methods_enabled` is jsonb; adding the `icici` key is a pure application-code change with a safe default (`false`) that requires no schema change and affects no existing event's behavior.
