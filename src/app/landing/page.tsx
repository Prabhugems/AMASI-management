"use client"

import { useState, useEffect, useRef } from "react"
import { motion, useInView } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { COMPANY_CONFIG } from "@/lib/config"

// ============================================
// CONFERENCE DATA
// ============================================
const EVENT = {
  name: "GEM TechnoSurg 2026",
  tagline: "AI, Robotics & Fluorescence in Surgery",
  dates: "June 19-20, 2026",
  targetDate: "2026-06-19T09:00:00+05:30",
  venue: "ITC Grand Chola",
  city: "Chennai",
  state: "Tamil Nadu",
  fullAddress: "63, Anna Salai, Guindy, Chennai, Tamil Nadu 600032",
  description:
    "India's most anticipated surgical technology summit bringing together 500+ surgeons, AI researchers, and medtech pioneers for two transformative days of live robotic procedures, fluorescence-guided surgery, and hands-on workshops.",
  registrationUrl: "/register",
  posterImage: "/landing/hero-poster.jpg",
  stats: [
    { value: 500, suffix: "+", label: "Delegates" },
    { value: 50, suffix: "+", label: "Speakers" },
    { value: 30, suffix: "+", label: "Live Surgeries" },
    { value: 2, suffix: "", label: "Days" },
  ],
  speakers: [
    { name: "Dr. Pradeep Chowbey", role: "Keynote Speaker", institution: "Max Healthcare, New Delhi" },
    { name: "Dr. C. Palanivelu", role: "Guest of Honour", institution: "GEM Hospital, Chennai" },
    { name: "Dr. Tehemton Udwadia", role: "Oration Speaker", institution: "Breach Candy Hospital, Mumbai" },
    { name: "Dr. Anil Heroor", role: "Faculty", institution: "Fortis Hospital, Mumbai" },
    { name: "Dr. Sanjay Rajdev", role: "Faculty", institution: "Apollo Hospital, Ahmedabad" },
    { name: "Dr. Vivek Bindal", role: "Faculty", institution: "Max Super Speciality, Delhi" },
  ],
  schedule: {
    day1: {
      date: "June 19, 2026",
      sessions: [
        { time: "08:00", title: "Registration & Breakfast", type: "general" },
        { time: "09:00", title: "Inaugural Ceremony", type: "general" },
        { time: "09:45", title: "Keynote: AI in Surgical Decision Making", type: "talk" },
        { time: "10:30", title: "Live Robotic Cholecystectomy", type: "surgery" },
        { time: "11:30", title: "Fluorescence-Guided Hepatectomy", type: "surgery" },
        { time: "13:00", title: "Lunch & Industry Exhibition", type: "general" },
        { time: "14:00", title: "Hands-on Workshop: ICG Navigation", type: "workshop" },
        { time: "15:30", title: "Panel: Ethics of AI in Surgery", type: "panel" },
        { time: "17:00", title: "Live: Robotic Hernia Repair", type: "surgery" },
      ],
    },
    day2: {
      date: "June 20, 2026",
      sessions: [
        { time: "08:30", title: "Morning Symposium: Surgical Robotics", type: "talk" },
        { time: "09:30", title: "Live: AI-Assisted Bariatric Surgery", type: "surgery" },
        { time: "10:30", title: "Workshop: Fluorescence Imaging Basics", type: "workshop" },
        { time: "12:00", title: "Panel: Future of Minimally Invasive Surgery", type: "panel" },
        { time: "13:00", title: "Lunch Break", type: "general" },
        { time: "14:00", title: "Live: Robotic Whipple Procedure", type: "surgery" },
        { time: "15:30", title: "Best Paper & Poster Awards", type: "general" },
        { time: "16:30", title: "Valedictory & Closing Ceremony", type: "general" },
      ],
    },
  },
  pricing: {
    earlyBird: "5,000",
    regular: "7,500",
    maxDelegates: 500,
  },
  mapEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.023871835398!2d80.21228531482184!3d13.010769690826928!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a5267f1a22a3d51%3A0x4ee79a7b2d3c1fbf!2sITC%20Grand%20Chola!5e0!3m2!1sen!2sin!4v1690000000000!5m2!1sen!2sin",
}

// ============================================
// ANIMATION VARIANTS
// ============================================
const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] as const },
  },
}

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.03 },
  },
}

const wordReveal = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const },
  },
}

// ============================================
// HOOKS
// ============================================
function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetDate])

  return timeLeft
}

function useCountUp(end: number, duration = 2000) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-100px" })

  useEffect(() => {
    if (!inView) return
    let start = 0
    const startTime = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      start = Math.floor(eased * end)
      setCount(start)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [inView, end, duration])

  return { count, ref }
}

// ============================================
// SESSION TYPE DOTS
// ============================================
function SessionDot({ type }: { type: string }) {
  const colors: Record<string, string> = {
    surgery: "bg-cyan-500",
    workshop: "bg-amber-500",
    panel: "bg-zinc-400",
    talk: "bg-cyan-400",
    general: "bg-zinc-600",
  }
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors[type] || colors.general} mt-2 shrink-0`} />
}

// ============================================
// PAGE
// ============================================
export default function LandingPage() {
  const countdown = useCountdown(EVENT.targetDate)

  return (
    <main className="bg-[#030712] text-white antialiased overflow-x-hidden">
      {/* ====== HERO ====== */}
      <Hero countdown={countdown} />

      {/* ====== ABOUT ====== */}
      <About />

      {/* ====== SPEAKERS ====== */}
      <Speakers />

      {/* ====== SCHEDULE ====== */}
      <Schedule />

      {/* ====== REGISTRATION ====== */}
      <Registration />

      {/* ====== VENUE ====== */}
      <Venue />

      {/* ====== FOOTER ====== */}
      <Footer />
    </main>
  )
}

// ============================================
// HERO SECTION
// ============================================
function Hero({ countdown }: { countdown: { days: number; hours: number; minutes: number; seconds: number } }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  const heroWords = ["GEM", "TechnoSurg", "2026"]

  return (
    <section className="relative min-h-[100dvh] flex items-center overflow-hidden">
      {/* Background dot grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Poster image — right side on desktop, behind on mobile */}
      <div className="absolute inset-0 lg:left-[40%] lg:right-0">
        <Image
          src={EVENT.posterImage}
          alt={EVENT.name}
          fill
          priority
          className="object-cover object-center"
        />
        {/* Gradient fade — left edge on desktop */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#030712] via-[#030712]/80 to-transparent hidden lg:block" />
        {/* Overlay on mobile */}
        <div className="absolute inset-0 bg-[#030712]/75 lg:hidden" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-[1400px] mx-auto w-full px-6 sm:px-10 lg:px-16 py-20" ref={ref}>
        <div className="max-w-2xl">
          {/* Date label */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xs tracking-[0.3em] uppercase text-cyan-500 mb-8"
          >
            June 19-20, 2026 &middot; Chennai
          </motion.p>

          {/* Title — staggered word reveal */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            className="mb-6"
          >
            {heroWords.map((word, i) => (
              <motion.span
                key={i}
                variants={wordReveal}
                className="block text-6xl sm:text-7xl lg:text-8xl font-extralight tracking-tighter leading-none"
              >
                {word}
              </motion.span>
            ))}
          </motion.div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-lg text-zinc-500 font-light mb-10 max-w-[55ch]"
          >
            {EVENT.tagline}
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.65 }}
          >
            <Link
              href={EVENT.registrationUrl}
              className="inline-block bg-cyan-500 text-white px-8 py-4 rounded-full text-sm tracking-wide uppercase hover:bg-cyan-400 transition-colors duration-300"
            >
              Register Now
            </Link>
          </motion.div>

          {/* Countdown */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.85 }}
            className="mt-12 flex gap-8"
          >
            {[
              { value: countdown.days, label: "Days" },
              { value: countdown.hours, label: "Hours" },
              { value: countdown.minutes, label: "Min" },
              { value: countdown.seconds, label: "Sec" },
            ].map((unit) => (
              <div key={unit.label} className="text-center">
                <span className="block text-2xl sm:text-3xl font-extralight tabular-nums">
                  {String(unit.value).padStart(2, "0")}
                </span>
                <span className="block text-[10px] tracking-[0.2em] uppercase text-zinc-600 mt-1">
                  {unit.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ============================================
// ABOUT SECTION
// ============================================
function About() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section className="bg-[#fafafa] text-zinc-900" ref={ref}>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-24 sm:py-32 lg:py-40">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tighter leading-none mb-8">
            Where Technology
            <br />
            Meets Surgery
          </h2>

          <p className="text-lg text-zinc-500 max-w-[55ch] mb-20 leading-relaxed">
            {EVENT.description}
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {EVENT.stats.map((stat) => (
            <StatItem key={stat.label} value={stat.value} suffix={stat.suffix} label={stat.label} />
          ))}
        </div>
      </div>
    </section>
  )
}

function StatItem({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { count, ref } = useCountUp(value)
  return (
    <div className="py-6 border-t border-zinc-200">
      <span ref={ref} className="block text-4xl sm:text-5xl font-extralight tracking-tight text-zinc-900 tabular-nums">
        {count}
        {suffix}
      </span>
      <span className="block text-sm text-zinc-500 mt-2 tracking-wide uppercase">{label}</span>
    </div>
  )
}

// ============================================
// SPEAKERS SECTION
// ============================================
function Speakers() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section className="bg-[#030712]" ref={ref}>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-24 sm:py-32 lg:py-40">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          <div className="flex items-center gap-6 mb-16">
            <h2 className="text-4xl sm:text-5xl font-light tracking-tighter text-white">Faculty</h2>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12">
          {EVENT.speakers.map((speaker, i) => (
            <motion.div
              key={speaker.name}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 * i, ease: [0.25, 0.1, 0.25, 1] }}
              className="group border-b border-zinc-800 py-8"
            >
              <span className="block text-5xl sm:text-6xl font-extralight text-cyan-500 leading-none mb-4 select-none">
                {speaker.name.charAt(0)}
              </span>
              <p className="text-white text-lg font-light tracking-tight transition-transform duration-300 group-hover:translate-x-2">
                {speaker.name}
              </p>
              <p className="text-zinc-500 text-sm mt-1">{speaker.role}</p>
              <p className="text-zinc-600 text-sm mt-0.5">{speaker.institution}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================
// SCHEDULE SECTION
// ============================================
function Schedule() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section className="bg-[#fafafa] text-zinc-900" ref={ref}>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-24 sm:py-32 lg:py-40">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          <h2 className="text-4xl sm:text-5xl font-light tracking-tighter mb-16">Schedule</h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Day 1 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <h3 className="text-lg font-light text-zinc-400 mb-6 tracking-wide">
              Day 1 &middot; {EVENT.schedule.day1.date}
            </h3>
            <div className="space-y-0">
              {EVENT.schedule.day1.sessions.map((s) => (
                <div key={s.time + s.title} className="flex gap-4 py-3 border-b border-zinc-200">
                  <SessionDot type={s.type} />
                  <span className="text-sm font-mono text-zinc-400 w-12 shrink-0">{s.time}</span>
                  <span className="text-sm text-zinc-700">{s.title}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Day 2 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.35 }}
          >
            <h3 className="text-lg font-light text-zinc-400 mb-6 tracking-wide">
              Day 2 &middot; {EVENT.schedule.day2.date}
            </h3>
            <div className="space-y-0">
              {EVENT.schedule.day2.sessions.map((s) => (
                <div key={s.time + s.title} className="flex gap-4 py-3 border-b border-zinc-200">
                  <SessionDot type={s.type} />
                  <span className="text-sm font-mono text-zinc-400 w-12 shrink-0">{s.time}</span>
                  <span className="text-sm text-zinc-700">{s.title}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Legend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 flex flex-wrap gap-6 text-xs text-zinc-400"
        >
          {[
            { type: "surgery", label: "Live Surgery" },
            { type: "workshop", label: "Workshop" },
            { type: "panel", label: "Panel" },
            { type: "talk", label: "Talk" },
          ].map((item) => (
            <span key={item.type} className="flex items-center gap-2">
              <SessionDot type={item.type} />
              {item.label}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ============================================
// REGISTRATION SECTION
// ============================================
function Registration() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section className="bg-[#030712]" ref={ref}>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-24 sm:py-32 lg:py-40 text-center">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-extralight tracking-tighter text-white mb-6">
            Secure Your Seat
          </h2>

          <p className="text-lg text-zinc-400 font-light mb-12">
            Early Bird: INR {EVENT.pricing.earlyBird} &middot; Regular: INR {EVENT.pricing.regular}
          </p>

          <Link
            href={EVENT.registrationUrl}
            className="inline-block bg-cyan-500 text-white px-10 py-4 rounded-full text-sm tracking-wide uppercase hover:bg-cyan-400 transition-colors duration-300"
          >
            Register Now
          </Link>

          <p className="text-sm text-zinc-600 mt-8">
            Limited to {EVENT.pricing.maxDelegates} delegates
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// ============================================
// VENUE SECTION
// ============================================
function Venue() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section className="bg-[#fafafa] text-zinc-900" ref={ref}>
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-24 sm:py-32 lg:py-40">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tighter mb-2">
            ITC Grand Chola
          </h2>
          <p className="text-lg text-zinc-400 font-light mb-8">Chennai, Tamil Nadu</p>

          <div className="max-w-[55ch] mb-12 space-y-3 text-zinc-500 text-base leading-relaxed">
            <p>{EVENT.fullAddress}</p>
            <p>
              15 minutes from Chennai International Airport.
              <br />
              Adjacent to Guindy Metro Station.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="w-full aspect-[16/7] rounded-2xl overflow-hidden"
        >
          <iframe
            src={EVENT.mapEmbedUrl}
            width="100%"
            height="100%"
            style={{ border: 0, filter: "grayscale(0.8) contrast(1.1)" }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="ITC Grand Chola location"
          />
        </motion.div>
      </div>
    </section>
  )
}

// ============================================
// FOOTER
// ============================================
function Footer() {
  return (
    <footer className="bg-[#030712] border-t border-zinc-900">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-8">
        <p className="text-sm text-zinc-600 text-center">
          {EVENT.name} &middot; {COMPANY_CONFIG.supportEmail} &middot; &copy; {new Date().getFullYear()} {COMPANY_CONFIG.name}
        </p>
      </div>
    </footer>
  )
}
