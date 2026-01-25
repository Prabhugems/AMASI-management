"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Plane,
  RefreshCw,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getFlightStatus,
  formatFlightTime,
  getStatusText,
  type FlightStatusDisplay,
} from "@/lib/flight-status"

interface FlightStatusBoardProps {
  flightNumbers: string[] // List of flight numbers to track
  title?: string
  autoRefresh?: boolean
  refreshInterval?: number // in milliseconds
}

export function FlightStatusBoard({
  flightNumbers,
  title = "Flight Status Board",
  autoRefresh = true,
  refreshInterval = 300000, // 5 minutes
}: FlightStatusBoardProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [manualFlightNumber, setManualFlightNumber] = useState("")

  // Fetch flight statuses
  const {
    data: flightStatuses,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["flight-statuses", flightNumbers],
    queryFn: async () => {
      const statuses: FlightStatusDisplay[] = []

      for (const flightNum of flightNumbers) {
        if (flightNum) {
          const status = await getFlightStatus(flightNum)
          if (status) {
            statuses.push(status)
          }
        }
      }

      return statuses
    },
    enabled: flightNumbers.length > 0,
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 60000, // 1 minute
  })

  // Search for a specific flight
  const {
    data: searchedFlight,
    isLoading: isSearching,
    refetch: searchFlight,
  } = useQuery({
    queryKey: ["flight-search", manualFlightNumber],
    queryFn: async () => {
      if (!manualFlightNumber) return null
      return getFlightStatus(manualFlightNumber)
    },
    enabled: false, // Only fetch when manually triggered
  })

  const handleSearch = () => {
    if (manualFlightNumber) {
      searchFlight()
    }
  }

  // Filter flights based on search
  const filteredFlights = flightStatuses?.filter(
    (flight) =>
      flight.flightNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      flight.airline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      flight.originCity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      flight.destinationCity.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusIcon = (status: FlightStatusDisplay["status"]) => {
    switch (status) {
      case "on-time":
        return <CheckCircle className="h-4 w-4" />
      case "delayed":
        return <Clock className="h-4 w-4" />
      case "cancelled":
        return <XCircle className="h-4 w-4" />
      case "boarding":
        return <Plane className="h-4 w-4 animate-pulse" />
      case "departed":
        return <Plane className="h-4 w-4" />
      case "landed":
        return <CheckCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const getStatusBadgeStyle = (status: FlightStatusDisplay["status"]) => {
    switch (status) {
      case "on-time":
        return "bg-green-500 text-white"
      case "delayed":
        return "bg-amber-500 text-white"
      case "cancelled":
        return "bg-red-500 text-white"
      case "boarding":
        return "bg-cyan-500 text-white animate-pulse"
      case "departed":
        return "bg-purple-500 text-white"
      case "landed":
        return "bg-blue-500 text-white"
      default:
        return "bg-gray-500 text-white"
    }
  }

  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden">
      {/* Header - Airport Board Style */}
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Plane className="h-5 w-5 text-amber-400" />
          <h3 className="text-white font-bold text-lg tracking-wide">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Search within tracked flights */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 w-40 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 text-sm"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-slate-300 hover:text-white hover:bg-slate-700"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Manual Flight Search */}
      <div className="bg-slate-800/50 px-4 py-2 border-t border-slate-700 flex items-center gap-2">
        <Input
          placeholder="Enter flight number (e.g., 6E2341)"
          value={manualFlightNumber}
          onChange={(e) => setManualFlightNumber(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="h-8 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 text-sm flex-1 max-w-xs"
        />
        <Button
          size="sm"
          onClick={handleSearch}
          disabled={isSearching || !manualFlightNumber}
          className="bg-amber-500 hover:bg-amber-600 text-black"
        >
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Track"}
        </Button>
      </div>

      {/* Searched Flight Result */}
      {searchedFlight && (
        <div className="px-4 py-3 bg-amber-500/10 border-b border-slate-700">
          <FlightRow flight={searchedFlight} getStatusIcon={getStatusIcon} getStatusBadgeStyle={getStatusBadgeStyle} />
        </div>
      )}

      {/* Flight List Header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider bg-slate-800/30 border-b border-slate-700">
        <div className="col-span-2">Flight</div>
        <div className="col-span-2">Route</div>
        <div className="col-span-2">Departure</div>
        <div className="col-span-2">Arrival</div>
        <div className="col-span-2">Terminal/Gate</div>
        <div className="col-span-2 text-right">Status</div>
      </div>

      {/* Flight List */}
      <div className="divide-y divide-slate-700/50">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          </div>
        ) : filteredFlights && filteredFlights.length > 0 ? (
          filteredFlights.map((flight, index) => (
            <FlightRow
              key={`${flight.flightNumber}-${index}`}
              flight={flight}
              getStatusIcon={getStatusIcon}
              getStatusBadgeStyle={getStatusBadgeStyle}
            />
          ))
        ) : (
          <div className="text-center py-12 text-slate-400">
            <Plane className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No flights to display</p>
            <p className="text-sm mt-1">Add flight numbers to track or search for a flight</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-slate-800/50 px-4 py-2 text-xs text-slate-500 flex items-center justify-between">
        <span>
          {autoRefresh && `Auto-refresh every ${refreshInterval / 60000} min`}
        </span>
        <span>
          Last updated: {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  )
}

// Individual flight row component
function FlightRow({
  flight,
  getStatusIcon,
  getStatusBadgeStyle,
}: {
  flight: FlightStatusDisplay
  getStatusIcon: (status: FlightStatusDisplay["status"]) => React.ReactNode
  getStatusBadgeStyle: (status: FlightStatusDisplay["status"]) => string
}) {
  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-3 text-white items-center hover:bg-slate-800/50 transition-colors">
      {/* Flight Number & Airline */}
      <div className="col-span-2">
        <p className="font-mono font-bold text-amber-400">{flight.flightNumber}</p>
        <p className="text-xs text-slate-400">{flight.airline}</p>
      </div>

      {/* Route */}
      <div className="col-span-2 flex items-center gap-1">
        <span className="font-mono">{flight.origin}</span>
        <ArrowRight className="h-3 w-3 text-slate-500" />
        <span className="font-mono">{flight.destination}</span>
      </div>

      {/* Departure */}
      <div className="col-span-2">
        <p className="font-mono">
          {formatFlightTime(flight.scheduledDeparture)}
        </p>
        {flight.actualDeparture && flight.actualDeparture !== flight.scheduledDeparture && (
          <p className="text-xs text-amber-400">
            Actual: {formatFlightTime(flight.actualDeparture)}
          </p>
        )}
      </div>

      {/* Arrival */}
      <div className="col-span-2">
        <p className="font-mono">
          {formatFlightTime(flight.scheduledArrival)}
        </p>
        {flight.actualArrival && flight.actualArrival !== flight.scheduledArrival && (
          <p className="text-xs text-amber-400">
            Actual: {formatFlightTime(flight.actualArrival)}
          </p>
        )}
      </div>

      {/* Terminal & Gate */}
      <div className="col-span-2 text-sm">
        {flight.terminal && <span>T{flight.terminal}</span>}
        {flight.terminal && flight.gate && <span className="text-slate-500"> / </span>}
        {flight.gate && <span className="text-cyan-400">Gate {flight.gate}</span>}
        {!flight.terminal && !flight.gate && <span className="text-slate-500">--</span>}
      </div>

      {/* Status */}
      <div className="col-span-2 text-right">
        <Badge className={cn("gap-1", getStatusBadgeStyle(flight.status))}>
          {getStatusIcon(flight.status)}
          {getStatusText(flight.status)}
        </Badge>
        {flight.delayMinutes && flight.delayMinutes > 0 && (
          <p className="text-xs text-amber-400 mt-1">+{flight.delayMinutes} min</p>
        )}
      </div>
    </div>
  )
}

// Compact version for sidebar/cards
export function FlightStatusCompact({ flightNumber }: { flightNumber: string }) {
  const { data: flight, isLoading } = useQuery({
    queryKey: ["flight-status", flightNumber],
    queryFn: () => getFlightStatus(flightNumber),
    enabled: !!flightNumber,
    staleTime: 60000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading...
      </div>
    )
  }

  if (!flight) {
    return (
      <div className="text-sm text-muted-foreground">
        {flightNumber || "No flight"}
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    "on-time": "text-green-600",
    "delayed": "text-amber-600",
    "cancelled": "text-red-600",
    "boarding": "text-cyan-600",
    "departed": "text-purple-600",
    "landed": "text-blue-600",
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-mono font-medium">{flight.flightNumber}</span>
      <span className="text-muted-foreground">
        {flight.origin} → {flight.destination}
      </span>
      <Badge
        variant="outline"
        className={cn("text-xs", statusColors[flight.status])}
      >
        {getStatusText(flight.status)}
      </Badge>
    </div>
  )
}
