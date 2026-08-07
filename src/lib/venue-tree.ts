// The venue tree: halls, and the screens nested under them.
//
// Pure and framework-free -- callers fetch the flat `halls` rows and pass them
// in, matching src/lib/agenda-conflicts.ts and src/lib/agenda-open-slots.ts.
//
// The model, from the Venue Setup mock: a space is either flat or split into
// screens, the choice is per-hall, and a venue routinely mixes both. Two levels
// only -- "Hall A · Screen 2" is as deep as a venue goes, and deeper nesting has
// no meaning to a session's location. Enforced in the database by
// halls_two_level_tree; enforced here so the UI can say so before the round trip.

export interface VenueRow {
  id: string
  event_id?: string
  name: string
  capacity?: number | null
  floor?: string | null
  display_order?: number | null
  parent_id?: string | null
  kind?: string | null
}

export interface VenueScreen {
  id: string
  name: string
  capacity: number | null
  display_order: number
  /** "Hall A · Screen 2" -- what the Session Builder's location picker shows. */
  label: string
}

export interface VenueHall {
  id: string
  name: string
  capacity: number | null
  floor: string | null
  display_order: number
  screens: VenueScreen[]
  /** Just the hall name. A flat hall is its own location. */
  label: string
}

/** How the mock separates a hall from its screen: "Hall A · Screen 2". */
export const VENUE_LABEL_SEPARATOR = " · "

function orderOf(row: VenueRow): number {
  return typeof row.display_order === "number" ? row.display_order : 0
}

function sortRows<T extends { display_order: number; name: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
}

/**
 * Group flat rows into halls with their screens.
 *
 * A screen whose parent is missing from the input is promoted to a top-level
 * hall rather than dropped. Losing a room silently is worse than showing one in
 * the wrong place -- a coordinator can see and fix the latter.
 */
export function buildVenueTree(rows: readonly VenueRow[]): VenueHall[] {
  const byId = new Map(rows.map((r) => [r.id, r]))

  const isScreen = (r: VenueRow) => r.kind === "screen" && !!r.parent_id && byId.has(r.parent_id)

  const halls: VenueHall[] = rows
    .filter((r) => !isScreen(r))
    .map((r) => ({
      id: r.id,
      name: r.name,
      capacity: r.capacity ?? null,
      floor: r.floor ?? null,
      display_order: orderOf(r),
      screens: [],
      label: r.name,
    }))

  const hallsById = new Map(halls.map((h) => [h.id, h]))

  for (const r of rows) {
    if (!isScreen(r)) continue
    const parent = hallsById.get(r.parent_id!)
    if (!parent) continue
    parent.screens.push({
      id: r.id,
      name: r.name,
      capacity: r.capacity ?? null,
      display_order: orderOf(r),
      label: `${parent.name}${VENUE_LABEL_SEPARATOR}${r.name}`,
    })
  }

  for (const h of halls) sortRows(h.screens)
  return sortRows(halls)
}

export interface LocationOption {
  id: string
  label: string
  /** A screen is indented under its hall in the picker. */
  depth: 0 | 1
  hall_id: string
  capacity: number | null
}

/**
 * The flat list the Session Builder's location picker renders.
 *
 * A hall that has screens is NOT itself selectable: the mock's picker offers
 * "Hall A" for a flat hall, and "Hall A · Screen 1/2/3" for a nested one -- you
 * place a session in a screen, not in the hall that contains it. The hall still
 * appears, as a non-selectable group header.
 */
export function toLocationOptions(halls: readonly VenueHall[]): Array<LocationOption & { selectable: boolean }> {
  const out: Array<LocationOption & { selectable: boolean }> = []
  for (const h of halls) {
    out.push({
      id: h.id,
      label: h.name,
      depth: 0,
      hall_id: h.id,
      capacity: h.capacity,
      selectable: h.screens.length === 0,
    })
    for (const s of h.screens) {
      out.push({
        id: s.id,
        label: s.label,
        depth: 1,
        hall_id: h.id,
        capacity: s.capacity,
        selectable: true,
      })
    }
  }
  return out
}

/** "3 halls · 3 screens" -- the Venue Overview header count. */
export function describeVenue(halls: readonly VenueHall[]): string {
  const screenCount = halls.reduce((n, h) => n + h.screens.length, 0)
  const hallPart = `${halls.length} hall${halls.length === 1 ? "" : "s"}`
  if (screenCount === 0) return hallPart
  return `${hallPart}${VENUE_LABEL_SEPARATOR}${screenCount} screen${screenCount === 1 ? "" : "s"}`
}

// ---------------------------------------------------------------------------
// Validation -- run before the round trip so the form can answer immediately
// ---------------------------------------------------------------------------

export type VenueIssueCode = "empty_name" | "duplicate_name" | "screen_needs_parent" | "nesting_too_deep"

export interface VenueIssue {
  code: VenueIssueCode
  message: string
  /**
   * `warning` may still be saved -- the mock is explicit that a duplicate name
   * is "a warning, not a wall". `blocking` cannot.
   */
  severity: "blocking" | "warning"
  /** For duplicate_name: the row to offer as "Edit existing Hall A". */
  conflictsWith?: string
}

function normaliseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

export interface VenueDraft {
  /** Omitted when adding; set when editing, so a row never collides with itself. */
  id?: string
  name: string
  parent_id?: string | null
  kind?: string | null
}

/**
 * Validate one add/edit against the current venue.
 *
 * Duplicate detection is scoped to siblings, not the whole event: two halls may
 * not both be "Hall A", and one hall may not hold two "Screen 1"s -- but "Screen
 * 1" under Hall A and "Screen 1" under Hall B is normal and must not warn.
 */
export function validateVenueDraft(draft: VenueDraft, existing: readonly VenueRow[]): VenueIssue[] {
  const issues: VenueIssue[] = []
  const name = draft.name.trim()

  if (name === "") {
    issues.push({
      code: "empty_name",
      severity: "blocking",
      message: draft.parent_id
        ? "Give this screen a name to save it."
        : "Give this hall a name to save it.",
    })
  }

  if (draft.kind === "screen" && !draft.parent_id) {
    issues.push({
      code: "screen_needs_parent",
      severity: "blocking",
      message: "A screen has to sit under a hall.",
    })
  }

  if (draft.parent_id) {
    const parent = existing.find((r) => r.id === draft.parent_id)
    if (parent?.parent_id) {
      issues.push({
        code: "nesting_too_deep",
        severity: "blocking",
        message: "Screens can't be nested inside other screens.",
      })
    }
  }

  if (name !== "") {
    const target = normaliseName(name)
    const siblingParent = draft.parent_id ?? null
    const clash = existing.find(
      (r) =>
        r.id !== draft.id &&
        (r.parent_id ?? null) === siblingParent &&
        normaliseName(r.name) === target
    )
    if (clash) {
      issues.push({
        code: "duplicate_name",
        severity: "warning",
        conflictsWith: clash.id,
        message: siblingParent
          ? `This hall already has a ${clash.name}.`
          : `You already have a ${clash.name}. Use a different name, or edit the existing one instead.`,
      })
    }
  }

  return issues
}

/** Whether a draft can be saved. Warnings don't stop a save; blocking issues do. */
export function canSaveVenueDraft(issues: readonly VenueIssue[]): boolean {
  return !issues.some((i) => i.severity === "blocking")
}

/** Next display_order among a set of siblings, so a new row appends rather than jumps. */
export function nextDisplayOrder(siblings: readonly VenueRow[]): number {
  if (siblings.length === 0) return 0
  return Math.max(...siblings.map(orderOf)) + 1
}
