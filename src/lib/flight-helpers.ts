/**
 * Flight Helper Functions
 * - Check direct flight availability
 * - Suggest connecting cities
 * - Validate flight numbers
 * - Generate search URLs
 */

import { AIRPORT_INFO, getAirportCode } from "./airline-api"

// Common connecting hubs in India
const CONNECTING_HUBS = ["DEL", "BOM", "BLR", "CCU", "HYD", "MAA"]

// Routes that typically have direct flights
const DIRECT_ROUTES: Record<string, string[]> = {
  // From Delhi
  "DEL": ["BOM", "BLR", "MAA", "CCU", "HYD", "PAT", "GAU", "AMD", "JAI", "LKO", "VNS", "BBI", "IXR", "GOI", "PNQ", "COK", "TRV", "IXB", "SXR", "CJB", "IXE", "VTZ", "NAG", "IDR", "BHO", "RPR", "ATQ", "DED"],
  // From Mumbai
  "BOM": ["DEL", "BLR", "MAA", "CCU", "HYD", "PAT", "GOI", "AMD", "JAI", "PNQ", "COK", "TRV", "NAG", "IDR", "BHO", "LKO", "VNS", "GAU", "CJB", "IXE", "VTZ", "BBI"],
  // From Bangalore
  "BLR": ["DEL", "BOM", "MAA", "CCU", "HYD", "PAT", "GOI", "COK", "TRV", "IXE", "CJB", "GAU", "BBI", "VTZ", "PNQ"],
  // From Chennai
  "MAA": ["DEL", "BOM", "BLR", "CCU", "HYD", "PAT", "COK", "TRV", "CJB", "IXE", "VTZ", "BBI", "PNQ"],
  // From Kolkata
  "CCU": ["DEL", "BOM", "BLR", "MAA", "HYD", "PAT", "GAU", "BBI", "IXR", "IXB", "BHO", "RPR", "VNS"],
  // From Hyderabad
  "HYD": ["DEL", "BOM", "BLR", "MAA", "CCU", "PAT", "VTZ", "VGA", "TIR", "BBI", "NAG"],
  // From Patna
  "PAT": ["DEL", "BOM", "BLR", "MAA", "CCU", "HYD", "CJB"],
  // From Coimbatore
  "CJB": ["DEL", "BOM", "BLR", "MAA", "HYD", "CCU", "PAT"],
  // From Guwahati
  "GAU": ["DEL", "BOM", "CCU", "BLR", "IXB"],
}

// Build reverse routes
Object.entries(DIRECT_ROUTES).forEach(([from, destinations]) => {
  destinations.forEach(to => {
    if (!DIRECT_ROUTES[to]) DIRECT_ROUTES[to] = []
    if (!DIRECT_ROUTES[to].includes(from)) {
      DIRECT_ROUTES[to].push(from)
    }
  })
})

/**
 * Check if direct flight likely exists between two airports
 */
export function hasDirectFlight(fromCode: string, toCode: string): boolean {
  const from = fromCode.toUpperCase()
  const to = toCode.toUpperCase()

  if (from === to) return false

  return DIRECT_ROUTES[from]?.includes(to) || DIRECT_ROUTES[to]?.includes(from) || false
}

/**
 * Get airport code from city name or return as-is if already a code
 */
function extractAirportCode(cityOrCode: string): string | null {
  if (!cityOrCode) return null

  // Check if it's already a code
  const upperCity = cityOrCode.toUpperCase().trim()
  if (AIRPORT_INFO[upperCity]) return upperCity

  // Extract code from format "City (CODE)"
  const match = cityOrCode.match(/\(([A-Z]{3})\)/)
  if (match) return match[1]

  // Try to find city
  const code = getAirportCode(cityOrCode)
  return code || null
}

/**
 * Suggest connecting cities for a route without direct flights
 */
export function suggestConnectingCities(fromCity: string, toCity: string): string[] {
  const fromCode = extractAirportCode(fromCity)
  const toCode = extractAirportCode(toCity)

  if (!fromCode || !toCode) return []
  if (hasDirectFlight(fromCode, toCode)) return [] // Direct flight exists

  const suggestions: string[] = []

  // Find hubs that connect both cities
  for (const hub of CONNECTING_HUBS) {
    if (hub === fromCode || hub === toCode) continue

    const fromHasConnection = hasDirectFlight(fromCode, hub)
    const toHasConnection = hasDirectFlight(hub, toCode)

    if (fromHasConnection && toHasConnection) {
      const hubInfo = AIRPORT_INFO[hub]
      if (hubInfo) {
        suggestions.push(`${hubInfo.city} (${hub})`)
      }
    }
  }

  return suggestions
}

/**
 * Check if a route needs connecting flight
 */
export function needsConnectingFlight(fromCity: string, toCity: string): boolean {
  const fromCode = extractAirportCode(fromCity)
  const toCode = extractAirportCode(toCity)

  if (!fromCode || !toCode) return false
  return !hasDirectFlight(fromCode, toCode)
}

/**
 * Validate flight number format and check if it exists
 */
export type FlightValidation = {
  valid: boolean
  formatted: string | null
  airline: string | null
  message: string
}

export function validateFlightNumber(flightNumber: string): FlightValidation {
  if (!flightNumber || flightNumber.trim().length === 0) {
    return { valid: true, formatted: null, airline: null, message: "" }
  }

  const normalized = flightNumber.toUpperCase().trim()

  // Common Indian airline patterns
  const patterns = [
    { regex: /^(6E)[-\s]?(\d{1,4})$/, airline: "IndiGo" },
    { regex: /^(AI)[-\s]?(\d{1,4})$/, airline: "Air India" },
    { regex: /^(SG)[-\s]?(\d{1,4})$/, airline: "SpiceJet" },
    { regex: /^(UK)[-\s]?(\d{1,4})$/, airline: "Vistara" },
    { regex: /^(QP)[-\s]?(\d{1,4})$/, airline: "Akasa Air" },
    { regex: /^(I5)[-\s]?(\d{1,4})$/, airline: "AirAsia India" },
    { regex: /^(G8)[-\s]?(\d{1,4})$/, airline: "Go First" },
    { regex: /^(IX)[-\s]?(\d{1,4})$/, airline: "Air India Express" },
  ]

  for (const { regex, airline } of patterns) {
    const match = normalized.match(regex)
    if (match) {
      const formatted = `${match[1]}-${match[2]}`
      return {
        valid: true,
        formatted,
        airline,
        message: `✓ ${airline} flight`
      }
    }
  }

  // Check for international airlines
  const intlPattern = /^([A-Z]{2})[-\s]?(\d{1,4})$/
  const intlMatch = normalized.match(intlPattern)
  if (intlMatch) {
    return {
      valid: true,
      formatted: `${intlMatch[1]}-${intlMatch[2]}`,
      airline: null,
      message: "Flight number format valid"
    }
  }

  return {
    valid: false,
    formatted: null,
    airline: null,
    message: "Invalid format. Use: 6E-123, AI-456, etc."
  }
}

/**
 * Generate Google Flights search URL
 */
export function getGoogleFlightsUrl(
  fromCity: string,
  toCity: string,
  date: string
): string {
  const fromCode = extractAirportCode(fromCity) || ""
  const toCode = extractAirportCode(toCity) || ""

  // Format date as YYYY-MM-DD
  const formattedDate = date || new Date().toISOString().split('T')[0]

  // Google Flights URL format
  return `https://www.google.com/travel/flights?q=flights%20from%20${fromCode}%20to%20${toCode}%20on%20${formattedDate}`
}

/**
 * Generate MakeMyTrip search URL
 */
export function getMakeMyTripUrl(
  fromCity: string,
  toCity: string,
  date: string
): string {
  const fromCode = extractAirportCode(fromCity) || ""
  const toCode = extractAirportCode(toCity) || ""

  // Format date as DD/MM/YYYY for MakeMyTrip
  let formattedDate = ""
  if (date) {
    const d = new Date(date)
    formattedDate = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
  }

  return `https://www.makemytrip.com/flight/search?itinerary=${fromCode}-${toCode}-${formattedDate}&tripType=O&paxType=A-1_C-0_I-0&intl=false&cabinClass=E`
}

/**
 * Generate Ixigo search URL
 */
export function getIxigoUrl(
  fromCity: string,
  toCity: string,
  date: string
): string {
  const fromCode = extractAirportCode(fromCity) || ""
  const toCode = extractAirportCode(toCity) || ""

  // Format date as YYYYMMDD for Ixigo
  let formattedDate = ""
  if (date) {
    formattedDate = date.replace(/-/g, '')
  }

  return `https://www.ixigo.com/search/result/flight?from=${fromCode}&to=${toCode}&date=${formattedDate}&adults=1&children=0&infants=0&class=e&source=Search%20Form`
}

/**
 * Get all search URLs for a route
 */
export function getFlightSearchUrls(fromCity: string, toCity: string, date: string) {
  return {
    google: getGoogleFlightsUrl(fromCity, toCity, date),
    makemytrip: getMakeMyTripUrl(fromCity, toCity, date),
    ixigo: getIxigoUrl(fromCity, toCity, date),
  }
}

/**
 * Get route analysis for a journey
 */
export type RouteAnalysis = {
  hasDirect: boolean
  needsConnection: boolean
  suggestedVia: string[]
  searchUrls: {
    google: string
    makemytrip: string
    ixigo: string
  }
}

export function analyzeRoute(fromCity: string, toCity: string, date: string): RouteAnalysis {
  const fromCode = extractAirportCode(fromCity)
  const toCode = extractAirportCode(toCity)

  const hasDirect = fromCode && toCode ? hasDirectFlight(fromCode, toCode) : false
  const suggestedVia = suggestConnectingCities(fromCity, toCity)

  return {
    hasDirect,
    needsConnection: !hasDirect && suggestedVia.length > 0,
    suggestedVia,
    searchUrls: getFlightSearchUrls(fromCity, toCity, date),
  }
}
