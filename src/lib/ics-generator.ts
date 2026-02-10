// ICS Calendar File Generator

interface CalendarEvent {
  title: string
  description?: string
  location?: string
  startDate: Date
  endDate: Date
  organizer?: string
  url?: string
}

// Format date to ICS format (YYYYMMDDTHHMMSSZ)
function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

// Generate a unique ID for the event
function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@amasi.in`
}

// Escape special characters in ICS text
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

// Generate a single ICS event
export function generateICSEvent(event: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AMASI Events//Travel Itinerary//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${generateUID()}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(event.startDate)}`,
    `DTEND:${formatICSDate(event.endDate)}`,
    `SUMMARY:${escapeICSText(event.title)}`,
  ]

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICSText(event.description)}`)
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICSText(event.location)}`)
  }

  if (event.url) {
    lines.push(`URL:${event.url}`)
  }

  if (event.organizer) {
    lines.push(`ORGANIZER:mailto:${event.organizer}`)
  }

  // Add reminder 2 hours before
  lines.push(
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder",
    "END:VALARM"
  )

  lines.push("END:VEVENT", "END:VCALENDAR")

  return lines.join("\r\n")
}

// Generate ICS for flight
export function generateFlightICS(flight: {
  airline: string
  flightNumber: string
  fromCity: string
  toCity: string
  departureDate: string
  departureTime: string
  arrivalDate?: string
  arrivalTime?: string
  pnr?: string
  passengerName: string
}): string {
  // Parse departure datetime
  const depDate = new Date(`${flight.departureDate}T${flight.departureTime || "00:00"}:00`)

  // Estimate arrival (2 hours after departure if not provided)
  let arrDate: Date
  if (flight.arrivalDate && flight.arrivalTime) {
    arrDate = new Date(`${flight.arrivalDate}T${flight.arrivalTime}:00`)
  } else {
    arrDate = new Date(depDate.getTime() + 2 * 60 * 60 * 1000)
  }

  const title = `${flight.airline} ${flight.flightNumber}: ${flight.fromCity} → ${flight.toCity}`

  let description = `Flight: ${flight.airline} ${flight.flightNumber}\n`
  description += `Passenger: ${flight.passengerName}\n`
  if (flight.pnr) {
    description += `PNR: ${flight.pnr}\n`
  }
  description += `From: ${flight.fromCity}\n`
  description += `To: ${flight.toCity}\n`
  description += `Departure: ${flight.departureTime || "Check ticket"}`

  return generateICSEvent({
    title,
    description,
    location: `${flight.fromCity} Airport`,
    startDate: depDate,
    endDate: arrDate,
  })
}

// Generate ICS for hotel stay
export function generateHotelICS(hotel: {
  hotelName: string
  address?: string
  checkIn: string
  checkOut: string
  guestName: string
  confirmationNumber?: string
}): string {
  // Check-in at 2 PM, Check-out at 11 AM (typical hotel times)
  const checkInDate = new Date(`${hotel.checkIn}T14:00:00`)
  const checkOutDate = new Date(`${hotel.checkOut}T11:00:00`)

  const title = `Hotel: ${hotel.hotelName}`

  let description = `Hotel: ${hotel.hotelName}\n`
  description += `Guest: ${hotel.guestName}\n`
  if (hotel.confirmationNumber) {
    description += `Confirmation: ${hotel.confirmationNumber}\n`
  }
  if (hotel.address) {
    description += `Address: ${hotel.address}\n`
  }
  description += `Check-in: ${hotel.checkIn} (2:00 PM)\n`
  description += `Check-out: ${hotel.checkOut} (11:00 AM)`

  return generateICSEvent({
    title,
    description,
    location: hotel.address || hotel.hotelName,
    startDate: checkInDate,
    endDate: checkOutDate,
  })
}

// Generate combined ICS with multiple events (flights + hotel)
export function generateTravelItineraryICS(itinerary: {
  speakerName: string
  eventName: string
  onwardFlight?: {
    airline: string
    flightNumber: string
    fromCity: string
    toCity: string
    departureDate: string
    departureTime: string
    arrivalDate?: string
    arrivalTime?: string
    pnr?: string
  }
  returnFlight?: {
    airline: string
    flightNumber: string
    fromCity: string
    toCity: string
    departureDate: string
    departureTime: string
    arrivalDate?: string
    arrivalTime?: string
    pnr?: string
  }
  hotel?: {
    hotelName: string
    address?: string
    checkIn: string
    checkOut: string
    confirmationNumber?: string
  }
}): string {
  const _events: string[] = []

  // Header
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AMASI Events//Travel Itinerary//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICSText(`${itinerary.eventName} - Travel Itinerary`)}`,
  ]

  // Add onward flight event
  if (itinerary.onwardFlight?.departureDate && itinerary.onwardFlight?.flightNumber) {
    const depDate = new Date(`${itinerary.onwardFlight.departureDate}T${itinerary.onwardFlight.departureTime || "00:00"}:00`)
    let arrDate: Date
    if (itinerary.onwardFlight.arrivalDate && itinerary.onwardFlight.arrivalTime) {
      arrDate = new Date(`${itinerary.onwardFlight.arrivalDate}T${itinerary.onwardFlight.arrivalTime}:00`)
    } else {
      arrDate = new Date(depDate.getTime() + 2 * 60 * 60 * 1000)
    }

    lines.push(
      "BEGIN:VEVENT",
      `UID:onward-${generateUID()}`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(depDate)}`,
      `DTEND:${formatICSDate(arrDate)}`,
      `SUMMARY:${escapeICSText(`✈️ ${itinerary.onwardFlight.airline} ${itinerary.onwardFlight.flightNumber}: ${itinerary.onwardFlight.fromCity} → ${itinerary.onwardFlight.toCity}`)}`,
      `DESCRIPTION:${escapeICSText(`Flight: ${itinerary.onwardFlight.airline} ${itinerary.onwardFlight.flightNumber}\\nPassenger: ${itinerary.speakerName}${itinerary.onwardFlight.pnr ? `\\nPNR: ${itinerary.onwardFlight.pnr}` : ""}\\nFrom: ${itinerary.onwardFlight.fromCity}\\nTo: ${itinerary.onwardFlight.toCity}\\nFor: ${itinerary.eventName}`)}`,
      `LOCATION:${escapeICSText(`${itinerary.onwardFlight.fromCity} Airport`)}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT3H",
      "ACTION:DISPLAY",
      "DESCRIPTION:Flight in 3 hours",
      "END:VALARM",
      "END:VEVENT"
    )
  }

  // Add hotel event
  if (itinerary.hotel?.hotelName && itinerary.hotel?.checkIn) {
    const checkInDate = new Date(`${itinerary.hotel.checkIn}T14:00:00`)
    const checkOutDate = new Date(`${itinerary.hotel.checkOut || itinerary.hotel.checkIn}T11:00:00`)

    lines.push(
      "BEGIN:VEVENT",
      `UID:hotel-${generateUID()}`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(checkInDate)}`,
      `DTEND:${formatICSDate(checkOutDate)}`,
      `SUMMARY:${escapeICSText(`🏨 ${itinerary.hotel.hotelName}`)}`,
      `DESCRIPTION:${escapeICSText(`Hotel: ${itinerary.hotel.hotelName}\\nGuest: ${itinerary.speakerName}${itinerary.hotel.confirmationNumber ? `\\nConfirmation: ${itinerary.hotel.confirmationNumber}` : ""}${itinerary.hotel.address ? `\\nAddress: ${itinerary.hotel.address}` : ""}\\nFor: ${itinerary.eventName}`)}`,
      `LOCATION:${escapeICSText(itinerary.hotel.address || itinerary.hotel.hotelName)}`,
      "END:VEVENT"
    )
  }

  // Add return flight event
  if (itinerary.returnFlight?.departureDate && itinerary.returnFlight?.flightNumber) {
    const depDate = new Date(`${itinerary.returnFlight.departureDate}T${itinerary.returnFlight.departureTime || "00:00"}:00`)
    let arrDate: Date
    if (itinerary.returnFlight.arrivalDate && itinerary.returnFlight.arrivalTime) {
      arrDate = new Date(`${itinerary.returnFlight.arrivalDate}T${itinerary.returnFlight.arrivalTime}:00`)
    } else {
      arrDate = new Date(depDate.getTime() + 2 * 60 * 60 * 1000)
    }

    lines.push(
      "BEGIN:VEVENT",
      `UID:return-${generateUID()}`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(depDate)}`,
      `DTEND:${formatICSDate(arrDate)}`,
      `SUMMARY:${escapeICSText(`✈️ ${itinerary.returnFlight.airline} ${itinerary.returnFlight.flightNumber}: ${itinerary.returnFlight.fromCity} → ${itinerary.returnFlight.toCity}`)}`,
      `DESCRIPTION:${escapeICSText(`Flight: ${itinerary.returnFlight.airline} ${itinerary.returnFlight.flightNumber}\\nPassenger: ${itinerary.speakerName}${itinerary.returnFlight.pnr ? `\\nPNR: ${itinerary.returnFlight.pnr}` : ""}\\nFrom: ${itinerary.returnFlight.fromCity}\\nTo: ${itinerary.returnFlight.toCity}\\nReturn from: ${itinerary.eventName}`)}`,
      `LOCATION:${escapeICSText(`${itinerary.returnFlight.fromCity} Airport`)}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT3H",
      "ACTION:DISPLAY",
      "DESCRIPTION:Return flight in 3 hours",
      "END:VALARM",
      "END:VEVENT"
    )
  }

  lines.push("END:VCALENDAR")

  return lines.join("\r\n")
}
