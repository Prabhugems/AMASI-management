// Flight Status API Integration
// Using AirLabs API (1000 free calls/month)
// Get your free API key at: https://airlabs.co/

// Use server-only env var to avoid exposing API key in client bundle
const AIRLABS_API_KEY = process.env.AIRLABS_API_KEY || process.env.NEXT_PUBLIC_AIRLABS_API_KEY || ""
const AIRLABS_BASE_URL = "https://airlabs.co/api/v9"

export type FlightStatus = {
  flight_iata: string        // e.g., "6E 2341"
  flight_number: string      // e.g., "2341"
  airline_iata: string       // e.g., "6E"
  airline_name: string       // e.g., "IndiGo"
  dep_iata: string           // Departure airport code
  dep_city: string           // Departure city
  dep_time: string           // Scheduled departure
  dep_actual: string | null  // Actual departure
  dep_terminal: string | null
  dep_gate: string | null
  arr_iata: string           // Arrival airport code
  arr_city: string           // Arrival city
  arr_time: string           // Scheduled arrival
  arr_actual: string | null  // Actual arrival
  arr_terminal: string | null
  arr_gate: string | null
  status: "scheduled" | "active" | "landed" | "cancelled" | "incident" | "diverted"
  delayed: number | null     // Delay in minutes
  duration: number           // Flight duration in minutes
}

export type FlightStatusDisplay = {
  flightNumber: string
  airline: string
  origin: string
  originCity: string
  destination: string
  destinationCity: string
  scheduledDeparture: string
  actualDeparture: string | null
  scheduledArrival: string
  actualArrival: string | null
  status: "on-time" | "delayed" | "boarding" | "departed" | "landed" | "cancelled"
  statusColor: string
  delayMinutes: number | null
  terminal: string | null
  gate: string | null
}

// Get flight status by flight number
export async function getFlightStatus(flightNumber: string, _date?: string): Promise<FlightStatusDisplay | null> {
  if (!AIRLABS_API_KEY) {
    console.warn("AirLabs API key not configured")
    return null
  }

  try {
    // Clean flight number (remove spaces)
    const cleanFlightNum = flightNumber.replace(/\s+/g, "").toUpperCase()

    const params = new URLSearchParams({
      api_key: AIRLABS_API_KEY,
      flight_iata: cleanFlightNum,
    })

    const response = await fetch(`${AIRLABS_BASE_URL}/flight?${params}`)

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    if (!data.response) {
      return null
    }

    const flight = data.response as FlightStatus
    return transformFlightStatus(flight)
  } catch (error) {
    console.error("Failed to fetch flight status:", error)
    return null
  }
}

// Get multiple flight statuses
export async function getMultipleFlightStatuses(flightNumbers: string[]): Promise<Map<string, FlightStatusDisplay>> {
  const results = new Map<string, FlightStatusDisplay>()

  // AirLabs free tier doesn't support batch, so we fetch one by one
  // with a small delay to avoid rate limiting
  for (const flightNum of flightNumbers) {
    const status = await getFlightStatus(flightNum)
    if (status) {
      results.set(flightNum, status)
    }
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  return results
}

// Get flights by route
export async function getFlightsByRoute(
  depIata: string,
  arrIata: string
): Promise<FlightStatusDisplay[]> {
  if (!AIRLABS_API_KEY) {
    console.warn("AirLabs API key not configured")
    return []
  }

  try {
    const params = new URLSearchParams({
      api_key: AIRLABS_API_KEY,
      dep_iata: depIata.toUpperCase(),
      arr_iata: arrIata.toUpperCase(),
    })

    const response = await fetch(`${AIRLABS_BASE_URL}/schedules?${params}`)

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    if (!data.response || !Array.isArray(data.response)) {
      return []
    }

    return data.response.map(transformFlightStatus).filter(Boolean) as FlightStatusDisplay[]
  } catch (error) {
    console.error("Failed to fetch flights by route:", error)
    return []
  }
}

// Transform API response to display format
function transformFlightStatus(flight: FlightStatus): FlightStatusDisplay {
  // Determine display status
  let status: FlightStatusDisplay["status"] = "on-time"
  let statusColor = "bg-green-500"

  if (flight.status === "cancelled") {
    status = "cancelled"
    statusColor = "bg-red-500"
  } else if (flight.status === "landed") {
    status = "landed"
    statusColor = "bg-blue-500"
  } else if (flight.status === "active") {
    status = "departed"
    statusColor = "bg-purple-500"
  } else if (flight.delayed && flight.delayed > 0) {
    status = "delayed"
    statusColor = "bg-amber-500"
  } else if (flight.dep_gate) {
    status = "boarding"
    statusColor = "bg-cyan-500"
  }

  return {
    flightNumber: flight.flight_iata || `${flight.airline_iata}${flight.flight_number}`,
    airline: flight.airline_name || flight.airline_iata,
    origin: flight.dep_iata,
    originCity: flight.dep_city || flight.dep_iata,
    destination: flight.arr_iata,
    destinationCity: flight.arr_city || flight.arr_iata,
    scheduledDeparture: flight.dep_time,
    actualDeparture: flight.dep_actual,
    scheduledArrival: flight.arr_time,
    actualArrival: flight.arr_actual,
    status,
    statusColor,
    delayMinutes: flight.delayed,
    terminal: flight.dep_terminal,
    gate: flight.dep_gate,
  }
}

// Format time for display
export function formatFlightTime(isoTime: string | null): string {
  if (!isoTime) return "--:--"
  try {
    const date = new Date(isoTime)
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    })
  } catch {
    return "--:--"
  }
}

// Get status badge text
export function getStatusText(status: FlightStatusDisplay["status"]): string {
  const statusMap = {
    "on-time": "On Time",
    "delayed": "Delayed",
    "boarding": "Boarding",
    "departed": "Departed",
    "landed": "Landed",
    "cancelled": "Cancelled",
  }
  return statusMap[status] || status
}

// Common Indian airports for dropdown
export const INDIAN_AIRPORTS = [
  { code: "DEL", name: "Delhi (Indira Gandhi)", city: "New Delhi" },
  { code: "BOM", name: "Mumbai (Chhatrapati Shivaji)", city: "Mumbai" },
  { code: "BLR", name: "Bangalore (Kempegowda)", city: "Bengaluru" },
  { code: "MAA", name: "Chennai", city: "Chennai" },
  { code: "CCU", name: "Kolkata (Netaji Subhas)", city: "Kolkata" },
  { code: "HYD", name: "Hyderabad (Rajiv Gandhi)", city: "Hyderabad" },
  { code: "COK", name: "Cochin", city: "Kochi" },
  { code: "AMD", name: "Ahmedabad (Sardar Vallabhbhai)", city: "Ahmedabad" },
  { code: "PNQ", name: "Pune", city: "Pune" },
  { code: "GOI", name: "Goa (Dabolim)", city: "Goa" },
  { code: "JAI", name: "Jaipur", city: "Jaipur" },
  { code: "LKO", name: "Lucknow (Chaudhary Charan Singh)", city: "Lucknow" },
  { code: "GAU", name: "Guwahati", city: "Guwahati" },
  { code: "IXC", name: "Chandigarh", city: "Chandigarh" },
  { code: "TRV", name: "Trivandrum", city: "Thiruvananthapuram" },
  { code: "VTZ", name: "Visakhapatnam", city: "Visakhapatnam" },
  { code: "PAT", name: "Patna", city: "Patna" },
  { code: "IXB", name: "Bagdogra", city: "Siliguri" },
  { code: "SXR", name: "Srinagar", city: "Srinagar" },
  { code: "VNS", name: "Varanasi", city: "Varanasi" },
]

// Common Indian airlines
export const INDIAN_AIRLINES = [
  { code: "6E", name: "IndiGo" },
  { code: "AI", name: "Air India" },
  { code: "UK", name: "Vistara" },
  { code: "SG", name: "SpiceJet" },
  { code: "G8", name: "Go First" },
  { code: "I5", name: "AirAsia India" },
  { code: "QP", name: "Akasa Air" },
  { code: "2T", name: "Alliance Air" },
]
