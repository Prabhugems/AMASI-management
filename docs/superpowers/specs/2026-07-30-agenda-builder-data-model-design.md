# Agenda Builder — Phase 1: Data Model & Module Architecture

**Status**: Approved for spec. Implementation plan pending.
**Scope**: Data model and backend architecture only. No UI/visual design, no import pipeline internals. This is the foundation that later screen-group specs (Import, Schedule Grid + Editor, Conflicts/Approval, Delegate views, In-venue check-in) build on.

## Context

This repo already runs a generic, multi-event Agenda/Programme module (`sessions`, `tracks`, `faculty_assignments`, `hall_coordinators`, `program_change_log`, all `event_id`-scoped) actively used across 20+ historical events — this is not a greenfield build. A design brief (`~/Downloads/Agenda Builder Design Brief.md`) describes a considerably richer target system: real hall capacity, reconciled tracks, per-event capability toggles, a structured AI-assisted import review flow, an approval/publish workflow, and session-level check-in tied to the existing kiosk infrastructure.

A prior audit (this same session) found the brief's target state doesn't match today's schema in specific ways:
- No dedicated `halls` table — halls are free-text strings on `sessions.hall`.
- Two unreconciled track concepts — the `tracks` table and `sessions.specialty_track` (free text) are not linked.
- No per-event capability toggle model for the 8 capabilities the brief calls out.
- Faculty/speaker data split three ways: `faculty_assignments` (structured) vs. `sessions.speakers_text`/`chairpersons_text`/`moderators_text` (free-text import artifacts).
- `checkin_lists`/`kiosk_stations` have no session-level linkage — today they only serve event-level lists (meals, kits, entry).
- No approval/publish lifecycle exists at all today.

**Decisions locked in for this phase** (confirmed with the user before writing this spec):
1. **Evolve in place**, not a parallel rebuild — extend existing tables additively; historical events need no migration/backfill beyond what's described below.
2. Capability toggles live in a **new `agenda_settings` table**, not bolted onto the already-70+-column `event_settings`.
3. Session check-in reuses the **existing `checkin_lists`/`kiosk_station_lists` scheduling machinery** (built 2026-07-29 for shared kiosk stations) rather than introducing a parallel `hall_id`-based runtime resolution path.

## 1. Halls

New table:

```sql
create table halls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  capacity integer,
  floor text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_halls_event on halls(event_id);
```

`sessions.hall_id uuid references halls(id)` — nullable, added **alongside** the existing `hall` text column (not replacing it).

`hall_coordinators.hall_id uuid references halls(id)` — nullable, added alongside the existing `hall_name` text column.

**Backfill** (one-time, per event, additive/idempotent):
1. For each event, `select distinct hall from sessions where event_id = :event_id and hall is not null`.
2. Create one `halls` row per distinct value (`name` = the text value, `capacity`/`floor` null, `display_order` by first-seen order).
3. Set `sessions.hall_id` to the matching new hall's id for every session sharing that exact text.
4. Do the same match for `hall_coordinators.hall_name` → `hall_id`.

Near-duplicate spellings (the brief's "hall names spelled two ways" case) are **not** auto-merged by this backfill — each distinct string becomes its own hall row. Merging duplicates is a coordinator action in the (future) Halls setup screen, not a data-migration decision, since only a human can safely judge whether "Hall A" and "Hall-A" are the same physical room.

The `hall` text column is frozen for new writes once `hall_id` exists on a session (going forward, the Session Editor writes `hall_id` only) but is never dropped — it remains the display fallback for any session where backfill matching failed or where a future import writes free text ahead of a resolved match.

## 2. Tracks

`sessions.track_id uuid references tracks(id)` — nullable, added alongside the existing free-text `specialty_track` column.

**Backfill**: within each event, match `sessions.specialty_track` (case-insensitive) against `tracks.name` for the same `event_id`. Where no match exists, create a new `tracks` row (`color` defaults to the existing schema default `#3B82F6`) and link it. `specialty_track` becomes read-only/legacy after backfill; the Session Editor's Details tab reads and writes `track_id` exclusively going forward.

## 3. Capability toggles — `agenda_settings`

```sql
create table agenda_settings (
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

One row per event, auto-created (all-false defaults) at the same point an event's `event_settings` row is created. `requireEventAndPermission(eventId, 'program')` continues to be the *authorization* gate (who can edit the programme at all); `agenda_settings` is a *presentation/feature* gate — which tabs and fields the Session Editor and other Agenda Builder screens show for that specific event. A small workshop with everything off should see a visibly sparse settings screen and a Session Editor with only the Details/Faculty/Delivery tabs (Engagement and Registration tabs hidden entirely when their toggles are off) — this is a UI concern for the later Setup-screens and Session-Editor specs, but the toggle model itself belongs here.

All-false defaults mean creating this row has zero behavioral effect on any existing event until a coordinator explicitly turns something on.

## 4. Faculty/speaker linkage

No schema change. Decision, binding for all Agenda Builder code going forward: **`faculty_assignments` is the single source of truth** for who is speaking in a session. The Session Editor's Faculty tab reads and writes `faculty_assignments` (`session_id`, `faculty_id`, `role`, `topic_title`, `status`, `participation_mode`, `display_order`) exclusively.

`sessions.speakers_text`/`chairpersons_text`/`moderators_text` and `faculty_assignments.faculty_name`/`faculty_email` (the free-text fallback columns used when `faculty_id` can't be resolved to a real `faculty` row) are frozen for new writes from Agenda Builder screens but not migrated or dropped in this phase. Reconciling historical free-text speaker data into real `faculty_assignments`/`faculty` rows requires a matching-with-review step (exactly the "Match the people" step the import brief describes) and is explicitly deferred to the Import pipeline spec — auto-matching names without human confirmation risks silently attributing a session to the wrong person.

## 5. Session-level check-in

Extends existing infrastructure rather than forking it.

```sql
alter table sessions add column checkin_enabled boolean not null default false;

alter table checkin_lists
  add column session_id uuid references sessions(id) on delete cascade;

alter table checkin_lists drop constraint checkin_lists_list_purpose_check;
alter table checkin_lists add constraint checkin_lists_list_purpose_check
  check (list_purpose in ('entry', 'collection', 'session'));
```

`sessions.checkin_enabled` mirrors `agenda_settings.enable_session_checkin` but at the individual-session level — turning the capability on for an event doesn't force check-in on every session (e.g. a keynote with open seating might opt out).

**Auto-provisioning**: when a session's `checkin_enabled` flips to `true`, or its `start_time`/`end_time`/`session_date` changes while `checkin_enabled` is already true, the API upserts exactly one `checkin_lists` row with `list_purpose = 'session'`, `session_id` set, and `kiosk_opens_at`/`kiosk_closes_at` derived from the session's own start/end plus a fixed grace buffer (proposed ±15 minutes, tunable) — reusing the scheduling fields and `computeListState` resolution logic already built for shared kiosk stations (`src/lib/kiosk-list-schedule.ts`) rather than introducing a second scheduling mechanism.

**Station linkage**: no new column on `kiosk_stations`. A hall's check-in tablet is linked, once, to every session-purpose `checkin_lists` row for its hall via the existing `kiosk_station_lists` join table — in practice a bulk "link this station to all of Hall A's sessions" action in a future setup screen, rather than one manual link per session. The existing manifest logic that already picks "which of this station's linked lists is inside its open/close window right now" is what surfaces "today's active session" on the in-venue check-in screen (Group 9 of the brief) — no new resolution path is introduced.

**Consequence surfaced for a later spec**: this means a check-in station must be explicitly set up per hall at least once (linked to that hall's sessions). The brief's Group 7 (Setup screens) doesn't list this as a setup step — flagging it for whoever writes that spec.

## 6. Conflict detection — computed, not enforced

No database-level exclusion/overlap constraint on `(hall_id, session_date, start_time, end_time)`. Two reasons: the brief's Schedule Grid explicitly allows creating an overlapping session via drag-and-drop (rendered as an unmissable visual conflict, not blocked), and a raw imported spreadsheet routinely contains real scheduling overlaps that need human review rather than a rejected insert — consistent with the brief's own principle that import produces a draft for review, never a silent write.

Conflicts are computed at read time by a query layer (e.g. `getConflicts(eventId)`, to live in an API route backing the Conflicts & Readiness screen):
- Hall double-bookings — blocking.
- Faculty double-bookings across halls — warning only (chairs legitimately float between rooms, per the brief).
- Sessions with no `faculty_assignments` row.
- Speakers whose `faculty_assignments.status != 'confirmed'`.
- Sessions where registered/checked-in count exceeds `halls.capacity` (only relevant once `agenda_settings.enable_capacity_limits` is on).
- Sessions with no `hall_id`/`track_id`/time (unscheduled).
- Gaps in a hall's day (computed from the sorted session list per hall, not stored).

This same query is the basis for the submit-for-approval gate in §7.

## 7. Approval / publish lifecycle

```sql
create table agenda_approval_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  action text not null check (action in ('submitted', 'approved', 'changes_requested', 'published')),
  actor_user_id uuid not null references users(id),
  comment text,
  created_at timestamptz not null default now()
);
create index idx_agenda_approval_log_event on agenda_approval_log(event_id, created_at desc);
```

Append-only log; no separate status column on `events` or elsewhere. Current lifecycle state for an event is *derived* — the most recent row's `action`, mapped: `submitted` → "Submitted for approval", `approved` → "Approved", `changes_requested` → back to "Draft", `published` → "Published". No event has ever been submitted → derived state is "Draft" (the implicit default; no row required to represent it). Deriving the state this way means it can never desync from its own history, at the cost of one extra query (`order by created_at desc limit 1`) wherever the current state is needed — acceptable given this is checked at human interaction points (submit button, approval screen), not in a hot path.

"What changed since last approval" — the screen the brief identifies as the one that determines whether the Organising Secretary trusts the tool — is computed by querying the existing `program_change_log` table for `event_id = :id and created_at > :last_approved_or_published_at`, where the threshold timestamp comes from the most recent `approved` or `published` row in `agenda_approval_log`. No new change-tracking mechanism; full reuse of the audit trail that already exists.

**Submit gate**: the coordinator's submit-for-approval action is blocked while `getConflicts(eventId)` (§6) returns any blocking-severity issue (hall double-bookings). Warnings (faculty clashes, unconfirmed speakers, etc.) do not block submission.

## 8. Permissions

No change to the existing auth model. All Agenda Builder API routes gate on `requireEventAndPermission(eventId, 'program')` (the `Permission` union already includes `'program'` per the platform audit) for coordinator/admin actions. The Organising Secretary's approve/request-changes action and the eventual delegate-facing/public-programme read paths are follow-on permission decisions for the Approval and Delegate-views specs respectively — not designed here.

## Explicitly out of scope for this phase

- Import pipeline data model (import batches, per-field confidence tracking, source-file retention, people-matching review) — own spec, folds in the brief's Group 4 in full.
- The two hardcoded single-event escape hatches found in the audit (AMASICON 2026 Google Sheets webhook sync, TechnoSurg's separate sheet-driven program view) — not touched, not reconciled, by this phase.
- Consolidating the 3+ overlapping public-program view implementations found in the audit.
- Any visual/UI design for any screen in the brief (Groups 1–3, 5–9). This spec only establishes what data those screens will read and write.

## Migration notes

All changes in §1–§7 are additive (`ADD COLUMN`, new tables) with safe defaults (`false`, `null`), so existing code paths and all 20+ historical events continue to behave identically until a coordinator or a later feature explicitly exercises the new columns. Per this repo's standing migration policy (CLAUDE.md), no migration described here is applied without an explicit user go-ahead via Supabase MCP, and each should be applied as its own dated migration file rather than one combined file, mirroring existing convention (e.g. the four separate `kiosk_stations` migrations from 2026-07-27 through 2026-07-29).
