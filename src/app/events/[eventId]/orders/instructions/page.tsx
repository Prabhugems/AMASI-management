"use client"

import {
  CreditCard,
  Package,
  Ticket,
  IndianRupee,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  FileText,
  HelpCircle,
  AlertTriangle,
  ArrowRight,
} from "lucide-react"

export default function OrdersInstructionsPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Orders & Payments Guide</h1>
        <p className="text-muted-foreground mt-1">
          Understanding how orders and payments work in the system
        </p>
      </div>

      {/* Order Types */}
      <section className="paper-card p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-primary" />
          Order Types
        </h2>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/30 border-l-4 border-primary">
            <h3 className="font-medium flex items-center gap-2">
              <Ticket className="w-4 h-4" />
              Registration Order
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              When a delegate registers for an event and pays for their ticket. This creates a new registration
              and links it to the payment.
            </p>
            <div className="mt-2 text-sm">
              <span className="font-medium">Shows:</span> Ticket details, attendee info, ticket price
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border-l-4 border-info">
            <h3 className="font-medium flex items-center gap-2">
              <Package className="w-4 h-4" />
              Add-on Purchase
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              When an existing delegate purchases additional add-ons (courses, workshops, etc.) for their
              registration. The ticket was already paid in a previous order.
            </p>
            <div className="mt-2 text-sm">
              <span className="font-medium">Shows:</span> Linked registration info (no ticket price), add-on details
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border-l-4 border-warning">
            <h3 className="font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Admin Uploaded / Offline
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Registrations created by admin where payment was collected offline (cash, bank transfer, etc.).
              These don&apos;t have Razorpay payment IDs.
            </p>
            <div className="mt-2 text-sm">
              <span className="font-medium">Payment Method:</span> Shows as &quot;offline&quot; or &quot;admin&quot;
            </div>
          </div>
        </div>
      </section>

      {/* Payment Status */}
      <section className="paper-card p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <IndianRupee className="w-5 h-5 text-primary" />
          Payment Status
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <span className="font-medium text-success">Paid / Completed</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Payment successfully received. Registration is confirmed.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-warning" />
              <span className="font-medium text-warning">Pending</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Payment initiated but not completed. Razorpay order created, awaiting payment.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              <span className="font-medium text-destructive">Failed</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Payment failed or was declined. Delegate may retry payment.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-info/10 border border-info/20">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-info" />
              <span className="font-medium text-info">Refunded</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Payment was refunded to the customer.
            </p>
          </div>
        </div>
      </section>

      {/* How Amounts Work */}
      <section className="paper-card p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-primary" />
          Understanding Amounts
        </h2>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/30">
            <h3 className="font-medium">Registration Order Calculation</h3>
            <div className="mt-2 text-sm space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Ticket Price</span>
                <span>+ Amount</span>
              </div>
              <div className="flex justify-between">
                <span>Add-ons (if any)</span>
                <span>+ Amount</span>
              </div>
              <div className="flex justify-between">
                <span>Tax (GST 18%)</span>
                <span>+ Amount</span>
              </div>
              <div className="flex justify-between">
                <span>Discount (if applied)</span>
                <span>- Amount</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1">
                <span>Total Paid</span>
                <span>= Net Amount</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/30">
            <h3 className="font-medium">Add-on Purchase Calculation</h3>
            <div className="mt-2 text-sm space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Add-on Price</span>
                <span>+ Amount</span>
              </div>
              <div className="flex justify-between">
                <span>Tax (GST 18%)</span>
                <span>+ Amount</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1">
                <span>Total Paid</span>
                <span>= Net Amount</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Note: Ticket price is NOT included - it was paid in the original registration order.
            </p>
          </div>
        </div>
      </section>

      {/* Important Notes */}
      <section className="paper-card p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-warning" />
          Important Notes
        </h2>
        <ul className="space-y-3 text-sm">
          <li className="flex gap-2">
            <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>
              <strong>Pending orders</strong> are automatically expired after 5 minutes. If a delegate&apos;s
              payment didn&apos;t go through, they can retry from their delegate portal.
            </span>
          </li>
          <li className="flex gap-2">
            <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>
              <strong>Duplicate prevention:</strong> The system prevents duplicate payments within a 5-minute
              window for the same email and amount.
            </span>
          </li>
          <li className="flex gap-2">
            <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>
              <strong>Add-on prices</strong> are fetched from the database to ensure correct pricing even
              if admin uploads registrations without specifying prices.
            </span>
          </li>
          <li className="flex gap-2">
            <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>
              <strong>Receipts</strong> show the actual amounts paid in that specific order. For add-on
              purchases, the receipt shows only the add-on amount (not the original ticket).
            </span>
          </li>
          <li className="flex gap-2">
            <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>
              <strong>Registration total</strong> in the attendee view shows Ticket + Add-ons combined,
              representing the total value of their registration.
            </span>
          </li>
        </ul>
      </section>

      {/* Razorpay Integration */}
      <section className="paper-card p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-primary" />
          Razorpay Integration
        </h2>
        <div className="space-y-3 text-sm">
          <p>
            All online payments are processed through Razorpay. Each event can have its own Razorpay
            credentials configured in Event Settings.
          </p>
          <div className="p-4 rounded-lg bg-muted/30">
            <h3 className="font-medium mb-2">Payment Flow</h3>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Delegate initiates payment → Order created in Razorpay</li>
              <li>Razorpay checkout opens → Delegate completes payment</li>
              <li>Payment verified → Registration confirmed</li>
              <li>Auto-actions triggered (receipt email, badge generation, etc.)</li>
            </ol>
          </div>
          <p className="text-muted-foreground">
            <strong>Razorpay IDs:</strong> Order ID (order_xxx) is created first, Payment ID (pay_xxx) is
            generated after successful payment.
          </p>
        </div>
      </section>
    </div>
  )
}
