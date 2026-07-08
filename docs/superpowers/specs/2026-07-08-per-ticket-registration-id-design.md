# Per-Ticket-Type Registration ID Format

## Problem

Registration ID formatting is currently event-level only: `event_settings` holds one
`customize_registration_id` / `registration_prefix` / `registration_start_number` /
`registration_suffix` / `current_registration_number` set for delegates, plus a parallel
`faculty_registration_*` set that's a special-cased second scope for faculty/speaker
registrations. There's no way for an admin to give an individual ticket type (e.g. "VIP",
"Workshop Add-on") its own numbering scheme; the faculty split is the only exception, and
it's hardcoded rather than a general mechanism.

Separately: the Registration Settings page silently shows blank/default fields when its
`GET /api/event-settings` call 403s, which reads as "my saved format got wiped" even
though the underlying data and live number generation are untouched. This is a real bug,
found while investigating this feature, and is fixed as part of this work.

## Goal

Let any ticket type optionally define its own registration ID format (prefix / starting
number / suffix), with a per-ticket-type toggle to opt out and fall back to the event's
default format — generalizing the existing faculty/delegate split into a single mechanism
that applies to any ticket type, not just "faculty."

## Non-goals

- No generic "numbering scope" system beyond event and ticket-type levels (no forms, no
  per-session numbering, etc.) — YAGNI until a concrete need appears.
- No change to how registration numbers are formatted internally (`${prefix}${number}${suffix}`)
  — only *where* the prefix/number/suffix/counter come from changes.
- No UI redesign of the existing Registration ID Format block — it's reused as-is, just
  parameterized by scope (event vs. ticket type).

## Design

### Data model

Add five columns to `ticket_types`, identical in shape and semantics to the existing
`event_settings` columns:

```sql
ALTER TABLE ticket_types
  ADD COLUMN customize_registration_id BOOLEAN DEFAULT false,
  ADD COLUMN registration_prefix TEXT,
  ADD COLUMN registration_start_number INT DEFAULT 1,
  ADD COLUMN registration_suffix TEXT,
  ADD COLUMN current_registration_number INT DEFAULT 0;
```

Rationale for mirroring the existing column set (rather than a new join table or a fully
generic scoped-numbering table): this is exactly the pattern the codebase already used
once, to bolt the faculty scope onto `event_settings`. Reusing it keeps the mental model
consistent, needs no new table/join, and is the smallest change that fully solves the
stated problem. A join table would save a handful of nullable columns on rows that never
customize, which isn't worth the added query complexity. A fully generic scoped-numbering
table (event, ticket, and future scopes uniformly) is more extensible but is speculative
scope for a need that doesn't exist yet, and would mean retiring/migrating the currently-
working `faculty_registration_*` columns in one shot, raising regression risk for no
present benefit.

### Generation logic

`src/lib/services/registration-number.ts`:

- `getNextRegistrationNumber(supabase, event_id, ticket_type_id)` gains a `ticket_type_id`
  parameter (optional — callers that don't have one yet, e.g. pre-ticket-selection flows,
  keep today's event-default behavior).
  - If `ticket_type_id` is provided: read that row's `customize_registration_id`. If true,
    atomically increment and format using the ticket type's own
    prefix/start/suffix/counter — same atomic-increment logic already used for
    `event_settings`, just scoped to `ticket_types`.
  - Otherwise (no ticket type, or its toggle is off): fall back to the existing
    `event_settings`-driven logic, unchanged.
- `getNextFacultyRegistrationNumber(supabase, event_id)` becomes a thin compatibility
  wrapper: look up the event's "Speaker"/"Faculty"-named ticket type (same lookup already
  done in `create-speaker-registrations/route.ts`); if that ticket type has been migrated
  (`customize_registration_id = true`), delegate to the new ticket-scoped path; otherwise
  fall back to the existing `faculty_registration_*` event-level path unchanged. This means
  every existing caller of `getNextFacultyRegistrationNumber` keeps working with zero
  changes to their call sites.

### Migration / backfill

One-time backfill (SQL, run once per environment): for every event where
`event_settings.faculty_registration_prefix` is set, find that event's "Speaker"/"Faculty"-
named ticket type (`ticket_types` where `name ILIKE '%speaker%' OR name ILIKE '%faculty%'`
and `event_id` matches) and copy `faculty_registration_prefix` →
`registration_prefix`, `faculty_registration_start_number` → `registration_start_number`,
`faculty_registration_suffix` → `registration_suffix`, `current_faculty_registration_number`
→ `current_registration_number`, and set `customize_registration_id = true` on that ticket
type row. `event_settings.faculty_registration_*` columns are left in place (not dropped)
as the fallback path for any event where no matching ticket type is found.

All other ticket types default to `customize_registration_id = false` — identical to
today's behavior (event default format applies).

### Collision safety

Each ticket type with customization on gets an independent counter. If two ticket types in
the same event are given the same prefix (or a ticket type's prefix matches the event
default prefix), their independently-incrementing counters can produce the same formatted
registration number, which is a real correctness problem given `registrations.registration_number`
is unique per event.

The ticket type save API validates on write: if the submitted prefix (non-empty) matches
another ticket type's custom prefix within the same event, reject the save with a clear
error naming the conflicting ticket type. If the event itself has `customize_registration_id
= true` (a real configured prefix, not the system `REG-DATE-XXXX` default), the submitted
prefix is checked against that too. The system default format is date-based and generated
on a different path, so it cannot collide with a ticket-type prefix by construction and is
excluded from the check.

### UI

- The ticket type create/edit screen gains a "Custom Registration ID" section — the exact
  same toggle / Prefix / Starting Number / Suffix / live "Next ID: ..." preview component
  used today on the event Registration Settings page, reused and parameterized by scope
  (`event_settings` vs. a specific `ticket_types` row).
- The existing event-level Registration ID Format section is relabeled "Default Registration
  ID Format" with a subtext: "Used for any ticket type that doesn't set its own format
  below," to make the fallback relationship explicit.
- Bug fix: both `src/app/events/[eventId]/registrations/settings/page.tsx` and the
  duplicate implementation in `src/app/events/[eventId]/settings/attendees-buyers/page.tsx`
  get `isError` handling on their `event_settings` fetch — on failure, show a visible error
  banner ("Couldn't load registration settings — you may not have access to this event")
  instead of silently rendering blank/default fields. This is what caused the "saved format
  disappeared" report; the underlying data was never touched.

## Testing

- Unit-level: `getNextRegistrationNumber` with a ticket type that has customization on,
  off, and with no `ticket_type_id` passed at all (legacy call sites).
- Migration: run the backfill against a copy of an event with faculty numbering configured;
  confirm the target ticket type row matches the old `faculty_registration_*` values and
  that newly-generated numbers are unchanged from before migration.
- Collision validation: attempt to save two ticket types in the same event with the same
  custom prefix; confirm the second save is rejected with a clear message.
- UI: simulate a 403 from `GET /api/event-settings` (e.g. temporarily revoke access) and
  confirm the settings page shows an error banner rather than blank fields.
