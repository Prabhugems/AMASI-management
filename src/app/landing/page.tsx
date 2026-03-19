"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import { motion, useScroll, useTransform } from "framer-motion"

/* ─────────────────────────────────────────────
   DATA — change content here
   ───────────────────────────────────────────── */

const REGISTER_URL = "/register"

const SPEAKERS = [
  { name: "Dr. C. Palanivelu", title: "Conference Chairman", org: "GEM Hospital" },
  { name: "Dr. Ramesh Ardhanari", title: "Organizing Secretary", org: "GEM Hospital" },
  { name: "To Be Announced", title: "International Faculty", org: "Robotic Surgery" },
  { name: "To Be Announced", title: "International Faculty", org: "AI in Surgery" },
  { name: "To Be Announced", title: "National Faculty", org: "Fluorescence Surgery" },
  { name: "To Be Announced", title: "National Faculty", org: "Bariatric Surgery" },
]

const DAY1 = [
  { time: "09:00", title: "Inaugural Ceremony" },
  { time: "09:30", title: "Live Surgery — Robotic Cholecystectomy", tag: "live" },
  { time: "11:00", title: "AI-Assisted Surgical Planning — Keynote", tag: "keynote" },
  { time: "12:00", title: "Panel: Fluorescence-Guided Navigation" },
  { time: "14:00", title: "Live Surgery — ICG Hepatobiliary Procedure", tag: "live" },
  { time: "15:30", title: "Hands-On Workshop — Robotic Console", tag: "workshop" },
  { time: "19:00", title: "Conference Dinner" },
]

const DAY2 = [
  { time: "08:30", title: "Live Surgery — Complex Multi-organ Procedure", tag: "live" },
  { time: "10:30", title: "Debate: Open vs Minimally Invasive Surgery" },
  { time: "11:30", title: "AI & Computer Vision in the OR — Keynote", tag: "keynote" },
  { time: "13:30", title: "Free Paper & Poster Awards" },
  { time: "14:30", title: "Live Surgery — Fluorescence-Guided Colorectal", tag: "live" },
  { time: "16:00", title: "Valedictory Ceremony" },
]

/* ─────────────────────────────────────────────
   UTILITIES
   ───────────────────────────────────────────── */

function useCountUp(target: number, duration = 2000, go = false) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!go) return
    let start: number
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setN(Math.floor(p * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, go])
  return n
}

function Countdown() {
  const [d, setD] = useState({ d: 0, h: 0, m: 0, s: 0 })
  useEffect(() => {
    const t = new Date("2026-06-19T09:00:00+05:30").getTime()
    const tick = () => {
      const diff = Math.max(0, t - Date.now())
      setD({
        d: Math.floor(diff / 864e5),
        h: Math.floor((diff % 864e5) / 36e5),
        m: Math.floor((diff % 36e5) / 6e4),
        s: Math.floor((diff % 6e4) / 1e3),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex gap-8 tabular-nums">
      {(["d", "h", "m", "s"] as const).map((k) => (
        <div key={k} className="text-center">
          <span className="block text-3xl sm:text-4xl font-light text-white">
            {String(d[k]).padStart(2, "0")}
          </span>
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/30 mt-1 block">
            {k === "d" ? "days" : k === "h" ? "hrs" : k === "m" ? "min" : "sec"}
          </span>
        </div>
      ))}
    </div>
  )
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function Stat({ value, suffix, label, delay, go }: { value: number; suffix: string; label: string; delay: number; go: boolean }) {
  const n = useCountUp(value, 2000, go)
  return (
    <Reveal delay={delay}>
      <div className="text-center">
        <span className="text-5xl sm:text-6xl font-extralight text-zinc-900 tabular-nums">{n}{suffix}</span>
        <span className="block text-xs uppercase tracking-[0.2em] text-zinc-400 mt-3">{label}</span>
      </div>
    </Reveal>
  )
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] })
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60)
    window.addEventListener("scroll", fn, { passive: true })
    return () => window.removeEventListener("scroll", fn)
  }, [])

  const [statsGo, setStatsGo] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsGo(true) }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const [day, setDay] = useState<1 | 2>(1)

  return (
    <div className="bg-black text-white antialiased selection:bg-cyan-500/30">

      {/* ── NAV ── */}
      <nav className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? "bg-black/70 backdrop-blur-2xl backdrop-saturate-150 border-b border-white/5" : ""}`}>
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-medium tracking-tight">GEM TechnoSurg</span>
          <div className="hidden md:flex items-center gap-8 text-[13px] text-white/60">
            <a href="#about" className="hover:text-white transition-colors">About</a>
            <a href="#speakers" className="hover:text-white transition-colors">Faculty</a>
            <a href="#schedule" className="hover:text-white transition-colors">Schedule</a>
            <a href="#register" className="hover:text-white transition-colors">Register</a>
          </div>
          <a href={REGISTER_URL} className="text-[13px] text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
            Register&nbsp;&rarr;
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative min-h-[100dvh] flex items-end overflow-hidden">
        {/* Poster background with parallax */}
        <motion.div className="absolute inset-0" style={{ y: heroY }}>
          <img
            src="/landing/hero-poster.jpg"
            alt="GEM TechnoSurg 2026"
            className="w-full h-full object-cover object-top"
          />
          {/* Bottom gradient fade to black */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </motion.div>

        {/* Content at bottom */}
        <motion.div className="relative z-10 w-full" style={{ opacity: heroOpacity }}>
          <div className="max-w-[1200px] mx-auto px-6 pb-16 sm:pb-24">
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-400 mb-6">
                June 19–20, 2026 &nbsp;·&nbsp; ITC Grand Chola, Chennai
              </p>
            </Reveal>
            <Reveal delay={200}>
              <h1 className="text-4xl sm:text-6xl lg:text-[5.5rem] font-extralight leading-[0.95] tracking-tighter max-w-3xl">
                AI. Robotics.<br />Fluorescence<br />in Surgery.
              </h1>
            </Reveal>
            <Reveal delay={400}>
              <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-6">
                <a
                  href={REGISTER_URL}
                  className="inline-flex items-center justify-center h-14 px-10 rounded-full bg-white text-black text-[15px] font-medium hover:bg-white/90 active:scale-[0.97] transition-all duration-200"
                >
                  Register Now
                </a>
                <Countdown />
              </div>
            </Reveal>
          </div>
        </motion.div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="bg-[#fafafa] text-zinc-900">
        <div className="max-w-[1200px] mx-auto px-6 py-28 sm:py-40">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-400 mb-6">About</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extralight tracking-tighter leading-[1.05] max-w-2xl">
              Where technology meets the operating room.
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-8 text-lg sm:text-xl font-light text-zinc-500 leading-relaxed max-w-[55ch]">
              India&apos;s most anticipated surgical technology summit bringing together 500+ surgeons,
              AI researchers, and medtech innovators for two days of live robotic procedures,
              fluorescence-guided surgery, and hands-on workshops at the iconic ITC Grand Chola, Chennai.
            </p>
          </Reveal>

          {/* Stats */}
          <div ref={statsRef} className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-8 border-t border-zinc-200 pt-16">
            <Stat value={500} suffix="+" label="Delegates" delay={0} go={statsGo} />
            <Stat value={50} suffix="+" label="Speakers" delay={100} go={statsGo} />
            <Stat value={30} suffix="+" label="Live Surgeries" delay={200} go={statsGo} />
            <Stat value={2} suffix="" label="Days" delay={300} go={statsGo} />
          </div>
        </div>
      </section>

      {/* ── SPEAKERS ── */}
      <section id="speakers" className="bg-black">
        <div className="max-w-[1200px] mx-auto px-6 py-28 sm:py-40">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-500 mb-6">Faculty</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl sm:text-5xl font-extralight tracking-tighter mb-20">
              Learn from the pioneers.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06]">
            {SPEAKERS.map((s, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="group bg-black p-8 sm:p-10 hover:bg-white/[0.03] transition-colors duration-500 cursor-default">
                  <span className="text-6xl sm:text-7xl font-extralight text-white/10 group-hover:text-cyan-500/20 transition-colors duration-500 leading-none block mb-6">
                    {s.name.charAt(0)}
                  </span>
                  <h3 className="text-lg font-normal text-white group-hover:translate-x-1 transition-transform duration-500">{s.name}</h3>
                  <p className="text-sm text-cyan-500/80 mt-1">{s.title}</p>
                  <p className="text-sm text-zinc-600 mt-0.5">{s.org}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCHEDULE ── */}
      <section id="schedule" className="bg-[#fafafa] text-zinc-900">
        <div className="max-w-[1200px] mx-auto px-6 py-28 sm:py-40">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-400 mb-6">Programme</p>
          </Reveal>
          <div className="flex items-end justify-between mb-16 flex-wrap gap-4">
            <Reveal delay={100}>
              <h2 className="text-3xl sm:text-5xl font-extralight tracking-tighter">
                Two days.<br />Boundless learning.
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <div className="flex gap-1 bg-zinc-200/60 rounded-full p-1">
                <button
                  onClick={() => setDay(1)}
                  className={`px-5 py-2 rounded-full text-sm transition-all duration-300 ${day === 1 ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                >
                  Day 1 — Jun 19
                </button>
                <button
                  onClick={() => setDay(2)}
                  className={`px-5 py-2 rounded-full text-sm transition-all duration-300 ${day === 2 ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                >
                  Day 2 — Jun 20
                </button>
              </div>
            </Reveal>
          </div>

          <div className="border-t border-zinc-200">
            {(day === 1 ? DAY1 : DAY2).map((s, i) => (
              <Reveal key={`${day}-${i}`} delay={i * 60}>
                <div className="flex items-baseline gap-6 py-5 border-b border-zinc-200/80 group">
                  <span className="text-sm font-mono text-zinc-400 w-14 shrink-0 tabular-nums">{s.time}</span>
                  <span className="text-[15px] sm:text-base text-zinc-800 group-hover:text-zinc-950 transition-colors flex-1">{s.title}</span>
                  {s.tag && (
                    <span className={`text-[10px] uppercase tracking-[0.15em] font-medium shrink-0 ${
                      s.tag === "live" ? "text-cyan-600" :
                      s.tag === "keynote" ? "text-zinc-500" :
                      "text-amber-600"
                    }`}>
                      {s.tag}
                    </span>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── REGISTER CTA ── */}
      <section id="register" className="bg-black">
        <div className="max-w-[1200px] mx-auto px-6 py-28 sm:py-40 text-center">
          <Reveal>
            <h2 className="text-4xl sm:text-6xl lg:text-7xl font-extralight tracking-tighter leading-[0.95]">
              Secure your seat.
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="mt-6 text-lg text-zinc-500 font-light">
              Early Bird ₹5,000&ensp;·&ensp;Regular ₹7,500&ensp;·&ensp;On-Spot ₹10,000
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-12">
              <a
                href={REGISTER_URL}
                className="inline-flex items-center justify-center h-14 px-12 rounded-full bg-white text-black text-[15px] font-medium hover:bg-white/90 active:scale-[0.97] transition-all duration-200"
              >
                Register Now
              </a>
            </div>
          </Reveal>
          <Reveal delay={400}>
            <p className="mt-6 text-sm text-zinc-600">Limited to 500 delegates</p>
          </Reveal>
        </div>
      </section>

      {/* ── VENUE ── */}
      <section className="bg-[#fafafa] text-zinc-900">
        <div className="max-w-[1200px] mx-auto px-6 py-28 sm:py-40">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.35em] text-zinc-400 mb-6">Venue</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl sm:text-5xl font-extralight tracking-tighter">
              ITC Grand Chola
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="text-lg text-zinc-500 font-light mt-2">Chennai, Tamil Nadu</p>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-sm text-zinc-400 mt-4 max-w-md">
              63, Anna Salai, Guindy, Chennai 600032<br />
              15 minutes from Chennai International Airport
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-12 rounded-2xl overflow-hidden h-72 sm:h-96 bg-zinc-200">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.3!2d80.22!3d13.01!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a5267f05de9c5e5%3A0xa9e89ec3e8e3e3e3!2sITC%20Grand%20Chola!5e0!3m2!1sen!2sin!4v1"
                width="100%"
                height="100%"
                style={{ border: 0, filter: "grayscale(1) contrast(1.1)" }}
                allowFullScreen
                loading="lazy"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-black border-t border-white/5">
        <div className="max-w-[1200px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-zinc-600">
          <span>GEM TechnoSurg 2026</span>
          <span>&copy; {new Date().getFullYear()} GEM Hospital. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
