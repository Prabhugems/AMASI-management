"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { COMPANY_CONFIG } from "@/lib/config"

// ============================================
// CONFERENCE DATA — Edit this to customize
// ============================================
const EVENT = {
  name: "TechnoSurg 2026",
  tagline: "Advancing the Frontiers of Surgical Technology",
  dates: "August 22-24, 2026",
  venue: "GEM Hospital & Research Centre",
  city: "Coimbatore, Tamil Nadu",
  description:
    "South India's premier surgical technology conference bringing together 500+ surgeons, innovators, and industry leaders for 3 days of cutting-edge surgical demonstrations, hands-on workshops, and transformative discussions.",
  registrationUrl: "/register",
  stats: [
    { value: "500+", label: "Expected Delegates" },
    { value: "50+", label: "Expert Speakers" },
    { value: "30+", label: "Live Surgeries" },
    { value: "3", label: "Days of Innovation" },
  ],
  highlights: [
    {
      title: "Live Surgical Demonstrations",
      description: "Watch world-class surgeons perform cutting-edge procedures in real-time with interactive Q&A",
      icon: "surgery",
    },
    {
      title: "Hands-On Workshops",
      description: "Get practical experience with the latest robotic and laparoscopic surgical systems",
      icon: "workshop",
    },
    {
      title: "AI in Surgery",
      description: "Explore how artificial intelligence is transforming surgical planning, navigation, and outcomes",
      icon: "ai",
    },
    {
      title: "Industry Exhibition",
      description: "Discover breakthrough medical devices and technologies from 40+ leading manufacturers",
      icon: "exhibition",
    },
  ],
  speakers: [
    { name: "Dr. C. Palanivelu", role: "Conference Chairman", institution: "GEM Hospital, Coimbatore", specialty: "Minimally Invasive Surgery" },
    { name: "Dr. Ramesh Ardhanari", role: "Organizing Secretary", institution: "GEM Hospital, Coimbatore", specialty: "Advanced Laparoscopy" },
    { name: "Speaker Announcement", role: "Coming Soon", institution: "International Faculty", specialty: "Robotic Surgery" },
    { name: "Speaker Announcement", role: "Coming Soon", institution: "International Faculty", specialty: "AI-Assisted Surgery" },
    { name: "Speaker Announcement", role: "Coming Soon", institution: "National Faculty", specialty: "Bariatric Surgery" },
    { name: "Speaker Announcement", role: "Coming Soon", institution: "National Faculty", specialty: "Hepatobiliary Surgery" },
  ],
  schedule: [
    {
      day: "Day 1 — Aug 22",
      theme: "Foundation & Innovation",
      sessions: [
        { time: "08:00 - 09:00", title: "Registration & Networking Breakfast", type: "networking" },
        { time: "09:00 - 09:30", title: "Inaugural Ceremony", type: "ceremony" },
        { time: "09:30 - 12:30", title: "Live Surgery — Advanced Laparoscopic Procedures", type: "surgery" },
        { time: "12:30 - 13:30", title: "Lunch & Exhibition", type: "break" },
        { time: "13:30 - 15:30", title: "Panel: The Future of Robotic Surgery in India", type: "panel" },
        { time: "15:30 - 17:30", title: "Hands-On Workshop — Suturing Techniques", type: "workshop" },
        { time: "19:00 - 21:00", title: "Welcome Dinner & Cultural Evening", type: "social" },
      ],
    },
    {
      day: "Day 2 — Aug 23",
      theme: "Technology & Transformation",
      sessions: [
        { time: "08:00 - 08:30", title: "Morning Tea & Networking", type: "networking" },
        { time: "08:30 - 12:00", title: "Live Surgery — Robotic & AI-Assisted Procedures", type: "surgery" },
        { time: "12:00 - 13:00", title: "Keynote: AI Revolution in Surgical Decision-Making", type: "keynote" },
        { time: "13:00 - 14:00", title: "Lunch & Poster Presentations", type: "break" },
        { time: "14:00 - 16:00", title: "Breakout Sessions — Specialty Tracks", type: "breakout" },
        { time: "16:00 - 17:30", title: "Workshop — Robotic Console Training", type: "workshop" },
        { time: "19:30 - 22:00", title: "Conference Gala Dinner", type: "social" },
      ],
    },
    {
      day: "Day 3 — Aug 24",
      theme: "Clinical Excellence & Networking",
      sessions: [
        { time: "08:00 - 08:30", title: "Morning Tea", type: "networking" },
        { time: "08:30 - 11:00", title: "Live Surgery — Complex Multi-organ Procedures", type: "surgery" },
        { time: "11:00 - 12:30", title: "Debate: Open vs Minimally Invasive — Where Do We Draw the Line?", type: "panel" },
        { time: "12:30 - 13:30", title: "Lunch", type: "break" },
        { time: "13:30 - 15:00", title: "Awards Ceremony & Best Paper Presentations", type: "ceremony" },
        { time: "15:00 - 16:00", title: "Valedictory & Closing Ceremony", type: "ceremony" },
      ],
    },
  ],
  pricing: [
    { name: "Early Bird", price: "5,000", currency: "INR", deadline: "Before June 30", features: ["All Sessions", "Workshop Access", "Conference Kit", "Lunch & Tea"] },
    { name: "Regular", price: "7,500", currency: "INR", deadline: "July 1 - Aug 15", features: ["All Sessions", "Workshop Access", "Conference Kit", "Lunch & Tea", "Gala Dinner"] },
    { name: "On-Spot", price: "10,000", currency: "INR", deadline: "At the Venue", features: ["All Sessions", "Workshop Access", "Conference Kit", "Lunch & Tea", "Gala Dinner"] },
  ],
  faq: [
    { q: "Who can attend TechnoSurg 2026?", a: "The conference is open to surgeons, surgical trainees, medical students, nurses, and industry professionals interested in surgical technology." },
    { q: "Are CME credits available?", a: "Yes, the conference is accredited for Continuing Medical Education credits. Details will be shared with registered delegates." },
    { q: "Is accommodation provided?", a: "We have partnered with nearby hotels offering discounted rates for delegates. Details will be shared upon registration." },
    { q: "Can I present a paper or poster?", a: "Yes, abstract submissions are welcome. Visit the registration portal for submission guidelines and deadlines." },
    { q: "What is the cancellation policy?", a: "Full refund if cancelled 30 days before the event. 50% refund for cancellations within 15-30 days. No refunds within 15 days." },
  ],
}

// ============================================
// ANIMATION HOOKS
// ============================================
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, isVisible }
}

function useCountUp(end: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      setCount(Math.floor(progress * end))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [end, duration, start])
  return count
}

// ============================================
// COUNTDOWN TIMER
// ============================================
function Countdown({ targetDate }: { targetDate: string }) {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const target = new Date(targetDate).getTime()
    const tick = () => {
      const now = Date.now()
      const diff = Math.max(0, target - now)
      setTime({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetDate])

  return (
    <div className="flex gap-3 sm:gap-4">
      {Object.entries(time).map(([label, value]) => (
        <div key={label} className="flex flex-col items-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center">
            <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{String(value).padStart(2, "0")}</span>
          </div>
          <span className="text-[10px] sm:text-xs text-white/50 mt-2 uppercase tracking-widest">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ============================================
// ICON COMPONENTS
// ============================================
function SurgeryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 4.27 10 6.73l-2.5 2.46M14 6.73l2.5-2.46M14 6.73l2.5 2.46" />
      <path d="M12 6.73v10.54" />
      <circle cx="12" cy="19.5" r="1.5" />
    </svg>
  )
}

function WorkshopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function AIIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
      <path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z" />
      <circle cx="9" cy="7" r="0.5" fill="currentColor" />
      <circle cx="15" cy="7" r="0.5" fill="currentColor" />
    </svg>
  )
}

function ExhibitionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <path d="M12 12v3" />
      <path d="M2 12h20" />
    </svg>
  )
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  surgery: SurgeryIcon,
  workshop: WorkshopIcon,
  ai: AIIcon,
  exhibition: ExhibitionIcon,
}

function SessionTypeTag({ type }: { type: string }) {
  const colors: Record<string, string> = {
    surgery: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    workshop: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    panel: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    keynote: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    ceremony: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    networking: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    break: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    social: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    breakout: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  }
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border ${colors[type] || colors.networking}`}>
      {type}
    </span>
  )
}

// ============================================
// SECTION WRAPPER
// ============================================
function Section({ children, className = "", id, dark = false }: { children: React.ReactNode; className?: string; id?: string; dark?: boolean }) {
  const { ref, isVisible } = useInView()
  return (
    <section
      id={id}
      ref={ref}
      className={`
        ${dark ? "bg-zinc-950 text-white" : "bg-zinc-50 text-zinc-900"}
        ${className}
        transition-all duration-1000
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
      `}
    >
      {children}
    </section>
  )
}

// ============================================
// MAIN PAGE
// ============================================
export default function LandingPage() {
  const [activeDay, setActiveDay] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)
  const [statsVisible, setStatsVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true) },
      { threshold: 0.3 }
    )
    if (statsRef.current) observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [])

  const navLinks = [
    { label: "About", href: "#about" },
    { label: "Speakers", href: "#speakers" },
    { label: "Schedule", href: "#schedule" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ]

  return (
    <div className="min-h-[100dvh] bg-zinc-950 overflow-x-hidden">
      {/* ============ NAVBAR ============ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "bg-zinc-950/90 backdrop-blur-xl border-b border-white/5 py-3" : "bg-transparent py-5"}`}>
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between">
          <a href="#" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <span className="text-lg font-bold text-white">T</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-white font-bold text-lg tracking-tight">{EVENT.name}</span>
              <span className="block text-zinc-500 text-xs">{EVENT.dates}</span>
            </div>
          </a>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-sm text-zinc-400 hover:text-white transition-colors duration-300">
                {link.label}
              </a>
            ))}
            <a
              href={EVENT.registrationUrl}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold hover:scale-105 transition-transform duration-300"
            >
              Register Now
            </a>
          </div>

          {/* Mobile Toggle */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-white p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {mobileMenuOpen ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-b border-white/5 p-6 space-y-4">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)} className="block text-zinc-300 hover:text-white py-2">
                {link.label}
              </a>
            ))}
            <a href={EVENT.registrationUrl} className="block text-center px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold">
              Register Now
            </a>
          </div>
        )}
      </nav>

      {/* ============ HERO ============ */}
      <section className="relative min-h-[100dvh] flex items-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
          <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full bg-emerald-500/5 blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full bg-teal-500/5 blur-[100px]" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-6 pt-32 pb-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-xs font-semibold tracking-wider uppercase">{EVENT.dates} &middot; {EVENT.city}</span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tighter leading-[0.95] mb-6">
                {EVENT.name.split(" ")[0]}
                <br />
                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {EVENT.name.split(" ").slice(1).join(" ")}
                </span>
              </h1>

              <p className="text-lg text-zinc-400 leading-relaxed max-w-[55ch] mb-10">
                {EVENT.tagline}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-16">
                <a
                  href={EVENT.registrationUrl}
                  className="group relative inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-lg overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="relative z-10">Register Now</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </a>
                <a
                  href="#schedule"
                  className="inline-flex items-center justify-center px-8 py-4 rounded-2xl border border-zinc-700 text-zinc-300 font-semibold hover:bg-white/5 hover:border-zinc-600 transition-all duration-300"
                >
                  View Schedule
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
                </a>
              </div>

              <Countdown targetDate="2026-08-22T09:00:00+05:30" />
            </div>

            {/* Right — Stats Bento */}
            <div className="hidden lg:grid grid-cols-2 gap-4">
              {EVENT.stats.map((stat, i) => (
                <div
                  key={stat.label}
                  className="group p-8 rounded-3xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.06] hover:border-emerald-500/20 transition-all duration-500"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  <div className="text-4xl font-bold text-white mb-2 tracking-tight">{stat.value}</div>
                  <div className="text-sm text-zinc-500 group-hover:text-zinc-400 transition-colors">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Scroll</span>
          <div className="w-5 h-8 rounded-full border border-zinc-700 flex justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-zinc-500 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ============ ABOUT ============ */}
      <Section id="about" className="py-24 sm:py-32 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-16">
            <div className="lg:col-span-3">
              <span className="text-emerald-500 text-sm font-semibold tracking-wider uppercase">About the Conference</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 tracking-tighter mt-4 mb-6">
                Where Surgical Innovation<br />Meets Clinical Excellence
              </h2>
              <p className="text-lg text-zinc-600 leading-relaxed max-w-[65ch]">
                {EVENT.description}
              </p>
            </div>
            <div className="lg:col-span-2 grid grid-cols-2 gap-4" ref={statsRef}>
              {EVENT.stats.map((stat, i) => {
                const numericValue = parseInt(stat.value.replace(/\D/g, ""))
                const suffix = stat.value.replace(/[0-9]/g, "")
                return (
                  <div key={stat.label} className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <div className="text-3xl font-bold text-zinc-900 tracking-tight tabular-nums">
                      <CountUpDisplay value={numericValue} suffix={suffix} started={statsVisible} />
                    </div>
                    <div className="text-sm text-zinc-500 mt-1">{stat.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Section>

      {/* ============ HIGHLIGHTS ============ */}
      <Section id="highlights" dark className="py-24 sm:py-32 px-6">
        <div className="max-w-[1400px] mx-auto">
          <span className="text-emerald-400 text-sm font-semibold tracking-wider uppercase">What to Expect</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tighter mt-4 mb-16">
            Conference Highlights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {EVENT.highlights.map((item, i) => {
              const Icon = iconMap[item.icon] || WorkshopIcon
              return (
                <div
                  key={item.title}
                  className="group p-8 sm:p-10 rounded-3xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-emerald-500/20 transition-all duration-500"
                >
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                    <Icon className="w-7 h-7 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{item.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ============ SPEAKERS ============ */}
      <Section id="speakers" className="py-24 sm:py-32 px-6">
        <div className="max-w-[1400px] mx-auto">
          <span className="text-emerald-500 text-sm font-semibold tracking-wider uppercase">Expert Faculty</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 tracking-tighter mt-4 mb-16">
            Our Speakers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {EVENT.speakers.map((speaker, i) => (
              <div
                key={i}
                className="group relative p-8 rounded-3xl bg-white border border-zinc-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] hover:border-zinc-300 transition-all duration-500"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-500">
                  <span className="text-2xl font-bold text-zinc-400">{speaker.name.charAt(0)}</span>
                </div>
                <h3 className="text-lg font-bold text-zinc-900">{speaker.name}</h3>
                <p className="text-emerald-600 text-sm font-semibold mt-1">{speaker.role}</p>
                <p className="text-zinc-500 text-sm mt-2">{speaker.institution}</p>
                <div className="mt-4 pt-4 border-t border-zinc-100">
                  <span className="text-xs text-zinc-400 uppercase tracking-wider">{speaker.specialty}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ============ SCHEDULE ============ */}
      <Section id="schedule" dark className="py-24 sm:py-32 px-6">
        <div className="max-w-[1400px] mx-auto">
          <span className="text-emerald-400 text-sm font-semibold tracking-wider uppercase">Programme</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tighter mt-4 mb-12">
            Conference Schedule
          </h2>

          {/* Day Tabs */}
          <div className="flex gap-3 mb-10 overflow-x-auto pb-2">
            {EVENT.schedule.map((day, i) => (
              <button
                key={i}
                onClick={() => setActiveDay(i)}
                className={`px-6 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
                  activeDay === i
                    ? "bg-emerald-500 text-white"
                    : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/10"
                }`}
              >
                {day.day}
              </button>
            ))}
          </div>

          {/* Day Theme */}
          <p className="text-zinc-500 text-sm mb-8">
            Theme: <span className="text-emerald-400 font-semibold">{EVENT.schedule[activeDay].theme}</span>
          </p>

          {/* Sessions */}
          <div className="space-y-3">
            {EVENT.schedule[activeDay].sessions.map((session, i) => (
              <div
                key={i}
                className="group flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all duration-300"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="sm:w-36 shrink-0">
                  <span className="text-sm font-mono text-zinc-500 tabular-nums">{session.time}</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-semibold">{session.title}</h4>
                </div>
                <SessionTypeTag type={session.type} />
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ============ PRICING ============ */}
      <Section id="pricing" className="py-24 sm:py-32 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-16">
            <span className="text-emerald-500 text-sm font-semibold tracking-wider uppercase">Registration</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 tracking-tighter mt-4">
              Choose Your Pass
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {EVENT.pricing.map((tier, i) => (
              <div
                key={tier.name}
                className={`relative p-8 rounded-3xl border transition-all duration-500 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] ${
                  i === 1
                    ? "bg-zinc-950 border-zinc-800 text-white scale-[1.02]"
                    : "bg-white border-zinc-200 text-zinc-900"
                }`}
              >
                {i === 1 && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider">
                    Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-bold">{tier.name}</h3>
                  <p className={`text-xs mt-1 ${i === 1 ? "text-zinc-400" : "text-zinc-500"}`}>{tier.deadline}</p>
                </div>
                <div className="mb-8">
                  <span className={`text-xs ${i === 1 ? "text-zinc-500" : "text-zinc-400"}`}>{tier.currency}</span>
                  <span className="text-4xl font-bold tracking-tight ml-1">{tier.price}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm">
                      <svg className={`w-4 h-4 shrink-0 ${i === 1 ? "text-emerald-400" : "text-emerald-500"}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={i === 1 ? "text-zinc-300" : "text-zinc-600"}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={EVENT.registrationUrl}
                  className={`block text-center py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
                    i === 1
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:scale-[1.02]"
                      : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                  }`}
                >
                  Register Now
                </a>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ============ VENUE ============ */}
      <Section dark className="py-24 sm:py-32 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-emerald-400 text-sm font-semibold tracking-wider uppercase">Venue</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tighter mt-4 mb-6">
                {EVENT.venue}
              </h2>
              <p className="text-zinc-400 leading-relaxed text-lg mb-8">
                {EVENT.city}. One of India&apos;s leading centers for minimally invasive surgery,
                equipped with state-of-the-art conference facilities and live surgery transmission capabilities.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" /><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0z" />
                    </svg>
                  </div>
                  <span className="text-zinc-300">45, Pankaja Mills Road, Ramanathapuram, Coimbatore</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </div>
                  <span className="text-zinc-300">Coimbatore International Airport — 15 min drive</span>
                </div>
              </div>
            </div>
            <div className="rounded-3xl overflow-hidden border border-white/10 h-80 lg:h-96 bg-zinc-800">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3916.485737387!2d76.96!3d11.01!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTHCsDAwJzM2LjAiTiA3NsKwNTcnMzYuMCJF!5e0!3m2!1sen!2sin!4v1"
                width="100%"
                height="100%"
                style={{ border: 0, filter: "invert(90%) hue-rotate(180deg) brightness(0.9) contrast(1.1)" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* ============ FAQ ============ */}
      <Section id="faq" className="py-24 sm:py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-emerald-500 text-sm font-semibold tracking-wider uppercase">Questions</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 tracking-tighter mt-4">
              Frequently Asked
            </h2>
          </div>

          <div className="space-y-3">
            {EVENT.faq.map((item, i) => (
              <FAQItem key={i} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>
      </Section>

      {/* ============ CTA ============ */}
      <section className="relative py-24 sm:py-32 px-6 overflow-hidden bg-zinc-950">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-emerald-500/10 blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tighter mb-6">
            Ready to Join TechnoSurg 2026?
          </h2>
          <p className="text-lg text-zinc-400 mb-10 max-w-[55ch] mx-auto">
            Secure your spot at South India&apos;s premier surgical technology conference. Early bird pricing available now.
          </p>
          <a
            href={EVENT.registrationUrl}
            className="inline-flex items-center justify-center px-10 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
          >
            Register Now
          </a>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-zinc-950 border-t border-white/5 py-12 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
                <span className="text-sm font-bold text-white">T</span>
              </div>
              <span className="text-zinc-400 text-sm">{EVENT.name} &middot; {COMPANY_CONFIG.fullName}</span>
            </div>
            <div className="flex items-center gap-6">
              <a href={`mailto:${COMPANY_CONFIG.supportEmail}`} className="text-sm text-zinc-500 hover:text-white transition-colors">
                {COMPANY_CONFIG.supportEmail}
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-xs text-zinc-600">
              &copy; {new Date().getFullYear()} {COMPANY_CONFIG.fullName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ============================================
// SUB-COMPONENTS
// ============================================
function CountUpDisplay({ value, suffix, started }: { value: number; suffix: string; started: boolean }) {
  const count = useCountUp(value, 2000, started)
  return <>{count}{suffix}</>
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white transition-shadow duration-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <span className="font-semibold text-zinc-900 pr-4">{question}</span>
        <svg
          className={`w-5 h-5 text-zinc-400 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-48 pb-6" : "max-h-0"}`}>
        <p className="px-6 text-zinc-600 leading-relaxed">{answer}</p>
      </div>
    </div>
  )
}
