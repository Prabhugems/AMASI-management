import type { Metadata } from "next"
import { Calendar, MapPin } from "lucide-react"
import type { Day, Row } from "./parser"
import {
  parseScreen1,
  parseScreen2,
  parseScreen3,
  parseGynaec,
  splitDayForPlenary,
} from "./parser"
import { DayProgram, type DayLayout, type Band, type Column } from "./day-program"

export const revalidate = 60

const PAGE_URL = "https://technosurg.gemhospitals.com/technosurg/program"
const PAGE_TITLE =
  "TechnoSurg 2026 Surgery Conference Program — Live Surgeries, Lectures & Gynaec Track"
const PAGE_DESCRIPTION =
  "Full scientific program for TechnoSurg 2026: 4 parallel screens with live broadcasts of GI, Onco, Robotic and Gynaec surgeries, plus plenary lectures and breakouts. Schedule updates live from the organising committee."

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: PAGE_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    type: "website",
    url: PAGE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
}

const SHEET_ID = "1nAO9LsFyXKI787ohOK9-yAaj9-Cll9nrkJquhqbsfeQ"
const SURGERY_GID = "954562000"
const GYNAEC_GID = "1740008344"

const surgeryUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SURGERY_GID}`
const gynaecUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GYNAEC_GID}`

const ACCENTS = {
  s1: "bg-amber-600",
  s2: "bg-emerald-700",
  s3: "bg-sky-700",
  s4: "bg-rose-600",
  s12: "bg-violet-700", // S1+S2 combined (Day 2 morning)
  s34: "bg-pink-700", // S3+S4 combined (Day 2 morning)
}

async function fetchCsv(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 60 }, redirect: "follow" })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function findDay(days: Day[], label: string): Day | undefined {
  return days.find((d) => d.label === label)
}

function nonEmpty(rows: Row[]): Row[] {
  return rows.filter((r) => {
    if (r.kind === "note") return r.text.trim().length > 0
    return true
  })
}

export default async function TechnosurgProgramPage() {
  const [surgeryCsv, gynaecCsv] = await Promise.all([fetchCsv(surgeryUrl), fetchCsv(gynaecUrl)])

  const lecturesDays = surgeryCsv ? parseScreen1(surgeryCsv) : []
  const gynaecDays = gynaecCsv ? parseGynaec(gynaecCsv) : []

  const s2Days = surgeryCsv ? parseScreen2(surgeryCsv) : []
  const s3Days = surgeryCsv ? parseScreen3(surgeryCsv) : []

  const lec1 = findDay(lecturesDays, "Day 1")
  const lec2 = findDay(lecturesDays, "Day 2")
  const gyn1 = findDay(gynaecDays, "Day 1")
  const gyn2 = findDay(gynaecDays, "Day 2")
  const lec1S = lec1 ? splitDayForPlenary(lec1) : null
  const lec2S = lec2 ? splitDayForPlenary(lec2) : null
  const gyn2S = gyn2 ? splitDayForPlenary(gyn2) : null

  const days: DayLayout[] = []

  // ───────── Day 1 ─────────
  if (lec1S) {
    const day1Bands: Band[] = []
    if (lec1S.morning.length) {
      day1Bands.push({
        type: "plenary",
        timeRange: "9 AM – 11 AM",
        scope: "All 4 screens",
        rows: nonEmpty(lec1S.morning),
      })
    }
    if (lec1S.parallel.length || s2Days.length || s3Days.length || gyn1) {
      const day1Parallel: Column[] = [
        {
          screen: 1,
          label: "Screen 1",
          subtitle: "Live GI / General",
          accent: ACCENTS.s1,
          rows: findDay(s3Days, "Day 1")?.rows ?? [],
        },
        {
          screen: 2,
          label: "Screen 2",
          subtitle: "Live GI / Onco",
          accent: ACCENTS.s2,
          rows: findDay(s2Days, "Day 1")?.rows ?? [],
        },
        {
          screen: 3,
          label: "Screen 3",
          subtitle: "Talks / Breakout / Lectures",
          accent: ACCENTS.s3,
          rows: lec1S.parallel,
        },
        {
          screen: 4,
          label: "Screen 4",
          subtitle: "Live Gynaec Surgery",
          accent: ACCENTS.s4,
          rows: gyn1?.rows ?? [],
        },
      ]
      day1Bands.push({ type: "parallel", timeRange: "11 AM – 3 PM", columns: day1Parallel })
    }
    if (lec1S.evening.length) {
      day1Bands.push({
        type: "plenary",
        timeRange: "3 PM – 6 PM",
        scope: "All 4 screens",
        rows: nonEmpty(lec1S.evening),
      })
    }
    if (day1Bands.length) days.push({ day: "Day 1", bands: day1Bands })
  }

  // ───────── Day 2 ─────────
  if (lec2S) {
    const day2Bands: Band[] = []

    // Day 2 morning: split plenary GI/ICG (S1+S2) | Gynaec (S3+S4)
    const gynMorning = gyn2S?.morning ?? []
    if (lec2S.morning.length || gynMorning.length) {
      day2Bands.push({
        type: "split-plenary",
        timeRange: "9 AM – 11 AM",
        halves: [
          {
            scope: "Screens 1 & 2 · GI / ICG talks",
            rows: nonEmpty(lec2S.morning),
            accent: ACCENTS.s12,
          },
          {
            scope: "Screens 3 & 4 · Gynaec talks",
            rows: nonEmpty(gynMorning),
            accent: ACCENTS.s34,
          },
        ],
      })
    }

    // Day 2 parallel: 4 columns
    const day2ParallelCols: Column[] = [
      {
        screen: 1,
        label: "Screen 1",
        subtitle: "Robotic flagship · then Live GI / General",
        accent: ACCENTS.s1,
        rows: lec2S.parallel,
      },
      {
        screen: 2,
        label: "Screen 2",
        subtitle: "Live GI / Onco",
        accent: ACCENTS.s2,
        rows: (findDay(s2Days, "Day 2")?.rows ?? []).length
          ? findDay(s2Days, "Day 2")!.rows
          : [
              {
                kind: "block" as const,
                rangeOrNote: "11 AM – 3 PM",
                sessionTitle: "Live GI / Onco",
              },
            ],
      },
      {
        screen: 3,
        label: "Screen 3",
        subtitle: "Live Gynaec Surgery",
        accent: ACCENTS.s3,
        rows: [
          {
            kind: "block" as const,
            rangeOrNote: "11 AM – 3 PM",
            sessionTitle: "Live Gynaec Surgery",
          },
        ],
      },
      {
        screen: 4,
        label: "Screen 4",
        subtitle: "Gynaec Talks · then Gynaec Live",
        accent: ACCENTS.s4,
        rows: gyn2S?.parallel ?? [],
      },
    ]
    if (day2ParallelCols.some((c) => c.rows.length > 0)) {
      day2Bands.push({ type: "parallel", timeRange: "11 AM – 3 PM", columns: day2ParallelCols })
    }

    // Day 2 evening plenary
    if (lec2S.evening.length) {
      day2Bands.push({
        type: "plenary",
        timeRange: "3 PM – 5 PM",
        scope: "All 4 screens",
        rows: nonEmpty(lec2S.evening),
      })
    }
    if (day2Bands.length) days.push({ day: "Day 2", bands: day2Bands })
  }

  const fullFetchError = !surgeryCsv && !gynaecCsv
  const partialFetchError =
    !fullFetchError && (!surgeryCsv || !gynaecCsv)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 print:bg-white print:from-white print:via-white print:to-white">
      <div className="mx-auto max-w-6xl px-4 py-10 print:py-4">
        <header className="mb-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                TechnoSurg 2026 — Scientific Program
              </h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>4 parallel screens</span>
                <span className="text-muted-foreground/50">•</span>
                <span>Live from organising committee sheet</span>
              </div>
            </div>
          </div>
        </header>

        {fullFetchError && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Couldn’t load the program sheet. Please try again in a moment.
          </div>
        )}
        {partialFetchError && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Some of the program sheet couldn’t be loaded — the schedule below may be incomplete.
          </div>
        )}

        {days.map((d) => (
          <DayProgram key={d.day} day={d} />
        ))}

        <footer className="mt-12 text-center text-xs text-muted-foreground print:hidden">
          Schedule may change. Page refreshes from the live sheet automatically.
        </footer>
      </div>
    </div>
  )
}
