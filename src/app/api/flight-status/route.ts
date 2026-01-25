import { NextRequest, NextResponse } from "next/server"

const AIRLABS_API_KEY = process.env.AIRLABS_API_KEY || ""
const AIRLABS_BASE_URL = "https://airlabs.co/api/v9"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const flightNumber = searchParams.get("flight")

  if (!flightNumber) {
    return NextResponse.json(
      { error: "Flight number is required" },
      { status: 400 }
    )
  }

  if (!AIRLABS_API_KEY) {
    return NextResponse.json(
      { error: "Flight API not configured. Add AIRLABS_API_KEY to environment." },
      { status: 500 }
    )
  }

  try {
    const cleanFlightNum = flightNumber.replace(/\s+/g, "").toUpperCase()

    const params = new URLSearchParams({
      api_key: AIRLABS_API_KEY,
      flight_iata: cleanFlightNum,
    })

    const response = await fetch(`${AIRLABS_BASE_URL}/flight?${params}`)
    const data = await response.json()

    if (data.error) {
      return NextResponse.json(
        { error: data.error.message || "Failed to fetch flight status" },
        { status: 400 }
      )
    }

    if (!data.response) {
      return NextResponse.json(
        { error: "Flight not found" },
        { status: 404 }
      )
    }

    const flight = data.response

    // Transform to our format
    const status = transformStatus(flight)

    return NextResponse.json({
      success: true,
      flight: status,
    })
  } catch (error: any) {
    console.error("Flight status error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch flight status" },
      { status: 500 }
    )
  }
}

function transformStatus(flight: any) {
  // Determine display status
  let status = "on-time"

  if (flight.status === "cancelled") {
    status = "cancelled"
  } else if (flight.status === "landed") {
    status = "landed"
  } else if (flight.status === "active") {
    status = "departed"
  } else if (flight.delayed && flight.delayed > 0) {
    status = "delayed"
  } else if (flight.dep_gate) {
    status = "boarding"
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
    delayMinutes: flight.delayed,
    terminal: flight.dep_terminal,
    gate: flight.dep_gate,
  }
}
