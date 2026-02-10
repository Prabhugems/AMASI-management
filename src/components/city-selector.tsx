"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MapPin, ChevronDown, X, Plane, Search } from "lucide-react"
import { INDIAN_CITIES } from "@/lib/airline-api"

type CitySelectorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  showAirportCode?: boolean
  label?: string
}

export function CitySelector({
  value,
  onChange,
  placeholder = "Search city...",
  disabled = false,
  className,
  showAirportCode = true,
  label,
}: CitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Filter cities based on search
  const filteredCities = useMemo(() => {
    if (!search.trim()) {
      // Show popular cities first when no search
      const popularCodes = ["DEL", "BOM", "BLR", "MAA", "CCU", "HYD", "PAT", "CJB", "COK", "AMD", "PNQ", "JAI", "LKO", "GAU"]
      const popular = INDIAN_CITIES.filter(c => popularCodes.includes(c.airportCode || ""))
      const others = INDIAN_CITIES.filter(c => !popularCodes.includes(c.airportCode || ""))
      return [...popular, ...others].slice(0, 30)
    }

    const q = search.toLowerCase().trim()
    return INDIAN_CITIES.filter(c => {
      const cityMatch = c.city.toLowerCase().includes(q)
      const stateMatch = c.state.toLowerCase().includes(q)
      const codeMatch = c.airportCode?.toLowerCase().includes(q)
      return cityMatch || stateMatch || codeMatch
    }).slice(0, 20)
  }, [search])

  // Get display value
  const displayValue = useMemo(() => {
    if (!value) return ""
    // Check if value matches a city
    const city = INDIAN_CITIES.find(c =>
      c.city.toLowerCase() === value.toLowerCase() ||
      c.airportCode?.toLowerCase() === value.toLowerCase() ||
      value.toLowerCase().includes(c.city.toLowerCase())
    )
    if (city) {
      return showAirportCode && city.airportCode
        ? `${city.city} (${city.airportCode})`
        : city.city
    }
    return value
  }, [value, showAirportCode])

  const handleSelect = (city: typeof INDIAN_CITIES[0]) => {
    const newValue = showAirportCode && city.airportCode
      ? `${city.city} (${city.airportCode})`
      : city.city
    onChange(newValue)
    setIsOpen(false)
    setSearch("")
  }

  const handleClear = () => {
    onChange("")
    setSearch("")
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {label && (
        <label className="text-sm text-white/80 mb-1 block">{label}</label>
      )}

      <div className="relative">
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen)
              setTimeout(() => inputRef.current?.focus(), 10)
            }
          }}
          className={cn(
            "w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            !value && "text-white/50"
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4 shrink-0 text-white/50" />
            {displayValue || placeholder}
          </span>
          <div className="flex items-center gap-1">
            {value && !disabled && (
              <X
                className="h-4 w-4 text-white/50 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClear()
                }}
              />
            )}
            <ChevronDown className={cn(
              "h-4 w-4 text-white/50 transition-transform",
              isOpen && "rotate-180"
            )} />
          </div>
        </Button>

        {isOpen && !disabled && (
          <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-white/20 rounded-lg shadow-xl overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type city name or airport code..."
                  className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  autoFocus
                />
              </div>
            </div>

            {/* Cities list */}
            <div className="max-h-64 overflow-y-auto">
              {filteredCities.length === 0 ? (
                <div className="p-4 text-center text-white/50">
                  <p>No cities found</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </div>
              ) : (
                <div className="py-1">
                  {filteredCities.map((city, idx) => (
                    <button
                      key={`${city.city}-${city.state}-${idx}`}
                      type="button"
                      onClick={() => handleSelect(city)}
                      className={cn(
                        "w-full px-3 py-2 text-left hover:bg-white/10 transition-colors",
                        "flex items-center justify-between gap-2"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-white/40 shrink-0" />
                        <div>
                          <p className="text-white font-medium">{city.city}</p>
                          <p className="text-xs text-white/50">{city.state}</p>
                        </div>
                      </div>
                      {city.airportCode && (
                        <div className="flex items-center gap-1 text-xs bg-white/10 px-2 py-1 rounded">
                          <Plane className="h-3 w-3 text-white/60" />
                          <span className="font-mono text-white/80">{city.airportCode}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="p-2 border-t border-white/10 bg-white/5">
              <p className="text-xs text-white/40 text-center">
                {filteredCities.length} cities • Type to search more
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
