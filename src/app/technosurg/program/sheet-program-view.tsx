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
  s12: "bg-violet-700",
  s34: "bg-pink-700",
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

export async function TechnosurgSheetProgramView() {
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
  // Split Screen 2 days into time buckets too — the sheet now carries one-off
  // Screen 2 talks in the evening (e.g. 5:45-6 PM MERIL Robotic Console).
  const s2D1 = findDay(s2Days, "Day 1")
  const s2D2 = findDay(s2Days, "Day 2")
  const s2D1S = s2D1 ? splitDayForPlenary(s2D1) : null
  const s2D2S = s2D2 ? splitDayForPlenary(s2D2) : null

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
          rows: lec1S.parallel,
        },
        {
          screen: 2,
          label: "Screen 2",
          subtitle: "Live GI / Onco",
          accent: ACCENTS.s2,
          rows: s2D1S?.parallel ?? findDay(s2Days, "Day 1")?.rows ?? [],
        },
        {
          screen: 3,
          label: "Screen 3",
          subtitle: "Talks / Breakout / Lectures",
          accent: ACCENTS.s3,
          rows: findDay(s3Days, "Day 1")?.rows ?? [],
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
    const day1Lec = nonEmpty(lec1S.evening)
    const day1Screen2 = nonEmpty(s2D1S?.evening ?? [])
    if (day1Lec.length || day1Screen2.length) {
      const to24 = (h: number, ampm: string) => {
        if (ampm === "pm" && h !== 12) return h + 12
        if (ampm === "am" && h === 12) return 0
        return h
      }
      const startMin = (row: Row): number | null => {
        const m = (s: string | undefined): number | null => {
          if (!s) return null
          // Try matching a time range first ("5:45 to 6 PM", "11-1 PM",
          // "9.00 AM to 9.15 AM") — extract the START time and infer its
          // AM/PM from the end if it's missing.
          const range = s.match(
            /(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:to|[-–])\s*(\d{1,2})(?:[:.]\d{2})?\s*(am|pm)/i,
          )
          if (range) {
            const sh = parseInt(range[1])
            const smn = range[2] ? parseInt(range[2]) : 0
            const sampmRaw = (range[3] || "").toLowerCase()
            const eh = parseInt(range[4])
            const eampm = range[5].toLowerCase()
            let startAmPm = sampmRaw
            if (!startAmPm) {
              const end24 = to24(eh, eampm)
              for (const cand of [eampm, eampm === "pm" ? "am" : "pm"]) {
                const start24 = to24(sh, cand)
                const diff = end24 - start24
                if (diff > 0 && diff <= 12) {
                  startAmPm = cand
                  break
                }
              }
            }
            if (!startAmPm) return null
            return to24(sh, startAmPm) * 60 + smn
          }
          // Single time
          const match =
            s.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)/i) ||
            s.match(/(\d{1,2})\s*(am|pm)/i)
          if (!match) return null
          const h = parseInt(match[1])
          const mn = match.length > 3 && match[2] && /\d/.test(match[2]) ? parseInt(match[2]) : 0
          const ampm = (match[match.length - 1] || "").toLowerCase()
          return to24(h, ampm) * 60 + mn
        }
        if (row.kind === "talk") return m(row.time)
        if (row.kind === "block") return m(row.blockTime) ?? m(row.rangeOrNote)
        if (row.kind === "section") return m(row.note) ?? m(row.title)
        return null
      }
      const withTime = (rows: Row[]): Array<{ row: Row; t: number }> => {
        const result: Array<{ row: Row; t: number }> = []
        let last = 0
        for (const row of rows) {
          const t = startMin(row)
          if (t !== null) last = t
          result.push({ row, t: last })
        }
        return result
      }
      const isScreen2 = (row: Row) => row.kind === "talk" && row.screen === 2
      // Forward-fill the lecture rows; tag Screen 2 rows so we can split them
      // into a side-by-side mini-band at 5:45 PM.
      const lecWithTime = withTime(day1Lec)
      const s2WithTime = withTime(day1Screen2)

      const SPLIT_START = 17 * 60 + 45 // 5:45 PM
      const SPLIT_END = 18 * 60 // 6:00 PM

      const preRows = lecWithTime.filter((e) => e.t < SPLIT_START).map((e) => e.row)
      const screen1AtSplit = lecWithTime
        .filter((e) => e.t >= SPLIT_START && e.t < SPLIT_END)
        .map((e) => e.row)
      const screen2AtSplit = s2WithTime
        .filter((e) => e.t >= SPLIT_START && e.t < SPLIT_END && isScreen2(e.row))
        .map((e) => e.row)
      // Any post-6 PM rows (lecture or Screen 2) — sort together.
      const postMerged = [
        ...lecWithTime.filter((e) => e.t >= SPLIT_END),
        ...s2WithTime.filter((e) => e.t >= SPLIT_END),
      ]
      postMerged.sort((a, b) => a.t - b.t)
      const postRows = postMerged.map((e) => e.row)

      const hasSplit = screen2AtSplit.length > 0
      if (preRows.length) {
        day1Bands.push({
          type: "plenary",
          timeRange: hasSplit ? "3 PM – 5:45 PM" : "3 PM – 6 PM",
          scope: "All 4 screens",
          rows: preRows,
        })
      }
      if (hasSplit) {
        day1Bands.push({
          type: "split-plenary",
          timeRange: "5:45 PM – 6:00 PM",
          halves: [
            { scope: "Screen 1", rows: screen1AtSplit, accent: ACCENTS.s1 },
            { scope: "Screen 2", rows: screen2AtSplit, accent: ACCENTS.s2 },
          ],
        })
      }
      if (postRows.length) {
        day1Bands.push({
          type: "plenary",
          timeRange: hasSplit ? "6 PM onwards" : "3 PM – 6 PM",
          scope: "All 4 screens",
          rows: postRows,
        })
      }
    }
    if (day1Bands.length) days.push({ day: "Day 1 · Friday, 19 June 2026", bands: day1Bands })
  }

  // ───────── Day 2 ─────────
  if (lec2S) {
    const day2Bands: Band[] = []

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

    const isGynaecLiveSurgery = (r: Row) =>
      r.kind === "block" && /live\s+surger/i.test(r.sessionTitle ?? "")
    const gyn2LiveRows = (gyn2S?.parallel ?? []).filter(isGynaecLiveSurgery)
    const gyn2TalkRows = (gyn2S?.parallel ?? []).filter((r) => !isGynaecLiveSurgery(r))

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
        rows: (s2D2S?.parallel ?? findDay(s2Days, "Day 2")?.rows ?? []).length
          ? (s2D2S?.parallel ?? findDay(s2Days, "Day 2")!.rows)
          : [
              {
                kind: "block" as const,
                blockTime: "11 AM – 3 PM",
                rangeOrNote: "",
                sessionTitle: "Live Surgery",
              },
            ],
      },
      {
        screen: 3,
        label: "Screen 3",
        subtitle: "Live Gynaec Surgery",
        accent: ACCENTS.s3,
        rows: gyn2LiveRows.length
          ? gyn2LiveRows
          : [
              {
                kind: "block" as const,
                blockTime: "11 AM – 3 PM",
                rangeOrNote: "",
                sessionTitle: "Live Surgery",
              },
            ],
      },
      {
        screen: 4,
        label: "Screen 4",
        subtitle: "Gynaec Talks · then Gynaec Live",
        accent: ACCENTS.s4,
        rows: gyn2TalkRows,
      },
    ]
    if (day2ParallelCols.some((c) => c.rows.length > 0)) {
      day2Bands.push({ type: "parallel", timeRange: "11 AM – 3 PM", columns: day2ParallelCols })
    }

    if (lec2S.evening.length) {
      day2Bands.push({
        type: "plenary",
        timeRange: "3 PM – 5 PM",
        scope: "All 4 screens",
        rows: nonEmpty(lec2S.evening),
      })
    }
    if (day2Bands.length) days.push({ day: "Day 2 · Saturday, 20 June 2026", bands: day2Bands })
  }

  const fullFetchError = !surgeryCsv && !gynaecCsv
  const partialFetchError = !fullFetchError && (!surgeryCsv || !gynaecCsv)

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
