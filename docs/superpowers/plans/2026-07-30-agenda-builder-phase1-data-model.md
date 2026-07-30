# Agenda Builder Phase 1: Data Model & Module Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the backend foundation for the multi-event Agenda Builder — halls as a real entity, tracks reconciled with `sessions.specialty_track`, per-event capability toggles, session-level check-in reusing the existing kiosk infrastructure, and an approval/publish lifecycle — all additive to the live `sessions`/`tracks`/`faculty_assignments`/`checkin_lists` schema that 20+ events already depend on.

**Architecture:** Five additive SQL migrations (committed, not applied — see Global Constraints), two idempotent backfill scripts with a dry-run default, four pure/testable TypeScript logic modules (`src/lib/agenda-*.ts`, following the existing `src/lib/kiosk-list-schedule.ts` pattern of framework-free functions with colocated vitest tests), and five Next.js API routes wiring that logic to the database via `createAdminClient()` + `requireEventAndPermission()`.

**Tech Stack:** Next.js 16 App Router API routes, Supabase (Postgres + supabase-js), TypeScript, vitest, zod.

## Global Constraints

- **No migration in this plan is applied to the database.** Per this repo's standing policy (CLAUDE.md, "Migration Pipeline — Known Debt"), no migration is applied via Supabase MCP or SQL editor without explicit user go-ahead, and each additional MCP-apply request is treated with scepticism even with prior go-ahead. Every migration task in this plan ends at "written, committed, not applied." Applying them is a separate, later, explicitly-approved action outside this plan.
- Every migration is additive only: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, safe defaults (`false`/`null`). No existing column is dropped, renamed, or has its type changed.
- Migration filenames follow this repo's `YYYYMMDD_description.sql` convention (`supabase/migrations/`).
- All new API routes gate on `requireEventAndPermission(eventId, 'program')` from `src/lib/auth/api-auth.ts:457` — the existing `Permission` union (`src/lib/auth/api-auth.ts:447`) already includes `'program'`.
- All new API routes use `createAdminClient()` from `src/lib/supabase/server.ts` (never a route-local service-role client), per this repo's established convention.
- Pure logic modules (`src/lib/agenda-*.ts`) take plain data as arguments and return plain data — no Supabase client, no I/O — so they're unit-testable without a database, matching `src/lib/kiosk-list-schedule.ts`.
- Test runner: `vitest` (`npx vitest run <path>` or `npm test -- <path>`). Test files are colocated (`foo.ts` + `foo.test.ts`), per existing convention (`src/lib/kiosk-list-schedule.test.ts`, `src/lib/checkin-time-window.test.ts`).

---

### Task 1: Migration — `halls` table

**Files:**
- Create: `supabase/migrations/20260730_agenda_builder_halls.sql`

**Interfaces:**
- Produces: table `halls(id, event_id, name, capacity, floor, display_order, created_at, updated_at)`; columns `sessions.hall_id`, `hall_coordinators.hall_id` (both nullable FK → `halls.id`).

- [ ] **Step 1: Write the migration file**

```sql
-- Agenda Builder Phase 1: halls become a real entity instead of free-text
-- sessions.hall. Additive only -- do NOT apply until explicit user go-ahead
-- (see CLAUDE.md's migration pipeline section). Backfill of existing halls
-- happens via scripts/agenda-backfill-halls.mjs, run separately after this
-- migration is applied -- not part of this file.
-- See docs/superpowers/specs/2026-07-30-agenda-builder-data-model-design.md

create table if not exists halls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  capacity integer,
  floor text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_halls_event on halls(event_id);

alter table sessions add column if not exists hall_id uuid references halls(id);
alter table hall_coordinators add column if not exists hall_id uuid references halls(id);
```

- [ ] **Step 2: Verify idempotency guards are present**

Run: `grep -c "if not exists" supabase/migrations/20260730_agenda_builder_halls.sql`
Expected: `4` (one `create table`, one `create index`, two `add column`)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260730_agenda_builder_halls.sql
git commit -m "feat(agenda): add halls table migration (not applied)"
```

---

### Task 2: Migration — tracks reconciliation

**Files:**
- Create: `supabase/migrations/20260730_agenda_builder_tracks.sql`

**Interfaces:**
- Produces: column `sessions.track_id` (nullable FK → `tracks.id`).

- [ ] **Step 1: Write the migration file**

```sql
-- Agenda Builder Phase 1: reconcile sessions.specialty_track (free text)
-- with the existing tracks table. Additive only -- do NOT apply until
-- explicit user go-ahead. Backfill via scripts/agenda-backfill-tracks.mjs,
-- run separately after this migration is applied.
-- See docs/superpowers/specs/2026-07-30-agenda-builder-data-model-design.md

alter table sessions add column if not exists track_id uuid references tracks(id);
```

- [ ] **Step 2: Verify idempotency guard is present**

Run: `grep -c "if not exists" supabase/migrations/20260730_agenda_builder_tracks.sql`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260730_agenda_builder_tracks.sql
git commit -m "feat(agenda): add sessions.track_id migration (not applied)"
```

---

### Task 3: Migration — `agenda_settings` table

**Files:**
- Create: `supabase/migrations/20260730_agenda_builder_settings.sql`

**Interfaces:**
- Produces: table `agenda_settings(event_id pk, enable_session_checkin, enable_session_registration, enable_capacity_limits, enable_feedback, enable_attendance_points, enable_certificates, enable_virtual_delivery, enable_public_programme, created_at, updated_at)`.

- [ ] **Step 1: Write the migration file**

```sql
-- Agenda Builder Phase 1: per-event capability toggles, kept separate from
-- the already-large event_settings table. All-false defaults -- creating
-- this row has zero behavioral effect on any existing event until a
-- coordinator explicitly turns something on. Additive only -- do NOT apply
-- until explicit user go-ahead.
-- See docs/superpowers/specs/2026-07-30-agenda-builder-data-model-design.md

create table if not exists agenda_settings (
  event_id uuid primary key references events(id) on delete cascade,
  enable_session_checkin boolean not null default false,
  enable_session_registration boolean not null default false,
  enable_capacity_limits boolean not null default false,
  enable_feedback boolean not null default false,
  enable_attendance_points boolean not null default false,
  enable_certificates boolean not null default false,
  enable_virtual_delivery boolean not null default false,
  enable_public_programme boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 2: Verify idempotency guard is present**

Run: `grep -c "if not exists" supabase/migrations/20260730_agenda_builder_settings.sql`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260730_agenda_builder_settings.sql
git commit -m "feat(agenda): add agenda_settings table migration (not applied)"
```

---

### Task 4: Migration — session-level check-in linkage

**Files:**
- Create: `supabase/migrations/20260730_agenda_builder_session_checkin.sql`

**Interfaces:**
- Produces: column `sessions.checkin_enabled` (boolean, default false); column `checkin_lists.session_id` (nullable FK → `sessions.id`); widened `checkin_lists_list_purpose_check` constraint to allow `'session'`.

- [ ] **Step 1: Write the migration file**

```sql
-- Agenda Builder Phase 1: session-level check-in, reusing the existing
-- checkin_lists / kiosk_station_lists scheduling machinery rather than
-- forking it. Additive only, default false -- do NOT apply until explicit
-- user go-ahead.
-- See docs/superpowers/specs/2026-07-30-agenda-builder-data-model-design.md

alter table sessions add column if not exists checkin_enabled boolean not null default false;

alter table checkin_lists add column if not exists session_id uuid references sessions(id) on delete cascade;

alter table checkin_lists drop constraint if exists checkin_lists_list_purpose_check;
alter table checkin_lists add constraint checkin_lists_list_purpose_check
  check (list_purpose in ('entry', 'collection', 'session'));
```

- [ ] **Step 2: Verify the constraint widening and column guards are present**

Run: `grep -c "if not exists" supabase/migrations/20260730_agenda_builder_session_checkin.sql && grep -c "'session'" supabase/migrations/20260730_agenda_builder_session_checkin.sql`
Expected: `2` then `1`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260730_agenda_builder_session_checkin.sql
git commit -m "feat(agenda): add session check-in linkage migration (not applied)"
```

---

### Task 5: Migration — `agenda_approval_log` table

**Files:**
- Create: `supabase/migrations/20260730_agenda_builder_approval_log.sql`

**Interfaces:**
- Produces: table `agenda_approval_log(id, event_id, action, actor_user_id, comment, created_at)`.

- [ ] **Step 1: Write the migration file**

```sql
-- Agenda Builder Phase 1: append-only approval/publish lifecycle log.
-- Current lifecycle state is derived from the most recent row (see
-- src/lib/agenda-approval-state.ts), never stored redundantly. Additive
-- only -- do NOT apply until explicit user go-ahead.
-- See docs/superpowers/specs/2026-07-30-agenda-builder-data-model-design.md

create table if not exists agenda_approval_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  action text not null check (action in ('submitted', 'approved', 'changes_requested', 'published')),
  actor_user_id uuid not null references users(id),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists idx_agenda_approval_log_event on agenda_approval_log(event_id, created_at desc);
```

- [ ] **Step 2: Verify idempotency guards are present**

Run: `grep -c "if not exists" supabase/migrations/20260730_agenda_builder_approval_log.sql`
Expected: `2`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260730_agenda_builder_approval_log.sql
git commit -m "feat(agenda): add agenda_approval_log table migration (not applied)"
```

---

### Task 6: Backfill script — halls

**Files:**
- Create: `scripts/agenda-backfill-halls.mjs`

**Interfaces:**
- Consumes: `sessions.hall` (existing text column, readable today without any migration), `sessions.hall_id` (only writable once Task 1's migration is applied).
- Produces: none consumed by other tasks — this is a standalone operational script.

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
/**
 * Agenda Builder Phase 1 backfill: creates one `halls` row per distinct
 * `sessions.hall` text value (per event) and links `sessions.hall_id` to it.
 *
 * Read-only by default (dry run). Pass --commit to actually write.
 * --commit requires supabase/migrations/20260730_agenda_builder_halls.sql
 * to already be applied -- it will fail loudly (missing column/table) if not.
 *
 * Usage:
 *   node scripts/agenda-backfill-halls.mjs                # dry run, all events
 *   node scripts/agenda-backfill-halls.mjs --event <id>   # dry run, one event
 *   node scripts/agenda-backfill-halls.mjs --commit        # actually write
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const args = process.argv.slice(2)
const commit = args.includes('--commit')
const eventIdArg = args.includes('--event') ? args[args.indexOf('--event') + 1] : null

async function getEventIds() {
  if (eventIdArg) return [eventIdArg]
  const { data, error } = await supabase.from('events').select('id')
  if (error) throw error
  return data.map((e) => e.id)
}

async function backfillEvent(eventId) {
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, hall, hall_id')
    .eq('event_id', eventId)
    .not('hall', 'is', null)
  if (sessionsError) throw sessionsError
  if (!sessions.length) return { eventId, hallsCreated: 0, sessionsLinked: 0 }

  const distinctHallNames = [...new Set(sessions.map((s) => s.hall.trim()).filter(Boolean))]

  const { data: existingHalls, error: existingHallsError } = await supabase
    .from('halls')
    .select('id, name')
    .eq('event_id', eventId)
  if (existingHallsError) throw existingHallsError

  const nameToHallId = new Map(existingHalls.map((h) => [h.name, h.id]))
  const namesToCreate = distinctHallNames.filter((name) => !nameToHallId.has(name))

  console.log(`[${eventId}] ${distinctHallNames.length} distinct hall names, ${namesToCreate.length} to create`)

  if (commit && namesToCreate.length) {
    const { data: created, error: createError } = await supabase
      .from('halls')
      .insert(namesToCreate.map((name, i) => ({ event_id: eventId, name, display_order: i })))
      .select('id, name')
    if (createError) throw createError
    for (const h of created) nameToHallId.set(h.name, h.id)
  }

  const sessionsToLink = sessions.filter((s) => !s.hall_id && s.hall && nameToHallId.has(s.hall.trim()))
  console.log(`[${eventId}] ${sessionsToLink.length} sessions to link to a hall_id`)

  if (commit) {
    for (const session of sessionsToLink) {
      const hallId = nameToHallId.get(session.hall.trim())
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ hall_id: hallId })
        .eq('id', session.id)
      if (updateError) throw updateError
    }
  }

  return { eventId, hallsCreated: namesToCreate.length, sessionsLinked: sessionsToLink.length }
}

async function main() {
  console.log(commit ? 'Running in COMMIT mode' : 'Running in DRY-RUN mode (pass --commit to write)')
  const eventIds = await getEventIds()
  const results = []
  for (const eventId of eventIds) {
    results.push(await backfillEvent(eventId))
  }
  const totals = results.reduce(
    (acc, r) => ({ hallsCreated: acc.hallsCreated + r.hallsCreated, sessionsLinked: acc.sessionsLinked + r.sessionsLinked }),
    { hallsCreated: 0, sessionsLinked: 0 }
  )
  console.log(`\nTotal: ${totals.hallsCreated} halls, ${totals.sessionsLinked} sessions linked across ${eventIds.length} events`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Run in dry-run mode against a real event to verify it reports sane counts**

Run: `node scripts/agenda-backfill-halls.mjs --event c11fe702-404c-4473-928d-eb8d8536a897`
Expected: prints `Running in DRY-RUN mode...`, then a line like `[c11fe702-...] N distinct hall names, N to create` and `... sessions to link to a hall_id` with `N` roughly matching the number of distinct halls used by AMASICON 2026's 150 sessions (this event has 150 sessions per the audit; expect a handful of distinct hall names, not zero and not 150). This is read-only — safe to run against production, since it does not write when `--commit` is absent, and `halls`/`hall_id` don't exist yet regardless.

- [ ] **Step 3: Commit**

```bash
git add scripts/agenda-backfill-halls.mjs
git commit -m "feat(agenda): add halls backfill script (dry-run verified, not committed to DB)"
```

---

### Task 7: Backfill script — tracks

**Files:**
- Create: `scripts/agenda-backfill-tracks.mjs`

**Interfaces:**
- Consumes: `sessions.specialty_track` (existing), `tracks.name` (existing), `sessions.track_id` (only writable once Task 2's migration is applied).

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
/**
 * Agenda Builder Phase 1 backfill: matches sessions.specialty_track (free
 * text) against existing tracks.name (case-insensitive) within the same
 * event, creating a new track row when nothing matches, and links
 * sessions.track_id.
 *
 * Read-only by default (dry run). Pass --commit to actually write.
 * --commit requires supabase/migrations/20260730_agenda_builder_tracks.sql
 * to already be applied.
 *
 * Usage:
 *   node scripts/agenda-backfill-tracks.mjs
 *   node scripts/agenda-backfill-tracks.mjs --event <id>
 *   node scripts/agenda-backfill-tracks.mjs --commit
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const args = process.argv.slice(2)
const commit = args.includes('--commit')
const eventIdArg = args.includes('--event') ? args[args.indexOf('--event') + 1] : null

async function getEventIds() {
  if (eventIdArg) return [eventIdArg]
  const { data, error } = await supabase.from('events').select('id')
  if (error) throw error
  return data.map((e) => e.id)
}

async function backfillEvent(eventId) {
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, specialty_track, track_id')
    .eq('event_id', eventId)
    .not('specialty_track', 'is', null)
  if (sessionsError) throw sessionsError
  if (!sessions.length) return { eventId, tracksCreated: 0, sessionsLinked: 0 }

  const distinctTrackNames = [...new Set(sessions.map((s) => s.specialty_track.trim()).filter(Boolean))]

  const { data: existingTracks, error: existingTracksError } = await supabase
    .from('tracks')
    .select('id, name')
    .eq('event_id', eventId)
  if (existingTracksError) throw existingTracksError

  const lowerNameToTrackId = new Map(existingTracks.map((t) => [t.name.toLowerCase(), t.id]))
  const namesToCreate = distinctTrackNames.filter((name) => !lowerNameToTrackId.has(name.toLowerCase()))

  console.log(`[${eventId}] ${distinctTrackNames.length} distinct specialty_track values, ${namesToCreate.length} to create`)

  if (commit && namesToCreate.length) {
    const { data: created, error: createError } = await supabase
      .from('tracks')
      .insert(namesToCreate.map((name) => ({ event_id: eventId, name })))
      .select('id, name')
    if (createError) throw createError
    for (const t of created) lowerNameToTrackId.set(t.name.toLowerCase(), t.id)
  }

  const sessionsToLink = sessions.filter(
    (s) => !s.track_id && s.specialty_track && lowerNameToTrackId.has(s.specialty_track.trim().toLowerCase())
  )
  console.log(`[${eventId}] ${sessionsToLink.length} sessions to link to a track_id`)

  if (commit) {
    for (const session of sessionsToLink) {
      const trackId = lowerNameToTrackId.get(session.specialty_track.trim().toLowerCase())
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ track_id: trackId })
        .eq('id', session.id)
      if (updateError) throw updateError
    }
  }

  return { eventId, tracksCreated: namesToCreate.length, sessionsLinked: sessionsToLink.length }
}

async function main() {
  console.log(commit ? 'Running in COMMIT mode' : 'Running in DRY-RUN mode (pass --commit to write)')
  const eventIds = await getEventIds()
  const results = []
  for (const eventId of eventIds) {
    results.push(await backfillEvent(eventId))
  }
  const totals = results.reduce(
    (acc, r) => ({ tracksCreated: acc.tracksCreated + r.tracksCreated, sessionsLinked: acc.sessionsLinked + r.sessionsLinked }),
    { tracksCreated: 0, sessionsLinked: 0 }
  )
  console.log(`\nTotal: ${totals.tracksCreated} tracks, ${totals.sessionsLinked} sessions linked across ${eventIds.length} events`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Run in dry-run mode against a real event to verify it reports sane counts**

Run: `node scripts/agenda-backfill-tracks.mjs --event 8e497ba9-f83b-4a66-9be5-1714f0d8669b`
Expected: prints `Running in DRY-RUN mode...`, then a line reporting distinct `specialty_track` values against this event's existing 13 `tracks` rows (126 FMAS Delhi, per the audit) — a plausible partial overlap, not "0 to create" and not "13 to create" for every session.

- [ ] **Step 3: Commit**

```bash
git add scripts/agenda-backfill-tracks.mjs
git commit -m "feat(agenda): add tracks backfill script (dry-run verified, not committed to DB)"
```

---

### Task 8: `agenda-conflicts.ts` — double-booking detection

**Files:**
- Create: `src/lib/agenda-conflicts.ts`
- Test: `src/lib/agenda-conflicts.test.ts`

**Interfaces:**
- Produces: `ConflictSession`, `FacultyAssignmentRow`, `Conflict` types; `findHallDoubleBookings(sessions)`, `findFacultyDoubleBookings(sessions, assignments)` — both used by Task 9's aggregator and Task 14's API route.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from "vitest"
import { findHallDoubleBookings, findFacultyDoubleBookings, type ConflictSession, type FacultyAssignmentRow } from "./agenda-conflicts"

const session = (overrides: Partial<ConflictSession>): ConflictSession => ({
  id: "s1",
  session_name: "Untitled",
  session_date: "2026-08-15",
  start_time: "09:00",
  end_time: "10:00",
  hall_id: "hall-a",
  ...overrides,
})

describe("findHallDoubleBookings", () => {
  it("flags two sessions overlapping in the same hall", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00", hall_id: "hall-a" })
    const s2 = session({ id: "s2", start_time: "09:30", end_time: "10:30", hall_id: "hall-a" })
    const conflicts = findHallDoubleBookings([s1, s2])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].type).toBe("hall_double_booking")
    expect(conflicts[0].severity).toBe("blocking")
    expect(conflicts[0].session_ids.sort()).toEqual(["s1", "s2"])
  })

  it("does not flag sessions in different halls at the same time", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00", hall_id: "hall-a" })
    const s2 = session({ id: "s2", start_time: "09:00", end_time: "10:00", hall_id: "hall-b" })
    expect(findHallDoubleBookings([s1, s2])).toHaveLength(0)
  })

  it("does not flag back-to-back sessions in the same hall", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00", hall_id: "hall-a" })
    const s2 = session({ id: "s2", start_time: "10:00", end_time: "11:00", hall_id: "hall-a" })
    expect(findHallDoubleBookings([s1, s2])).toHaveLength(0)
  })

  it("ignores sessions with no hall_id", () => {
    const s1 = session({ id: "s1", hall_id: null })
    const s2 = session({ id: "s2", hall_id: null })
    expect(findHallDoubleBookings([s1, s2])).toHaveLength(0)
  })

  it("ignores overlaps on different days", () => {
    const s1 = session({ id: "s1", session_date: "2026-08-15" })
    const s2 = session({ id: "s2", session_date: "2026-08-16" })
    expect(findHallDoubleBookings([s1, s2])).toHaveLength(0)
  })
})

describe("findFacultyDoubleBookings", () => {
  const assignment = (overrides: Partial<FacultyAssignmentRow>): FacultyAssignmentRow => ({
    session_id: "s1",
    faculty_id: "fac-1",
    faculty_name: "Dr. Test",
    status: "confirmed",
    ...overrides,
  })

  it("flags a faculty member double-booked across halls as a warning, not a block", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00", hall_id: "hall-a" })
    const s2 = session({ id: "s2", start_time: "09:30", end_time: "10:30", hall_id: "hall-b" })
    const assignments = [
      assignment({ session_id: "s1", faculty_id: "fac-1" }),
      assignment({ session_id: "s2", faculty_id: "fac-1" }),
    ]
    const conflicts = findFacultyDoubleBookings([s1, s2], assignments)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].type).toBe("faculty_double_booking")
    expect(conflicts[0].severity).toBe("warning")
  })

  it("does not flag two different faculty members in overlapping sessions", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00", hall_id: "hall-a" })
    const s2 = session({ id: "s2", start_time: "09:30", end_time: "10:30", hall_id: "hall-b" })
    const assignments = [
      assignment({ session_id: "s1", faculty_id: "fac-1" }),
      assignment({ session_id: "s2", faculty_id: "fac-2" }),
    ]
    expect(findFacultyDoubleBookings([s1, s2], assignments)).toHaveLength(0)
  })

  it("ignores assignments with no faculty_id (unresolved free-text speaker)", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00" })
    const s2 = session({ id: "s2", start_time: "09:30", end_time: "10:30" })
    const assignments = [
      assignment({ session_id: "s1", faculty_id: null }),
      assignment({ session_id: "s2", faculty_id: null }),
    ]
    expect(findFacultyDoubleBookings([s1, s2], assignments)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/agenda-conflicts.test.ts`
Expected: FAIL — `Cannot find module './agenda-conflicts'`

- [ ] **Step 3: Write the implementation**

```typescript
// Pure, framework-free conflict detection for the Agenda Builder's
// Conflicts & Readiness screen (see docs/superpowers/specs/2026-07-30-
// agenda-builder-data-model-design.md, section 6). No database access --
// callers (API routes) fetch sessions/assignments and pass plain data in.

export interface ConflictSession {
  id: string
  session_name: string
  session_date: string | null
  start_time: string | null
  end_time: string | null
  hall_id: string | null
}

export interface FacultyAssignmentRow {
  session_id: string
  faculty_id: string | null
  faculty_name: string | null
  status: string
}

export type ConflictType =
  | "hall_double_booking"
  | "faculty_double_booking"
  | "no_speaker"
  | "unconfirmed_speaker"
  | "over_capacity"
  | "unscheduled"

export type ConflictSeverity = "blocking" | "warning"

export interface Conflict {
  type: ConflictType
  severity: ConflictSeverity
  session_ids: string[]
  message: string
}

function toMinutes(time: string | null): number | null {
  if (!time || !time.includes(":")) return null
  const [h, m] = time.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

function sessionsOverlap(a: ConflictSession, b: ConflictSession): boolean {
  if (!a.session_date || !b.session_date || a.session_date !== b.session_date) return false
  const aStart = toMinutes(a.start_time)
  const aEnd = toMinutes(a.end_time)
  const bStart = toMinutes(b.start_time)
  const bEnd = toMinutes(b.end_time)
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd)
}

export function findHallDoubleBookings(sessions: ConflictSession[]): Conflict[] {
  const conflicts: Conflict[] = []
  const withHall = sessions.filter((s) => s.hall_id)
  for (let i = 0; i < withHall.length; i++) {
    for (let j = i + 1; j < withHall.length; j++) {
      const a = withHall[i]
      const b = withHall[j]
      if (a.hall_id !== b.hall_id) continue
      if (!sessionsOverlap(a, b)) continue
      conflicts.push({
        type: "hall_double_booking",
        severity: "blocking",
        session_ids: [a.id, b.id],
        message: `"${a.session_name}" and "${b.session_name}" overlap in the same hall`,
      })
    }
  }
  return conflicts
}

export function findFacultyDoubleBookings(
  sessions: ConflictSession[],
  assignments: FacultyAssignmentRow[]
): Conflict[] {
  const sessionsById = new Map(sessions.map((s) => [s.id, s]))
  const sessionsByFaculty = new Map<string, string[]>()

  for (const a of assignments) {
    if (!a.faculty_id) continue
    if (!sessionsById.has(a.session_id)) continue
    const list = sessionsByFaculty.get(a.faculty_id) ?? []
    list.push(a.session_id)
    sessionsByFaculty.set(a.faculty_id, list)
  }

  const conflicts: Conflict[] = []
  for (const [, sessionIds] of sessionsByFaculty) {
    for (let i = 0; i < sessionIds.length; i++) {
      for (let j = i + 1; j < sessionIds.length; j++) {
        const a = sessionsById.get(sessionIds[i])!
        const b = sessionsById.get(sessionIds[j])!
        if (!sessionsOverlap(a, b)) continue
        conflicts.push({
          type: "faculty_double_booking",
          severity: "warning",
          session_ids: [a.id, b.id],
          message: `A faculty member is scheduled in both "${a.session_name}" and "${b.session_name}" at overlapping times`,
        })
      }
    }
  }
  return conflicts
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/agenda-conflicts.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/agenda-conflicts.ts src/lib/agenda-conflicts.test.ts
git commit -m "feat(agenda): add hall and faculty double-booking detection"
```

---

### Task 9: `agenda-conflicts.ts` — remaining checks + aggregator

**Files:**
- Modify: `src/lib/agenda-conflicts.ts` (append new exports)
- Modify: `src/lib/agenda-conflicts.test.ts` (append new tests)

**Interfaces:**
- Consumes: `ConflictSession`, `FacultyAssignmentRow`, `Conflict`, `sessionsOverlap` internals from Task 8 (same file).
- Produces: `findUnassignedSessions`, `findUnconfirmedSpeakers`, `HallCapacity`, `findOverCapacitySessions`, `findUnscheduledSessions`, `getAllConflicts` — `getAllConflicts` is consumed by Task 14's rewritten conflicts API route.

- [ ] **Step 1: Write the failing tests (append to the existing test file)**

```typescript
// Append to src/lib/agenda-conflicts.test.ts (add this import alongside the existing one)
import {
  findUnassignedSessions,
  findUnconfirmedSpeakers,
  findOverCapacitySessions,
  findUnscheduledSessions,
  getAllConflicts,
  type HallCapacity,
} from "./agenda-conflicts"

describe("findUnassignedSessions", () => {
  it("flags a session with no faculty_assignments row at all", () => {
    const s1 = session({ id: "s1" })
    expect(findUnassignedSessions([s1], [])).toHaveLength(1)
  })

  it("does not flag a session with at least one assignment", () => {
    const s1 = session({ id: "s1" })
    const assignments = [{ session_id: "s1", faculty_id: "fac-1", faculty_name: "Dr. Test", status: "confirmed" }]
    expect(findUnassignedSessions([s1], assignments)).toHaveLength(0)
  })
})

describe("findUnconfirmedSpeakers", () => {
  it("flags a session whose only assignment is not confirmed", () => {
    const s1 = session({ id: "s1" })
    const assignments = [{ session_id: "s1", faculty_id: "fac-1", faculty_name: "Dr. Test", status: "invited" }]
    expect(findUnconfirmedSpeakers([s1], assignments)).toHaveLength(1)
  })

  it("does not flag a session where every assignment is confirmed", () => {
    const s1 = session({ id: "s1" })
    const assignments = [{ session_id: "s1", faculty_id: "fac-1", faculty_name: "Dr. Test", status: "confirmed" }]
    expect(findUnconfirmedSpeakers([s1], assignments)).toHaveLength(0)
  })
})

describe("findOverCapacitySessions", () => {
  it("flags a session whose registered count exceeds its hall's capacity", () => {
    const s1 = { ...session({ id: "s1", hall_id: "hall-a" }), registeredCount: 250 }
    const halls: HallCapacity[] = [{ id: "hall-a", capacity: 200 }]
    expect(findOverCapacitySessions([s1], halls)).toHaveLength(1)
  })

  it("does not flag when under capacity or capacity is unset", () => {
    const s1 = { ...session({ id: "s1", hall_id: "hall-a" }), registeredCount: 150 }
    const s2 = { ...session({ id: "s2", hall_id: "hall-b" }), registeredCount: 9999 }
    const halls: HallCapacity[] = [{ id: "hall-a", capacity: 200 }, { id: "hall-b", capacity: null }]
    expect(findOverCapacitySessions([s1, s2], halls)).toHaveLength(0)
  })
})

describe("findUnscheduledSessions", () => {
  it("flags a session missing a hall, date, or time", () => {
    const s1 = session({ id: "s1", hall_id: null })
    const s2 = session({ id: "s2", session_date: null })
    const s3 = session({ id: "s3", start_time: null })
    expect(findUnscheduledSessions([s1, s2, s3])).toHaveLength(3)
  })

  it("does not flag a fully scheduled session", () => {
    const s1 = session({ id: "s1" })
    expect(findUnscheduledSessions([s1])).toHaveLength(0)
  })
})

describe("getAllConflicts", () => {
  it("aggregates all conflict types and counts blocking vs warning", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00", hall_id: "hall-a" })
    const s2 = session({ id: "s2", start_time: "09:30", end_time: "10:30", hall_id: "hall-a" })
    const result = getAllConflicts({
      sessions: [s1, s2].map((s) => ({ ...s, registeredCount: 0 })),
      assignments: [],
      halls: [{ id: "hall-a", capacity: null }],
    })
    expect(result.blockingCount).toBeGreaterThanOrEqual(1)
    expect(result.conflicts.some((c) => c.type === "hall_double_booking")).toBe(true)
    expect(result.conflicts.some((c) => c.type === "no_speaker")).toBe(true)
  })

  it("returns zero conflicts for a clean, fully-staffed, non-overlapping schedule", () => {
    const s1 = session({ id: "s1", start_time: "09:00", end_time: "10:00", hall_id: "hall-a" })
    const result = getAllConflicts({
      sessions: [{ ...s1, registeredCount: 0 }],
      assignments: [{ session_id: "s1", faculty_id: "fac-1", faculty_name: "Dr. Test", status: "confirmed" }],
      halls: [{ id: "hall-a", capacity: null }],
    })
    expect(result.conflicts).toHaveLength(0)
    expect(result.blockingCount).toBe(0)
    expect(result.warningCount).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/lib/agenda-conflicts.test.ts`
Expected: FAIL — `findUnassignedSessions is not a function` (and similarly for the other new exports)

- [ ] **Step 3: Append the implementation to `src/lib/agenda-conflicts.ts`**

```typescript
export function findUnassignedSessions(
  sessions: ConflictSession[],
  assignments: FacultyAssignmentRow[]
): Conflict[] {
  const sessionIdsWithAssignment = new Set(assignments.map((a) => a.session_id))
  return sessions
    .filter((s) => !sessionIdsWithAssignment.has(s.id))
    .map((s) => ({
      type: "no_speaker" as const,
      severity: "warning" as const,
      session_ids: [s.id],
      message: `"${s.session_name}" has no speaker assigned`,
    }))
}

export function findUnconfirmedSpeakers(
  sessions: ConflictSession[],
  assignments: FacultyAssignmentRow[]
): Conflict[] {
  const sessionsById = new Map(sessions.map((s) => [s.id, s]))
  const unconfirmedBySession = new Set(
    assignments.filter((a) => a.status !== "confirmed" && a.status !== "declined" && a.status !== "cancelled").map((a) => a.session_id)
  )
  return [...unconfirmedBySession]
    .filter((id) => sessionsById.has(id))
    .map((id) => ({
      type: "unconfirmed_speaker" as const,
      severity: "warning" as const,
      session_ids: [id],
      message: `"${sessionsById.get(id)!.session_name}" has a speaker who hasn't confirmed yet`,
    }))
}

export interface HallCapacity {
  id: string
  capacity: number | null
}

export function findOverCapacitySessions(
  sessions: (ConflictSession & { registeredCount: number })[],
  halls: HallCapacity[]
): Conflict[] {
  const capacityByHall = new Map(halls.map((h) => [h.id, h.capacity]))
  return sessions
    .filter((s) => {
      if (!s.hall_id) return false
      const capacity = capacityByHall.get(s.hall_id)
      return capacity != null && s.registeredCount > capacity
    })
    .map((s) => ({
      type: "over_capacity" as const,
      severity: "warning" as const,
      session_ids: [s.id],
      message: `"${s.session_name}" has ${s.registeredCount} registered against a hall capacity of ${capacityByHall.get(s.hall_id!)}`,
    }))
}

export function findUnscheduledSessions(sessions: ConflictSession[]): Conflict[] {
  return sessions
    .filter((s) => !s.hall_id || !s.session_date || !s.start_time || !s.end_time)
    .map((s) => ({
      type: "unscheduled" as const,
      severity: "warning" as const,
      session_ids: [s.id],
      message: `"${s.session_name}" is missing a hall, date, or time`,
    }))
}

export function getAllConflicts(input: {
  sessions: (ConflictSession & { registeredCount: number })[]
  assignments: FacultyAssignmentRow[]
  halls: HallCapacity[]
}): { conflicts: Conflict[]; blockingCount: number; warningCount: number } {
  const conflicts = [
    ...findHallDoubleBookings(input.sessions),
    ...findFacultyDoubleBookings(input.sessions, input.assignments),
    ...findUnassignedSessions(input.sessions, input.assignments),
    ...findUnconfirmedSpeakers(input.sessions, input.assignments),
    ...findOverCapacitySessions(input.sessions, input.halls),
    ...findUnscheduledSessions(input.sessions),
  ]
  return {
    conflicts,
    blockingCount: conflicts.filter((c) => c.severity === "blocking").length,
    warningCount: conflicts.filter((c) => c.severity === "warning").length,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/agenda-conflicts.test.ts`
Expected: PASS, 18 tests total

- [ ] **Step 5: Commit**

```bash
git add src/lib/agenda-conflicts.ts src/lib/agenda-conflicts.test.ts
git commit -m "feat(agenda): add remaining conflict checks and getAllConflicts aggregator"
```

---

### Task 10: `agenda-approval-state.ts`

**Files:**
- Create: `src/lib/agenda-approval-state.ts`
- Test: `src/lib/agenda-approval-state.test.ts`

**Interfaces:**
- Produces: `ApprovalLogRow`, `AgendaStatus`, `deriveAgendaStatus(log)`, `canSubmitForApproval(conflicts)`, `getLastApprovalTimestamp(log)` — all consumed by Task 15's approval API route.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from "vitest"
import { deriveAgendaStatus, canSubmitForApproval, getLastApprovalTimestamp, type ApprovalLogRow } from "./agenda-approval-state"

describe("deriveAgendaStatus", () => {
  it("is draft when the log is empty", () => {
    expect(deriveAgendaStatus([])).toBe("draft")
  })

  it("is submitted after a submitted action", () => {
    const log: ApprovalLogRow[] = [{ action: "submitted", created_at: "2026-08-01T00:00:00.000Z" }]
    expect(deriveAgendaStatus(log)).toBe("submitted")
  })

  it("is approved after an approved action", () => {
    const log: ApprovalLogRow[] = [
      { action: "submitted", created_at: "2026-08-01T00:00:00.000Z" },
      { action: "approved", created_at: "2026-08-02T00:00:00.000Z" },
    ]
    expect(deriveAgendaStatus(log)).toBe("approved")
  })

  it("falls back to draft after changes_requested, even if approved earlier", () => {
    const log: ApprovalLogRow[] = [
      { action: "approved", created_at: "2026-08-01T00:00:00.000Z" },
      { action: "changes_requested", created_at: "2026-08-02T00:00:00.000Z" },
    ]
    expect(deriveAgendaStatus(log)).toBe("draft")
  })

  it("is published after a published action", () => {
    const log: ApprovalLogRow[] = [
      { action: "approved", created_at: "2026-08-01T00:00:00.000Z" },
      { action: "published", created_at: "2026-08-02T00:00:00.000Z" },
    ]
    expect(deriveAgendaStatus(log)).toBe("published")
  })

  it("uses the most recent row regardless of array order", () => {
    const log: ApprovalLogRow[] = [
      { action: "published", created_at: "2026-08-02T00:00:00.000Z" },
      { action: "approved", created_at: "2026-08-01T00:00:00.000Z" },
    ]
    expect(deriveAgendaStatus(log)).toBe("published")
  })
})

describe("canSubmitForApproval", () => {
  it("is true when there are no blocking conflicts", () => {
    expect(canSubmitForApproval([{ severity: "warning" }])).toBe(true)
    expect(canSubmitForApproval([])).toBe(true)
  })

  it("is false when any conflict is blocking", () => {
    expect(canSubmitForApproval([{ severity: "warning" }, { severity: "blocking" }])).toBe(false)
  })
})

describe("getLastApprovalTimestamp", () => {
  it("returns null when never approved or published", () => {
    const log: ApprovalLogRow[] = [{ action: "submitted", created_at: "2026-08-01T00:00:00.000Z" }]
    expect(getLastApprovalTimestamp(log)).toBeNull()
  })

  it("returns the timestamp of the most recent approved or published row", () => {
    const log: ApprovalLogRow[] = [
      { action: "approved", created_at: "2026-08-01T00:00:00.000Z" },
      { action: "published", created_at: "2026-08-03T00:00:00.000Z" },
      { action: "submitted", created_at: "2026-08-02T00:00:00.000Z" },
    ]
    expect(getLastApprovalTimestamp(log)).toBe("2026-08-03T00:00:00.000Z")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/agenda-approval-state.test.ts`
Expected: FAIL — `Cannot find module './agenda-approval-state'`

- [ ] **Step 3: Write the implementation**

```typescript
// Pure derivation of the Agenda Builder's approval/publish lifecycle state
// from an append-only log (agenda_approval_log). See docs/superpowers/specs/
// 2026-07-30-agenda-builder-data-model-design.md, section 7. No database
// access -- the caller (API route) fetches the log rows and passes them in.

export interface ApprovalLogRow {
  action: "submitted" | "approved" | "changes_requested" | "published"
  created_at: string
}

export type AgendaStatus = "draft" | "submitted" | "approved" | "published"

function mostRecent(log: ApprovalLogRow[]): ApprovalLogRow | null {
  if (log.length === 0) return null
  return [...log].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
}

export function deriveAgendaStatus(log: ApprovalLogRow[]): AgendaStatus {
  const latest = mostRecent(log)
  if (!latest) return "draft"
  switch (latest.action) {
    case "submitted":
      return "submitted"
    case "approved":
      return "approved"
    case "published":
      return "published"
    case "changes_requested":
      return "draft"
  }
}

export function canSubmitForApproval(conflicts: { severity: "blocking" | "warning" }[]): boolean {
  return !conflicts.some((c) => c.severity === "blocking")
}

export function getLastApprovalTimestamp(log: ApprovalLogRow[]): string | null {
  const approvalRows = log.filter((row) => row.action === "approved" || row.action === "published")
  const latest = mostRecent(approvalRows)
  return latest ? latest.created_at : null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/agenda-approval-state.test.ts`
Expected: PASS, 11 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/agenda-approval-state.ts src/lib/agenda-approval-state.test.ts
git commit -m "feat(agenda): add approval lifecycle state derivation"
```

---

### Task 11: `agenda-session-checkin-window.ts`

**Files:**
- Create: `src/lib/agenda-session-checkin-window.ts`
- Test: `src/lib/agenda-session-checkin-window.test.ts`

**Interfaces:**
- Produces: `CheckinWindowSession`, `computeSessionCheckinWindow(session, timezone, graceMinutes?)` — consumed by Task 16's session PATCH route to compute `checkin_lists.kiosk_opens_at`/`kiosk_closes_at`.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from "vitest"
import { computeSessionCheckinWindow } from "./agenda-session-checkin-window"

describe("computeSessionCheckinWindow", () => {
  it("converts a session's local date/time in Asia/Kolkata (UTC+5:30, no DST) to UTC with a 15-minute default grace buffer", () => {
    const result = computeSessionCheckinWindow(
      { session_date: "2026-08-15", start_time: "09:00", end_time: "10:00" },
      "Asia/Kolkata"
    )
    // 09:00 IST = 03:30 UTC; opens 15 min early = 03:15 UTC
    expect(result.opensAt).toBe("2026-08-15T03:15:00.000Z")
    // 10:00 IST = 04:30 UTC; closes 15 min late = 04:45 UTC
    expect(result.closesAt).toBe("2026-08-15T04:45:00.000Z")
  })

  it("respects a custom grace buffer", () => {
    const result = computeSessionCheckinWindow(
      { session_date: "2026-08-15", start_time: "09:00", end_time: "10:00" },
      "Asia/Kolkata",
      30
    )
    expect(result.opensAt).toBe("2026-08-15T03:00:00.000Z")
    expect(result.closesAt).toBe("2026-08-15T05:00:00.000Z")
  })

  it("works for UTC directly (zero offset)", () => {
    const result = computeSessionCheckinWindow(
      { session_date: "2026-08-15", start_time: "09:00", end_time: "10:00" },
      "UTC",
      0
    )
    expect(result.opensAt).toBe("2026-08-15T09:00:00.000Z")
    expect(result.closesAt).toBe("2026-08-15T10:00:00.000Z")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/agenda-session-checkin-window.test.ts`
Expected: FAIL — `Cannot find module './agenda-session-checkin-window'`

- [ ] **Step 3: Write the implementation**

```typescript
// Pure computation of a session's check-in window (opens_at/closes_at) for
// auto-provisioning its checkin_lists row. See docs/superpowers/specs/
// 2026-07-30-agenda-builder-data-model-design.md, section 5.
//
// events.timezone is an IANA zone string (e.g. "Asia/Kolkata"), but
// sessions.session_date/start_time/end_time are naive local wall-clock
// values with no offset of their own. This resolves the IANA zone's UTC
// offset at the session's own instant using only the built-in Intl API --
// no new date-library dependency -- so it correctly handles any zone this
// system already stores, DST-observing or not.

export interface CheckinWindowSession {
  session_date: string // "YYYY-MM-DD"
  start_time: string // "HH:MM"
  end_time: string // "HH:MM"
}

function getTimezoneOffsetMinutes(timeZone: string, utcGuess: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const parts = Object.fromEntries(dtf.formatToParts(utcGuess).map((p) => [p.type, p.value]))
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )
  return (asIfUtc - utcGuess.getTime()) / 60000
}

function localWallClockToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  const [hour, minute] = timeStr.split(":").map(Number)
  // First guess: treat the wall-clock values as if they were already UTC.
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  const offsetMinutes = getTimezoneOffsetMinutes(timeZone, utcGuess)
  return new Date(utcGuess.getTime() - offsetMinutes * 60000)
}

export function computeSessionCheckinWindow(
  session: CheckinWindowSession,
  timezone: string,
  graceMinutes = 15
): { opensAt: string; closesAt: string } {
  const start = localWallClockToUtc(session.session_date, session.start_time, timezone)
  const end = localWallClockToUtc(session.session_date, session.end_time, timezone)
  const opensAt = new Date(start.getTime() - graceMinutes * 60000)
  const closesAt = new Date(end.getTime() + graceMinutes * 60000)
  return { opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString() }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/agenda-session-checkin-window.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/agenda-session-checkin-window.ts src/lib/agenda-session-checkin-window.test.ts
git commit -m "feat(agenda): add timezone-aware session check-in window computation"
```

---

### Task 12: API route — `agenda_settings`

**Files:**
- Create: `src/app/api/events/[eventId]/agenda-settings/route.ts`

**Interfaces:**
- Consumes: `requireEventAndPermission(eventId, 'program')` (`src/lib/auth/api-auth.ts:457`), `createAdminClient()` (`src/lib/supabase/server.ts`).

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

const patchSchema = z.object({
  enable_session_checkin: z.boolean().optional(),
  enable_session_registration: z.boolean().optional(),
  enable_capacity_limits: z.boolean().optional(),
  enable_feedback: z.boolean().optional(),
  enable_attendance_points: z.boolean().optional(),
  enable_certificates: z.boolean().optional(),
  enable_virtual_delivery: z.boolean().optional(),
  enable_public_programme: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const supabase = (await createAdminClient()) as any
  const { data, error } = await supabase
    .from("agenda_settings")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "Failed to fetch agenda settings" }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? {
      event_id: eventId,
      enable_session_checkin: false,
      enable_session_registration: false,
      enable_capacity_limits: false,
      enable_feedback: false,
      enable_attendance_points: false,
      enable_certificates: false,
      enable_virtual_delivery: false,
      enable_public_programme: false,
    },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const supabase = (await createAdminClient()) as any
  const { data, error } = await supabase
    .from("agenda_settings")
    .upsert({ event_id: eventId, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: "event_id" })
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to update agenda settings" }, { status: 500 })
  }

  return NextResponse.json({ data })
}
```

- [ ] **Step 2: Verify the route compiles under the project's typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "agenda-settings/route.ts" || echo "no errors in this file"`
Expected: `no errors in this file` (pre-existing unrelated errors elsewhere in the project, if any, are out of scope for this task)

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/events/[eventId]/agenda-settings/route.ts"
git commit -m "feat(agenda): add agenda_settings GET/PATCH API route"
```

---

### Task 13: API route — halls CRUD

**Files:**
- Create: `src/app/api/events/[eventId]/halls/route.ts`
- Create: `src/app/api/events/[eventId]/halls/[hallId]/route.ts`

**Interfaces:**
- Consumes: `requireEventAndPermission`, `createAdminClient` (same as Task 12).

- [ ] **Step 1: Write the list/create route**

```typescript
// src/app/api/events/[eventId]/halls/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

const createSchema = z.object({
  name: z.string().min(1),
  capacity: z.number().int().positive().nullable().optional(),
  floor: z.string().nullable().optional(),
  display_order: z.number().int().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const supabase = (await createAdminClient()) as any
  const { data, error } = await supabase
    .from("halls")
    .select("*")
    .eq("event_id", eventId)
    .order("display_order")

  if (error) return NextResponse.json({ error: "Failed to fetch halls" }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const supabase = (await createAdminClient()) as any
  const { data, error } = await supabase
    .from("halls")
    .insert({ event_id: eventId, ...parsed.data })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: "Failed to create hall" }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
```

- [ ] **Step 2: Write the update/delete route**

```typescript
// src/app/api/events/[eventId]/halls/[hallId]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.number().int().positive().nullable().optional(),
  floor: z.string().nullable().optional(),
  display_order: z.number().int().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; hallId: string }> }
) {
  const { eventId, hallId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const supabase = (await createAdminClient()) as any
  const { data, error } = await supabase
    .from("halls")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", hallId)
    .eq("event_id", eventId)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: "Failed to update hall" }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; hallId: string }> }
) {
  const { eventId, hallId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const supabase = (await createAdminClient()) as any
  const { error } = await supabase.from("halls").delete().eq("id", hallId).eq("event_id", eventId)

  if (error) return NextResponse.json({ error: "Failed to delete hall" }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Verify both routes compile under the project's typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "events/\[eventId\]/halls" || echo "no errors in these files"`
Expected: `no errors in these files`

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/events/[eventId]/halls"
git commit -m "feat(agenda): add halls CRUD API routes"
```

---

### Task 14: Rewrite the conflicts API route

**Files:**
- Modify: `src/app/api/events/[eventId]/conflicts/route.ts` (full replacement)

**Interfaces:**
- Consumes: `getAllConflicts`, `ConflictSession`, `FacultyAssignmentRow`, `HallCapacity` from `src/lib/agenda-conflicts.ts` (Tasks 8–9).

The existing route at this path queries a `session_speakers` relation on `sessions` (`src/app/api/events/[eventId]/conflicts/route.ts:80`) — confirmed against the live database schema that no table or view named `session_speakers` exists (the actual join table is `faculty_assignments`). This route currently throws a PostgREST "relationship not found" error on every call and only ever checked faculty double-bookings — it doesn't check hall double-bookings, unassigned sessions, unconfirmed speakers, capacity, or unscheduled sessions at all. This task replaces it with a working route built on Task 8–9's tested logic, covering every conflict type from the spec's §6.

- [ ] **Step 1: Replace the route's contents**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { getAllConflicts, type ConflictSession, type FacultyAssignmentRow, type HallCapacity } from "@/lib/agenda-conflicts"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const supabase = (await createAdminClient()) as any

  const [sessionsResult, assignmentsResult, hallsResult, checkinCountsResult] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, session_name, session_date, start_time, end_time, hall_id")
      .eq("event_id", eventId),
    supabase
      .from("faculty_assignments")
      .select("session_id, faculty_id, faculty_name, status")
      .eq("event_id", eventId),
    supabase.from("halls").select("id, capacity").eq("event_id", eventId),
    supabase
      .from("checkin_records")
      .select("checkin_list_id, checkin_lists!inner(session_id)")
      .not("checkin_lists.session_id", "is", null)
      .eq("checkin_lists.event_id", eventId),
  ])

  if (sessionsResult.error || assignmentsResult.error || hallsResult.error) {
    return NextResponse.json({ error: "Failed to fetch conflict inputs" }, { status: 500 })
  }

  const registeredCountBySession = new Map<string, number>()
  for (const row of checkinCountsResult.data ?? []) {
    const sessionId = row.checkin_lists?.session_id
    if (!sessionId) continue
    registeredCountBySession.set(sessionId, (registeredCountBySession.get(sessionId) ?? 0) + 1)
  }

  const sessions: (ConflictSession & { registeredCount: number })[] = (sessionsResult.data ?? []).map((s: any) => ({
    id: s.id,
    session_name: s.session_name,
    session_date: s.session_date,
    start_time: s.start_time,
    end_time: s.end_time,
    hall_id: s.hall_id,
    registeredCount: registeredCountBySession.get(s.id) ?? 0,
  }))

  const assignments: FacultyAssignmentRow[] = assignmentsResult.data ?? []
  const halls: HallCapacity[] = hallsResult.data ?? []

  const result = getAllConflicts({ sessions, assignments, halls })

  return NextResponse.json({
    success: true,
    summary: {
      total_conflicts: result.conflicts.length,
      blocking_count: result.blockingCount,
      warning_count: result.warningCount,
    },
    conflicts: result.conflicts,
  })
}
```

- [ ] **Step 2: Verify the route compiles under the project's typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "events/\[eventId\]/conflicts/route.ts" || echo "no errors in this file"`
Expected: `no errors in this file`

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/events/[eventId]/conflicts/route.ts"
git commit -m "fix(agenda): rewrite conflicts route on working faculty_assignments query, add all conflict types"
```

---

### Task 15: API route — approval actions

**Files:**
- Create: `src/app/api/events/[eventId]/agenda-approval/route.ts`

**Interfaces:**
- Consumes: `deriveAgendaStatus`, `canSubmitForApproval`, `getLastApprovalTimestamp` (Task 10), `getAllConflicts` (Task 9, to compute the submit gate), `AuthUser.id` (`src/lib/auth/api-auth.ts:11`) as `actor_user_id`.

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { deriveAgendaStatus, getLastApprovalTimestamp, canSubmitForApproval, type ApprovalLogRow } from "@/lib/agenda-approval-state"
import { getAllConflicts, type ConflictSession, type FacultyAssignmentRow, type HallCapacity } from "@/lib/agenda-conflicts"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const supabase = (await createAdminClient()) as any

  const { data: log, error: logError } = await supabase
    .from("agenda_approval_log")
    .select("action, created_at, actor_user_id, comment")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })

  if (logError) return NextResponse.json({ error: "Failed to fetch approval log" }, { status: 500 })

  const status = deriveAgendaStatus(log as ApprovalLogRow[])
  const lastApprovedAt = getLastApprovalTimestamp(log as ApprovalLogRow[])

  const { data: changesSinceApproval } = lastApprovedAt
    ? await supabase
        .from("program_change_log")
        .select("*")
        .eq("event_id", eventId)
        .gt("created_at", lastApprovedAt)
        .order("created_at", { ascending: false })
    : { data: [] }

  return NextResponse.json({
    status,
    last_approved_at: lastApprovedAt,
    changes_since_approval: changesSinceApproval ?? [],
    log,
  })
}

const postSchema = z.object({
  action: z.enum(["submitted", "approved", "changes_requested", "published"]),
  comment: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError, user } = await requireEventAndPermission(eventId, "program")
  if (authError || !user) return authError ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const supabase = (await createAdminClient()) as any

  if (parsed.data.action === "submitted") {
    const [sessionsResult, assignmentsResult, hallsResult, checkinCountsResult] = await Promise.all([
      supabase.from("sessions").select("id, session_name, session_date, start_time, end_time, hall_id").eq("event_id", eventId),
      supabase.from("faculty_assignments").select("session_id, faculty_id, faculty_name, status").eq("event_id", eventId),
      supabase.from("halls").select("id, capacity").eq("event_id", eventId),
      supabase
        .from("checkin_records")
        .select("checkin_list_id, checkin_lists!inner(session_id)")
        .not("checkin_lists.session_id", "is", null)
        .eq("checkin_lists.event_id", eventId),
    ])

    // Mirrors the same registered-count computation as the GET /conflicts
    // route (Task 14) -- duplicated rather than imported because the two
    // routes have different auth/response shapes; both call the same
    // getAllConflicts() for the actual conflict logic.
    const registeredCountBySession = new Map<string, number>()
    for (const row of checkinCountsResult.data ?? []) {
      const sessionId = row.checkin_lists?.session_id
      if (!sessionId) continue
      registeredCountBySession.set(sessionId, (registeredCountBySession.get(sessionId) ?? 0) + 1)
    }

    const sessions: (ConflictSession & { registeredCount: number })[] = (sessionsResult.data ?? []).map((s: any) => ({
      ...s,
      registeredCount: registeredCountBySession.get(s.id) ?? 0,
    }))
    const assignments: FacultyAssignmentRow[] = assignmentsResult.data ?? []
    const halls: HallCapacity[] = hallsResult.data ?? []

    const { conflicts } = getAllConflicts({ sessions, assignments, halls })
    if (!canSubmitForApproval(conflicts)) {
      return NextResponse.json(
        { error: "Cannot submit for approval while blocking conflicts exist", conflicts: conflicts.filter((c) => c.severity === "blocking") },
        { status: 409 }
      )
    }
  }

  const { data, error } = await supabase
    .from("agenda_approval_log")
    .insert({
      event_id: eventId,
      action: parsed.data.action,
      actor_user_id: user.id,
      comment: parsed.data.comment ?? null,
    })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: "Failed to record approval action" }, { status: 500 })
  return NextResponse.json({ data, status: deriveAgendaStatus([{ action: parsed.data.action, created_at: data.created_at }]) })
}
```

- [ ] **Step 2: Verify the route compiles under the project's typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "agenda-approval/route.ts" || echo "no errors in this file"`
Expected: `no errors in this file`

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/events/[eventId]/agenda-approval/route.ts"
git commit -m "feat(agenda): add approval lifecycle API route (submit/approve/request-changes/publish)"
```

---

### Task 16: API route — session PATCH with check-in auto-provisioning

**Files:**
- Create: `src/app/api/events/[eventId]/program/sessions/[sessionId]/route.ts`

**Interfaces:**
- Consumes: `computeSessionCheckinWindow` (Task 11).
- Note: this is a new, additive write path for session fields relevant to check-in (`checkin_enabled`, `hall_id`, `track_id`, `session_date`, `start_time`, `end_time`). The existing Session admin page (`src/app/events/[eventId]/program/sessions/page.tsx`) writes directly to `sessions` via the browser Supabase client and is not modified by this task — wiring that UI to this route is scoped to the future Session Editor spec. This task only builds and proves the backend behavior.

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { computeSessionCheckinWindow } from "@/lib/agenda-session-checkin-window"

const patchSchema = z.object({
  session_name: z.string().min(1).optional(),
  session_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  hall_id: z.string().uuid().nullable().optional(),
  track_id: z.string().uuid().nullable().optional(),
  checkin_enabled: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; sessionId: string }> }
) {
  const { eventId, sessionId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const supabase = (await createAdminClient()) as any

  const { data: session, error: updateError } = await supabase
    .from("sessions")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("event_id", eventId)
    .select("id, session_date, start_time, end_time, checkin_enabled")
    .single()

  if (updateError || !session) {
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 })
  }

  if (session.checkin_enabled && session.session_date && session.start_time && session.end_time) {
    const { data: event } = await supabase.from("events").select("timezone").eq("id", eventId).single()
    const timezone = event?.timezone ?? "Asia/Kolkata"

    const { opensAt, closesAt } = computeSessionCheckinWindow(
      { session_date: session.session_date, start_time: session.start_time, end_time: session.end_time },
      timezone
    )

    const { data: existingList } = await supabase
      .from("checkin_lists")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle()

    if (existingList) {
      await supabase
        .from("checkin_lists")
        .update({ kiosk_opens_at: opensAt, kiosk_closes_at: closesAt, updated_at: new Date().toISOString() })
        .eq("id", existingList.id)
    } else {
      await supabase.from("checkin_lists").insert({
        event_id: eventId,
        session_id: sessionId,
        name: `Session check-in — ${sessionId}`,
        list_purpose: "session",
        kiosk_opens_at: opensAt,
        kiosk_closes_at: closesAt,
      })
    }
  }

  return NextResponse.json({ data: session })
}
```

- [ ] **Step 2: Verify the route compiles under the project's typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "program/sessions/\[sessionId\]/route.ts" || echo "no errors in this file"`
Expected: `no errors in this file`

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/events/[eventId]/program/sessions/[sessionId]/route.ts"
git commit -m "feat(agenda): add session PATCH route with check-in auto-provisioning"
```

---

## After all tasks

Run the full test suite once to confirm nothing regressed:

```bash
npx vitest run
npx tsc --noEmit -p .
```

**Not part of this plan, deliberately**: applying the five migrations to the database. Per this repo's standing policy, that requires a separate, explicit user go-ahead via Supabase MCP — one migration at a time, each with its own pre-flight/post-apply row-count check, following the pattern already documented in this repo's `CLAUDE.md` migration history.
