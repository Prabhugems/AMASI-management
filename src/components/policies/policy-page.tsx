import Link from "next/link"
import { notFound } from "next/navigation"
import { getTenant, type Tenant } from "@/lib/tenant"

// Gate a policy page so it only renders for tenants it has real content for —
// every other deployment (AMASI/College, or a tenant not yet listed here)
// falls through to a plain 404 instead of showing another tenant's content.
export function requireTenantIn(tenants: readonly Tenant[]) {
  const tenant = getTenant()
  if (!tenants.includes(tenant)) notFound()
  return tenant
}

type Brand = {
  headerBg: string
  homeHref: string
  homeLabel: string
  subtitle: string
  accentColor: string
  navLinks: { href: string; label: string }[]
  footerLine: string
}

const BRANDS: Record<"essurg" | "cos", Brand> = {
  essurg: {
    headerBg: "#112248",
    homeHref: "/register/essurg-2026",
    homeLabel: "ESSURG 2026",
    subtitle: "28th Annual Congress of the European Society of Surgery",
    accentColor: "#112248",
    navLinks: [
      { href: "/register/essurg-2026", label: "Registration & Fees" },
      { href: "/terms", label: "Terms & Conditions" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/refund-policy", label: "Cancellation & Refund" },
      { href: "/shipping-policy", label: "Shipping Policy" },
      { href: "/contact", label: "Contact Us" },
    ],
    footerLine: "ESSURG 2026 Secretariat · Chiktsa Foundation · registrations@essurg2026.org",
  },
  cos: {
    headerBg: "#3B0764",
    homeHref: "/register/tamilcon-2026",
    homeLabel: "TAMILCON 2026",
    subtitle: "4th TNOA Tamil Orthopaedic Conference",
    accentColor: "#3B0764",
    navLinks: [
      { href: "/register/tamilcon-2026", label: "Registration & Fees" },
      { href: "/terms", label: "Terms & Conditions" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/refund-policy", label: "Cancellation & Refund" },
      { href: "/shipping-policy", label: "Shipping Policy" },
      { href: "/contact", label: "Contact Us" },
    ],
    footerLine: "TAMILCON 2026 Organising Secretariat · Coimbatore Orthopaedic Society · cbetamilcon2026@gmail.com",
  },
}

export function PolicyPage({
  title,
  updated,
  brand = "essurg",
  children,
}: {
  title: string
  updated: string
  brand?: keyof typeof BRANDS
  children: React.ReactNode
}) {
  const b = BRANDS[brand]
  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif" }}>
      {/* Typography: Playfair Display (editorial serif) + DM Sans — matches the register flow */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap"
        rel="stylesheet"
      />

      <header className="border-b border-black/5" style={{ background: b.headerBg }}>
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href={b.homeHref} className="text-white font-bold tracking-tight">
            {b.homeLabel}
          </Link>
          <span className="text-white/60 text-sm hidden sm:block">{b.subtitle}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-[#1C1917] mb-2" style={{ fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" }}>{title}</h1>
        <p className="text-sm text-[#A8A29E] mb-10">Last updated: {updated}</p>
        <div className="policy-content" style={{ "--policy-accent": b.accentColor } as React.CSSProperties}>
          {children}
        </div>
      </main>

      <style>{`
        .policy-content h2 { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 1.25rem; color: #1C1917; margin-top: 2rem; margin-bottom: 0.75rem; }
        .policy-content p { color: #44403C; line-height: 1.75; margin-bottom: 1rem; }
        .policy-content ul { color: #44403C; line-height: 1.75; margin-bottom: 1rem; padding-left: 1.5rem; list-style: disc; }
        .policy-content li { margin-bottom: 0.5rem; }
        .policy-content a { color: var(--policy-accent, #112248); text-decoration: underline; }
        .policy-content table { width: 100%; border-collapse: collapse; margin: 1rem 0 1.5rem; font-size: 0.9rem; }
        .policy-content th, .policy-content td { border: 1px solid #E7E5E4; padding: 0.6rem 0.75rem; text-align: left; vertical-align: top; }
        .policy-content th { background: #F5F5F4; font-weight: 600; }
      `}</style>

      <footer className="border-t border-black/5 mt-12">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {b.navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-[#57534E] hover:text-[#112248] transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
          <p className="text-xs text-[#A8A29E] mt-6">
            {b.footerLine}
          </p>
        </div>
      </footer>
    </div>
  )
}
