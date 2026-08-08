"use client"

// The faculty cell of a Session Builder row.
//
// Type a name, pick from the directory, done — the assignment is written on
// selection. Built for the case the programme spreadsheet actually presents:
// the coordinator already knows who is speaking, so making them leave the page
// to attach a person is the single biggest source of friction in the old flow.
//
// A name that is NOT in the directory still saves. "RAJESH SRIVASTAVA" is not
// among the 1,960 faculty rows (there are eight other Srivastavas), and
// refusing the row until somebody creates a faculty record would stop the
// person typing in a programme. It stores as a name with no faculty_id —
// exactly how 43% of existing assignments already are — and is shown as
// unlinked so it can be reconciled later.

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Loader2, Link2Off, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface FacultyMatch {
  id: string
  name: string
  email: string | null
  meta: string | null
}

export interface PickedFaculty {
  faculty_id: string | null
  faculty_name: string
  faculty_email: string | null
}

export function FacultyPicker({
  value,
  placeholder = "Add faculty",
  linked,
  onPick,
  onClear,
  disabled,
}: {
  /** Current name shown in the cell, if someone is already assigned. */
  value: string | null
  placeholder?: string
  /** False when the assignment has no faculty_id — shown, not hidden. */
  linked?: boolean
  onPick: (picked: PickedFaculty) => void
  onClear?: () => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<FacultyMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  // Debounced so a fast typist does not fire a request per keystroke against a
  // 1,960-row table. All state changes happen inside the timer or the fetch
  // callback, never synchronously in the effect body.
  useEffect(() => {
    const q = query.trim()
    let cancelled = false

    const t = setTimeout(async () => {
      if (q.length < 2) {
        setResults([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await fetch(`/api/faculty/search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        if (!cancelled) {
          setResults((json.data ?? []) as FacultyMatch[])
          setHighlight(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 180)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  const commitFreeText = () => {
    const name = query.trim()
    if (!name) return
    onPick({ faculty_id: null, faculty_name: name, faculty_email: null })
    setQuery("")
    setOpen(false)
  }

  const commitMatch = (m: FacultyMatch) => {
    onPick({ faculty_id: m.id, faculty_name: m.name, faculty_email: m.email })
    setQuery("")
    setOpen(false)
  }

  // Someone is already assigned — show them, with a way to remove.
  if (value) {
    return (
      <div className="flex items-center gap-1.5">
        <span className={cn("truncate text-sm", !linked && "text-amber-700 dark:text-amber-500")}>
          {value}
        </span>
        {!linked && (
          <span title="Not linked to a faculty record — invitations can't be sent until it is">
            <Link2Off className="h-3 w-3 shrink-0 text-amber-600" />
          </span>
        )}
        {onClear && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${value}`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={boxRef} className="relative">
      <Input
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, results.length - 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
          } else if (e.key === "Enter") {
            e.preventDefault()
            // Enter takes the highlighted match, or the typed name if there is
            // none — so a name absent from the directory never blocks the row.
            if (results[highlight]) commitMatch(results[highlight])
            else commitFreeText()
          } else if (e.key === "Escape") {
            setOpen(false)
          }
        }}
        placeholder={placeholder}
        className="h-8 text-xs"
      />

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-9 z-30 max-h-60 overflow-auto rounded-md border bg-popover shadow-lg">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching…
            </div>
          )}

          {!loading &&
            results.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => commitMatch(m)}
                className={cn(
                  "block w-full px-3 py-2 text-left",
                  i === highlight && "bg-accent"
                )}
              >
                <div className="text-sm">{m.name}</div>
                {m.meta && <div className="text-xs text-muted-foreground">{m.meta}</div>}
              </button>
            ))}

          {!loading && (
            <button
              type="button"
              onClick={commitFreeText}
              className={cn(
                "block w-full border-t px-3 py-2 text-left text-xs",
                results.length === 0 && "border-t-0"
              )}
            >
              {results.length === 0 ? (
                <>
                  No match for &ldquo;{query.trim()}&rdquo; —{" "}
                  <span className="font-medium text-primary">use this name anyway</span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  None of these — use &ldquo;{query.trim()}&rdquo; as typed
                </span>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
