"use client"

import { COMPANY_CONFIG } from "@/lib/config"
import { useEffect } from "react"
import Link from "next/link"

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Force light mode for public registration pages
  useEffect(() => {
    document.documentElement.classList.remove("dark")
    document.documentElement.style.colorScheme = "light"
  }, [])

  return (
    <>
      {/* Typography: Playfair Display (editorial serif) + DM Sans (clean geometric) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap"
        rel="stylesheet"
      />

      <style>{`
        .reg-sans { font-family: 'DM Sans', system-ui, -apple-system, sans-serif; }
        .reg-serif { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; }
      `}</style>

      <div className="reg-sans register-flow min-h-screen relative" style={{ background: '#FAFAF7' }}>
        {/* Subtle grain texture overlay for warmth */}
        <div
          className="fixed inset-0 pointer-events-none z-[60] opacity-[0.025]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Header — frosted glass with editorial restraint */}
        <header
          className="sticky top-0 z-50 transition-all duration-300"
          style={{
            background: 'rgba(250, 250, 247, 0.82)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            borderBottom: '1px solid rgba(28, 25, 23, 0.06)',
          }}
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
            <Link href="/register" className="flex items-center gap-3.5 group">
              <div className="relative">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm transition-transform duration-300 group-hover:scale-105"
                  style={{ background: 'linear-gradient(145deg, #14532D 0%, #166534 50%, #15803D 100%)' }}
                >
                  A
                </div>
                {/* Subtle gold indicator dot */}
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{ background: '#D97706', borderColor: '#FAFAF7' }}
                />
              </div>
              <div>
                <h1
                  className="reg-serif font-semibold tracking-tight leading-tight"
                  style={{ color: '#1C1917', fontSize: '16px' }}
                >
                  {COMPANY_CONFIG.name}
                </h1>
                <p
                  className="font-medium"
                  style={{ color: '#A8A29E', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' }}
                >
                  Events & Registration
                </p>
              </div>
            </Link>

            {/* Minimal right-side nav hint */}
            <div className="hidden sm:flex items-center gap-6">
              <a
                href={COMPANY_CONFIG.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-medium transition-colors duration-300"
                style={{ color: '#78716C' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#1C1917')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#78716C')}
              >
                Main Site &rarr;
              </a>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="pb-20 relative z-10">{children}</main>

        {/* Footer — understated, editorial */}
        <footer style={{ borderTop: '1px solid rgba(28, 25, 23, 0.06)' }}>
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[13px]" style={{ color: '#A8A29E' }}>
                &copy; {new Date().getFullYear()} {COMPANY_CONFIG.fullName}
              </p>
              <div className="flex items-center gap-8">
                {[
                  { label: 'Terms', href: '#' },
                  { label: 'Privacy', href: '#' },
                  { label: 'Contact', href: '#' },
                ].map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-[13px] transition-colors duration-300"
                    style={{ color: '#A8A29E' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#1C1917')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#A8A29E')}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
