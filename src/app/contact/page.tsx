import { PolicyPage, requireEssurgTenant } from "@/components/policies/policy-page"

export const metadata = { title: "Contact Us | ESSURG 2026" }

export default function ContactPage() {
  requireEssurgTenant()

  return (
    <PolicyPage title="Contact Us" updated="15 July 2026">
      <h2>ESSURG 2026 Secretariat</h2>
      <p>Local Organising Secretariat: Chiktsa Foundation, Agra</p>

      <h2>Email</h2>
      <p>
        <a href="mailto:registrations@essurg2026.org">registrations@essurg2026.org</a>
      </p>

      <h2>Phone / WhatsApp</h2>
      <p>
        +91 97190 66850<br />
        +91 98977 94208
      </p>

      <h2>Postal / Courier Address</h2>
      <p>
        ESSURG 2026 Secretariat, Chiktsa Foundation<br />
        C-139, MMIG, Kedar Nagar<br />
        Agra, Uttar Pradesh, India
      </p>

      <h2>Website</h2>
      <p>
        <a href="https://essurg2026.org">essurg2026.org</a>
      </p>

      <h2>GSTIN</h2>
      <p>09AADTC0826B1Z8</p>
    </PolicyPage>
  )
}
