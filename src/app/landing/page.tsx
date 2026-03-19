"use client"

import { useState, useEffect, useRef } from "react"
import { motion, useInView, AnimatePresence } from "framer-motion"
import { COMPANY_CONFIG } from "@/lib/config"
import Image from "next/image"

// ============================================
// CONFERENCE DATA — Edit this to customize
// ============================================
const EVENT = {
  name: "GEM TechnoSurg 2026",
  nameShort: "GEM",
  nameSuffix: "TechnoSurg 2026",
  tagline: "AI, Robotics & Fluorescence in Surgery",
  dates: "June 19-20, 2026",
  targetDate: "2026-06-19T09:00:00+05:30",
  venue: "ITC Grand Chola",
  city: "Chennai",
  fullAddress: "63, Anna Salai, Guindy, Chennai, Tamil Nadu 600032",
  description:
    "India's most anticipated surgical technology summit, uniting 500+ surgeons, AI researchers, and medtech pioneers for two transformative days of live robotic procedures, fluorescence-guided surgery, and hands-on workshops at the iconic ITC Grand Chola.",
  registrationUrl: "/register",
  posterImage: "/landing/hero-poster.jpg",
  stats: [
    { value: 500, suffix: "+", label: "Delegates" },
    { value: 50, suffix: "+", label: "Speakers" },
    { value: 30, suffix: "+", label: "Live Surgeries" },
    { value: 2, suffix: "", label: "Days" },
  ],
  highlights: [
    {
      title: "Live Robotic Surgery",
      description: "Watch world-class surgeons operate da Vinci and Versius systems in real-time with interactive Q&A from the console.",
      icon: "robot",
      span: "large",
    },
    {
      title: "AI-Powered Diagnostics",
      description: "Explore how machine learning transforms pre-operative planning and intraoperative decision-making.",
      icon: "ai",
      span: "small",
    },
    {
      title: "Fluorescence-Guided Surgery",
      description: "ICG and novel fluorophores lighting up anatomy you never knew you could see.",
      icon: "fluorescence",
      span: "small",
    },
    {
      title: "Hands-On Workshops",
      description: "Get console time on robotic platforms and practice advanced laparoscopic techniques with expert proctors.",
      icon: "workshop",
      span: "medium",
    },
    {
      title: "Industry Exhibition",
      description: "40+ medtech companies showcasing next-generation surgical instruments, imaging systems, and AI platforms.",
      icon: "exhibition",
      span: "medium",
    },
  ],
  speakers: [
    { name: "Dr. C. Palanivelu", role: "Conference Chairman", institution: "GEM Hospital, Coimbatore", specialty: "Minimally Invasive Surgery", initials: "CP" },
    { name: "Dr. Ramesh Ardhanari", role: "Organizing Secretary", institution: "GEM Hospital, Coimbatore", specialty: "Advanced Laparoscopy", initials: "RA" },
    { name: "International Faculty", role: "Keynote Speaker", institution: "To Be Announced", specialty: "Robotic Surgery", initials: "IF" },
    { name: "International Faculty", role: "Invited Speaker", institution: "To Be Announced", specialty: "AI-Assisted Surgery", initials: "IF" },
    { name: "National Faculty", role: "Invited Speaker", institution: "To Be Announced", specialty: "Fluorescence Surgery", initials: "NF" },
    { name: "National Faculty", role: "Invited Speaker", institution: "To Be Announced", specialty: "Hepatobiliary Surgery", initials: "NF" },
  ],
  schedule: [
    {
      day: "Day 1",
      date: "June 19",
      theme: "AI & Robotic Surgery",
      sessions: [
        { time: "08:00 - 09:00", title: "Registration & Networking Breakfast", type: "networking" },
        { time: "09:00 - 09:45", title: "Inaugural Ceremony", type: "ceremony" },
        { time: "10:00 - 13:00", title: "Live Surgery: Robotic Whipple & AI-Assisted Navigation", type: "surgery" },
        { time: "13:00 - 14:00", title: "Lunch & Industry Exhibition", type: "break" },
        { time: "14:00 - 15:30", title: "Panel: The Future of Autonomous Surgical Systems", type: "panel" },
        { time: "15:45 - 17:30", title: "Hands-On Workshop: Robotic Console Training", type: "workshop" },
        { time: "19:00 - 21:30", title: "Welcome Dinner at Grand Ballroom", type: "social" },
      ],
    },
    {
      day: "Day 2",
      date: "June 20",
      theme: "Fluorescence & Innovation",
      sessions: [
        { time: "08:00 - 08:30", title: "Morning Tea & Poster Walk", type: "networking" },
        { time: "08:30 - 12:00", title: "Live Surgery: ICG Fluorescence-Guided Procedures", type: "surgery" },
        { time: "12:00 - 13:00", title: "Keynote: Next Frontier in Surgical Intelligence", type: "keynote" },
        { time: "13:00 - 14:00", title: "Lunch & Poster Presentations", type: "break" },
        { time: "14:00 - 16:00", title: "Breakout: Specialty Tracks (HPB / Bariatric / Colorectal)", type: "breakout" },
        { time: "16:00 - 17:00", title: "Awards & Best Paper Presentations", type: "ceremony" },
        { time: "17:00 - 17:30", title: "Valedictory Ceremony", type: "ceremony" },
      ],
    },
  ],
  pricing: [
    {
      name: "Early Bird",
      price: "5,000",
      currency: "INR",
      deadline: "Before April 30",
      features: ["All Scientific Sessions", "Workshop Access", "Conference Kit", "Lunch & Refreshments"],
      popular: false,
    },
    {
      name: "Regular",
      price: "7,500",
      currency: "INR",
      deadline: "May 1 - June 10",
      features: ["All Scientific Sessions", "Workshop Access", "Conference Kit", "Lunch & Refreshments", "Gala Dinner", "Certificate of Attendance"],
      popular: true,
    },
    {
      name: "On-Spot",
      price: "10,000",
      currency: "INR",
      deadline: "At the Venue",
      features: ["All Scientific Sessions", "Workshop Access", "Conference Kit", "Lunch & Refreshments", "Gala Dinner"],
      popular: false,
    },
  ],
  faq: [
    { q: "Who can attend GEM TechnoSurg 2026?", a: "The conference is open to surgeons, surgical trainees, medical students, nurses, and industry professionals interested in surgical technology, AI, and robotics." },
    { q: "Are CME credits available?", a: "Yes, the conference is accredited for Continuing Medical Education credits. Detailed credit information will be shared with registered delegates." },
    { q: "Is accommodation provided?", a: "ITC Grand Chola offers special delegate rates. We have also partnered with nearby hotels for additional options. Details are shared upon registration." },
    { q: "Can I present a paper or poster?", a: "Absolutely. Abstract submissions are welcome through the registration portal. Submission guidelines and deadlines are available on the registration page." },
    { q: "What is the cancellation and refund policy?", a: "Full refund if cancelled 30+ days before the event. 50% refund for cancellations within 15-30 days. No refunds within 15 days of the event." },
    { q: "How do I reach ITC Grand Chola?", a: "The venue is located on Anna Salai (Mount Road), approximately 20 minutes from Chennai International Airport. Cab services and hotel shuttles are readily available." },
  ],
}

// ============================================
// THEME
// ============================================
const COLORS = {
  navy: "#0a1628",
  cyan: "#00b4d8",
  gold: "#f59e0b",
  neon: "#22d3ee",
  navyLight: "#0f2038",
  cyanDark: "#0891b2",
}

// ============================================
// ANIMATION VARIANTS
// ============================================
const EASE_OUT_QUART: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.1, ease: EASE_OUT_QUART },
  }),
}

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i: number = 0) => ({
    opacity: 1,
    transition: { duration: 0.6, delay: i * 0.08 },
  }),
}

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, delay: i * 0.1, ease: EASE_OUT_QUART },
  }),
}

const charReveal = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: 0.5 + i * 0.03, ease: "easeOut" as const },
  }),
}

// ============================================
// COUNTDOWN TIMER
// ============================================
function Countdown({ targetDate }: { targetDate: string }) {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
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

  if (!mounted) return null

  const units = [
    { label: "Days", value: time.days },
    { label: "Hours", value: time.hours },
    { label: "Min", value: time.minutes },
    { label: "Sec", value: time.seconds },
  ]

  return (
    <div className="flex gap-3">
      {units.map((unit, i) => (
        <motion.div
          key={unit.label}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2 + i * 0.1 }}
          className="flex flex-col items-center"
        >
          <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] flex items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent" />
            <span className="relative text-2xl sm:text-3xl font-bold text-white tabular-nums tracking-tight">
              {String(unit.value).padStart(2, "0")}
            </span>
          </div>
          <span className="text-[10px] text-white/30 mt-2 uppercase tracking-[0.2em] font-medium">{unit.label}</span>
        </motion.div>
      ))}
    </div>
  )
}

// ============================================
// COUNTER ANIMATION
// ============================================
function AnimatedCounter({ value, suffix, inView }: { value: number; suffix: string; inView: boolean }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!inView) return
    let startTime: number
    const duration = 2200
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * value))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value, inView])

  return <>{count}{suffix}</>
}

// ============================================
// FLOATING PARTICLES
// ============================================
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 3 === 0 ? COLORS.cyan : i % 3 === 1 ? COLORS.gold : COLORS.neon,
            opacity: 0.15 + Math.random() * 0.2,
          }}
          animate={{
            y: [0, -30 - Math.random() * 40, 0],
            x: [0, (Math.random() - 0.5) * 20, 0],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 4 + Math.random() * 6,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}

// ============================================
// SESSION TYPE TAG
// ============================================
function SessionTypeTag({ type }: { type: string }) {
  const styles: Record<string, string> = {
    surgery: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    workshop: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    panel: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    keynote: "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20",
    ceremony: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    networking: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    break: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    social: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    breakout: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  }
  return (
    <span className={`text-[10px] uppercase tracking-[0.15em] font-semibold px-2.5 py-1 rounded-full border ${styles[type] || styles.networking}`}>
      {type}
    </span>
  )
}

// ============================================
// HIGHLIGHT ICONS
// ============================================
function HighlightIcon({ type, className }: { type: string; className?: string }) {
  const icons: Record<string, JSX.Element> = {
    robot: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="8" width="14" height="10" rx="2" />
        <path d="M12 8V5" /><circle cx="12" cy="4" r="1" />
        <circle cx="9" cy="13" r="1" fill="currentColor" /><circle cx="15" cy="13" r="1" fill="currentColor" />
        <path d="M9 16h6" /><path d="M3 13h2" /><path d="M19 13h2" />
      </svg>
    ),
    ai: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
      </svg>
    ),
    fluorescence: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" /><path d="M12 1v2" /><path d="M12 21v2" /><path d="M4.22 4.22l1.42 1.42" /><path d="M18.36 18.36l1.42 1.42" /><path d="M1 12h2" /><path d="M21 12h2" /><path d="M4.22 19.78l1.42-1.42" /><path d="M18.36 5.64l1.42-1.42" />
      </svg>
    ),
    workshop: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    exhibition: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><path d="M12 12v3" /><path d="M2 12h20" />
      </svg>
    ),
  }
  return icons[type] || icons.workshop
}

// ============================================
// FAQ ITEM
// ============================================
function FAQItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      className="group"
    >
      <div className={`rounded-2xl border transition-all duration-500 overflow-hidden ${open ? "border-cyan-500/30 bg-white/[0.04] shadow-[0_0_30px_-10px_rgba(0,180,216,0.15)]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"}`}>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between p-6 sm:p-7 text-left gap-4"
        >
          <span className={`font-semibold text-[15px] sm:text-base transition-colors duration-300 ${open ? "text-white" : "text-white/70"}`}>{question}</span>
          <motion.div
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.3 }}
            className="shrink-0 w-8 h-8 rounded-full border border-white/10 flex items-center justify-center"
          >
            <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </motion.div>
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="overflow-hidden"
            >
              <p className="px-6 sm:px-7 pb-6 sm:pb-7 text-white/50 leading-relaxed text-[15px]">{answer}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ============================================
// SECTION HEADING
// ============================================
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={fadeUp} custom={0} className="flex items-center gap-3 mb-5">
      <div className="w-8 h-px bg-gradient-to-r from-cyan-500 to-transparent" />
      <span className="text-cyan-400 text-xs font-semibold tracking-[0.25em] uppercase">{children}</span>
    </motion.div>
  )
}

// ============================================
// MAIN PAGE
// ============================================
export default function LandingPage() {
  const [activeDay, setActiveDay] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Scroll tracking
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Section refs for inView
  const heroRef = useRef(null)
  const aboutRef = useRef(null)
  const highlightsRef = useRef(null)
  const speakersRef = useRef(null)
  const scheduleRef = useRef(null)
  const pricingRef = useRef(null)
  const venueRef = useRef(null)
  const faqRef = useRef(null)
  const ctaRef = useRef(null)

  const heroInView = useInView(heroRef, { once: true, margin: "-100px" })
  const aboutInView = useInView(aboutRef, { once: true, margin: "-100px" })
  const highlightsInView = useInView(highlightsRef, { once: true, margin: "-100px" })
  const speakersInView = useInView(speakersRef, { once: true, margin: "-100px" })
  const scheduleInView = useInView(scheduleRef, { once: true, margin: "-100px" })
  const pricingInView = useInView(pricingRef, { once: true, margin: "-100px" })
  const venueInView = useInView(venueRef, { once: true, margin: "-100px" })
  const faqInView = useInView(faqRef, { once: true, margin: "-100px" })
  const ctaInView = useInView(ctaRef, { once: true, margin: "-100px" })

  const navLinks = [
    { label: "About", href: "#about" },
    { label: "Highlights", href: "#highlights" },
    { label: "Speakers", href: "#speakers" },
    { label: "Schedule", href: "#schedule" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ]

  // Hero character reveal text
  const heroTitle = "TechnoSurg"
  const heroChars = heroTitle.split("")

  return (
    <div className="min-h-[100dvh] overflow-x-hidden" style={{ background: COLORS.navy }}>

      {/* ============ NAVBAR ============ */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "py-3 border-b border-white/[0.06]"
            : "py-5"
        }`}
        style={{
          background: scrolled ? "rgba(10, 22, 40, 0.85)" : "transparent",
          backdropFilter: scrolled ? "blur(20px) saturate(1.5)" : "none",
        }}
      >
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between">
          <a href="#" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-[0_0_20px_rgba(0,180,216,0.3)] group-hover:shadow-[0_0_30px_rgba(0,180,216,0.5)] transition-shadow duration-500">
              <span className="text-sm font-bold text-white tracking-tight">GEM</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-white font-bold text-sm tracking-tight">{EVENT.name}</span>
              <span className="block text-white/30 text-[11px] tracking-wide">{EVENT.dates}</span>
            </div>
          </a>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[13px] text-white/40 hover:text-white transition-colors duration-300 tracking-wide"
              >
                {link.label}
              </a>
            ))}
            <a
              href={EVENT.registrationUrl}
              className="relative px-6 py-2.5 rounded-xl text-sm font-semibold text-white overflow-hidden group"
              style={{ background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.cyanDark})` }}
            >
              <span className="relative z-10">Register Now</span>
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </a>
          </div>

          {/* Mobile Toggle */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden text-white p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {mobileMenuOpen ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h12" />}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:hidden absolute top-full left-0 right-0 border-b border-white/[0.06] overflow-hidden"
              style={{ background: "rgba(10, 22, 40, 0.95)", backdropFilter: "blur(20px)" }}
            >
              <div className="p-6 space-y-1">
                {navLinks.map((link, i) => (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="block text-white/60 hover:text-white py-3 text-[15px] transition-colors"
                  >
                    {link.label}
                  </motion.a>
                ))}
                <motion.a
                  href={EVENT.registrationUrl}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="block text-center mt-4 px-5 py-3.5 rounded-xl font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.cyanDark})` }}
                >
                  Register Now
                </motion.a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ============ HERO ============ */}
      <section ref={heroRef} className="relative min-h-[100dvh] flex items-end lg:items-center overflow-hidden pb-16 lg:pb-0">
        {/* Background grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(${COLORS.cyan} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.cyan} 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />

        {/* Gradient orbs */}
        <div className="absolute top-[-20%] right-[-10%] w-[700px] h-[700px] rounded-full blur-[140px]" style={{ background: `radial-gradient(circle, ${COLORS.cyan}12, transparent 70%)` }} />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full blur-[120px]" style={{ background: `radial-gradient(circle, ${COLORS.gold}08, transparent 70%)` }} />

        <FloatingParticles />

        <div className="relative z-10 max-w-[1400px] mx-auto px-6 pt-28 sm:pt-32 lg:pt-0 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Content — spans 7 cols */}
            <div className="lg:col-span-7">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={heroInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-cyan-500/20 mb-10"
                style={{ background: "rgba(0,180,216,0.06)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-cyan-400 text-xs font-medium tracking-[0.15em] uppercase">{EVENT.dates} &middot; {EVENT.city}</span>
              </motion.div>

              {/* GEM prefix */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={heroInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="mb-3"
              >
                <span
                  className="text-lg sm:text-xl font-semibold tracking-[0.3em] uppercase"
                  style={{ color: COLORS.gold }}
                >
                  GEM
                </span>
              </motion.div>

              {/* Character-by-character reveal */}
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tighter leading-[0.9] mb-4">
                {heroChars.map((char, i) => (
                  <motion.span
                    key={i}
                    variants={charReveal}
                    initial="hidden"
                    animate={heroInView ? "visible" : "hidden"}
                    custom={i}
                    className="inline-block"
                    style={{
                      background: `linear-gradient(135deg, #ffffff 0%, ${COLORS.cyan} 50%, ${COLORS.neon} 100%)`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {char}
                  </motion.span>
                ))}
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={heroInView ? { opacity: 1 } : {}}
                  transition={{ delay: 1.0, duration: 0.4 }}
                  className="block text-3xl sm:text-4xl md:text-5xl text-white/20 font-light tracking-tight mt-2"
                >
                  2026
                </motion.span>
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 1.1, duration: 0.6 }}
                className="text-base sm:text-lg text-white/40 leading-relaxed max-w-[50ch] mb-10 font-light"
              >
                {EVENT.tagline}. Two days of live robotic surgery, fluorescence-guided procedures, and the future of surgical AI.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 1.3, duration: 0.6 }}
                className="flex flex-col sm:flex-row gap-4 mb-14"
              >
                <a
                  href={EVENT.registrationUrl}
                  className="group relative inline-flex items-center justify-center px-8 py-4 rounded-2xl text-white font-semibold text-base overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.cyanDark})`, boxShadow: `0 0 40px -10px ${COLORS.cyan}` }}
                >
                  <span className="relative z-10">Register Now</span>
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </a>
                <a
                  href="#schedule"
                  className="inline-flex items-center justify-center px-8 py-4 rounded-2xl border border-white/[0.08] text-white/60 font-medium hover:bg-white/[0.04] hover:text-white/80 hover:border-white/[0.15] transition-all duration-300"
                >
                  View Schedule
                  <svg className="w-4 h-4 ml-2 opacity-40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={heroInView ? { opacity: 1 } : {}}
                transition={{ delay: 1.5, duration: 0.6 }}
              >
                <Countdown targetDate={EVENT.targetDate} />
              </motion.div>
            </div>

            {/* Right — Poster Image, spans 5 cols */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: 40 }}
              animate={heroInView ? { opacity: 1, scale: 1, x: 0 } : {}}
              transition={{ delay: 0.8, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="lg:col-span-5 relative hidden lg:block"
            >
              <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] shadow-[0_0_60px_-20px_rgba(0,180,216,0.2)]">
                <div className="aspect-[3/4] relative">
                  <Image
                    src={EVENT.posterImage}
                    alt={EVENT.name}
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628] via-transparent to-transparent opacity-60" />
                </div>
                {/* Floating badge on poster */}
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="px-5 py-3 rounded-xl bg-white/[0.08] backdrop-blur-md border border-white/[0.1]">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-sm text-white/80 font-medium">{EVENT.venue}, {EVENT.city}</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Decorative glow behind poster */}
              <div className="absolute -inset-4 -z-10 rounded-3xl blur-[60px] opacity-20" style={{ background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.gold})` }} />
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 hidden sm:flex"
        >
          <span className="text-[10px] text-white/20 uppercase tracking-[0.25em]">Scroll</span>
          <div className="w-5 h-9 rounded-full border border-white/10 flex justify-center pt-2">
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-1 h-2 rounded-full bg-cyan-400/50"
            />
          </div>
        </motion.div>
      </section>

      {/* ============ ABOUT ============ */}
      <section id="about" ref={aboutRef} className="py-24 sm:py-32 lg:py-40 px-6 relative" style={{ background: COLORS.navy }}>
        {/* Subtle top border glow */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />

        <motion.div
          initial="hidden"
          animate={aboutInView ? "visible" : "hidden"}
          variants={staggerContainer}
          className="max-w-[1400px] mx-auto"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-20 items-start">
            {/* Left text — 7 cols */}
            <div className="lg:col-span-7">
              <SectionLabel>About the Conference</SectionLabel>

              <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl lg:text-[3.2rem] font-bold text-white tracking-tighter leading-[1.1] mb-8">
                Where Surgical Innovation
                <span className="block mt-1" style={{ color: COLORS.cyan }}>Meets Clinical Excellence</span>
              </motion.h2>

              <motion.p variants={fadeUp} custom={2} className="text-base sm:text-lg text-white/40 leading-relaxed max-w-[60ch] font-light">
                {EVENT.description}
              </motion.p>
            </div>

            {/* Right stats — 5 cols, asymmetric grid */}
            <div className="lg:col-span-5">
              <div className="grid grid-cols-2 gap-4">
                {EVENT.stats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    variants={scaleIn}
                    custom={i}
                    className={`relative p-7 rounded-2xl border border-white/[0.06] overflow-hidden group hover:border-cyan-500/20 transition-all duration-500 ${
                      i === 0 ? "bg-gradient-to-br from-cyan-500/[0.08] to-transparent" : "bg-white/[0.02]"
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[40px] bg-gradient-to-bl from-white/[0.02] to-transparent" />
                    <div className="text-3xl sm:text-4xl font-bold tracking-tight tabular-nums" style={{ color: i === 0 ? COLORS.cyan : "#ffffff" }}>
                      <AnimatedCounter value={stat.value} suffix={stat.suffix} inView={aboutInView} />
                    </div>
                    <div className="text-sm text-white/30 mt-2 font-medium">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ============ HIGHLIGHTS ============ */}
      <section id="highlights" ref={highlightsRef} className="py-24 sm:py-32 lg:py-40 px-6 relative" style={{ background: "#070e1a" }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

        <motion.div
          initial="hidden"
          animate={highlightsInView ? "visible" : "hidden"}
          variants={staggerContainer}
          className="max-w-[1400px] mx-auto"
        >
          <SectionLabel>What to Expect</SectionLabel>
          <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl lg:text-[3.2rem] font-bold text-white tracking-tighter leading-[1.1] mb-16">
            Conference Highlights
          </motion.h2>

          {/* Bento grid — asymmetric */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 sm:gap-5">
            {/* Large card — spans 4 cols */}
            <motion.div
              variants={scaleIn}
              custom={0}
              className="md:col-span-4 group p-8 sm:p-10 rounded-3xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-cyan-500/20 transition-all duration-500 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-40 h-40 rounded-bl-[80px] bg-gradient-to-bl from-cyan-500/[0.04] to-transparent" />
              <div className="w-14 h-14 rounded-2xl border border-cyan-500/20 flex items-center justify-center mb-7 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(0,180,216,0.2)] transition-all duration-500" style={{ background: "rgba(0,180,216,0.08)" }}>
                <HighlightIcon type={EVENT.highlights[0].icon} className="w-7 h-7 text-cyan-400" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 tracking-tight">{EVENT.highlights[0].title}</h3>
              <p className="text-white/40 leading-relaxed max-w-[50ch] font-light">{EVENT.highlights[0].description}</p>
            </motion.div>

            {/* Two small cards stacked — spans 2 cols */}
            <div className="md:col-span-2 flex flex-col gap-4 sm:gap-5">
              {EVENT.highlights.slice(1, 3).map((item, i) => (
                <motion.div
                  key={item.title}
                  variants={scaleIn}
                  custom={i + 1}
                  className="group flex-1 p-7 rounded-3xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-cyan-500/20 transition-all duration-500"
                >
                  <div className="w-11 h-11 rounded-xl border border-cyan-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500" style={{ background: "rgba(0,180,216,0.08)" }}>
                    <HighlightIcon type={item.icon} className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2 tracking-tight">{item.title}</h3>
                  <p className="text-sm text-white/35 leading-relaxed font-light">{item.description}</p>
                </motion.div>
              ))}
            </div>

            {/* Two medium cards — 3 cols each */}
            {EVENT.highlights.slice(3).map((item, i) => (
              <motion.div
                key={item.title}
                variants={scaleIn}
                custom={i + 3}
                className="md:col-span-3 group p-8 rounded-3xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-cyan-500/20 transition-all duration-500"
              >
                <div className="w-12 h-12 rounded-xl border border-cyan-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500" style={{ background: "rgba(0,180,216,0.08)" }}>
                  <HighlightIcon type={item.icon} className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">{item.title}</h3>
                <p className="text-white/35 leading-relaxed font-light">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ============ SPEAKERS ============ */}
      <section id="speakers" ref={speakersRef} className="py-24 sm:py-32 lg:py-40 px-6 relative" style={{ background: COLORS.navy }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

        <motion.div
          initial="hidden"
          animate={speakersInView ? "visible" : "hidden"}
          variants={staggerContainer}
          className="max-w-[1400px] mx-auto"
        >
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-16">
            <div>
              <SectionLabel>Expert Faculty</SectionLabel>
              <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl lg:text-[3.2rem] font-bold text-white tracking-tighter leading-[1.1]">
                Our Speakers
              </motion.h2>
            </div>
            <motion.p variants={fadeUp} custom={2} className="text-white/30 text-sm max-w-[40ch] font-light">
              World-class surgical faculty from leading institutions across India and internationally.
            </motion.p>
          </div>

          {/* Asymmetric grid: 2 large + 4 medium */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-5">
            {EVENT.speakers.map((speaker, i) => {
              const isLarge = i < 2
              return (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  custom={i}
                  className={`group relative rounded-3xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-cyan-500/15 transition-all duration-500 overflow-hidden ${
                    isLarge ? "lg:col-span-4 p-8 sm:p-9" : "lg:col-span-3 p-6 sm:p-7"
                  } ${i === 0 ? "sm:col-span-1" : ""}`}
                >
                  {/* Top accent line */}
                  <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className={`rounded-2xl flex items-center justify-center mb-6 ${
                    isLarge
                      ? "w-20 h-20 bg-gradient-to-br from-cyan-500/10 to-cyan-600/5"
                      : "w-14 h-14 bg-gradient-to-br from-white/[0.04] to-white/[0.02]"
                  } border border-white/[0.08] group-hover:scale-105 transition-transform duration-500`}>
                    <span className={`font-bold text-white/50 ${isLarge ? "text-2xl" : "text-lg"}`}>{speaker.initials}</span>
                  </div>

                  <h3 className={`font-bold text-white tracking-tight ${isLarge ? "text-lg" : "text-base"}`}>{speaker.name}</h3>
                  <p className="text-sm font-medium mt-1.5" style={{ color: COLORS.cyan }}>{speaker.role}</p>
                  <p className="text-sm text-white/30 mt-1">{speaker.institution}</p>

                  <div className={`mt-5 pt-4 border-t border-white/[0.05]`}>
                    <span className="inline-block text-[11px] text-white/25 uppercase tracking-[0.15em] px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02]">
                      {speaker.specialty}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </section>

      {/* ============ SCHEDULE ============ */}
      <section id="schedule" ref={scheduleRef} className="py-24 sm:py-32 lg:py-40 px-6 relative" style={{ background: "#070e1a" }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

        <motion.div
          initial="hidden"
          animate={scheduleInView ? "visible" : "hidden"}
          variants={staggerContainer}
          className="max-w-[1400px] mx-auto"
        >
          <SectionLabel>Programme</SectionLabel>
          <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl lg:text-[3.2rem] font-bold text-white tracking-tighter leading-[1.1] mb-12">
            Conference Schedule
          </motion.h2>

          {/* Day Tabs */}
          <motion.div variants={fadeUp} custom={2} className="flex gap-3 mb-4">
            {EVENT.schedule.map((day, i) => (
              <button
                key={i}
                onClick={() => setActiveDay(i)}
                className={`relative px-6 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-400 overflow-hidden ${
                  activeDay === i
                    ? "text-white"
                    : "bg-white/[0.03] text-white/30 hover:bg-white/[0.06] hover:text-white/50 border border-white/[0.06]"
                }`}
                style={activeDay === i ? { background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.cyanDark})`, boxShadow: `0 0 20px -5px ${COLORS.cyan}40` } : {}}
              >
                {day.day} &mdash; {day.date}
              </button>
            ))}
          </motion.div>

          {/* Day Theme */}
          <motion.p variants={fadeUp} custom={3} className="text-white/25 text-sm mb-10">
            Theme: <span className="font-medium" style={{ color: COLORS.cyan }}>{EVENT.schedule[activeDay].theme}</span>
          </motion.p>

          {/* Sessions */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeDay}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              {EVENT.schedule[activeDay].sessions.map((session, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  className="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 p-5 sm:p-6 rounded-2xl border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-400"
                >
                  <div className="sm:w-32 shrink-0">
                    <span className="text-sm font-mono text-white/25 tabular-nums tracking-wide">{session.time}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white/80 font-medium group-hover:text-white transition-colors duration-300 text-[15px]">{session.title}</h4>
                  </div>
                  <SessionTypeTag type={session.type} />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" ref={pricingRef} className="py-24 sm:py-32 lg:py-40 px-6 relative" style={{ background: COLORS.navy }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

        <motion.div
          initial="hidden"
          animate={pricingInView ? "visible" : "hidden"}
          variants={staggerContainer}
          className="max-w-[1200px] mx-auto"
        >
          <div className="mb-16">
            <SectionLabel>Registration</SectionLabel>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl lg:text-[3.2rem] font-bold text-white tracking-tighter leading-[1.1]">
              Choose Your Pass
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {EVENT.pricing.map((tier, i) => (
              <motion.div
                key={tier.name}
                variants={scaleIn}
                custom={i}
                className={`relative rounded-3xl border overflow-hidden transition-all duration-500 group ${
                  tier.popular
                    ? "border-cyan-500/30 bg-gradient-to-b from-cyan-500/[0.08] to-white/[0.02] scale-[1.02] shadow-[0_0_40px_-15px_rgba(0,180,216,0.25)]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                }`}
              >
                {tier.popular && (
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${COLORS.cyan}, transparent)` }} />
                )}

                <div className="p-8 sm:p-9">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-bold text-white">{tier.name}</h3>
                    {tier.popular && (
                      <span className="text-[10px] uppercase tracking-[0.15em] font-bold px-3 py-1 rounded-full" style={{ background: `${COLORS.cyan}20`, color: COLORS.cyan }}>
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/25 mb-7">{tier.deadline}</p>

                  <div className="mb-8">
                    <span className="text-xs text-white/25 mr-1">{tier.currency}</span>
                    <span className="text-4xl sm:text-5xl font-bold text-white tracking-tight">{tier.price}</span>
                  </div>

                  <ul className="space-y-3.5 mb-9">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm">
                        <svg className="w-4 h-4 shrink-0" style={{ color: COLORS.cyan }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-white/45 font-light">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href={EVENT.registrationUrl}
                    className={`block text-center py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
                      tier.popular
                        ? "text-white hover:scale-[1.02]"
                        : "text-white/60 border border-white/[0.08] hover:bg-white/[0.04] hover:text-white hover:border-white/[0.15]"
                    }`}
                    style={tier.popular ? { background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.cyanDark})`, boxShadow: `0 0 20px -5px ${COLORS.cyan}40` } : {}}
                  >
                    Register Now
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ============ VENUE ============ */}
      <section ref={venueRef} className="py-24 sm:py-32 lg:py-40 px-6 relative" style={{ background: "#070e1a" }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

        <motion.div
          initial="hidden"
          animate={venueInView ? "visible" : "hidden"}
          variants={staggerContainer}
          className="max-w-[1400px] mx-auto"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Left info — 5 cols */}
            <div className="lg:col-span-5">
              <SectionLabel>Venue</SectionLabel>
              <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tighter leading-[1.05] mb-6">
                {EVENT.venue}
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-white/35 leading-relaxed text-base mb-10 font-light">
                Experience surgical innovation at one of India&apos;s most iconic luxury hotels. The ITC Grand Chola offers
                world-class conference facilities, exquisite dining, and the legendary Chettinad hospitality.
              </motion.p>

              <motion.div variants={fadeUp} custom={3} className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-5 h-5" style={{ color: COLORS.cyan }} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" /><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-white/60 text-sm font-medium">{EVENT.fullAddress}</span>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-5 h-5" style={{ color: COLORS.cyan }} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-white/60 text-sm font-medium">Chennai International Airport &mdash; 20 min drive</span>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-5 h-5" style={{ color: COLORS.cyan }} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-white/60 text-sm font-medium">Chennai Central Railway Station &mdash; 15 min drive</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right map — 7 cols */}
            <motion.div variants={fadeUp} custom={2} className="lg:col-span-7">
              <div className="rounded-3xl overflow-hidden border border-white/[0.06] h-80 sm:h-96 lg:h-[480px] bg-white/[0.02] relative">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.0!2d80.2209!3d13.0108!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a5267f16c060631%3A0xdb33e05c1eb78f0!2sITC%20Grand%20Chola!5e0!3m2!1sen!2sin!4v1"
                  width="100%"
                  height="100%"
                  style={{ border: 0, filter: "invert(90%) hue-rotate(180deg) brightness(0.85) contrast(1.2) saturate(0.3)" }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                {/* Map overlay gradient */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#070e1a] via-transparent to-transparent opacity-40" />
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" ref={faqRef} className="py-24 sm:py-32 lg:py-40 px-6 relative" style={{ background: COLORS.navy }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

        <motion.div
          initial="hidden"
          animate={faqInView ? "visible" : "hidden"}
          variants={staggerContainer}
          className="max-w-[900px] mx-auto"
        >
          <div className="mb-14">
            <SectionLabel>Questions</SectionLabel>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl lg:text-[3.2rem] font-bold text-white tracking-tighter leading-[1.1]">
              Frequently Asked
            </motion.h2>
          </div>

          <div className="space-y-3">
            {EVENT.faq.map((item, i) => (
              <FAQItem key={i} question={item.q} answer={item.a} index={i} />
            ))}
          </div>
        </motion.div>
      </section>

      {/* ============ CTA ============ */}
      <section ref={ctaRef} className="relative py-24 sm:py-32 lg:py-40 px-6 overflow-hidden" style={{ background: "#070e1a" }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

        {/* Gradient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full blur-[150px]" style={{ background: `radial-gradient(ellipse, ${COLORS.cyan}10, ${COLORS.gold}05, transparent 70%)` }} />

        <FloatingParticles />

        <motion.div
          initial="hidden"
          animate={ctaInView ? "visible" : "hidden"}
          variants={staggerContainer}
          className="relative z-10 max-w-[800px] mx-auto"
        >
          <div className="flex flex-col items-start sm:items-center sm:text-center">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tighter leading-[1.05] mb-6">
              Ready to Shape the
              <span className="block sm:inline" style={{ color: COLORS.cyan }}> Future of Surgery?</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-base sm:text-lg text-white/35 mb-10 max-w-[50ch] font-light">
              Secure your spot at {EVENT.name}. Join 500+ surgeons and innovators for two days of breakthroughs at {EVENT.venue}, {EVENT.city}.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="flex flex-col sm:flex-row gap-4">
              <a
                href={EVENT.registrationUrl}
                className="group relative inline-flex items-center justify-center px-10 py-4 rounded-2xl text-white font-semibold text-lg overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.cyanDark})`, boxShadow: `0 0 50px -15px ${COLORS.cyan}` }}
              >
                <span className="relative z-10">Register Now</span>
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </a>
              <a
                href={`mailto:${COMPANY_CONFIG.supportEmail}`}
                className="inline-flex items-center justify-center px-8 py-4 rounded-2xl border border-white/[0.08] text-white/50 font-medium hover:bg-white/[0.04] hover:text-white/70 transition-all duration-300"
              >
                Contact Us
              </a>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-white/[0.04] py-12 sm:py-16 px-6" style={{ background: COLORS.navy }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.cyanDark})` }}>
                <span className="text-xs font-bold text-white tracking-tight">GEM</span>
              </div>
              <div>
                <span className="text-white/50 text-sm font-medium">{EVENT.name}</span>
                <span className="block text-white/20 text-xs">{COMPANY_CONFIG.fullName}</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
              <a href={`mailto:${COMPANY_CONFIG.supportEmail}`} className="text-sm text-white/25 hover:text-white/50 transition-colors duration-300">
                {COMPANY_CONFIG.supportEmail}
              </a>
              <a href={EVENT.registrationUrl} className="text-sm font-medium transition-colors duration-300" style={{ color: COLORS.cyan }}>
                Register
              </a>
            </div>
          </div>
          <div className="mt-10 pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-[13px] text-white/15">
              &copy; {new Date().getFullYear()} {COMPANY_CONFIG.fullName}. All rights reserved.
            </p>
            <div className="flex gap-6">
              <span className="text-[13px] text-white/15">{EVENT.dates}</span>
              <span className="text-[13px] text-white/15">{EVENT.venue}, {EVENT.city}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
