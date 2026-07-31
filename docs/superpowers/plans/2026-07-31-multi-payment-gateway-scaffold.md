# Multi-Payment-Gateway Scaffold (ICICI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a second payment gateway (ICICI) alongside Razorpay — a shared config type, a disabled "coming soon" admin toggle, and a stubbed gateway-service interface — with zero change to any live payment flow.

**Architecture:** One new shared TypeScript type consumed by the three existing places that currently define `payment_methods_enabled`'s shape independently and inconsistently; one new disabled UI tile in the existing payment-settings admin page; one new interface + one new stub service file, neither wired into any route yet.

**Tech Stack:** Next.js 16 App Router, TypeScript, React (client components), vitest.

## Global Constraints

- No database migration. `events.payment_methods_enabled` is jsonb; adding the `icici` key is a pure application-code change, default `false`.
- The delegate-facing checkout page (`src/app/register/[eventSlug]/checkout/page.tsx`) must NOT gain an ICICI payment option in this pass — its `availablePaymentMethods` computation continues checking only `razorpay`/`bank_transfer`/`cash`/`free`. Only its type definition changes.
- The admin payment-settings page's new ICICI toggle must be structurally disabled (unclickable), regardless of the stored `payment_methods_enabled.icici` value — nothing in this pass may let an admin turn it on.
- No changes to `src/app/api/payments/razorpay/**` (create-order, verify, webhook) or `src/lib/services/razorpay.ts` in this pass.
- Test runner: `npx vitest run <path>` (colocated `.test.ts` files, per this repo's existing convention).

---

### Task 1: Shared `PaymentMethodsEnabled` type

**Files:**
- Create: `src/lib/types/payment-methods.ts`
- Test: `src/lib/types/payment-methods.test.ts`

**Interfaces:**
- Produces: `PaymentMethodsEnabled` interface, `DEFAULT_PAYMENT_METHODS_ENABLED` const — both consumed by Tasks 2, 3, and 4.

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/types/payment-methods.test.ts`
Expected: FAIL with `Cannot find module './payment-methods'`

- [ ] **Step 3: Write the implementation**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/types/payment-methods.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/payment-methods.ts src/lib/types/payment-methods.test.ts
git commit -m "feat(payments): add shared PaymentMethodsEnabled type with icici flag"
```

---

### Task 2: Wire the shared type into the checkout page (no UI/behavior change)

**Files:**
- Modify: `src/app/register/[eventSlug]/checkout/page.tsx:122-130` (remove local `type PaymentMethod` and `interface PaymentMethodsEnabled`)
- Modify: `src/app/register/[eventSlug]/checkout/page.tsx:534-537` (use the shared default)

**Interfaces:**
- Consumes: `PaymentMethodsEnabled`, `DEFAULT_PAYMENT_METHODS_ENABLED` from `@/lib/types/payment-methods` (Task 1).

This task changes ONLY typing — `availablePaymentMethods` (the same file, lines ~540-561) is NOT touched, and must still only branch on `razorpay`/`bank_transfer`/`cash`/`free`. The local `PaymentMethod` union type (`"razorpay" | "bank_transfer" | "cash" | "free"`) stays exactly as-is — it describes which methods the UI can render, not which methods exist in config, and deliberately does not gain `"icici"` in this pass.

- [ ] **Step 1: Remove the local type definitions**

Find this block (current lines 122-130):

```typescript
type PaymentMethod = "razorpay" | "bank_transfer" | "cash" | "free"

interface PaymentMethodsEnabled {
  razorpay: boolean
  bank_transfer: boolean
  cash: boolean
  free: boolean
}
```

Replace with:

```typescript
type PaymentMethod = "razorpay" | "bank_transfer" | "cash" | "free"
```

(i.e., delete the local `interface PaymentMethodsEnabled` block entirely — keep the `PaymentMethod` union unchanged.)

- [ ] **Step 2: Add the import**

Near the top of the file, alongside the other `@/lib/...` imports, add:

```typescript
import { DEFAULT_PAYMENT_METHODS_ENABLED, type PaymentMethodsEnabled } from "@/lib/types/payment-methods"
```

- [ ] **Step 3: Replace the local default object**

Find this block (current lines 534-537):

```typescript
  // Get enabled payment methods from event
  const paymentMethods = useMemo(() => {
    const defaultMethods: PaymentMethodsEnabled = { razorpay: true, bank_transfer: false, cash: false, free: true }
    return event?.payment_methods_enabled || defaultMethods
  }, [event])
```

Replace with:

```typescript
  // Get enabled payment methods from event
  const paymentMethods = useMemo(() => {
    return (event?.payment_methods_enabled as PaymentMethodsEnabled | undefined) || DEFAULT_PAYMENT_METHODS_ENABLED
  }, [event])
```

- [ ] **Step 4: Verify the file still compiles and no other reference to the deleted local type remains**

Run: `npx tsc --noEmit -p . 2>&1 | grep "checkout/page.tsx" || echo "no errors in this file"`
Expected: `no errors in this file`

Run: `grep -n "interface PaymentMethodsEnabled" "src/app/register/[eventSlug]/checkout/page.tsx" || echo "no local interface remains"`
Expected: `no local interface remains`

- [ ] **Step 5: Commit**

```bash
git add "src/app/register/[eventSlug]/checkout/page.tsx"
git commit -m "refactor(payments): use shared PaymentMethodsEnabled type in checkout page"
```

---

### Task 3: Wire the shared type into the payment-settings admin page + add disabled ICICI toggle

**Files:**
- Modify: `src/app/events/[eventId]/payment-settings/page.tsx:66` (type the `payment_methods_enabled` field)
- Modify: `src/app/events/[eventId]/payment-settings/page.tsx:90` (use the shared default)
- Modify: `src/app/events/[eventId]/payment-settings/page.tsx` (grid at lines 176-301 — widen grid, add disabled ICICI tile)

**Interfaces:**
- Consumes: `PaymentMethodsEnabled`, `DEFAULT_PAYMENT_METHODS_ENABLED` from `@/lib/types/payment-methods` (Task 1). `CreditCard` icon, already imported in this file from `lucide-react` (line 10) — reused for ICICI, no new icon import needed.

- [ ] **Step 1: Add the import**

Near the top of the file, alongside the other imports, add:

```typescript
import { DEFAULT_PAYMENT_METHODS_ENABLED, type PaymentMethodsEnabled } from "@/lib/types/payment-methods"
```

- [ ] **Step 2: Type the `EventData` field**

Find (current line 66):

```typescript
    payment_methods_enabled: any
```

Replace with:

```typescript
    payment_methods_enabled: PaymentMethodsEnabled | null
```

- [ ] **Step 3: Replace the local default object**

Find (current line 90):

```typescript
        const defaultMethods = { razorpay: true, bank_transfer: false, cash: false, free: true }
```

Replace with:

```typescript
        const defaultMethods = DEFAULT_PAYMENT_METHODS_ENABLED
```

- [ ] **Step 4: Add the disabled ICICI tile to the toggle grid**

Find the grid container (current line 176):

```typescript
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
```

Change to (five tiles now, not four):

```typescript
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
```

Immediately after the closing `</button>` of the "Free" tile (the last tile in the grid, ending around current line 302 with `</button>` followed by the grid's closing `</div>`), insert a new, non-interactive tile:

```typescript
              {/* ICICI Payment Gateway -- coming soon, not yet toggleable */}
              <div
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-border opacity-60 cursor-not-allowed"
                title="ICICI Payment Gateway integration is not yet available"
              >
                <CreditCard className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  ICICI
                </span>
                <span className="text-xs text-muted-foreground">Coming soon</span>
              </div>
```

This is a plain `<div>`, not a `<button>` — it has no `onClick` and cannot toggle `payment_methods_enabled.icici`. The dashed border, reduced opacity, and "not-allowed" cursor visually distinguish it from the four live, clickable tiles.

- [ ] **Step 5: Verify the page still compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "payment-settings/page.tsx" || echo "no errors in this file"`
Expected: `no errors in this file`

- [ ] **Step 6: Commit**

```bash
git add "src/app/events/[eventId]/payment-settings/page.tsx"
git commit -m "feat(payments): add disabled ICICI toggle to payment-settings admin page"
```

---

### Task 4: Wire the shared default into the payment-settings API route

**Files:**
- Modify: `src/app/api/events/[eventId]/payment-settings/route.ts:1-3` (add import)
- Modify: `src/app/api/events/[eventId]/payment-settings/route.ts:42-47` (use the shared default)

**Interfaces:**
- Consumes: `DEFAULT_PAYMENT_METHODS_ENABLED` from `@/lib/types/payment-methods` (Task 1).

- [ ] **Step 1: Add the import**

At the top of the file, alongside the existing imports:

```typescript
import { DEFAULT_PAYMENT_METHODS_ENABLED } from "@/lib/types/payment-methods"
```

- [ ] **Step 2: Replace the inline default fallback**

Find (current lines 42-47):

```typescript
        payment_methods_enabled: payment_methods_enabled || {
          razorpay: true,
          bank_transfer: false,
          cash: false,
          free: true,
        },
```

Replace with:

```typescript
        payment_methods_enabled: payment_methods_enabled || DEFAULT_PAYMENT_METHODS_ENABLED,
```

- [ ] **Step 3: Verify the route still compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep "events/\[eventId\]/payment-settings/route.ts" || echo "no errors in this file"`
Expected: `no errors in this file`

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/events/[eventId]/payment-settings/route.ts"
git commit -m "refactor(payments): use shared default in payment-settings API route"
```

---

### Task 5: `PaymentGatewayService` interface + ICICI stub implementation

**Files:**
- Create: `src/lib/services/payment-gateway.ts`
- Create: `src/lib/services/icici.ts`
- Test: `src/lib/services/icici.test.ts`

**Interfaces:**
- Produces: `PaymentGatewayService`, `CreateOrderParams`, `GatewayOrder`, `VerifySignatureParams` (in `payment-gateway.ts`); `iciciGateway: PaymentGatewayService` (in `icici.ts`). Neither is imported by any other file in this plan — both are new, unwired scaffolding for a future pass.

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/icici.test.ts`
Expected: FAIL with `Cannot find module './icici'`

- [ ] **Step 3: Write the interface**

`src/lib/services/payment-gateway.ts`:

```typescript
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
```

- [ ] **Step 4: Write the ICICI stub**

`src/lib/services/icici.ts`:

```typescript
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/services/icici.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/payment-gateway.ts src/lib/services/icici.ts src/lib/services/icici.test.ts
git commit -m "feat(payments): add PaymentGatewayService interface and ICICI stub"
```

---

## After all tasks

Run the full test suite and typecheck once to confirm nothing regressed:

```bash
npx vitest run
npx tsc --noEmit -p .
```

**Not part of this plan, deliberately**: any real ICICI API integration, any change to the checkout page's payment-method selection logic, any change to the Razorpay routes, and removing the admin toggle's disabled state. All of these wait for real ICICI merchant credentials and API documentation.
