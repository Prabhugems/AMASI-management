import type { Row } from "./parser"
import { RenderRow } from "./row-renderer"
import { Tv } from "lucide-react"

export type Column = {
  screen: number
  label: string
  subtitle: string
  accent: string
  rows: Row[]
}

export type Band =
  | { type: "plenary"; timeRange: string; scope: string; rows: Row[] }
  | { type: "split-plenary"; timeRange: string; halves: { scope: string; rows: Row[]; accent: string }[] }
  | { type: "parallel"; timeRange: string; columns: Column[] }

export type DayLayout = {
  day: string
  bands: Band[]
}

export function DayProgram({ day }: { day: DayLayout }) {
  return (
    <section className="mb-14 print:mb-6 print:break-inside-avoid">
      <div className="mb-6 flex items-baseline gap-3">
        <h2 className="text-3xl font-bold tracking-tight">{day.day}</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-6">
        {day.bands.map((band, i) => (
          <BandView key={i} band={band} />
        ))}
      </div>
    </section>
  )
}

function BandHeader({ type, timeRange, scope }: { type: string; timeRange: string; scope: string }) {
  return (
    <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-3 text-white dark:from-slate-800 dark:to-slate-700">
      <Tv className="h-3.5 w-3.5 text-white/70" />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
        {type}
      </span>
      <span className="text-base font-bold tracking-tight">{timeRange}</span>
      <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/90">
        {scope}
      </span>
    </header>
  )
}

function BandView({ band }: { band: Band }) {
  if (band.type === "plenary") {
    return (
      <article className="overflow-hidden rounded-3xl border bg-card shadow-[0_1px_0_rgba(0,0,0,0.02),0_8px_24px_-12px_rgba(0,0,0,0.08)] print:rounded-none print:border-slate-300 print:shadow-none print:break-inside-avoid">
        <BandHeader type="Plenary session" timeRange={band.timeRange} scope={band.scope} />
        <ul className="divide-y divide-border/60">
          {band.rows.map((row, i) => (
            <li key={i}>
              <RenderRow row={row} accent="bg-slate-700" />
            </li>
          ))}
        </ul>
      </article>
    )
  }

  if (band.type === "split-plenary") {
    return (
      <article className="overflow-hidden rounded-3xl border bg-card shadow-[0_1px_0_rgba(0,0,0,0.02),0_8px_24px_-12px_rgba(0,0,0,0.08)] print:rounded-none print:border-slate-300 print:shadow-none print:break-inside-avoid">
        <BandHeader type="Split plenary" timeRange={band.timeRange} scope="2 parallel plenaries" />
        <div className="grid grid-cols-1 md:auto-rows-fr md:grid-cols-2">
          {band.halves.map((half, i) => (
            <div
              key={i}
              className={`flex min-w-0 flex-col ${i > 0 ? "border-t md:border-l md:border-t-0" : ""}`}
            >
              <div
                className={`flex h-12 items-center px-5 text-[11px] font-bold uppercase tracking-widest text-white ${half.accent}`}
              >
                <span className="line-clamp-1">{half.scope}</span>
              </div>
              <ul className="flex-1 divide-y divide-border/60">
                {half.rows.map((row, j) => (
                  <li key={j}>
                    <RenderRow row={row} accent={half.accent} compact />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </article>
    )
  }

  // parallel
  return (
    <article className="overflow-hidden rounded-3xl border bg-card shadow-[0_1px_0_rgba(0,0,0,0.02),0_8px_24px_-12px_rgba(0,0,0,0.08)] print:rounded-none print:border-slate-300 print:shadow-none print:break-inside-avoid">
      <BandHeader type="Parallel sessions" timeRange={band.timeRange} scope="4 screens" />
      <div className="grid grid-cols-1 md:auto-rows-fr md:grid-cols-2 xl:grid-cols-4 print:grid-cols-4 print:auto-rows-auto">
        {band.columns.map((col, idx) => (
          <div
            key={col.screen}
            className={`flex min-w-0 flex-col ${idx > 0 ? "border-t md:border-t md:border-l xl:border-t-0" : ""} ${idx > 1 ? "xl:border-l" : ""}`}
          >
            <div className={`flex h-16 flex-col justify-center gap-0.5 px-4 text-white ${col.accent}`}>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
                {col.label}
              </span>
              <span className="text-[13px] font-bold leading-tight line-clamp-2">
                {col.subtitle}
              </span>
            </div>
            {col.rows.length === 0 ? (
              <div className="flex-1 px-5 py-6 text-center text-xs text-muted-foreground">
                No detailed schedule
              </div>
            ) : (
              <ul className="flex-1 divide-y divide-border/60">
                {col.rows.map((row, j) => (
                  <li key={j}>
                    <RenderRow row={row} accent={col.accent} compact />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </article>
  )
}
