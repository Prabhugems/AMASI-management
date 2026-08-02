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

function exactMatch(value: string | null | undefined, term: string): boolean {
  return !!value && value.toLowerCase() === term
}

// Bug-audit fix (2026-08): registration numbers are unpadded and sequential
// ("AMASI1", "AMASI11", "AMASI100" can all coexist), so a plain substring
// search on registration_number alone could resolve to the WRONG delegate --
// whichever one happened to sort first in the cached array, not the one
// whose number was actually scanned. Within each field, an exact match is
// now always tried first, before falling back to substring -- a scan of
// "AMASI1" can only resolve to the delegate whose number IS "AMASI1", never
// to "AMASI11" merely because it contains that substring. Field priority
// (registration_number, then email, then name, then phone) is unchanged.
export function matchDelegate(delegates: CachedDelegate[], query: string): CachedDelegate | null {
  const term = query.trim().toLowerCase()
  if (!term) return null

  return (
    delegates.find((d) => exactMatch(d.registration_number, term)) ??
    delegates.find((d) => includesTerm(d.registration_number, term)) ??
    delegates.find((d) => exactMatch(d.attendee_email, term)) ??
    delegates.find((d) => includesTerm(d.attendee_email, term)) ??
    delegates.find((d) => exactMatch(d.attendee_name, term)) ??
    delegates.find((d) => includesTerm(d.attendee_name, term)) ??
    delegates.find((d) => exactMatch(d.attendee_phone, term)) ??
    delegates.find((d) => includesTerm(d.attendee_phone, term)) ??
    null
  )
}

// Kiosk work order §5 -- "search by name" lookup for a volunteer whose
// scanner or the delegate's phone/QR isn't working. Unlike matchDelegate
// (one best match, for the scan/manual-entry auto-submit path), this
// returns every plausible candidate so a volunteer can pick the right
// person out of a same-name/near-duplicate set -- never auto-selects.
// Pure and synchronous like matchDelegate, so it can run on every
// keystroke against the already-cached roster with no network/IndexedDB
// round-trip.
export function searchDelegates(delegates: CachedDelegate[], query: string, limit = 6): CachedDelegate[] {
  const term = query.trim().toLowerCase()
  if (term.length < 2) return []

  const seen = new Set<string>()
  const results: CachedDelegate[] = []
  const add = (d: CachedDelegate) => {
    if (seen.has(d.id) || results.length >= limit) return
    seen.add(d.id)
    results.push(d)
  }

  // Priority order matches matchDelegate: an identifier match should never
  // be buried under a pile of coincidental name matches.
  delegates.filter((d) => includesTerm(d.registration_number, term)).forEach(add)
  delegates.filter((d) => includesTerm(d.attendee_name, term)).forEach(add)
  delegates.filter((d) => includesTerm(d.attendee_email, term)).forEach(add)
  delegates.filter((d) => includesTerm(d.attendee_phone, term)).forEach(add)

  return results
}
