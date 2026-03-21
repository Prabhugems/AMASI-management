"use client"

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react"
import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from "framer-motion"

const REGISTER_URL = "/register/technosurg2026-mmvs3874"

/* ─────────────────────────────────────
   ANIMATED CANVAS PARTICLE BACKGROUND
   ───────────────────────────────────── */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouse = useRef({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Disable on mobile or when user prefers reduced motion
    if (window.innerWidth < 768 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsMobile(true)
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = (canvas.width = window.innerWidth)
    let h = (canvas.height = window.innerHeight)
    let animId: number

    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number; pulse: number }[] = []
    const count = window.innerWidth > 1024 ? 60 : 25

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        pulse: Math.random() * Math.PI * 2,
      })
    }

    const onResize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    let lastMouseUpdate = 0
    const onMouse = (e: MouseEvent) => {
      const now = performance.now()
      if (now - lastMouseUpdate < 50) return
      lastMouseUpdate = now
      mouse.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener("resize", onResize)
    window.addEventListener("mousemove", onMouse)

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.pulse += 0.02

        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0

        // Mouse repulsion
        const dx = p.x - mouse.current.x
        const dy = p.y - mouse.current.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 150) {
          const force = (150 - dist) / 150
          p.vx += (dx / dist) * force * 0.05
          p.vy += (dy / dist) * force * 0.05
        }

        // Damping
        p.vx *= 0.99
        p.vy *= 0.99

        const glow = Math.sin(p.pulse) * 0.3 + 0.7
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * glow, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(6, 182, 212, ${p.opacity * glow})`
        ctx.fill()
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 80) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(6, 182, 212, ${0.06 * (1 - dist / 80)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("mousemove", onMouse)
    }
  }, [])

  if (isMobile) return null
  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />
}

/* ─────────────────────────────────────
   LAZY-LOADED VIDEO (plays on viewport entry)
   ───────────────────────────────────── */
function LazyVideo({ src, className = "" }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (visible && ref.current) {
      ref.current.play().catch(() => {})
    }
  }, [visible])

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload={visible ? "auto" : "none"}
      className={className}
    >
      {visible && <source src={src} type="video/mp4" />}
    </video>
  )
}

/* ─────────────────────────────────────
   TEXT SCRAMBLE EFFECT
   ───────────────────────────────────── */
function ScrambleText({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  const [display, setDisplay] = useState("")
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&"

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTimeout(() => setStarted(true), delay); obs.disconnect() }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [delay])

  useEffect(() => {
    if (!started) return
    let frame = 0
    const totalFrames = text.length * 3
    const id = setInterval(() => {
      const progress = frame / totalFrames
      const resolved = Math.floor(progress * text.length)
      let result = ""
      for (let i = 0; i < text.length; i++) {
        if (text[i] === " ") {
          result += " "
        } else if (i < resolved) {
          result += text[i]
        } else {
          result += chars[Math.floor(Math.random() * chars.length)]
        }
      }
      setDisplay(result)
      frame++
      if (frame > totalFrames) {
        setDisplay(text)
        clearInterval(id)
      }
    }, 30)
    return () => clearInterval(id)
  }, [started, text])

  return <span ref={ref} className={className}>{display || "\u00A0"}</span>
}

/* ─────────────────────────────────────
   MAGNETIC BUTTON
   ───────────────────────────────────── */
function MagneticButton({ children, href, className = "" }: { children: ReactNode; href: string; className?: string }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 150, damping: 15 })
  const springY = useSpring(y, { stiffness: 150, damping: 15 })

  const handleMouse = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    x.set((e.clientX - cx) * 0.3)
    y.set((e.clientY - cy) * 0.3)
  }, [x, y])

  const handleLeave = useCallback(() => {
    x.set(0)
    y.set(0)
  }, [x, y])

  return (
    <motion.a
      ref={ref}
      href={href}
      className={className}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.a>
  )
}

/* ─────────────────────────────────────
   GLOWING BORDER CARD
   ───────────────────────────────────── */
function GlowCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [hovering, setHovering] = useState(false)

  const handleMouse = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [])

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      onMouseMove={handleMouse}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Glow effect following cursor */}
      <div
        className="absolute w-64 h-64 rounded-full transition-opacity duration-500 pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)",
          left: pos.x - 128,
          top: pos.y - 128,
          opacity: hovering ? 1 : 0,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

/* ─────────────────────────────────────
   REVEAL ON SCROLL
   ───────────────────────────────────── */
function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect() } }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${vis ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

/* ─────────────────────────────────────
   ANIMATED COUNTER
   ───────────────────────────────────── */
function Counter({ value, suffix = "", go }: { value: number; suffix?: string; go: boolean }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!go) return
    let start: number
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / 2000, 1)
      const eased = 1 - Math.pow(1 - p, 4) // easeOutQuart
      setN(Math.floor(eased * value))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value, go])
  return <>{n}{suffix}</>
}

/* ─────────────────────────────────────
   COUNTDOWN
   ───────────────────────────────────── */
function Countdown() {
  const [t, setT] = useState({ d: 0, h: 0, m: 0, s: 0 })
  useEffect(() => {
    const target = new Date("2026-06-19T09:00:00+05:30").getTime()
    const tick = () => {
      const diff = Math.max(0, target - Date.now())
      setT({
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
    <div className="flex gap-6 tabular-nums">
      {(["d", "h", "m", "s"] as const).map((k) => (
        <div key={k}>
          <motion.span
            key={t[k]}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="block text-2xl sm:text-3xl font-light text-white/90"
          >
            {String(t[k]).padStart(2, "0")}
          </motion.span>
          <span className="text-[9px] uppercase tracking-[0.3em] text-white/20 block mt-1">
            {k === "d" ? "days" : k === "h" ? "hrs" : k === "m" ? "min" : "sec"}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────
   ANTIGRAVITY FLOATING ELEMENTS
   ───────────────────────────────────── */
function FloatingElements() {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    // Disable on mobile and when user prefers reduced motion
    if (window.innerWidth >= 768 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEnabled(true)
    }
  }, [])

  const shapes = [
    { size: 60, x: "10%", delay: 0, duration: 18, type: "ring" },
    { size: 40, x: "25%", delay: 2, duration: 22, type: "cross" },
    { size: 80, x: "45%", delay: 5, duration: 25, type: "circle" },
    { size: 35, x: "65%", delay: 1, duration: 20, type: "diamond" },
    { size: 50, x: "80%", delay: 3, duration: 23, type: "ring" },
    { size: 28, x: "90%", delay: 7, duration: 19, type: "dot" },
    { size: 45, x: "15%", delay: 4, duration: 21, type: "diamond" },
    { size: 55, x: "55%", delay: 6, duration: 24, type: "cross" },
  ]

  if (!enabled) return null

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {shapes.map((s, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: s.x, bottom: "-10%" }}
          animate={{
            y: [0, -(typeof window !== "undefined" ? window.innerHeight + 200 : 1200)],
            rotate: [0, s.type === "diamond" ? 360 : s.type === "cross" ? 180 : 0],
            opacity: [0, 0.12, 0.12, 0],
          }}
          transition={{
            duration: s.duration,
            repeat: Infinity,
            delay: s.delay,
            ease: "linear",
          }}
        >
          {s.type === "ring" && (
            <div style={{ width: s.size, height: s.size }} className="rounded-full border border-cyan-500/20" />
          )}
          {s.type === "circle" && (
            <div style={{ width: s.size, height: s.size }} className="rounded-full bg-cyan-500/5 backdrop-blur-sm" />
          )}
          {s.type === "cross" && (
            <svg width={s.size} height={s.size} viewBox="0 0 40 40" fill="none" stroke="rgba(6,182,212,0.15)" strokeWidth="1">
              <line x1="20" y1="0" x2="20" y2="40" />
              <line x1="0" y1="20" x2="40" y2="20" />
            </svg>
          )}
          {s.type === "diamond" && (
            <div style={{ width: s.size * 0.7, height: s.size * 0.7 }} className="border border-cyan-500/15 rotate-45" />
          )}
          {s.type === "dot" && (
            <div style={{ width: s.size * 0.4, height: s.size * 0.4 }} className="rounded-full bg-cyan-400/20" />
          )}
        </motion.div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────
   FLOATING STAT ORBS (antigravity feel)
   ───────────────────────────────────── */
function FloatingOrb({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      animate={{
        y: [-8, 8, -8],
        rotate: [-1, 1, -1],
      }}
      transition={{
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    >
      {children}
    </motion.div>
  )
}

/* ─────────────────────────────────────
   HORIZONTAL SCROLL MARQUEE
   ───────────────────────────────────── */
function Marquee({ items }: { items: string[] }) {
  const getItemStyle = (item: string) => {
    if (item === "Fluorescence Imaging" || item === "ICG Navigation") return "text-green-400/40 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]"
    if (item === "AI Surgery") return "text-cyan-400/30"
    if (item === "da Vinci") return "text-white/25"
    return "text-white/20"
  }
  return (
    <div className="overflow-hidden whitespace-nowrap py-6 border-y border-white/5">
      <motion.div
        className="inline-flex gap-12"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
        {[...items, ...items].map((item, i) => (
          <span key={i} className={`text-sm uppercase tracking-[0.3em] ${getItemStyle(item)}`}>
            {item}
            <span className="mx-6 text-cyan-500/30">&middot;</span>
          </span>
        ))}
      </motion.div>
    </div>
  )
}

/* ─────────────────────────────────────
   DATA
   ───────────────────────────────────── */
const SPEAKERS = [
  { name: "Dr. C. Palanivelu", title: "Conference Chairman", org: "GEM Hospital" },
  { name: "To Be Announced", title: "Organizing Secretary", org: "GEM Hospital" },
  { name: "To Be Announced", title: "International Faculty", org: "Robotic Surgery" },
  { name: "To Be Announced", title: "International Faculty", org: "AI in Surgery" },
  { name: "To Be Announced", title: "National Faculty", org: "Fluorescence Surgery" },
  { name: "To Be Announced", title: "National Faculty", org: "Bariatric Surgery" },
]

const DAY1 = [
  { time: "09:00", title: "Inaugural Ceremony" },
  { time: "09:30", title: "Principles of ICG Fluorescence Imaging in Surgery", tag: "keynote" },
  { time: "10:00", title: "Evolution & Applications of Fluorescence-Guided Surgery" },
  { time: "10:30", title: "ICG in Colorectal Surgery — Preventing Anastomotic Leaks" },
  { time: "11:00", title: "ICG in Upper GI Surgery" },
  { time: "11:30", title: "ICG in Liver Transplant & Segmental Liver Resections" },
  { time: "12:00", title: "ICG-Guided Laparoscopic Cholecystectomy — Biliary Mapping & Safety" },
  { time: "12:30", title: "ICG in Complex Ventral Hernias / AWR" },
  { time: "14:00", title: "ICG-Guided Lymphatic Mapping in Malignancies / SLNB" },
  { time: "14:30", title: "ICG in Bariatric Surgery" },
  { time: "15:00", title: "AI in Endoscopy", tag: "keynote" },
  { time: "15:30", title: "Debate: ICG — Mandatory vs Marketing Hype", tag: "debate" },
  { time: "16:30", title: "Robotic Surgery — SSI, HUGO, da Vinci, MERIL/MISSO" },
  { time: "17:00", title: "Debate: Robotic Surgery — Value vs Vanity", tag: "debate" },
  { time: "17:30", title: "Panel: The Operating Room in 2035 — What Will Change" },
  { time: "18:00", title: "Telesurgery — India's Next Leap" },
  { time: "19:00", title: "Conference Dinner" },
]

const DAY2 = [
  { time: "09:00", title: "Keynote: AI in Surgery", tag: "keynote" },
  { time: "09:30", title: "AI in Preoperative Imaging — Detection & Triage" },
  { time: "10:00", title: "AI in Surgical Planning — Radiomics & Prediction" },
  { time: "10:30", title: "AI in Postoperative ICU — Decision Support" },
  { time: "11:00", title: "AI in Ward Recovery — Remote Monitoring" },
  { time: "11:30", title: "AI in Diagnostics — Lab & Pathology" },
  { time: "12:00", title: "Autonomous Surgery — Reality or Risk?", tag: "keynote" },
  { time: "14:00", title: "AR / VR in Surgery & Surgical Training", tag: "workshop" },
  { time: "14:30", title: "HoloSuit — Immersive Surgical Simulation" },
  { time: "15:00", title: "AI-Powered Radiology & Teleradiology" },
  { time: "16:00", title: "Valedictory Ceremony" },
]

/* ─────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────── */
export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] })
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.15])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = ["About", "Faculty", "Schedule", "Register"] as const

  return (
    <div className="bg-[#050a14] text-white antialiased selection:bg-cyan-500/30 overflow-x-hidden">

      {/* ── NAV ── */}
      <motion.nav
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-700 ${scrolled ? "bg-[#050a14]/80 backdrop-blur-2xl backdrop-saturate-150" : ""}`}
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-sm font-medium tracking-tight text-white/80">GEM TechnoSurg</span>
          <div className="hidden md:flex items-center gap-8 text-[13px] text-white/40">
            {navLinks.map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} className="hover:text-white transition-colors duration-300 relative group">
                {l}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-cyan-400 group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </div>
          {/* Mobile hamburger button */}
          <button
            className="md:hidden relative z-50 w-8 h-8 flex flex-col items-center justify-center gap-1.5"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            <motion.span
              className="block w-5 h-px bg-white/80 origin-center"
              animate={mobileMenuOpen ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.3 }}
            />
            <motion.span
              className="block w-5 h-px bg-white/80 origin-center"
              animate={mobileMenuOpen ? { opacity: 0 } : { opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
            <motion.span
              className="block w-5 h-px bg-white/80 origin-center"
              animate={mobileMenuOpen ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.3 }}
            />
          </button>
          <MagneticButton
            href={REGISTER_URL}
            className="hidden md:inline-flex text-[13px] text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
          >
            Register &rarr;
          </MagneticButton>
        </div>
      </motion.nav>

      {/* ── MOBILE MENU ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-40 md:hidden bg-[#050a14]/95 backdrop-blur-2xl flex flex-col items-center justify-center gap-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {navLinks.map((l, i) => (
              <motion.a
                key={l}
                href={`#${l.toLowerCase()}`}
                className="text-2xl font-light text-white/70 hover:text-white transition-colors duration-300"
                onClick={() => setMobileMenuOpen(false)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
              >
                {l}
              </motion.a>
            ))}
            <motion.a
              href={REGISTER_URL}
              className="mt-4 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors border border-cyan-400/30 rounded-full px-6 py-2"
              onClick={() => setMobileMenuOpen(false)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ delay: navLinks.length * 0.06, duration: 0.3 }}
            >
              Register &rarr;
            </motion.a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative min-h-[100dvh] flex items-end overflow-hidden">
        {/* Video background */}
        <motion.div className="absolute inset-0 z-[1]" style={{ scale: heroScale }}>
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            poster="/landing/hero-poster.jpg"
          >
            <source src="/landing/hero-video.mp4" type="video/mp4" />
          </video>
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050a14] via-[#050a14]/80 to-[#050a14]/40" />
          <div className="absolute inset-0 bg-[#050a14]/30" />
        </motion.div>

        {/* Particle overlay */}
        <div className="absolute inset-0 z-[2]">
          <ParticleField />
        </div>

        {/* Hero content */}
        <motion.div className="relative z-10 w-full" style={{ opacity: heroOpacity }}>
          <div className="max-w-[1200px] mx-auto px-6 pb-20 sm:pb-28">

            <motion.p
              className="text-[11px] uppercase tracking-[0.4em] text-cyan-400/80 mb-8"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.3 }}
            >
              June 19–20, 2026 &middot; ITC Grand Chola, Chennai
            </motion.p>

            <div className="mb-8">
              <h1 className="text-4xl sm:text-6xl lg:text-[6.5rem] font-light leading-[0.9] tracking-tighter">
                <motion.span
                  className="block text-white drop-shadow-[0_2px_30px_rgba(255,255,255,0.3)]"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  AI. Robotics.
                </motion.span>
                <motion.span
                  className="block text-cyan-400 drop-shadow-[0_0_40px_rgba(6,182,212,0.5)]"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                  Fluorescence
                </motion.span>
                <motion.span
                  className="block text-white drop-shadow-[0_2px_30px_rgba(255,255,255,0.3)]"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 1.1, ease: [0.16, 1, 0.3, 1] }}
                >
                  in Surgery.
                </motion.span>
              </h1>
            </div>

            <motion.div
              className="flex flex-col sm:flex-row sm:items-center gap-8 mt-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.5 }}
            >
              <MagneticButton
                href={REGISTER_URL}
                className="group relative inline-flex items-center justify-center h-14 px-10 rounded-full bg-white text-[#050a14] text-[15px] font-medium overflow-hidden"
              >
                <span className="relative z-10">Register Now</span>
                <motion.div
                  className="absolute inset-0 bg-cyan-400"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "0%" }}
                  transition={{ duration: 0.4 }}
                />
              </MagneticButton>
              <Countdown />
            </motion.div>

          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-5 h-8 rounded-full border border-white/20 flex justify-center pt-1.5">
            <div className="w-0.5 h-2 rounded-full bg-white/40" />
          </div>
        </motion.div>
      </section>

      {/* ── MARQUEE ── */}
      <Marquee items={["AI Surgery", "Robotic Systems", "Fluorescence Imaging", "Live Procedures", "Hands-On Training", "Innovation", "da Vinci", "ICG Navigation"]} />

      {/* ── ABOUT ── */}
      <section id="about" className="relative text-white overflow-hidden">
        {/* About background video */}
        <div className="absolute inset-0 z-0">
          <LazyVideo src="/landing/about-video.mp4" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="relative z-10 max-w-[1200px] mx-auto px-6 py-28 sm:py-40">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-400 mb-6">About the Conference</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-light tracking-tighter leading-[1.05] max-w-3xl text-white">
              Where surgical technology meets{" "}
              <span className="text-cyan-400">clinical excellence.</span>
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-8 text-lg font-light text-white/70 leading-relaxed max-w-[58ch]">
              India&apos;s most anticipated surgical technology summit bringing together 500+ surgeons,
              AI researchers, and medtech innovators for two transformative days of live robotic procedures,
              fluorescence-guided surgery, and hands-on workshops at the iconic ITC Grand Chola, Chennai.
            </p>
          </Reveal>

          <div ref={statsRef} className="mt-24 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {[
              { v: 500, s: "+", l: "Delegates" },
              { v: 50, s: "+", l: "Expert Faculty" },
              { v: 30, s: "+", l: "Live Surgeries" },
              { v: 2, s: "", l: "Intensive Days" },
            ].map((stat, i) => (
              <Reveal key={stat.l} delay={i * 100}>
                <FloatingOrb delay={i * 0.8}>
                  <div className="relative bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/10 text-center group hover:bg-white/15 hover:border-cyan-400/30 transition-all duration-700">
                    {/* Subtle glow */}
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-cyan-500/0 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                    <span className="relative text-5xl sm:text-6xl font-light text-white tabular-nums block">
                      <Counter value={stat.v} suffix={stat.s} go={statsGo} />
                    </span>
                    <span className="relative block text-xs uppercase tracking-[0.2em] text-white/40 mt-4">{stat.l}</span>
                  </div>
                </FloatingOrb>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SPEAKERS ── */}
      <section id="faculty" className="bg-[#050a14] relative overflow-hidden">
        {/* Faculty background video */}
        <div className="absolute inset-0 z-0">
          <LazyVideo src="/landing/Section-video.mp4" className="w-full h-full object-cover opacity-[0.08]" />
        </div>
        <div className="relative z-10 max-w-[1200px] mx-auto px-6 py-28 sm:py-40">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-500/60 mb-6">Faculty</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-4xl sm:text-5xl font-light tracking-tighter mb-20 text-white drop-shadow-[0_2px_30px_rgba(255,255,255,0.3)]">
              Learn from the pioneers.
            </h2>
          </Reveal>

          <div className="space-y-0">
            {SPEAKERS.map((s, i) => (
              <Reveal key={i} delay={i * 80}>
                <motion.div
                  className="group flex items-center gap-6 sm:gap-10 py-8 border-b border-white/[0.06] cursor-default"
                  whileHover={{ x: 12 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  <span className="text-3xl sm:text-4xl font-light text-white/[0.06] group-hover:text-cyan-500/20 transition-colors duration-700 w-16 sm:w-20 shrink-0 leading-none">
                    {s.name.split(" ").pop()?.charAt(0)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-light text-white/90 group-hover:text-white transition-colors">{s.name}</h3>
                    <p className="text-sm text-white/30 mt-0.5">{s.org}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/50 group-hover:text-cyan-400 transition-colors shrink-0 hidden sm:block">
                    {s.title}
                  </span>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCHEDULE ── */}
      <section id="schedule" className="bg-[#fafafa] text-zinc-900">
        <div className="max-w-[1200px] mx-auto px-6 py-28 sm:py-40">
          <div className="flex items-end justify-between mb-16 flex-wrap gap-6">
            <div>
              <Reveal>
                <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-600 mb-6">Programme</p>
              </Reveal>
              <Reveal delay={100}>
                <h2 className="text-4xl sm:text-5xl font-light tracking-tighter">
                  Two days. Boundless learning.
                </h2>
              </Reveal>
            </div>
            <Reveal delay={200}>
              <div className="flex gap-1 bg-zinc-200/60 rounded-full p-1">
                {[1, 2].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDay(d as 1 | 2)}
                    className={`relative px-5 py-2 rounded-full text-sm transition-all duration-300 ${day === d ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"}`}
                  >
                    {day === d && (
                      <motion.div
                        layoutId="dayTab"
                        className="absolute inset-0 bg-white rounded-full shadow-sm"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">Day {d} — Jun {d === 1 ? "19" : "20"}</span>
                  </button>
                ))}
              </div>
            </Reveal>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={day}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="border-t border-zinc-200"
            >
              {(day === 1 ? DAY1 : DAY2).map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="flex items-center gap-4 sm:gap-6 py-5 border-b border-zinc-200/80 group"
                >
                  <span className="text-sm font-mono text-zinc-300 w-16 shrink-0 tabular-nums">{s.time}</span>
                  {s.tag && (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      s.tag === "live" ? "bg-cyan-500" : s.tag === "keynote" ? "bg-zinc-400" : s.tag === "debate" ? "bg-rose-500" : "bg-amber-500"
                    }`} />
                  )}
                  <span className="text-[15px] text-zinc-700 group-hover:text-zinc-950 transition-colors flex-1">{s.title}</span>
                  {s.tag && (
                    <span className={`text-[10px] uppercase tracking-[0.15em] font-medium shrink-0 hidden sm:block ${
                      s.tag === "live" ? "text-cyan-600" : s.tag === "keynote" ? "text-zinc-400" : s.tag === "debate" ? "text-rose-600" : "text-amber-600"
                    }`}>
                      {s.tag}
                    </span>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── REGISTER CTA ── */}
      <section id="register" className="relative bg-[#050a14] overflow-hidden">
        {/* CTA background video */}
        <div className="absolute inset-0 z-0">
          <LazyVideo src="/landing/cta-video.mp4" className="w-full h-full object-cover opacity-[0.08]" />
          <div className="absolute inset-0 bg-[#050a14]/80" />
        </div>
        {/* Pulsing rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[1]">
          <motion.div
            className="absolute -inset-32 rounded-full border border-cyan-500/[0.06]"
            animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0, 0.1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -inset-56 rounded-full border border-cyan-500/[0.04]"
            animate={{ scale: [1, 1.2, 1], opacity: [0.08, 0, 0.08] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          <motion.div
            className="absolute -inset-80 rounded-full border border-cyan-500/[0.03]"
            animate={{ scale: [1, 1.15, 1], opacity: [0.05, 0, 0.05] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
        </div>
        {/* Subtle radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/[0.04] blur-[100px] pointer-events-none" />

        <div className="relative max-w-[1200px] mx-auto px-6 py-32 sm:py-44 text-center">
          <Reveal>
            <h2 className="text-4xl sm:text-6xl lg:text-7xl font-light tracking-tighter leading-[0.95] text-white drop-shadow-[0_2px_30px_rgba(255,255,255,0.3)]">
              Secure your seat.
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="mt-8 text-base sm:text-lg text-white/60 font-light">
              Delegate ₹7,000 &ensp;&middot;&ensp; PG ₹5,000 &ensp;&middot;&ensp; (incl. GST)
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-14">
              <MagneticButton
                href={REGISTER_URL}
                className="group relative inline-flex items-center justify-center h-16 px-14 rounded-full border border-white/20 text-white text-[15px] font-medium overflow-hidden hover:border-cyan-500/40 transition-colors duration-500"
              >
                <span className="relative z-10 group-hover:text-[#050a14] transition-colors duration-500">Register Now</span>
                <motion.div
                  className="absolute inset-0 bg-white rounded-full"
                  initial={{ scale: 0 }}
                  whileHover={{ scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </MagneticButton>
            </div>
          </Reveal>
          <Reveal delay={400}>
            <p className="mt-8 text-sm text-white/40">Limited to 500 delegates</p>
          </Reveal>
        </div>
      </section>

      {/* ── VENUE ── */}
      <section className="relative bg-[#050a14] text-white overflow-hidden">
        {/* Venue background video */}
        <div className="absolute inset-0 z-0">
          <LazyVideo src="/landing/venue-video.mp4" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="relative z-10 max-w-[1200px] mx-auto px-6 py-28 sm:py-40">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-400/60 mb-6">Venue</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-4xl sm:text-5xl font-light tracking-tighter text-white">
              ITC Grand Chola
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="text-lg text-white/50 font-light mt-2">Chennai, Tamil Nadu</p>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-sm text-white/30 mt-4 max-w-md leading-relaxed">
              63, Anna Salai, Guindy, Chennai 600032<br />
              15 minutes from Chennai International Airport
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#050a14] border-t border-white/[0.04]">
        <div className="max-w-[1200px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-white/20">
          <span>GEM TechnoSurg 2026</span>
          <span>&copy; {new Date().getFullYear()} GEM Hospital &amp; Research Centre</span>
        </div>
      </footer>
    </div>
  )
}
