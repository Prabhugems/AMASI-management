// Local, offline-capable mirror of the fuzzy match /api/kiosk/checkin/
// route.ts:66-83 does server-side. Kept as a pure function (no IndexedDB,
// no network) so it's unit-testable and so Task 5 can call it synchronously
// on every keystroke/scan without an await.
//
// The server's .or() query has no deterministic field-priority tie-break;
// this version does, intentionally: an exact identifier (registration
// number) should never lose to a coincidental name/phone substring match.
export interface CachedDelegate {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  attendee_designation: string | null
  attendee_institution: string | null
}

function includesTerm(value: string | null | undefined, term: string): boolean {
  return !!value && value.toLowerCase().includes(term)
}

export function matchDelegate(delegates: CachedDelegate[], query: string): CachedDelegate | null {
  const term = query.trim().toLowerCase()
  if (!term) return null

  return (
    delegates.find((d) => includesTerm(d.registration_number, term)) ??
    delegates.find((d) => includesTerm(d.attendee_email, term)) ??
    delegates.find((d) => includesTerm(d.attendee_name, term)) ??
    delegates.find((d) => includesTerm(d.attendee_phone, term)) ??
    null
  )
}
