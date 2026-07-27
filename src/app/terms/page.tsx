import { PolicyPage, requireTenantIn } from "@/components/policies/policy-page"

export const metadata = { title: "Terms & Conditions" }

export default function TermsPage() {
  const tenant = requireTenantIn(["essurg", "cos"])
  return tenant === "cos" ? <CosTerms /> : <EssurgTerms />
}

function EssurgTerms() {
  return (
    <PolicyPage title="Terms & Conditions" updated="15 July 2026" brand="essurg">
      <p>
        These Terms &amp; Conditions govern registration and participation in ESSURG 2026, the 28th Annual
        Congress of the European Society of Surgery, held 27&ndash;29 November 2026 at Kalakriti Cultural &amp;
        Convention Centre, Agra, India (&ldquo;the Congress&rdquo;), organised by the ESSURG 2026 Secretariat in
        association with Chiktsa Foundation (&ldquo;the Organising Committee&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
        By registering, you agree to these terms.
      </p>

      <h2>1. Eligibility and Registration Categories</h2>
      <p>
        Registration categories (Residents/Trainees, Delegates, National Faculty, International Faculty) each
        require category-specific eligibility proof as described on the registration form. The Organising
        Committee reserves the right to verify eligibility documents and to reclassify or decline a registration
        if the submitted category is not supported by valid proof.
      </p>

      <h2>2. Fees</h2>
      <p>
        Registration fees are published on the <a href="/register/essurg-2026">registration page</a> and are
        inclusive of GST unless stated otherwise. Fees are charged in a deadline-based slab (Early Bird / Regular
        / Late / Spot); the applicable slab is determined by the date of successful payment, in Indian Standard
        Time.
      </p>

      <h2>3. Workshops</h2>
      <p>
        Workshop enrolment is available only to delegates who have completed main Congress registration. Standard
        enrolment permits a maximum of three workshops per delegate. Workshop seats are limited and allotted on a
        first-paid, first-confirmed basis; selecting a workshop does not guarantee a seat until payment is
        completed and confirmation is issued.
      </p>

      <h2>4. Conduct</h2>
      <p>
        By registering, you agree to follow Congress policies, venue rules, scientific-session rules, and
        professional conduct requirements. The Organising Committee reserves the right to refuse or cancel a
        registration in case of misrepresentation, non-payment, invalid proof, misconduct, or violation of
        Congress policy.
      </p>

      <h2>5. Programme Changes</h2>
      <p>
        The Organising Committee may modify workshop faculty, timing, venue, capacity, content, format, or batch
        allocation for scientific, safety, logistical, or operational reasons. Certificates of attendance and
        workshop certificates are issued only after attendance and completion are verified.
      </p>

      <h2>6. Cancellation, Transfer and Refunds</h2>
      <p>
        Cancellations, transfers, and refunds are governed by our{" "}
        <a href="/refund-policy">Cancellation &amp; Refund Policy</a>, which forms part of these Terms.
      </p>

      <h2>7. Payment</h2>
      <p>
        Payment is accepted through the official registration portal or an approved payment gateway. Bank
        charges, international transfer charges, foreign-exchange differences, and payment gateway charges, if
        any, may be borne by the participant unless specifically waived. Registration is confirmed only after
        successful payment reconciliation and, where applicable, verification of eligibility documents.
      </p>

      <h2>8. Limitation of Liability</h2>
      <p>
        In the event of circumstances beyond reasonable control &mdash; including government restrictions, public
        health advisories, natural disaster, civil disturbance, venue disruption, faculty travel disruption, or
        equipment failure &mdash; the Organising Committee may reschedule, modify, relocate, combine, replace, or
        cancel sessions or workshops. Our liability is limited to the registration/workshop fee actually received
        and approved for refund under the applicable policy.
      </p>

      <h2>9. Governing Decision</h2>
      <p>
        The decision of the Organising Chairman / ESSURG 2026 Secretariat is final regarding registration
        category, workshop allotment, substitutions, refunds, and operational matters.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these Terms can be sent to <a href="mailto:registrations@essurg2026.org">registrations@essurg2026.org</a>.
        See our <a href="/contact">Contact Us</a> page for full details.
      </p>
    </PolicyPage>
  )
}

function CosTerms() {
  return (
    <PolicyPage title="Terms & Conditions" updated="27 July 2026" brand="cos">
      <p>
        These Terms &amp; Conditions govern registration and participation in TAMILCON 2026, the 4th TNOA Tamil
        Orthopaedic Conference, held 3&ndash;4 October 2026 at Hotel Merlis Coimbatore, Coimbatore, Tamil Nadu
        (&ldquo;the Conference&rdquo;), organised by the Coimbatore Orthopaedic Society in association with the
        Tamilnadu Orthopaedic Association (&ldquo;the Organising Committee&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
        By registering, you agree to these terms.
      </p>

      <h2>1. Eligibility and Registration Categories</h2>
      <p>
        Registration categories &mdash; TNOA/Local Society Members, Non-Members, Postgraduates, and Spot
        registration &mdash; each require category-specific proof as described on the registration form (e.g.
        TNOA/local society membership number, or institutional ID for postgraduates). The Organising Committee
        reserves the right to verify eligibility and to reclassify or decline a registration if the submitted
        category is not supported by valid proof.
      </p>

      <h2>2. Fees</h2>
      <p>
        Registration fees are published on the <a href="/register/tamilcon-2026">registration page</a>. Early
        Bird fees apply to payments completed on or before 31 July 2026; the Regular fee applies from 1 August to
        15 October 2026; Spot registration is a fixed &#8377;5,000. Fees include scientific sessions, workshop
        kit, lunch, and the conference dinner.
      </p>

      <h2>3. Conduct</h2>
      <p>
        By registering, you agree to follow Conference policies, venue rules, scientific-session rules, and
        professional conduct requirements. The Organising Committee reserves the right to refuse or cancel a
        registration in case of misrepresentation, non-payment, invalid proof, or misconduct.
      </p>

      <h2>4. Programme Changes</h2>
      <p>
        The Organising Committee may modify faculty, timing, venue, capacity, content, or format for scientific,
        safety, logistical, or operational reasons. Certificates of attendance are issued only after attendance is
        verified.
      </p>

      <h2>5. Cancellation, Transfer and Refunds</h2>
      <p>
        Cancellations, transfers, and refunds are governed by our{" "}
        <a href="/refund-policy">Cancellation &amp; Refund Policy</a>, which forms part of these Terms.
      </p>

      <h2>6. Payment</h2>
      <p>
        Payment is accepted through the official registration portal via an approved payment gateway. Payment
        gateway charges, if any, may be borne by the participant unless specifically waived. Registration is
        confirmed only after successful payment reconciliation and, where applicable, verification of eligibility
        documents.
      </p>

      <h2>7. Limitation of Liability</h2>
      <p>
        In the event of circumstances beyond reasonable control &mdash; including government restrictions, public
        health advisories, natural disaster, civil disturbance, or venue disruption &mdash; the Organising
        Committee may reschedule, modify, relocate, or cancel sessions. Our liability is limited to the
        registration fee actually received and approved for refund under the applicable policy.
      </p>

      <h2>8. Governing Decision</h2>
      <p>
        The decision of the Organising Chairman / Coimbatore Orthopaedic Society is final regarding registration
        category, substitutions, refunds, and operational matters.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about these Terms can be sent to <a href="mailto:cbetamilcon2026@gmail.com">cbetamilcon2026@gmail.com</a>.
        See our <a href="/contact">Contact Us</a> page for full details.
      </p>
    </PolicyPage>
  )
}
