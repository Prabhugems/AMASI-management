"use client"

import { useMemo } from "react"
import { ExternalLink, CheckCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  validateFlightNumber,
  getFlightSearchUrls,
  type FlightValidation,
} from "@/lib/flight-helpers"

type SmartFlightAssistProps = {
  fromCity: string
  toCity: string
  date: string
  flightNumber?: string
  className?: string
}

export function SmartFlightAssist({
  fromCity,
  toCity,
  date,
  flightNumber,
  className,
}: SmartFlightAssistProps) {
  // Get search URLs
  const searchUrls = useMemo(() => {
    if (!fromCity || !toCity || !date) return null
    return getFlightSearchUrls(fromCity, toCity, date)
  }, [fromCity, toCity, date])

  // Validate flight number
  const flightValidation: FlightValidation | null = useMemo(() => {
    if (!flightNumber) return null
    return validateFlightNumber(flightNumber)
  }, [flightNumber])

  // Don't render if no cities selected
  if (!fromCity || !toCity) return null

  const showValidation = flightNumber && flightValidation

  return (
    <div className={cn("space-y-2", className)}>
      {/* Flight number validation */}
      {showValidation && (
        <div className={cn(
          "flex items-center gap-2 text-xs",
          flightValidation.valid ? "text-green-400" : "text-red-400"
        )}>
          {flightValidation.valid ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          <span>{flightValidation.message}</span>
          {flightValidation.airline && (
            <span className="px-1.5 py-0.5 bg-white/10 rounded text-white/70">
              {flightValidation.airline}
            </span>
          )}
        </div>
      )}

      {/* Quick search links */}
      {searchUrls && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-white/40">Search flights:</span>
          <a
            href={searchUrls.google}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
          >
            Google
            <ExternalLink className="h-3 w-3" />
          </a>
          <span className="text-white/20">•</span>
          <a
            href={searchUrls.makemytrip}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
          >
            MakeMyTrip
            <ExternalLink className="h-3 w-3" />
          </a>
          <span className="text-white/20">•</span>
          <a
            href={searchUrls.ixigo}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
          >
            Ixigo
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  )
}
