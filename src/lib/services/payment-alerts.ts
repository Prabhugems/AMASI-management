/**
 * Payment Error Alerting Service
 *
 * Sends email alerts to admin when payment issues are detected:
 * - payment_failed: Razorpay payment failed
 * - orphan_payment: Reconciliation found unmatched payment
 * - registration_missing: Payment exists but no registration
 * - refund_failed: Auto-refund failed
 */

import { sendEmail } from "@/lib/email"
import { COMPANY_CONFIG } from "@/lib/config"

export type PaymentAlertType =
  | "payment_failed"
  | "orphan_payment"
  | "registration_missing"
  | "refund_failed"

export interface PaymentAlertDetails {
  delegateName?: string
  delegateEmail?: string
  amount?: number
  currency?: string
  razorpayPaymentId?: string
  razorpayOrderId?: string
  errorCode?: string
  errorDescription?: string
  eventId?: string
  eventName?: string
  /** Extra context for the alert */
  notes?: string
}

const ALERT_LABELS: Record<PaymentAlertType, string> = {
  payment_failed: "Payment Failed",
  orphan_payment: "Orphan Payment Detected",
  registration_missing: "Registration Missing",
  refund_failed: "Refund Failed",
}

const ALERT_ACTIONS: Record<PaymentAlertType, string> = {
  payment_failed:
    "Check if the delegate needs assistance retrying the payment. Review error details in the Razorpay dashboard.",
  orphan_payment:
    "Match this payment to the correct event and delegate in the admin panel. If no match is found, consider issuing a refund.",
  registration_missing:
    "Verify whether the delegate completed registration. If not, create a registration manually or contact the delegate.",
  refund_failed:
    "Manually process the refund via the Razorpay dashboard. Contact the delegate to confirm.",
}

const SEVERITY_COLORS: Record<PaymentAlertType, string> = {
  payment_failed: "#e74c3c",
  orphan_payment: "#e67e22",
  registration_missing: "#f39c12",
  refund_failed: "#e74c3c",
}

function getAdminEmail(): string {
  return (
    process.env.ADMIN_ALERT_EMAIL?.trim() ||
    COMPANY_CONFIG.supportEmail ||
    "support@amasi.org"
  )
}

function formatCurrency(amount?: number, currency?: string): string {
  if (amount == null) return "N/A"
  const symbol = currency === "INR" || !currency ? "\u20B9" : currency
  return `${symbol}${amount.toLocaleString("en-IN")}`
}

function buildAlertHtml(
  type: PaymentAlertType,
  details: PaymentAlertDetails,
): string {
  const label = ALERT_LABELS[type]
  const action = ALERT_ACTIONS[type]
  const color = SEVERITY_COLORS[type]
  const timestamp = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  })

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f7;color:#333;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:${color};padding:20px 24px;">
            <h1 style="margin:0;color:#fff;font-size:20px;">${label}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:24px;">
            <table width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;">
              <tr>
                <td style="color:#666;width:160px;">Alert Type</td>
                <td><strong>${type}</strong></td>
              </tr>
              <tr>
                <td style="color:#666;">Timestamp</td>
                <td>${timestamp}</td>
              </tr>
              ${details.delegateName ? `<tr><td style="color:#666;">Delegate Name</td><td>${details.delegateName}</td></tr>` : ""}
              ${details.delegateEmail ? `<tr><td style="color:#666;">Delegate Email</td><td>${details.delegateEmail}</td></tr>` : ""}
              ${details.amount != null ? `<tr><td style="color:#666;">Amount</td><td>${formatCurrency(details.amount, details.currency)}</td></tr>` : ""}
              ${details.razorpayPaymentId ? `<tr><td style="color:#666;">Razorpay Payment ID</td><td style="font-family:monospace;">${details.razorpayPaymentId}</td></tr>` : ""}
              ${details.razorpayOrderId ? `<tr><td style="color:#666;">Razorpay Order ID</td><td style="font-family:monospace;">${details.razorpayOrderId}</td></tr>` : ""}
              ${details.errorCode ? `<tr><td style="color:#666;">Error Code</td><td>${details.errorCode}</td></tr>` : ""}
              ${details.errorDescription ? `<tr><td style="color:#666;">Error Description</td><td>${details.errorDescription}</td></tr>` : ""}
              ${details.eventId ? `<tr><td style="color:#666;">Event ID</td><td style="font-family:monospace;">${details.eventId}</td></tr>` : ""}
              ${details.eventName ? `<tr><td style="color:#666;">Event</td><td>${details.eventName}</td></tr>` : ""}
              ${details.notes ? `<tr><td style="color:#666;">Notes</td><td>${details.notes}</td></tr>` : ""}
            </table>

            <div style="margin-top:20px;padding:14px;background:#fef9e7;border-left:4px solid #f39c12;border-radius:4px;">
              <strong style="font-size:13px;color:#7d6608;">Action Needed:</strong>
              <p style="margin:6px 0 0;font-size:13px;color:#333;">${action}</p>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 24px;background:#f9f9f9;font-size:12px;color:#999;text-align:center;">
            ${COMPANY_CONFIG.name} &mdash; Payment Alert System
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/**
 * Send a payment alert email to the admin.
 * Fails silently (logs errors) so it never breaks the calling flow.
 */
export async function sendPaymentAlert(
  type: PaymentAlertType,
  details: PaymentAlertDetails,
): Promise<void> {
  const label = ALERT_LABELS[type]
  const adminEmail = getAdminEmail()

  console.log(
    `[PAYMENT ALERT] ${type}: payment=${details.razorpayPaymentId || "N/A"}, ` +
      `delegate=${details.delegateEmail || "N/A"}, amount=${details.amount ?? "N/A"}`,
  )

  try {
    const result = await sendEmail({
      to: adminEmail,
      subject: `[${COMPANY_CONFIG.name}] ${label} — ${details.razorpayPaymentId || "Unknown Payment"}`,
      html: buildAlertHtml(type, details),
    })

    if (!result.success) {
      console.error(`[PAYMENT ALERT] Failed to send alert email: ${result.error}`)
    } else {
      console.log(`[PAYMENT ALERT] Alert email sent to ${adminEmail} (id: ${result.id})`)
    }
  } catch (err) {
    console.error("[PAYMENT ALERT] Error sending alert email:", err)
  }
}
