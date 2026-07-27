import { Reveal } from "@/components/reveal"

const REGISTER_URL = "/register/tamilcon-2026"
const BROCHURE_URL = "/tamilcon-2026-brochure.pdf"

const HIGHLIGHTS = [
  "Scientific sessions on Trauma, Joint Replacement, Arthroscopy, Spine, Paediatrics, and Sports Medicine",
  "reLive surgical demonstrations",
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
          <a
            href={REGISTER_URL}
            className="inline-flex items-center h-10 px-5 rounded-full bg-[#3B0764] text-white text-sm font-semibold hover:bg-[#2A0548] transition-colors"
          >
            Register
          </a>
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
    </div>
  )
}
