// Maps route segments to required permissions
export const ROUTE_PERMISSION_MAP: Record<string, string> = {
  registrations: "registrations",
  speakers: "speakers",
  program: "program",
  abstracts: "abstracts",
  badges: "badges",
  certificates: "certificates",
  "check-in": "checkin",
  checkin: "checkin",
  accommodation: "hotels",
  travel: "flights",
  flights: "flights",
  hotels: "hotels",
  transfers: "transfers",
  trains: "trains",
  communications: "communications",
  emails: "communications",
}

export function getRequiredPermission(pathname: string): string | null {
  // Split pathname and look for known module segments
  // Typical path: /events/[eventId]/registrations/...
  const segments = pathname.split("/")
  for (const segment of segments) {
    if (ROUTE_PERMISSION_MAP[segment]) {
      return ROUTE_PERMISSION_MAP[segment]
    }
  }
  return null
}
