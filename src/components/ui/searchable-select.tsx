"use client"

import { useState, useMemo } from "react"
import { Search, ChevronDown, Check } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface SearchableSelectOption {
  label: string
  value: string
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

// A plain <Select> with 100+ options (e.g. a country list) makes people
// scroll through the whole thing to find one entry — this adds a search
// box on top, for select fields with enough options that scrolling stops
// being the fastest way to find one.
export function SearchableSelect({ options, value, onChange, placeholder = "Select an option", className, style }: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const selected = options.find((o) => o.value === value)
  const filtered = useMemo(() => {
    if (!search.trim()) return options
    const q = search.trim().toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, search])

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch("")
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-12 px-4 border rounded-lg text-base transition-all w-full flex items-center justify-between text-left bg-white",
            "focus:outline-none focus:ring-2 focus:ring-offset-0 border-gray-200 focus:border-emerald-500 focus:ring-emerald-100",
            className
          )}
          style={style}
        >
          <span className={selected ? "" : "text-gray-400"}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b border-gray-100">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-8 h-9"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">No matches</p>
          )}
          {filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
                setSearch("")
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between",
                option.value === value && "bg-gray-50 font-medium"
              )}
            >
              {option.label}
              {option.value === value && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
