import Link from "next/link"
import { notFound } from "next/navigation"
import { getTenant } from "@/lib/tenant"

// This content (dates, entity name, GST details) is specific to ESSURG 2026.
// Gate it so it never renders on the shared AMASI/College deployments, which
// need their own policy content, not ESSURG's.
export function requireEssurgTenant() {
  if (getTenant() !== "essurg") notFound()
}

const NAV_LINKS = [
  { href: "/register/essurg-2026", label: "Registration & Fees" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund-policy", label: "Cancellation & Refund" },
  { href: "/shipping-policy", label: "Shipping Policy" },
  { href: "/contact", label: "Contact Us" },
]

export function PolicyPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <header className="border-b border-black/5 bg-[#1e3a5f]">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/register/essurg-2026" className="text-white font-bold tracking-tight">
            ESSURG 2026
          </Link>
          <span className="text-white/60 text-sm hidden sm:block">28th Annual Congress of the European Society of Surgery</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-[#1C1917] mb-2">{title}</h1>
        <p className="text-sm text-[#A8A29E] mb-10">Last updated: {updated}</p>
        <div className="policy-content">
          {children}
        </div>
      </main>

      <style>{`
        .policy-content h2 { font-weight: 700; font-size: 1.25rem; color: #1C1917; margin-top: 2rem; margin-bottom: 0.75rem; }
        .policy-content p { color: #44403C; line-height: 1.75; margin-bottom: 1rem; }
        .policy-content ul { color: #44403C; line-height: 1.75; margin-bottom: 1rem; padding-left: 1.5rem; list-style: disc; }
        .policy-content li { margin-bottom: 0.5rem; }
        .policy-content a { color: #1e3a5f; text-decoration: underline; }
        .policy-content table { width: 100%; border-collapse: collapse; margin: 1rem 0 1.5rem; font-size: 0.9rem; }
        .policy-content th, .policy-content td { border: 1px solid #E7E5E4; padding: 0.6rem 0.75rem; text-align: left; vertical-align: top; }
        .policy-content th { background: #F5F5F4; font-weight: 600; }
      `}</style>

      <footer className="border-t border-black/5 mt-12">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-[#57534E] hover:text-[#1e3a5f] transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
          <p className="text-xs text-[#A8A29E] mt-6">
            ESSURG 2026 Secretariat &middot; Chiktsa Foundation &middot; registrations@essurg2026.org
          </p>
        </div>
      </footer>
    </div>
  )
}
