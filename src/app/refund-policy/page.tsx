import { PolicyPage, requireEssurgTenant } from "@/components/policies/policy-page"

export const metadata = { title: "Cancellation & Refund Policy | ESSURG 2026" }

export default function RefundPolicyPage() {
  requireEssurgTenant()

  return (
    <PolicyPage title="Cancellation & Refund Policy" updated="15 July 2026">
      <h2>1. Cancellation Deadlines and Deductions</h2>
      <p>Refunds are calculated based on the date your written cancellation request is received:</p>
      <table>
        <thead>
          <tr>
            <th>Request received</th>
            <th>Main Congress registration</th>
            <th>Workshop registration</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>On or before 31 August 2026</td>
            <td>Full refund</td>
            <td>Full refund, unless the seat has already been transferred from the waitlist</td>
          </tr>
          <tr>
            <td>On or after 1 September 2026</td>
            <td>50% refund</td>
            <td>50% refund, subject to workshop seat status</td>
          </tr>
          <tr>
            <td>No-show / partial attendance</td>
            <td>No refund</td>
            <td>No refund</td>
          </tr>
        </tbody>
      </table>

      <h2>2. Workshops Are Separately Refundable</h2>
      <p>
        Workshop fees are refunded independently of the main Congress registration fee, following the same
        deadline schedule above. Cancelling a workshop does not cancel your main registration, and vice versa.
        If the Organising Committee cancels a workshop, affected delegates may be offered an alternative workshop,
        waitlist priority, or a refund/adjustment of that workshop fee, at the Secretariat&rsquo;s discretion.
      </p>

      <h2>3. Transfers and Name Changes</h2>
      <p>
        Registration is non-transferable except with prior written approval of the ESSURG 2026 Secretariat. Where
        approved, name substitutions must be completed before 31 October 2026 and may be subject to administrative
        charges.
      </p>

      <h2>4. Refund Processing Time</h2>
      <p>
        Approved refunds are processed within 15&ndash;30 business days of approval, to the original payment
        method or registered bank account, after verification and deduction of applicable administrative,
        banking, gateway, or statutory charges. All refund requests must be submitted in writing to the ESSURG
        2026 Secretariat with your registration ID and payment proof.
      </p>

      <h2>5. Rejected Eligibility Applications</h2>
      <p>
        Category eligibility (e.g. Resident/Trainee proof, National Faculty registration proof, International
        Faculty licence proof) is verified by the Secretariat. If a submitted registration&rsquo;s eligibility
        documents cannot be verified or are rejected, and no alternative eligible category applies, the
        registration fee is refunded in full, less any payment gateway processing charges actually incurred.
      </p>

      <h2>6. Event Postponement, Cancellation and Force Majeure</h2>
      <p>
        In the event of circumstances beyond reasonable control &mdash; including government restrictions, public
        health advisories, natural disaster, civil disturbance, venue disruption, faculty travel disruption,
        equipment failure, or other force majeure events &mdash; the Organising Committee may reschedule, modify,
        relocate, combine, replace, or cancel sessions or workshops. If the Congress itself is postponed,
        registrations are automatically carried over to the rescheduled date; if the Congress is cancelled
        outright, registration fees are refunded in full, less any payment gateway or statutory charges actually
        incurred. Our liability is limited to the registration/workshop fee actually received.
      </p>

      <h2>7. International Refunds and Currency Conversion</h2>
      <p>
        Refunds for payments made in a currency other than the original payment currency, or refunds to
        international bank accounts, are issued in the original payment currency. Any difference arising from
        currency conversion, foreign-exchange rate movement, or international transfer/wire charges is borne by
        the participant and is not covered by ESSURG 2026 or Chiktsa Foundation.
      </p>

      <h2>8. How to Request a Refund or Cancellation</h2>
      <p>
        Email <a href="mailto:registrations@essurg2026.org">registrations@essurg2026.org</a> with your
        registration ID, payment proof, and reason for cancellation. See our <a href="/contact">Contact Us</a>
        page for additional contact options.
      </p>
    </PolicyPage>
  )
}
