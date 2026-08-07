import { describe, it, expect } from "vitest"
import {
  buildVenueTree,
  canSaveVenueDraft,
  describeVenue,
  nextDisplayOrder,
  toLocationOptions,
  validateVenueDraft,
  type VenueRow,
} from "./venue-tree"

const hall = (id: string, name: string, over: Partial<VenueRow> = {}): VenueRow => ({
  id,
  name,
  kind: "hall",
  parent_id: null,
  capacity: null,
  display_order: 0,
  ...over,
})

const screen = (id: string, name: string, parent_id: string, over: Partial<VenueRow> = {}): VenueRow => ({
  id,
  name,
  kind: "screen",
  parent_id,
  capacity: null,
  display_order: 0,
  ...over,
})

describe("buildVenueTree", () => {
  it("nests screens under their hall", () => {
    const tree = buildVenueTree([
      hall("h1", "Hall A", { capacity: 400 }),
      screen("s1", "Screen 1", "h1", { display_order: 0 }),
      screen("s2", "Screen 2", "h1", { display_order: 1 }),
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0].capacity).toBe(400)
    expect(tree[0].screens.map((s) => s.name)).toEqual(["Screen 1", "Screen 2"])
  })

  it("labels a screen the way the location picker shows it", () => {
    const tree = buildVenueTree([hall("h1", "Hall A"), screen("s1", "Screen 2", "h1")])
    expect(tree[0].screens[0].label).toBe("Hall A › Screen 2")
    expect(tree[0].label).toBe("Hall A")
  })

  it("lets a venue mix flat and nested halls", () => {
    // "A venue can mix both — some halls flat, some nested."
    const tree = buildVenueTree([
      hall("h1", "Hall A", { display_order: 0 }),
      hall("h2", "Hall B", { display_order: 1 }),
      screen("s1", "Screen 1", "h2"),
      hall("h3", "Hall C", { display_order: 2 }),
    ])
    expect(tree.map((h) => [h.name, h.screens.length])).toEqual([
      ["Hall A", 0],
      ["Hall B", 1],
      ["Hall C", 0],
    ])
  })

  it("orders by display_order, then name", () => {
    const tree = buildVenueTree([
      hall("h2", "Hall B", { display_order: 1 }),
      hall("h1", "Hall A", { display_order: 0 }),
      hall("h3", "Aardvark Room", { display_order: 1 }),
    ])
    expect(tree.map((h) => h.name)).toEqual(["Hall A", "Aardvark Room", "Hall B"])
  })

  it("promotes an orphaned screen rather than dropping it", () => {
    // Losing a room silently is worse than showing one in the wrong place.
    const tree = buildVenueTree([screen("s1", "Screen 1", "missing-hall")])
    expect(tree.map((h) => h.name)).toEqual(["Screen 1"])
  })

  it("handles an empty venue", () => {
    expect(buildVenueTree([])).toEqual([])
  })

  it("treats a row with no kind as a hall", () => {
    // The 34 pre-existing rows predate the `kind` column.
    const tree = buildVenueTree([{ id: "h1", name: "Hall A" }])
    expect(tree).toHaveLength(1)
    expect(tree[0].screens).toEqual([])
  })
})

describe("toLocationOptions", () => {
  it("makes a flat hall selectable", () => {
    const opts = toLocationOptions(buildVenueTree([hall("h1", "Hall A")]))
    expect(opts).toEqual([
      { id: "h1", label: "Hall A", depth: 0, hall_id: "h1", capacity: null, selectable: true },
    ])
  })

  it("makes a hall with screens a non-selectable group header", () => {
    // You place a session in a screen, not in the hall containing it.
    const opts = toLocationOptions(
      buildVenueTree([hall("h1", "Hall B"), screen("s1", "Screen 1", "h1"), screen("s2", "Screen 2", "h1")])
    )
    expect(opts.map((o) => [o.label, o.depth, o.selectable])).toEqual([
      ["Hall B", 0, false],
      ["Hall B › Screen 1", 1, true],
      ["Hall B › Screen 2", 1, true],
    ])
  })

  it("keeps each screen pointing at its hall", () => {
    const opts = toLocationOptions(buildVenueTree([hall("h1", "Hall A"), screen("s1", "Screen 1", "h1")]))
    expect(opts[1].hall_id).toBe("h1")
  })
})

describe("describeVenue", () => {
  it("counts halls alone when nothing is nested", () => {
    expect(describeVenue(buildVenueTree([hall("h1", "Hall A")]))).toBe("1 hall")
    expect(describeVenue(buildVenueTree([hall("h1", "A"), hall("h2", "B")]))).toBe("2 halls")
  })

  it("adds the screen count when there is one", () => {
    const tree = buildVenueTree([
      hall("h1", "Hall A"),
      screen("s1", "Screen 1", "h1"),
      screen("s2", "Screen 2", "h1"),
      screen("s3", "Screen 3", "h1"),
    ])
    expect(describeVenue(tree)).toBe("1 hall · 3 screens")
  })

  it("says nothing about screens on an empty venue", () => {
    expect(describeVenue([])).toBe("0 halls")
  })
})

describe("validateVenueDraft", () => {
  const venue = [hall("h1", "Hall A"), hall("h2", "Hall B"), screen("s1", "Screen 1", "h2")]

  it("blocks an empty name and says which thing needs one", () => {
    expect(validateVenueDraft({ name: "  " }, venue)).toEqual([
      { code: "empty_name", severity: "blocking", message: "Give this hall a name to save it." },
    ])
    expect(validateVenueDraft({ name: "", parent_id: "h2", kind: "screen" }, venue)[0].message).toBe(
      "Give this screen a name to save it."
    )
  })

  it("warns on a duplicate hall name without blocking it", () => {
    // "A warning, not a wall — with the fix offered right there."
    const issues = validateVenueDraft({ name: "Hall A" }, venue)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      code: "duplicate_name",
      severity: "warning",
      conflictsWith: "h1",
    })
    expect(issues[0].message).toContain("edit the existing one instead")
    expect(canSaveVenueDraft(issues)).toBe(true)
  })

  it("ignores case and spacing when detecting a duplicate", () => {
    expect(validateVenueDraft({ name: "  hall   a " }, venue)[0]?.code).toBe("duplicate_name")
  })

  it("does not flag a row against itself when editing", () => {
    expect(validateVenueDraft({ id: "h1", name: "Hall A" }, venue)).toEqual([])
  })

  it("scopes duplicates to siblings, so the same screen name in two halls is fine", () => {
    const issues = validateVenueDraft({ name: "Screen 1", parent_id: "h1", kind: "screen" }, venue)
    expect(issues).toEqual([])
  })

  it("warns on a duplicate screen name within the same hall", () => {
    const issues = validateVenueDraft({ name: "Screen 1", parent_id: "h2", kind: "screen" }, venue)
    expect(issues[0]).toMatchObject({ code: "duplicate_name", conflictsWith: "s1" })
  })

  it("blocks a screen with no parent", () => {
    const issues = validateVenueDraft({ name: "Screen 9", kind: "screen" }, venue)
    expect(issues).toContainEqual({
      code: "screen_needs_parent",
      severity: "blocking",
      message: "A screen has to sit under a hall.",
    })
    expect(canSaveVenueDraft(issues)).toBe(false)
  })

  it("blocks a screen nested under another screen", () => {
    const issues = validateVenueDraft({ name: "Sub", parent_id: "s1", kind: "screen" }, venue)
    expect(issues.map((i) => i.code)).toContain("nesting_too_deep")
    expect(canSaveVenueDraft(issues)).toBe(false)
  })

  it("accepts a clean new hall", () => {
    expect(validateVenueDraft({ name: "Hall D" }, venue)).toEqual([])
  })
})

describe("nextDisplayOrder", () => {
  it("appends after the highest sibling", () => {
    expect(nextDisplayOrder([hall("h1", "A", { display_order: 0 }), hall("h2", "B", { display_order: 4 })])).toBe(5)
  })

  it("starts at zero for the first row", () => {
    expect(nextDisplayOrder([])).toBe(0)
  })

  it("treats a missing display_order as zero", () => {
    expect(nextDisplayOrder([{ id: "h1", name: "A" }])).toBe(1)
  })
})
