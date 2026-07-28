import { Reveal } from "@/components/reveal"

const REGISTER_URL = "/register/tamilcon-2026"
const BROCHURE_URL = "/tamilcon-2026-brochure.pdf"

const HIGHLIGHTS = [
  "Scientific sessions on Trauma, Joint Replacement, Arthroscopy, Spine, Paediatrics, and Sports Medicine",
  "Live surgical demonstrations",
  "Keynote addresses by national and international faculty",
  "Free paper presentations, e-posters, and award sessions",
  "Industry exhibition showcasing the latest implants, instruments, and technologies",
  "Cultural evening & networking dinner",
]

const WHY_ATTEND = [
  "Earn CME credit hours",
  "Update your knowledge with evidence-based practices",
  "Connect with 500+ orthopaedic surgeons, residents, and academicians",
  "Explore emerging trends in robotic surgery, biologics, and AI in orthopaedics",
]

// Brochure order — matches the printed "Registration Fees for delegates" table.
const FEE_CATEGORY_ORDER = ["TNOA / Local Society Members", "Non-Members", "Post Graduates"]

// ticket_types rows are seeded as separate "<Category> - Early Bird" / "<Category> - Regular"
// tickets; this pivots them back into the brochure's two-column-per-category table shape.
function groupFeeRows(tickets: { id: string; name: string; price: string }[]) {
  const byCategory = new Map<string, { earlyBird?: string; regular?: string }>()
  for (const ticket of tickets) {
    const earlyBirdMatch = ticket.name.match(/^(.*) - Early Bird$/)
    const regularMatch = ticket.name.match(/^(.*) - Regular$/)
    if (earlyBirdMatch) {
      const category = earlyBirdMatch[1]
      byCategory.set(category, { ...byCategory.get(category), earlyBird: ticket.price })
    } else if (regularMatch) {
      const category = regularMatch[1]
      byCategory.set(category, { ...byCategory.get(category), regular: ticket.price })
    }
  }
  return FEE_CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => ({
    category,
    ...byCategory.get(category)!,
  }))
}

export function TamilconLandingPage({ tickets }: { tickets: { id: string; name: string; price: string }[] }) {
  return (
    <div className="bg-[#FAFAF7] text-[#1C1917]" style={{ fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap"
        rel="stylesheet"
      />

      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-[#FAFAF7]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold tracking-tight text-[#3B0764]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            TAMILCON 2026
          </span>
          <div className="flex items-center gap-3">
            <a
              href="/my"
              className="inline-flex items-center h-10 px-5 rounded-full border border-[#3B0764]/20 text-[#3B0764] text-sm font-semibold hover:bg-[#3B0764]/5 transition-colors"
            >
              Delegate Portal
            </a>
            <a
              href={REGISTER_URL}
              className="inline-flex items-center h-10 px-5 rounded-full bg-[#3B0764] text-white text-sm font-semibold hover:bg-[#2A0548] transition-colors"
            >
              Register
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(59,7,100,0.08) 0%, transparent 70%)" }} />
        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-5">
              4th TNOA Tamil Orthopaedic Conference &middot; Hosted by Coimbatore Orthopaedic Society
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              TAMILCON 2026
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-lg sm:text-xl text-[#57534E] italic mb-8">
              &ldquo;Innovate Collaborate, Elevate Patient Care&rdquo;
            </p>
          </Reveal>
          <Reveal delay={300}>
            <p className="text-base sm:text-lg text-[#44403C] mb-10">
              3&ndash;4 October 2026 &middot; Hotel Merlis, Coimbatore, Tamil Nadu
            </p>
          </Reveal>
          <Reveal delay={400}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={REGISTER_URL}
                className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-[#3B0764] text-white font-semibold hover:bg-[#2A0548] transition-colors w-full sm:w-auto"
              >
                Register Now
              </a>
              <a
                href={BROCHURE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-[#3B0764]/30 text-[#3B0764] font-semibold hover:bg-[#3B0764]/5 transition-colors w-full sm:w-auto"
              >
                Download Brochure
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── HIGHLIGHTS ── */}
      <section className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Reveal>
              <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-4">Key Highlights</p>
            </Reveal>
            <Reveal delay={100}>
              <ul className="space-y-3">
                {HIGHLIGHTS.map((item) => (
                  <li key={item} className="flex gap-3 text-[#44403C] leading-relaxed">
                    <span className="text-[#3B0764] mt-1">&#8226;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <Reveal delay={150}>
            <div className="rounded-2xl overflow-hidden bg-[#3B0764]/5 aspect-[4/3]">
              <img src="/landing/tamilcon-audience.jpg" alt="Delegates at a TNOA session" className="w-full h-full object-cover" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── WHY ATTEND ── */}
      <section className="bg-[#3B0764]/[0.04] py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-4 text-center">Why Attend?</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-6 mt-8">
            {WHY_ATTEND.map((item, i) => (
              <Reveal key={item} delay={i * 100}>
                <div className="bg-white rounded-2xl border border-black/5 p-6 h-full">
                  <p className="text-[#1C1917] leading-relaxed">{item}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROGRAMME ── */}
      <section className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-4 text-center">Programme at a Glance</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 gap-6 mt-8">
          <Reveal delay={100}>
            <div className="border border-black/5 rounded-2xl p-6 h-full">
              <p className="font-bold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>3 October &middot; 6&ndash;8pm</p>
              <p className="text-[#57534E]">Cultural programme</p>
              <p className="text-[#57534E] mt-2">8pm onwards: Fellowship and dinner</p>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className="border border-black/5 rounded-2xl p-6 h-full">
              <p className="font-bold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>4 October &middot; 8am&ndash;6pm</p>
              <p className="text-[#57534E]">PG free paper sessions, keynote lectures, debates, workshop</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEES ── */}
      <section className="bg-[#3B0764]/[0.04] py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-6">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-4 text-center">Registration Fees for Delegates</p>
          </Reveal>
          <Reveal delay={100}>
            {(() => {
              const rows = groupFeeRows(tickets)
              if (rows.length === 0) {
                return (
                  <p className="text-center text-[#57534E] mt-8">
                    Registration opens soon &mdash; contact us at{" "}
                    <a href="mailto:cbetamilcon2026@gmail.com" className="text-[#3B0764] underline">cbetamilcon2026@gmail.com</a>.
                  </p>
                )
              }
              return (
                <div className="mt-8 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(59,7,100,0.15)]">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="bg-gradient-to-b from-[#E8CD8A] to-[#C9A24B] w-2/5" />
                        <th className="bg-gradient-to-b from-[#E8CD8A] to-[#C9A24B] py-4 px-3 text-center font-bold text-[#3B0764]">
                          Early Bird
                          <span className="block text-[11px] font-medium text-[#3B0764]/70 mt-0.5">Upto 31 July 2026</span>
                        </th>
                        <th className="bg-gradient-to-b from-[#E8CD8A] to-[#C9A24B] py-4 px-3 text-center font-bold text-[#3B0764]">
                          Regular
                          <span className="block text-[11px] font-medium text-[#3B0764]/70 mt-0.5">1 Aug &ndash; 15 Oct 2026</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={row.category} className={i > 0 ? "border-t border-white/15" : ""}>
                          <td className="bg-[#3B0764] py-4 pl-6 pr-3 text-white font-semibold uppercase text-[13px] tracking-wide">
                            {row.category}
                          </td>
                          <td className="bg-[#3B0764] py-4 px-3 text-center text-white font-bold text-lg tabular-nums">
                            {row.earlyBird ? `₹${Number(row.earlyBird).toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="bg-[#3B0764] py-4 px-3 text-center text-white font-bold text-lg tabular-nums">
                            {row.regular ? `₹${Number(row.regular).toLocaleString("en-IN")}` : "—"}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-white/15">
                        <td className="bg-[#2A0548] py-4 pl-6 pr-3 text-white font-semibold uppercase text-[13px] tracking-wide">
                          Spot Registration
                        </td>
                        <td className="bg-[#2A0548] py-4 px-3 text-center text-white font-bold text-lg tabular-nums" colSpan={2}>
                          &#8377;5,000
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </Reveal>
          <Reveal delay={150}>
            <p className="text-center text-[13px] text-[#57534E] mt-5">
              Includes scientific sessions, workshop kit, lunch, and conference dinner.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── COMMITTEE ── */}
      <section className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-8 text-center">Organizing Committee</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 gap-x-12 gap-y-4 max-w-2xl mx-auto">
          {[
            ["Organizing Chairman", "Dr. B.R.J. Satish Kumar"],
            ["Organizing Secretary", "Dr. M. Karthik Selvaraj"],
            ["COS President", "Dr. R. Jayakumar"],
            ["COS Secretary", "Dr. A.S. Thennavan"],
            ["COS Treasurer", "Dr. Arun Raja"],
            ["TNOA President", "Dr. S.R. Sundararajan"],
            ["TNOA President Elect", "Dr. C. Rex"],
            ["TNOA Secretary", "Dr. S. Marimuthu"],
          ].map(([role, name]) => (
            <Reveal key={role}>
              <div className="flex justify-between border-b border-black/5 pb-2">
                <span className="text-[#57534E] text-sm">{role}</span>
                <span className="font-semibold text-[#1C1917] text-sm">{name}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── VENUE ── */}
      <section className="bg-[#3B0764]/[0.04] py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-[#3B0764]/70 mb-4">Venue</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Hotel Merlis, Coimbatore
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-[#44403C] leading-relaxed max-w-xl mx-auto">
              Coimbatore &mdash; the Manchester of South India and a hub of medical excellence. Known for its
              textile industry, pleasant climate, and world-class healthcare facilities, with scenic spots like
              Ooty a short drive away and excellent connectivity by air, rail, and road.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-black/5">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm justify-center">
            <a href="/register/tamilcon-2026" className="text-[#57534E] hover:text-[#3B0764] transition-colors">Registration & Fees</a>
            <a href="/terms" className="text-[#57534E] hover:text-[#3B0764] transition-colors">Terms & Conditions</a>
            <a href="/privacy" className="text-[#57534E] hover:text-[#3B0764] transition-colors">Privacy Policy</a>
            <a href="/refund-policy" className="text-[#57534E] hover:text-[#3B0764] transition-colors">Cancellation & Refund</a>
            <a href="/shipping-policy" className="text-[#57534E] hover:text-[#3B0764] transition-colors">Shipping Policy</a>
            <a href="/contact" className="text-[#57534E] hover:text-[#3B0764] transition-colors">Contact Us</a>
          </div>
          <p className="text-center text-xs text-[#A8A29E] mt-6">
            cbetamilcon2026@gmail.com &middot; 94426 33111, 97902 10633
          </p>
          <p className="text-center text-xs mt-3">
            <a href="/login" className="text-[#A8A29E] hover:text-[#3B0764] transition-colors">Admin Login</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
