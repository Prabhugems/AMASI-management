import { NextRequest, NextResponse } from "next/server"
import { getFlightsByRoute, getAirportList, getAvailableDestinations, AIRPORT_INFO } from "@/lib/airline-api"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  // Get list of airports for dropdown
  if (action === "airports") {
    const airports = getAirportList()
    return NextResponse.json({ airports })
  }

  // Get available destinations from a specific airport
  if (action === "destinations" && from) {
    const destinations = getAvailableDestinations(from)
    const destinationDetails = destinations.map(code => ({
      code,
      city: AIRPORT_INFO[code]?.city || code,
    }))
    return NextResponse.json({ destinations: destinationDetails })
  }

  // Get flights for a specific route
  if (action === "search" && from && to) {
    const flights = getFlightsByRoute(from, to)
    return NextResponse.json({
      flights,
      route: {
        from: { code: from, city: AIRPORT_INFO[from]?.city || from },
        to: { code: to, city: AIRPORT_INFO[to]?.city || to },
      }
    })
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 })
}
