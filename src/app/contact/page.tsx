import { PolicyPage, requireTenantIn } from "@/components/policies/policy-page"

export const metadata = { title: "Contact Us" }

export default function ContactPage() {
  const tenant = requireTenantIn(["essurg", "cos"])
  return tenant === "cos" ? <CosContact /> : <EssurgContact />
}

function EssurgContact() {
  return (
    <PolicyPage title="Contact Us" updated="15 July 2026" brand="essurg">
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

function CosContact() {
  return (
    <PolicyPage title="Contact Us" updated="27 July 2026" brand="cos">
      <h2>TAMILCON 2026 Organising Committee</h2>
      <p>Hosted by Coimbatore Orthopaedic Society, in association with the Tamilnadu Orthopaedic Association</p>

      <h2>Organising Chairman</h2>
      <p>Dr. B.R.J. Satish Kumar</p>

      <h2>Organising Secretary</h2>
      <p>Dr. M. Karthik Selvaraj</p>

      <h2>Email</h2>
      <p>
        <a href="mailto:cbetamilcon2026@gmail.com">cbetamilcon2026@gmail.com</a>
      </p>

      <h2>Phone / WhatsApp</h2>
      <p>
        94426 33111<br />
        97902 10633
      </p>

      <h2>Venue</h2>
      <p>
        Hotel Merlis Coimbatore<br />
        Coimbatore, Tamil Nadu, India
      </p>
    </PolicyPage>
  )
}
