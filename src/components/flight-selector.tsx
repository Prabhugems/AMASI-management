"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plane, Clock, Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"

type Airport = {
  code: string
  city: string
  name?: string
}

type Flight = {
  flight_number: string
  airline: string
  airline_code: string
  departure: {
    airport: string
    city: string
    time: string
    terminal?: string
  }
  arrival: {
    airport: string
    city: string
    time: string
    terminal?: string
  }
  duration_mins: number
}

type FlightSelectorProps = {
  label: string
  color: "blue" | "purple"
  onSelect: (flight: {
    from: string
    to: string
    flightNumber: string
    departureTime: string
    arrivalTime: string
    airline: string
  }) => void
  initialFrom?: string
  initialTo?: string
  selectedFlight?: string
  disabled?: boolean
}

export function FlightSelector({
  label,
  color,
  onSelect,
  initialFrom,
  initialTo,
  selectedFlight,
  disabled = false,
}: FlightSelectorProps) {
  const [airports, setAirports] = useState<Airport[]>([])
  const [from, setFrom] = useState(initialFrom || "")
  const [to, setTo] = useState(initialTo || "")
  const [flights, setFlights] = useState<Flight[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(selectedFlight || "")

  // Fetch airports on mount
  useEffect(() => {
    fetch("/api/flights?action=airports")
      .then(res => res.json())
      .then(data => setAirports(data.airports || []))
      .catch(console.error)
  }, [])

  // Fetch flights when route changes
  useEffect(() => {
    if (from && to) {
      setLoading(true)
      fetch(`/api/flights?action=search&from=${from}&to=${to}`)
        .then(res => res.json())
        .then(data => {
          setFlights(data.flights || [])
          setLoading(false)
        })
        .catch(() => {
          setFlights([])
          setLoading(false)
        })
    } else {
      setFlights([])
    }
  }, [from, to])

  const handleSelectFlight = (flight: Flight) => {
    setSelected(flight.flight_number)
    onSelect({
      from: `${flight.departure.city} (${flight.departure.airport})`,
      to: `${flight.arrival.city} (${flight.arrival.airport})`,
      flightNumber: flight.flight_number,
      departureTime: flight.departure.time,
      arrivalTime: flight.arrival.time,
      airline: flight.airline,
    })
  }

  const colorClasses = {
    blue: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      text: "text-blue-400",
      selectedBg: "bg-blue-500/30",
      selectedBorder: "border-blue-500",
    },
    purple: {
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
      text: "text-purple-400",
      selectedBg: "bg-purple-500/30",
      selectedBorder: "border-purple-500",
    },
  }

  const colors = colorClasses[color]

  return (
    <div className={cn("p-4 rounded-lg border", colors.bg, colors.border)}>
      <h3 className={cn("font-semibold flex items-center gap-2 mb-4", colors.text)}>
        <Plane className="h-5 w-5" />
        {label}
      </h3>

      <div className="space-y-4">
        {/* Route Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-white/80 text-sm">From</Label>
            <Select value={from} onValueChange={setFrom} disabled={disabled}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                {airports.map(airport => (
                  <SelectItem key={airport.code} value={airport.code}>
                    {airport.city} ({airport.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-white/80 text-sm">To</Label>
            <Select value={to} onValueChange={setTo} disabled={disabled}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                {airports.filter(a => a.code !== from).map(airport => (
                  <SelectItem key={airport.code} value={airport.code}>
                    {airport.city} ({airport.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Flight List */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
          </div>
        )}

        {!loading && from && to && flights.length === 0 && (
          <div className="text-center py-6 text-white/50">
            <p>No flights found for this route</p>
            <p className="text-xs mt-1">Try selecting different cities</p>
          </div>
        )}

        {!loading && flights.length > 0 && (
          <div className="space-y-2">
            <Label className="text-white/80 text-sm">Select Flight</Label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {flights.map(flight => (
                <button
                  key={flight.flight_number}
                  onClick={() => handleSelectFlight(flight)}
                  disabled={disabled}
                  className={cn(
                    "w-full p-3 rounded-lg border text-left transition-all",
                    "hover:bg-white/10",
                    selected === flight.flight_number
                      ? cn(colors.selectedBg, colors.selectedBorder, "border-2")
                      : "bg-white/5 border-white/10",
                    disabled && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[60px]">
                        <p className="text-lg font-bold text-white">{flight.departure.time}</p>
                        <p className="text-xs text-white/50">{flight.departure.airport}</p>
                      </div>
                      <div className="flex items-center gap-1 text-white/30">
                        <div className="w-8 border-t border-dashed border-white/30" />
                        <Plane className="h-3 w-3" />
                        <div className="w-8 border-t border-dashed border-white/30" />
                      </div>
                      <div className="text-center min-w-[60px]">
                        <p className="text-lg font-bold text-white">{flight.arrival.time}</p>
                        <p className="text-xs text-white/50">{flight.arrival.airport}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-mono text-white">{flight.flight_number}</p>
                      <p className="text-xs text-white/50">{flight.airline}</p>
                    </div>

                    {selected === flight.flight_number && (
                      <Check className={cn("h-5 w-5 ml-2", colors.text)} />
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
                    <Clock className="h-3 w-3" />
                    <span>{Math.floor(flight.duration_mins / 60)}h {flight.duration_mins % 60}m</span>
                    {flight.departure.terminal && (
                      <span>• Terminal {flight.departure.terminal}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected Flight Summary */}
        {selected && (
          <div className={cn("p-3 rounded-lg border", colors.selectedBg, colors.selectedBorder)}>
            <p className="text-sm text-white/80">
              Selected: <span className="font-mono font-bold text-white">{selected}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
