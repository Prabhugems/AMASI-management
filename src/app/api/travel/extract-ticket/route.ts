import { NextRequest, NextResponse } from "next/server"
import { enhanceFlightData } from "@/lib/airline-api"
import { extractTextFromImage, isOCREnabled } from "@/lib/ocr"

// Parse PDF and extract text using pdf-parse v1
async function parsePDF(buffer: Buffer): Promise<{ text: string }> {
  // Use require to avoid pdf-parse test data loading issue
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse/lib/pdf-parse")
  const result = await pdfParse(buffer)
  return { text: result.text }
}

type Journey = {
  pnr: string | null
  airline: string | null
  flight_number: string | null
  departure_city: string | null
  departure_airport: string | null
  departure_date: string | null
  departure_time: string | null
  arrival_city: string | null
  arrival_airport: string | null
  arrival_time: string | null
  seat_number: string | null
  passenger_name: string | null
}

/**
 * Ticket Extraction using PDF parsing + Pattern Recognition
 *
 * Extracts flight/train details from ticket PDFs using:
 * 1. PDF text extraction (pdf-parse)
 * 2. Pattern matching for PNR, flight numbers, times, dates, etc.
 */

type ExtractedFlightDetails = {
  pnr: string | null
  airline: string | null
  flight_number: string | null
  departure_city: string | null
  departure_airport: string | null
  departure_date: string | null
  departure_time: string | null
  arrival_city: string | null
  arrival_airport: string | null
  arrival_date: string | null
  arrival_time: string | null
  passenger_name: string | null
  seat_number: string | null
  terminal: string | null
}

type ExtractedTrainDetails = {
  pnr: string | null
  train_number: string | null
  train_name: string | null
  departure_station: string | null
  departure_date: string | null
  departure_time: string | null
  arrival_station: string | null
  arrival_date: string | null
  arrival_time: string | null
  passenger_name: string | null
  coach: string | null
  seat_number: string | null
  class: string | null
  booking_status: string | null
}

// Indian airport codes mapping - comprehensive list matching city-selector options
const AIRPORT_CODES: Record<string, string> = {
  // Metro cities
  DEL: "Delhi", BOM: "Mumbai", BLR: "Bangalore", MAA: "Chennai",
  CCU: "Kolkata", HYD: "Hyderabad",
  // South India
  CJB: "Coimbatore", TRZ: "Tiruchirappalli", IXM: "Madurai",
  COK: "Kochi", TRV: "Trivandrum", CCJ: "Kozhikode",
  IXE: "Mangalore", MYQ: "Mysore", HBX: "Hubli",
  VTZ: "Visakhapatnam", VGA: "Vijayawada", TIR: "Tirupati", RJA: "Rajahmundry",
  // West India
  PNQ: "Pune", NAG: "Nagpur", AMD: "Ahmedabad", STV: "Surat",
  BDQ: "Vadodara", RAJ: "Rajkot", JGA: "Jamnagar", BHJ: "Bhuj",
  GOI: "Goa", GOX: "Mopa",
  KLH: "Kolhapur", NDC: "Nanded",
  // North India
  JAI: "Jaipur", UDR: "Udaipur", JDH: "Jodhpur", BKB: "Bikaner", KTU: "Kota",
  LKO: "Lucknow", VNS: "Varanasi", AGR: "Agra", KNU: "Kanpur", GOP: "Gorakhpur", AYJ: "Ayodhya",
  IDR: "Indore", BHO: "Bhopal", JLR: "Jabalpur", GWL: "Gwalior",
  PAT: "Patna", GAY: "Gaya", DBR: "Darbhanga",
  IXR: "Ranchi", IXW: "Jamshedpur", DEO: "Deoghar",
  BBI: "Bhubaneswar", JRG: "Jharsuguda",
  RPR: "Raipur",
  IXB: "Bagdogra",
  ATQ: "Amritsar", LUH: "Ludhiana", IXC: "Chandigarh",
  SXR: "Srinagar", IXJ: "Jammu", IXL: "Leh",
  DED: "Dehradun",
  // North East
  GAU: "Guwahati", DIB: "Dibrugarh", JRH: "Jorhat", IXS: "Silchar",
  IMF: "Imphal", DMU: "Dimapur", AJL: "Aizawl", IXA: "Agartala",
  // Islands
  IXZ: "Port Blair",
}

// Airline patterns
const AIRLINES: Record<string, RegExp> = {
  "IndiGo": /indigo|6e[-\s]?\d{3,4}/i,
  "Air India": /air\s*india|ai[-\s]?\d{3,4}/i,
  "SpiceJet": /spicejet|sg[-\s]?\d{3,4}/i,
  "Vistara": /vistara|uk[-\s]?\d{3,4}/i,
  "Go First": /go\s*first|g8[-\s]?\d{3,4}/i,
  "AirAsia": /airasia|i5[-\s]?\d{3,4}/i,
  "Akasa Air": /akasa|qp[-\s]?\d{3,4}/i,
}

// Extract ALL journeys from ticket text
async function extractAllJourneys(text: string): Promise<Journey[]> {
  const journeys: Journey[] = []
  // Normalize text: fix line endings, unicode spaces, and common PDF artifacts
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ") // non-breaking & unicode spaces
    .replace(/[–—]/g, "-") // normalize dashes
    .replace(/\s+/g, (m) => m.includes("\n") ? "\n" : " ") // collapse multiple spaces but keep newlines
  const upper = normalized.toUpperCase()

  // Find ALL PNRs with their positions - round-trip tickets have separate PNRs per segment
  const pnrPattern = /PNR[:\s]*([A-Z0-9]{6})|PNR([A-Z0-9]{6})/gi
  const pnrs: Array<{ pnr: string; index: number }> = []
  let pnrMatch
  while ((pnrMatch = pnrPattern.exec(upper)) !== null) {
    const pnr = pnrMatch[1] || pnrMatch[2]
    // Avoid duplicates
    if (!pnrs.some(p => p.pnr === pnr)) {
      pnrs.push({ pnr, index: pnrMatch.index })
    }
  }
  console.log("PNRs found:", pnrs)

  // Find passenger name
  const nameMatch = normalized.match(/(?:MR\.|MRS\.|MS\.|DR\.)\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})/i)
  const passengerName = nameMatch ? nameMatch[1].trim() : null

  // Find seat numbers - multiple patterns for different ticket formats
  // Exclude airline codes: 6E, G8, I5
  const airlineCodes = ["6E", "G8", "I5"]
  const validSeats: string[] = []

  // Pattern 1: Seat followed by "Included" (meal included) - e.g., "2D Included"
  const seatIncludedPattern = /(\d{1,2}[A-F])\s*Included/gi
  let seatMatch
  while ((seatMatch = seatIncludedPattern.exec(normalized)) !== null) {
    if (!airlineCodes.includes(seatMatch[1].toUpperCase())) {
      validSeats.push(seatMatch[1].toUpperCase())
    }
  }

  // Pattern 2: Seat after "Adult" - e.g., "Adult 2D" or "Adult2D"
  const seatAfterAdultPattern = /Adult\s*(\d{1,2}[A-F])/gi
  while ((seatMatch = seatAfterAdultPattern.exec(normalized)) !== null) {
    if (!airlineCodes.includes(seatMatch[1].toUpperCase()) && !validSeats.includes(seatMatch[1].toUpperCase())) {
      validSeats.push(seatMatch[1].toUpperCase())
    }
  }

  // Pattern 3: Seat before 6-char alphanumeric (e-ticket/PNR) - e.g., "2D B7W3TJ"
  const seatBeforePnrPattern = /(\d{1,2}[A-F])\s*[A-Z0-9]{6}/gi
  while ((seatMatch = seatBeforePnrPattern.exec(normalized)) !== null) {
    if (!airlineCodes.includes(seatMatch[1].toUpperCase()) && !validSeats.includes(seatMatch[1].toUpperCase())) {
      validSeats.push(seatMatch[1].toUpperCase())
    }
  }

  // Pattern 4: Standalone seats (fallback) - must not be airline codes or part of PNR
  if (validSeats.length === 0) {
    // Use a pattern that requires non-letter before the seat to avoid matching PNR suffixes like "IYYI6A" -> "6A"
    const generalSeatPattern = /(?:^|[^A-Za-z])(\d{1,2}[A-F])\b/gi
    let generalMatch
    while ((generalMatch = generalSeatPattern.exec(normalized)) !== null) {
      const seat = generalMatch[1].toUpperCase()
      if (!airlineCodes.includes(seat) && !validSeats.includes(seat)) {
        validSeats.push(seat)
      }
    }
  }

  // Filter out any seats that look like they're part of a PNR (6-char alphanumeric ending)
  const pnrLikePattern = /[A-Z]{4}\d[A-F]/gi
  const pnrLikeSuffixes: string[] = []
  let pnrLikeMatch
  while ((pnrLikeMatch = pnrLikePattern.exec(upper)) !== null) {
    // Extract the last 2 chars (like "6A" from "IYYI6A")
    const suffix = pnrLikeMatch[0].slice(-2)
    pnrLikeSuffixes.push(suffix)
  }
  const filteredSeats = validSeats.filter(s => !pnrLikeSuffixes.includes(s))

  console.log("Seats found:", filteredSeats)

  // Find all airport codes with times: "CCU 10:50 hrs" or "PAT\n12:00 hrs"
  // Dynamically build pattern from all known airport codes
  const allCodes = Object.keys(AIRPORT_CODES).join("|")
  const airportTimePattern = new RegExp(`\\b(${allCodes})\\s*\\n?\\s*(\\d{1,2}):(\\d{2})\\s*(hrs|am|pm)?`, "gi")
  const airportTimes: Array<{ airport: string; time: string; index: number }> = []
  let match
  while ((match = airportTimePattern.exec(normalized)) !== null) {
    let hours = parseInt(match[2])
    const minutes = match[3]
    const period = match[4]?.toLowerCase()
    if (period === "pm" && hours < 12) hours += 12
    if (period === "am" && hours === 12) hours = 0
    airportTimes.push({
      airport: match[1].toUpperCase(),
      time: `${hours.toString().padStart(2, "0")}:${minutes}`,
      index: match.index,
    })
  }

  // Find all route patterns like "City1 - City2" with dates
  // Supports multi-word cities (e.g. "New Delhi") and optional day names
  const routeRegex = /([A-Za-z][A-Za-z ]*?)\s*[-–]\s*([A-Za-z][A-Za-z ]*?)\s*\n?\s*(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*[,\s]*)?(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{4})?/gi
  const routes: Array<{ index: number; city1: string; city2: string; date: string; depAirport: string; arrAirport: string }> = []

  while ((match = routeRegex.exec(normalized)) !== null) {
    const day = match[3]
    const month = match[4]
    const year = match[5] || new Date().getFullYear().toString()
    const monthNum = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" }[month.toLowerCase().substring(0, 3)] || "01"

    let depAirport = ""
    let arrAirport = ""
    const city1Lower = match[1].toLowerCase()
    const city2Lower = match[2].toLowerCase()

    // Map city names to airport codes (with fuzzy matching for spelling variants)
    for (const [code, cityName] of Object.entries(AIRPORT_CODES)) {
      const cn = cityName.toLowerCase()
      if (cn === city1Lower || (city1Lower.length >= 5 && levenshtein(cn, city1Lower) <= 2)) depAirport = code
      if (cn === city2Lower || (city2Lower.length >= 5 && levenshtein(cn, city2Lower) <= 2)) arrAirport = code
    }

    routes.push({
      index: match.index,
      city1: match[1],
      city2: match[2],
      date: `${year}-${monthNum}-${day.padStart(2, "0")}`,
      depAirport,
      arrAirport,
    })
  }

  // Find all flight numbers
  // Handle case where flight number is concatenated with duration like "6E-3421h 10m"
  const flightRegex = /\b(6E|AI|SG|UK|G8|I5|QP)[-\s]?(\d{2,4})(\d)?([hH]\s*\d+[mM])?/gi
  const flights: Array<{ index: number; number: string }> = []
  while ((match = flightRegex.exec(upper)) !== null) {
    let flightNum = match[2]
    // If there's a duration suffix (like "1h 10m"), the last digit of match[2] might be part of duration
    // Check if match[3] exists and match[4] is the duration - if so, don't include match[3]
    if (match[3] && match[4]) {
      // The last digit is part of duration, use just match[2]
      // flightNum is already correct
    } else if (!match[4] && match[3]) {
      // No duration suffix but there's an extra digit - include it
      flightNum = match[2] + match[3]
    }
    flights.push({ index: match.index, number: `${match[1]}-${flightNum}` })
  }

  console.log("Airport times found:", airportTimes.map(at => `${at.airport} ${at.time} @${at.index}`))
  console.log("Routes found:", routes.map(r => `${r.city1}-${r.city2} @${r.index}`))

  // Build journeys from routes
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i]
    const nextRouteIndex = i < routes.length - 1 ? routes[i + 1].index : normalized.length

    // Find flight number for this segment
    const segmentFlight = flights.find(f => f.index > route.index && f.index < nextRouteIndex)

    // Find PNR for this segment - pick the PNR closest to but after this route
    let segmentPNR: string | null = null
    const segmentPnrs = pnrs.filter(p => p.index > route.index && p.index < nextRouteIndex)
    if (segmentPnrs.length > 0) {
      segmentPNR = segmentPnrs[0].pnr
    } else if (pnrs.length > i) {
      // Fallback: assign PNRs in order
      segmentPNR = pnrs[i].pnr
    } else if (pnrs.length > 0) {
      segmentPNR = pnrs[0].pnr
    }

    // Find times for this segment
    // Some PDFs have times BEFORE the route pattern, others have them AFTER
    // Look in both directions for the departure/arrival times

    // First try: Look AFTER the route pattern (standard format)
    const timesAfterRoute = airportTimes.filter(at => at.index > route.index && at.index < nextRouteIndex)

    // Second try: Look BEFORE the route pattern (some ticket formats)
    const prevRouteIndex = i > 0 ? routes[i - 1].index : 0
    const timesBeforeRoute = airportTimes.filter(at => at.index > prevRouteIndex && at.index < route.index)

    // Find departure time - check after first, then before
    let depTimeInfo = timesAfterRoute.find(at => at.airport === route.depAirport)
    if (!depTimeInfo) {
      depTimeInfo = timesBeforeRoute.find(at => at.airport === route.depAirport)
    }

    // Find arrival time - must be for arrival airport
    let arrTimeInfo = timesAfterRoute.find(at => at.airport === route.arrAirport)
    if (!arrTimeInfo) {
      arrTimeInfo = timesBeforeRoute.find(at => at.airport === route.arrAirport)
    }

    console.log(`Route ${route.city1}-${route.city2}: pnr=${segmentPNR}, dep=${depTimeInfo?.time}, arr=${arrTimeInfo?.time}`)

    journeys.push({
      pnr: segmentPNR,
      airline: segmentFlight ? getAirlineFromCode(segmentFlight.number.split("-")[0]) : null,
      flight_number: segmentFlight?.number || null,
      departure_city: AIRPORT_CODES[route.depAirport] || route.city1,
      departure_airport: route.depAirport,
      departure_date: route.date,
      departure_time: depTimeInfo?.time || null,
      arrival_city: AIRPORT_CODES[route.arrAirport] || route.city2,
      arrival_airport: route.arrAirport,
      arrival_time: arrTimeInfo?.time || null,
      seat_number: filteredSeats[i] || null,
      passenger_name: passengerName,
    })
  }

  // If no routes found by pattern, fall back to single extraction
  if (journeys.length === 0) {
    const single = extractFlightDetails(text)
    journeys.push({
      pnr: single.pnr,
      airline: single.airline,
      flight_number: single.flight_number,
      departure_city: single.departure_city,
      departure_airport: single.departure_airport,
      departure_date: single.departure_date,
      departure_time: single.departure_time,
      arrival_city: single.arrival_city,
      arrival_airport: single.arrival_airport,
      arrival_time: single.arrival_time,
      seat_number: single.seat_number,
      passenger_name: single.passenger_name,
    })
  }

  // Enhance each journey with airline API data
  for (const journey of journeys) {
    if (journey.flight_number) {
      try {
        const enhanced = await enhanceFlightData({
          flight_number: journey.flight_number,
          departure_airport: journey.departure_airport,
          arrival_airport: journey.arrival_airport,
          departure_time: journey.departure_time,
          arrival_time: journey.arrival_time,
        })

        if (enhanced.enhanced) {
          // Fill in missing data from API/database
          if (!journey.airline && enhanced.airline) journey.airline = enhanced.airline
          if (!journey.departure_city && enhanced.departure_city) journey.departure_city = enhanced.departure_city
          if (!journey.arrival_city && enhanced.arrival_city) journey.arrival_city = enhanced.arrival_city

          // ALWAYS use API times if available - PDF extraction is unreliable
          if (enhanced.departure_time) journey.departure_time = enhanced.departure_time
          if (enhanced.arrival_time) journey.arrival_time = enhanced.arrival_time

          console.log(`Enhanced journey ${journey.flight_number} with API data:`, {
            dep: journey.departure_time,
            arr: journey.arrival_time,
          })
        }
      } catch (error) {
        console.error(`Failed to enhance journey ${journey.flight_number}:`, error)
      }
    }

    // Validate times - if arrival is before departure on same day, something is wrong
    if (journey.departure_time && journey.arrival_time) {
      const depMins = parseInt(journey.departure_time.split(":")[0]) * 60 + parseInt(journey.departure_time.split(":")[1])
      const arrMins = parseInt(journey.arrival_time.split(":")[0]) * 60 + parseInt(journey.arrival_time.split(":")[1])
      if (arrMins < depMins) {
        console.warn(`Invalid times for ${journey.flight_number}: dep ${journey.departure_time}, arr ${journey.arrival_time}`)
        // Clear invalid times - let the form show empty rather than wrong data
        journey.departure_time = null
        journey.arrival_time = null
      }
    }
  }

  return journeys
}

// Get airline name from code
function getAirlineFromCode(code: string): string {
  const codeToAirline: Record<string, string> = {
    "6E": "IndiGo", "AI": "Air India", "SG": "SpiceJet",
    "UK": "Vistara", "G8": "Go First", "I5": "AirAsia", "QP": "Akasa Air",
  }
  return codeToAirline[code.toUpperCase()] || code
}

// Split round-trip ticket text into onward and return sections
function _splitRoundTripText(text: string): { onward: string; return_journey: string } {
  // Normalize text
  const normalized = text.replace(/\r\n/g, "\n")

  // Try to find explicit section markers
  const returnMarkers = [
    /\n\s*(RETURN|INBOUND|RETURN\s*FLIGHT|RETURN\s*JOURNEY|TRIP\s*2|FLIGHT\s*2)\s*\n/i,
    /\n([A-Za-z]+\s*[-–]\s*[A-Za-z]+)\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^]*$/i,  // Second city-pair section
  ]

  for (const marker of returnMarkers) {
    const match = normalized.search(marker)
    if (match > 100) {
      return {
        onward: normalized.substring(0, match),
        return_journey: normalized.substring(match),
      }
    }
  }

  // Split by multiple flight numbers - find positions of all flight codes
  const flightMatches: Array<{ index: number; match: string }> = []
  const flightRegex = /\b(6E|AI|SG|UK|G8|I5|QP)[-\s]?\d{3,4}/gi
  let match
  while ((match = flightRegex.exec(normalized)) !== null) {
    flightMatches.push({ index: match.index, match: match[0] })
  }

  // If we have 2 or more flights, split at the second flight
  if (flightMatches.length >= 2) {
    const secondFlightIndex = flightMatches[1].index
    // Find a good split point before the second flight (look for date/day pattern before it)
    const beforeSecond = normalized.substring(0, secondFlightIndex)
    const lastNewlineBeforeSecond = beforeSecond.lastIndexOf("\n")
    const splitPoint = lastNewlineBeforeSecond > 50 ? lastNewlineBeforeSecond : secondFlightIndex - 20

    return {
      onward: normalized.substring(0, Math.max(0, splitPoint)),
      return_journey: normalized.substring(splitPoint),
    }
  }

  // Fallback: split in half
  const midPoint = Math.floor(normalized.length / 2)
  return {
    onward: normalized.substring(0, midPoint),
    return_journey: normalized.substring(midPoint),
  }
}

// Extract flight details from text
function extractFlightDetails(text: string): ExtractedFlightDetails {
  const result: ExtractedFlightDetails = {
    pnr: null, airline: null, flight_number: null,
    departure_city: null, departure_airport: null, departure_date: null, departure_time: null,
    arrival_city: null, arrival_airport: null, arrival_date: null, arrival_time: null,
    passenger_name: null, seat_number: null, terminal: null,
  }

  // Normalize text
  const normalized = text.replace(/\s+/g, " ").trim()
  const upper = normalized.toUpperCase()

  // Extract PNR (6 alphanumeric characters)
  const pnrPatterns = [
    /PNR[:\s]*([A-Z0-9]{6})/i,           // PNR: ABC123 or PNR ABC123
    /PNR([A-Z0-9]{6})/i,                  // PNRABC123 (no separator)
    /BOOKING\s*(?:REF|REFERENCE|ID)?[:\s]*([A-Z0-9]{6})/i,
    /CONFIRMATION[:\s]*([A-Z0-9]{6})/i,
    /(?:^|\s)([A-Z0-9]{6})(?:\s|$)/,
  ]
  for (const pattern of pnrPatterns) {
    const match = upper.match(pattern)
    if (match && /[A-Z]/.test(match[1]) && /[0-9]/.test(match[1])) {
      result.pnr = match[1]
      break
    }
  }

  // Extract airline
  for (const [airline, pattern] of Object.entries(AIRLINES)) {
    if (pattern.test(normalized)) {
      result.airline = airline
      break
    }
  }

  // Extract flight number (e.g., 6E-1234, AI 505, UK-945)
  // Handle cases where flight number is concatenated with duration like "6E-63481h 10m"
  const flightPatterns = [
    // Standard format with separator: 6E-6348 or 6E 6348
    /\b(6E|AI|SG|UK|G8|I5|QP)[-\s](\d{3,4})\b/,
    // Concatenated with duration: 6E6348 followed by 1h or h
    /\b(6E|AI|SG|UK|G8|I5|QP)[-\s]?(\d{3,4})\d*[hH]\s*\d+[mM]/,
    // Just airline code followed by digits
    /\b(6E|AI|SG|UK|G8|I5|QP)[-\s]?(\d{3,4})/,
  ]

  for (const pattern of flightPatterns) {
    const match = upper.match(pattern)
    if (match) {
      result.flight_number = `${match[1]}-${match[2]}`
      // Set airline from flight code if not found
      if (!result.airline) {
        const codeToAirline: Record<string, string> = {
          "6E": "IndiGo", "AI": "Air India", "SG": "SpiceJet",
          "UK": "Vistara", "G8": "Go First", "I5": "AirAsia", "QP": "Akasa Air",
        }
        result.airline = codeToAirline[match[1]] || null
      }
      break
    }
  }

  // First, try to extract route from "City1 - City2" or "City1 to City2" patterns
  // These are more reliable than airport code order in multi-journey PDFs
  const _cityNames = Object.values(AIRPORT_CODES).map(c => c.toLowerCase())
  const routePatterns = [
    /BOOKING\s*DETAILS\s*\n?\s*([A-Za-z]+)\s*[-–]\s*([A-Za-z]+)/i,
    /([A-Za-z]+)\s*[-–]\s*([A-Za-z]+)\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i,
    /journey\s+on\s+([A-Za-z]+)\s*[-–]\s*([A-Za-z]+)/i,
  ]

  let routeFound = false
  for (const pattern of routePatterns) {
    const match = normalized.match(pattern)
    if (match) {
      const city1 = match[1].toLowerCase()
      const city2 = match[2].toLowerCase()

      // Find airport codes for these cities (with fuzzy matching)
      for (const [code, cityName] of Object.entries(AIRPORT_CODES)) {
        const cn = cityName.toLowerCase()
        if (cn === city1 || city1.includes(cn) || (city1.length >= 5 && levenshtein(cn, city1) <= 2)) {
          result.departure_airport = code
          result.departure_city = cityName
        }
        if (cn === city2 || city2.includes(cn) || (city2.length >= 5 && levenshtein(cn, city2) <= 2)) {
          result.arrival_airport = code
          result.arrival_city = cityName
        }
      }

      if (result.departure_city && result.arrival_city) {
        routeFound = true
        break
      }
    }
  }

  // Fallback: Extract airport codes if route pattern not found
  if (!routeFound) {
    const knownAirportCodes = Object.keys(AIRPORT_CODES)
    const airportPositions: Array<{code: string, index: number}> = []
    for (const code of knownAirportCodes) {
      // Match airport code at word boundary or followed by numbers (like CCU21:35)
      const pattern = new RegExp(`\\b${code}(?:\\b|\\d)`)
      const match = upper.match(pattern)
      if (match && match.index !== undefined) {
        airportPositions.push({ code, index: match.index })
      }
    }
    // Sort by position in text to get correct order (departure first, then arrival)
    airportPositions.sort((a, b) => a.index - b.index)
    const uniqueAirports = [...new Set(airportPositions.map(a => a.code))]

    if (uniqueAirports.length >= 2) {
      result.departure_airport = uniqueAirports[0]
      result.departure_city = AIRPORT_CODES[uniqueAirports[0]]
      result.arrival_airport = uniqueAirports[1]
      result.arrival_city = AIRPORT_CODES[uniqueAirports[1]]
    } else if (uniqueAirports.length === 1) {
      result.departure_airport = uniqueAirports[0]
      result.departure_city = AIRPORT_CODES[uniqueAirports[0]]
    }
  }

  // Extract times (HH:MM format) - also match times concatenated after airport codes
  const timePattern = /(\d{1,2}):(\d{2})\s*(AM|PM|HRS|H)?/gi
  const timeMatches = normalized.match(timePattern) || []
  if (timeMatches.length >= 1 && timeMatches[0]) {
    result.departure_time = convertTo24Hour(timeMatches[0])
  }
  if (timeMatches.length >= 2 && timeMatches[1]) {
    result.arrival_time = convertTo24Hour(timeMatches[1])
  }

  // Extract travel date - prioritize dates with day names (Mon, Tue, Fri, etc.) as these are travel dates
  // Skip dates that appear near "Booked on" which are booking dates
  const travelDatePatterns = [
    // "Fri, 30 Jan 2026" or "Fri, 30 Jan"
    /(?:MON|TUE|WED|THU|FRI|SAT|SUN)[A-Z]*[,\s]+(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*(?:\s+(\d{4}))?/i,
    // "30 Jan 2026" standalone
    /(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{4})/i,
    // DD/MM/YYYY
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/,
  ]

  for (const pattern of travelDatePatterns) {
    const match = normalized.match(pattern)
    if (match) {
      result.departure_date = parseDate(match[0])
      break
    }
  }

  // Extract seat number - be careful not to match duration like "1h 10m"
  // Seats are typically like 2D, 12A, 5F - near SEAT or TRAVELLER keywords
  // Exclude airline codes: 6E, G8, I5 which could match seat pattern
  const airlineCodesSeat = ["6E", "G8", "I5"]
  const seatPatterns = [
    /SEAT[:\s]*([0-9]{1,2}[A-F])\b/i,                    // SEAT: 2D
    /TRAVELLER.*?\b([0-9]{1,2}[A-F])\b.*?(?:Included|meal)/i,  // In traveller section
    /\b([0-9]{1,2}[A-F])\s*Included/i,                   // 2D Included
    /\b([0-9]{1,2}[A-F])(?=[A-Z]{6})/,                   // Seat followed by PNR (like "2DB7W3TJ")
  ]
  for (const pattern of seatPatterns) {
    const match = upper.match(pattern)
    if (match && !airlineCodesSeat.includes(match[1].toUpperCase())) {
      result.seat_number = match[1]
      break
    }
  }

  // Extract terminal
  const terminalMatch = upper.match(/TERMINAL[:\s]*([0-9T]+[A-Z]?)/i) ||
                        upper.match(/T([0-9])\b/)
  if (terminalMatch) {
    result.terminal = terminalMatch[1].startsWith("T") ? terminalMatch[1] : `T${terminalMatch[1]}`
  }

  // Extract passenger name - look for "MR./MRS./MS./DR. NAME" pattern or "TRAVELLER" section
  const namePatterns = [
    /(?:MR\.|MRS\.|MS\.|DR\.)\s*([A-Z][A-Z\s]{2,30}?)(?:\s+Adult|\s+Child|\s*$)/i,
    /TRAVELLER[S]?.*?(?:MR\.|MRS\.|MS\.|DR\.)?\s*([A-Z][A-Z\s]{2,30}?)(?:\s+Adult|\s+Child)/i,
    /PASSENGER[:\s]+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})/i,
  ]
  for (const pattern of namePatterns) {
    const match = normalized.match(pattern)
    if (match && match[1] && match[1].trim().length > 3) {
      result.passenger_name = match[1].trim()
      break
    }
  }

  return result
}

// Extract train details from text
function _extractTrainDetails(text: string): ExtractedTrainDetails {
  const result: ExtractedTrainDetails = {
    pnr: null, train_number: null, train_name: null,
    departure_station: null, departure_date: null, departure_time: null,
    arrival_station: null, arrival_date: null, arrival_time: null,
    passenger_name: null, coach: null, seat_number: null,
    class: null, booking_status: null,
  }

  const normalized = text.replace(/\s+/g, " ").trim()
  const upper = normalized.toUpperCase()

  // Extract PNR (10 digits for trains)
  const pnrMatch = upper.match(/PNR[:\s]*(\d{10})/i) || upper.match(/\b(\d{10})\b/)
  if (pnrMatch) {
    result.pnr = pnrMatch[1]
  }

  // Extract train number (5 digits)
  const trainMatch = upper.match(/TRAIN[:\s#]*(\d{5})/i) || upper.match(/\b(\d{5})\b/)
  if (trainMatch) {
    result.train_number = trainMatch[1]
  }

  // Extract train name
  const trainNameMatch = normalized.match(/(\w+\s+(?:EXPRESS|MAIL|SUPERFAST|RAJDHANI|SHATABDI|DURONTO|VANDE\s*BHARAT))/i)
  if (trainNameMatch) {
    result.train_name = trainNameMatch[1]
  }

  // Extract coach
  const coachMatch = upper.match(/COACH[:\s]*([A-Z][0-9]+)/i) || upper.match(/\b([SB][0-9]+|A[0-9]|H[0-9])\b/)
  if (coachMatch) {
    result.coach = coachMatch[1]
  }

  // Extract seat/berth
  const seatMatch = upper.match(/(?:SEAT|BERTH)[:\s]*(\d+)/i) || upper.match(/\b(\d{1,2})\s*(?:LOWER|UPPER|MIDDLE|SIDE)/i)
  if (seatMatch) {
    result.seat_number = seatMatch[1]
  }

  // Extract class
  const classMatch = upper.match(/\b(SLEEPER|3AC|2AC|1AC|CC|EC|2S|SL)\b/i)
  if (classMatch) {
    result.class = classMatch[1].toUpperCase()
  }

  // Extract booking status
  const statusMatch = upper.match(/\b(CNF|CONFIRMED|RAC|WL|WAITING)\b/i)
  if (statusMatch) {
    result.booking_status = statusMatch[1].toUpperCase()
  }

  // Extract times
  const timeMatches = normalized.match(/\b(\d{1,2}):(\d{2})\b/g) || []
  if (timeMatches.length >= 1 && timeMatches[0]) result.departure_time = timeMatches[0]
  if (timeMatches.length >= 2 && timeMatches[1]) result.arrival_time = timeMatches[1]

  // Extract date
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
    /(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\w*\s*(\d{2,4})?/i,
  ]
  for (const pattern of datePatterns) {
    const match = normalized.match(pattern)
    if (match) {
      result.departure_date = parseDate(match[0])
      break
    }
  }

  return result
}

// Convert 12-hour to 24-hour format
function convertTo24Hour(timeStr: string): string {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!match) return timeStr

  let hours = parseInt(match[1])
  const minutes = match[2]
  const period = match[3]?.toUpperCase()

  if (period === "PM" && hours !== 12) hours += 12
  if (period === "AM" && hours === 12) hours = 0

  return `${hours.toString().padStart(2, "0")}:${minutes}`
}

// Parse date to YYYY-MM-DD
function parseDate(dateStr: string): string | null {
  const months: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  }

  // DD/MM/YYYY or DD-MM-YYYY
  let match = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/)
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3]
    return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
  }

  // DD MMM YYYY
  match = dateStr.match(/(\d{1,2})\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\w*\s*(\d{2,4})?/i)
  if (match) {
    const year = match[3] ? (match[3].length === 2 ? `20${match[3]}` : match[3]) : new Date().getFullYear().toString()
    const month = months[match[2].toUpperCase().substring(0, 3)]
    return `${year}-${month}-${match[1].padStart(2, "0")}`
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const ticketCategory = formData.get("ticket_category") as string || "oneway" // oneway, roundtrip, multicity
    const requestedOnward = formData.get("requested_onward") as string
    const requestedReturn = formData.get("requested_return") as string

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    // Read file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let extractedText = ""
    const fileName = file.name.toLowerCase()
    const isImage = file.type.startsWith("image/") ||
      [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].some(ext => fileName.endsWith(ext))
    const isPDF = file.type === "application/pdf" || fileName.endsWith(".pdf")

    // Extract text from PDF
    if (isPDF) {
      try {
        const pdfData = await parsePDF(buffer)
        extractedText = pdfData.text

        // If PDF has no text (image-based PDF), try OCR
        if ((!extractedText || extractedText.trim().length < 20) && isOCREnabled()) {
          console.log("PDF appears to be image-based, trying OCR...")
          const ocrResult = await extractTextFromImage(buffer, file.name)
          if (ocrResult.success) {
            extractedText = ocrResult.text
          }
        }
      } catch (pdfError) {
        console.error("PDF parsing error:", pdfError)
        // Try OCR as fallback for problematic PDFs
        if (isOCREnabled()) {
          const ocrResult = await extractTextFromImage(buffer, file.name)
          if (ocrResult.success) {
            extractedText = ocrResult.text
          } else {
            return NextResponse.json({
              success: false,
              error: "Could not parse PDF. Please try uploading an image instead.",
            })
          }
        } else {
          return NextResponse.json({
            success: false,
            error: "Could not parse PDF. Please try uploading an image instead.",
          })
        }
      }
    }
    // Extract text from image using OCR
    else if (isImage) {
      if (!isOCREnabled()) {
        return NextResponse.json({
          success: false,
          error: "Image OCR is not configured. Please upload a PDF ticket.",
        })
      }

      const ocrResult = await extractTextFromImage(buffer, file.name)
      if (!ocrResult.success) {
        return NextResponse.json({
          success: false,
          error: ocrResult.error || "Could not extract text from image.",
        })
      }
      extractedText = ocrResult.text
    }
    // Unsupported file type
    else {
      return NextResponse.json({
        success: false,
        error: "Unsupported file type. Please upload a PDF or image (JPG, PNG).",
      })
    }

    if (!extractedText || extractedText.trim().length < 20) {
      return NextResponse.json({
        success: false,
        error: "Could not extract text from the ticket. Please ensure the image is clear and readable.",
      })
    }

    console.log("Extracted text:", extractedText.substring(0, 1500))
    console.log("Full text length:", extractedText.length)
    console.log("Ticket category:", ticketCategory)

    // Extract ALL journeys from the ticket
    const allJourneys = await extractAllJourneys(extractedText)
    console.log("Found journeys:", allJourneys.length)
    allJourneys.forEach((j, i) => console.log(`Journey ${i + 1}:`, JSON.stringify(j)))

    // Parse requested itineraries
    let onwardRequest: any = null
    let returnRequest: any = null
    try {
      if (requestedOnward) onwardRequest = JSON.parse(requestedOnward)
      if (requestedReturn) returnRequest = JSON.parse(requestedReturn)
    } catch { /* ignore parse errors */ }

    // Match journeys with speaker requests
    let onwardMatch: { journey: Journey | null; matched: boolean; discrepancies: any[] } = { journey: null, matched: false, discrepancies: [] }
    let returnMatch: { journey: Journey | null; matched: boolean; discrepancies: any[] } = { journey: null, matched: false, discrepancies: [] }

    if (ticketCategory === "oneway") {
      // Single journey - try to match with onward first, then return
      if (allJourneys.length > 0) {
        const journey = allJourneys[0]
        if (onwardRequest) {
          const check = matchJourneyWithRequest(journey, onwardRequest)
          if (check.matched) {
            onwardMatch = { journey, matched: true, discrepancies: [] }
          } else {
            onwardMatch = { journey, matched: false, discrepancies: check.discrepancies }
          }
        } else if (returnRequest) {
          const check = matchJourneyWithRequest(journey, returnRequest)
          if (check.matched) {
            returnMatch = { journey, matched: true, discrepancies: [] }
          } else {
            returnMatch = { journey, matched: false, discrepancies: check.discrepancies }
          }
        } else {
          // No request to match against, just return the journey
          onwardMatch = { journey, matched: true, discrepancies: [] }
        }
      }
    } else if (ticketCategory === "roundtrip" || ticketCategory === "multicity") {
      // Multiple journeys - match each with onward/return requests
      // First pass: try exact matches
      for (const journey of allJourneys) {
        if (onwardRequest && !onwardMatch.matched) {
          const check = matchJourneyWithRequest(journey, onwardRequest)
          if (check.matched) {
            onwardMatch = { journey, matched: true, discrepancies: [] }
            continue
          }
        }
        if (returnRequest && !returnMatch.matched) {
          const check = matchJourneyWithRequest(journey, returnRequest)
          if (check.matched) {
            returnMatch = { journey, matched: true, discrepancies: [] }
            continue
          }
        }
      }

      // Second pass: for any unmatched journey, find best match (fewest discrepancies)
      // Run independently for onward and return so one matching doesn't block the other
      if (allJourneys.length > 0) {
        // Collect journeys already claimed by exact match
        const claimedJourneys = new Set<Journey>()
        if (onwardMatch.matched && onwardMatch.journey) claimedJourneys.add(onwardMatch.journey)
        if (returnMatch.matched && returnMatch.journey) claimedJourneys.add(returnMatch.journey)

        // Best-match for onward if not yet matched
        if (!onwardMatch.matched && onwardRequest) {
          let bestOnward: { journey: Journey; discrepancies: any[]; score: number } | null = null
          for (const journey of allJourneys) {
            if (claimedJourneys.has(journey)) continue
            const check = matchJourneyWithRequest(journey, onwardRequest)
            const score = check.discrepancies.length
            if (!bestOnward || score < bestOnward.score) {
              bestOnward = { journey, discrepancies: check.discrepancies, score }
            }
          }
          if (bestOnward) {
            const citiesOk = bestOnward.discrepancies.every(d => d.field === "Date")
            onwardMatch = {
              journey: bestOnward.journey,
              matched: citiesOk && bestOnward.score <= 1,
              discrepancies: citiesOk && bestOnward.score <= 1 ? [] : bestOnward.discrepancies,
            }
            if (onwardMatch.matched) claimedJourneys.add(bestOnward.journey)
          }
        }

        // Best-match for return if not yet matched
        if (!returnMatch.matched && returnRequest) {
          let bestReturn: { journey: Journey; discrepancies: any[]; score: number } | null = null
          for (const journey of allJourneys) {
            if (claimedJourneys.has(journey)) continue
            const check = matchJourneyWithRequest(journey, returnRequest)
            const score = check.discrepancies.length
            if (!bestReturn || score < bestReturn.score) {
              bestReturn = { journey, discrepancies: check.discrepancies, score }
            }
          }
          if (bestReturn) {
            const citiesOk = bestReturn.discrepancies.every(d => d.field === "Date")
            returnMatch = {
              journey: bestReturn.journey,
              matched: citiesOk && bestReturn.score <= 1,
              discrepancies: citiesOk && bestReturn.score <= 1 ? [] : bestReturn.discrepancies,
            }
          }
        }
      }
    }

    // Calculate confidence
    const confidence = calculateConfidence(onwardMatch, returnMatch, ticketCategory)

    return NextResponse.json({
      success: true,
      ticket_category: ticketCategory,
      journeys_found: allJourneys.length,
      all_journeys: allJourneys,
      onward: onwardMatch.journey ? {
        ...onwardMatch.journey,
        matched: onwardMatch.matched,
        discrepancies: onwardMatch.discrepancies,
      } : null,
      return: returnMatch.journey ? {
        ...returnMatch.journey,
        matched: returnMatch.matched,
        discrepancies: returnMatch.discrepancies,
      } : null,
      confidence,
      raw_text: extractedText.substring(0, 500),
    })
  } catch (error: any) {
    console.error("Ticket extraction error:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to extract ticket details",
    }, { status: 500 })
  }
}

// Match a journey with speaker's request
function matchJourneyWithRequest(journey: Journey, request: any): { matched: boolean; discrepancies: any[] } {
  const discrepancies: any[] = []

  // Check departure city
  if (request.departure_city && journey.departure_city) {
    if (!citiesMatch(request.departure_city, journey.departure_city, journey.departure_airport)) {
      discrepancies.push({
        field: "From",
        requested: request.departure_city,
        extracted: journey.departure_city || journey.departure_airport,
      })
    }
  }

  // Check arrival city
  if (request.arrival_city && journey.arrival_city) {
    if (!citiesMatch(request.arrival_city, journey.arrival_city, journey.arrival_airport)) {
      discrepancies.push({
        field: "To",
        requested: request.arrival_city,
        extracted: journey.arrival_city || journey.arrival_airport,
      })
    }
  }

  // Check date
  if (request.departure_date && journey.departure_date) {
    if (request.departure_date !== journey.departure_date) {
      discrepancies.push({
        field: "Date",
        requested: request.departure_date,
        extracted: journey.departure_date,
      })
    }
  }

  return { matched: discrepancies.length === 0, discrepancies }
}

// Calculate overall confidence
function calculateConfidence(
  onward: { journey: Journey | null; matched: boolean },
  returnJ: { journey: Journey | null; matched: boolean },
  category: string
): number {
  let score = 0
  let total = 0

  const countFields = (j: Journey | null) => {
    if (!j) return { filled: 0, total: 8 }
    let filled = 0
    if (j.pnr) filled++
    if (j.flight_number) filled++
    if (j.departure_city || j.departure_airport) filled++
    if (j.arrival_city || j.arrival_airport) filled++
    if (j.departure_date) filled++
    if (j.departure_time) filled++
    if (j.arrival_time) filled++
    if (j.seat_number) filled++
    return { filled, total: 8 }
  }

  if (onward.journey) {
    const c = countFields(onward.journey)
    score += c.filled * (onward.matched ? 1.5 : 0.5)
    total += c.total
  }

  if (category === "roundtrip" && returnJ.journey) {
    const c = countFields(returnJ.journey)
    score += c.filled * (returnJ.matched ? 1.5 : 0.5)
    total += c.total
  }

  if (total === 0) return 0
  return Math.min(95, Math.round((score / total) * 100))
}

// Normalize city string: strip airport codes in parens, normalize whitespace/unicode
function normalizeCity(city: string): { name: string; code: string } {
  // Extract airport code from "City (CODE)" format
  const codeMatch = city.match(/\(([A-Za-z]{3})\)/)
  const code = codeMatch ? codeMatch[1].toLowerCase() : ""
  // Strip parenthetical airport code and normalize whitespace (including non-breaking spaces)
  const name = city
    .replace(/\s*\([A-Za-z]{3}\)\s*/g, "")
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ") // normalize unicode spaces
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim()
  return { name, code }
}

// Simple Levenshtein distance for fuzzy city matching
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// Helper to check if city/airport matches
function citiesMatch(requested: string, extracted: string, extractedAirport?: string | null): boolean {
  if (!requested || !extracted) return true // Skip if either is missing

  const req = normalizeCity(requested)
  const ext = normalizeCity(extracted)
  const extAirportLower = (extractedAirport || "").toLowerCase().trim()

  // Direct city name match
  if (req.name === ext.name) return true

  // Airport code matches (from request "City (CODE)" vs extracted airport)
  if (req.code && extAirportLower && req.code === extAirportLower) return true
  if (req.code && ext.name === req.code) return true
  if (req.name === extAirportLower) return true

  // Partial match on normalized city names (one contains the other)
  if (ext.name.includes(req.name) || req.name.includes(ext.name)) return true

  // If extracted is just an airport code, compare with request's embedded code
  if (req.code && ext.code && req.code === ext.code) return true

  // Fuzzy match: allow edit distance <= 2 for city names with 6+ chars
  if (req.name.length >= 6 && ext.name.length >= 6) {
    const dist = levenshtein(req.name, ext.name)
    if (dist <= 2) return true
  }

  // Check airport code to city mapping (includes common spelling variants)
  // Build from AIRPORT_CODES + add known spelling variants
  const airportToCityMap: Record<string, string[]> = {}
  for (const [code, city] of Object.entries(AIRPORT_CODES)) {
    airportToCityMap[code.toLowerCase()] = [city.toLowerCase()]
  }
  // Add spelling variants for commonly misspelled cities
  const variants: Record<string, string[]> = {
    "del": ["new delhi"],
    "bom": ["bombay"],
    "blr": ["bengaluru", "bangaluru"],
    "maa": ["madras"],
    "ccu": ["calcutta"],
    "amd": ["ahemdabad"],
    "cok": ["cochin"],
    "pnq": ["poona"],
    "gau": ["gauhati"],
    "trv": ["thiruvananthapuram"],
    "vns": ["banaras", "benares"],
    "bbi": ["bhubaneshwar", "bhubanesar"],
    "vtz": ["vizag"],
    "ixe": ["mangaluru"],
    "myq": ["mysuru"],
    "trz": ["trichy"],
    "ccj": ["calicut"],
    "bdq": ["baroda"],
    "ded": ["dehra dun"],
    "goi": ["panaji"],
    "atq": ["amritsar"],
    "pgh": ["allahabad", "prayagraj"],
    "hbx": ["hubballi"],
  }
  for (const [code, alts] of Object.entries(variants)) {
    if (airportToCityMap[code]) {
      airportToCityMap[code].push(...alts)
    }
  }

  // Collect all codes to check: extracted airport, extracted city-as-code, request's embedded code
  const extractedCodes = [extAirportLower, ext.name, ext.code].filter(Boolean)
  const requestedCodes = [req.code, req.name].filter(Boolean)

  for (const [code, cities] of Object.entries(airportToCityMap)) {
    // Check if any extracted value matches this airport code
    if (extractedCodes.includes(code)) {
      if (cities.some(city => requestedCodes.some(rc => rc.includes(city) || city.includes(rc)))) {
        return true
      }
    }
    // Check if any requested value matches this airport code
    if (requestedCodes.includes(code)) {
      if (cities.some(city => extractedCodes.some(ec => ec.includes(city) || city.includes(ec)))) {
        return true
      }
    }
  }

  return false
}

// Cross-check extracted vs requested
function _performCrossCheck(extracted: any, requested: any, ticketType: string) {
  const discrepancies: Array<{ field: string; requested: string | null; booked: string | null; severity: string }> = []

  if (ticketType === "flight") {
    // Check departure city
    if (requested.departure_city && (extracted.departure_city || extracted.departure_airport)) {
      if (!citiesMatch(requested.departure_city, extracted.departure_city, extracted.departure_airport)) {
        discrepancies.push({
          field: "Departure",
          requested: requested.departure_city,
          booked: extracted.departure_city || extracted.departure_airport,
          severity: "error",
        })
      }
    }

    // Check arrival city
    if (requested.arrival_city && (extracted.arrival_city || extracted.arrival_airport)) {
      if (!citiesMatch(requested.arrival_city, extracted.arrival_city, extracted.arrival_airport)) {
        discrepancies.push({
          field: "Arrival",
          requested: requested.arrival_city,
          booked: extracted.arrival_city || extracted.arrival_airport,
          severity: "error",
        })
      }
    }

    // Check date
    if (requested.departure_date && extracted.departure_date) {
      if (requested.departure_date !== extracted.departure_date) {
        discrepancies.push({
          field: "Date",
          requested: requested.departure_date,
          booked: extracted.departure_date,
          severity: "error",
        })
      }
    }
  }

  return {
    match: discrepancies.length === 0,
    discrepancies,
  }
}
