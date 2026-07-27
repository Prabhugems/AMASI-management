import { PolicyPage, requireTenantIn } from "@/components/policies/policy-page"

export const metadata = { title: "Shipping Policy" }

export default function ShippingPolicyPage() {
  const tenant = requireTenantIn(["essurg", "cos"])
  return tenant === "cos" ? <CosShipping /> : <EssurgShipping />
}

function EssurgShipping() {
  return (
    <PolicyPage title="Shipping Policy" updated="15 July 2026" brand="essurg">
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

function CosShipping() {
  return (
    <PolicyPage title="Shipping Policy" updated="27 July 2026" brand="cos">
      <p>
        TAMILCON 2026 is a professional conference. We do not sell or ship physical goods.
      </p>
      <p>
        Registration confirmation and payment receipts are delivered electronically to the email address provided
        at registration. Delegate kits, printed badges, and any physical materials are distributed in person at
        the registration desk during the Conference (3&ndash;4 October 2026, Hotel Merlis Coimbatore, Coimbatore,
        Tamil Nadu) &mdash; nothing is physically shipped or couriered to participants.
      </p>
      <p>
        For questions about receiving your registration documents, contact{" "}
        <a href="mailto:cbetamilcon2026@gmail.com">cbetamilcon2026@gmail.com</a>.
      </p>
    </PolicyPage>
  )
}
