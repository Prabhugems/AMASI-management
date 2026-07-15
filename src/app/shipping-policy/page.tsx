import { PolicyPage, requireEssurgTenant } from "@/components/policies/policy-page"

export const metadata = { title: "Shipping Policy | ESSURG 2026" }

export default function ShippingPolicyPage() {
  requireEssurgTenant()

  return (
    <PolicyPage title="Shipping Policy" updated="15 July 2026">
      <p>
        ESSURG 2026 is a professional conference. We do not sell or ship physical goods.
      </p>
      <p>
        Registration confirmation, payment receipts, GST invoices, badges, and certificates of attendance are
        delivered electronically to the email address provided at registration. Conference kits, printed badges,
        and any physical materials are distributed in person at the registration desk during the Congress
        (27&ndash;29 November 2026, Kalakriti Cultural &amp; Convention Centre, Agra, India) &mdash; nothing is
        physically shipped or couriered to participants.
      </p>
      <p>
        For questions about receiving your registration documents, contact{" "}
        <a href="mailto:registrations@essurg2026.org">registrations@essurg2026.org</a>.
      </p>
    </PolicyPage>
  )
}
