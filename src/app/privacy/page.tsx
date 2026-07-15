import { PolicyPage, requireEssurgTenant } from "@/components/policies/policy-page"

export const metadata = { title: "Privacy Policy | ESSURG 2026" }

export default function PrivacyPolicyPage() {
  requireEssurgTenant()

  return (
    <PolicyPage title="Privacy Policy" updated="15 July 2026">
      <p>
        This Privacy Policy explains how the ESSURG 2026 Secretariat and Chiktsa Foundation (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collect, use, and store your information when you register for or participate in ESSURG
        2026.
      </p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li><strong>Contact information:</strong> name, email address, mobile/WhatsApp number, postal address, institution, designation.</li>
        <li><strong>Professional registration documents:</strong> qualification proof (e.g. MBBS, MS, DNB), institutional/residency certificates, medical council or society registration numbers (ASI, AMASI, NMC, or equivalent), submitted to verify your registration category.</li>
        <li><strong>Identity documents:</strong> photo ID, passport details (for international faculty/delegates, where applicable), used for eligibility verification and, for accompanying persons, for badge issuance.</li>
        <li><strong>Payment and invoice data:</strong> payment reference/transaction ID, billing name, GSTIN/PAN (for invoicing), amount paid, and payment method. Card and bank credentials are processed directly by our payment gateway and are not stored by us.</li>
        <li><strong>Other:</strong> dietary preference, accessibility needs, abstract submissions, workshop preferences, and any documents you voluntarily upload during registration.</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To process your registration, verify eligibility, and confirm payment.</li>
        <li>To issue badges, certificates, GST invoices/receipts, and workshop allotments.</li>
        <li>To communicate with you about the Congress by email, SMS, WhatsApp, or telephone (registration confirmations, schedule updates, reminders).</li>
        <li>To administer workshops, abstract review, and check-in at the venue.</li>
        <li>To comply with applicable tax, statutory, and regulatory requirements (including GST invoicing).</li>
      </ul>

      <h2>3. How We Store and Protect Your Information</h2>
      <p>
        Your data is stored on secure, access-controlled cloud infrastructure. Professional registration and
        identity documents are used solely for eligibility verification and are accessible only to authorised
        Secretariat staff. We retain registration records, including eligibility and payment documentation, for
        as long as needed for Congress administration, GST/statutory compliance, and audit purposes, after which
        they are securely deleted or anonymised.
      </p>

      <h2>4. Sharing of Information</h2>
      <p>
        We do not sell your personal information. We share data only with: (a) our payment gateway, to process
        payments and refunds; (b) our email/WhatsApp service providers, to send Congress communications; (c) the
        venue, for badge/check-in purposes; and (d) regulatory or tax authorities where legally required. Service
        providers are only given the information necessary to perform their function.
      </p>

      <h2>5. Photography and Recording</h2>
      <p>
        Congress photography, videography, and recording may take place for documentation, academic, archival,
        and promotional purposes. If you do not wish to be photographed, please notify the Secretariat at
        registration.
      </p>

      <h2>6. Your Rights</h2>
      <p>
        You may request access to, correction of, or deletion of your personal information (subject to our
        statutory retention obligations for payment and tax records) by contacting{" "}
        <a href="mailto:registrations@essurg2026.org">registrations@essurg2026.org</a>.
      </p>

      <h2>7. Contact</h2>
      <p>
        For privacy-related questions, see our <a href="/contact">Contact Us</a> page or email{" "}
        <a href="mailto:registrations@essurg2026.org">registrations@essurg2026.org</a>.
      </p>
    </PolicyPage>
  )
}
