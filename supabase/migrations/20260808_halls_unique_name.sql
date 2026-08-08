-- A venue cannot contain two rooms with the same name.
--
-- Two "Hall A"s in one event confuse delegates, and they confuse the Session
-- Builder worse: its location picker lists rooms BY NAME, so two identically
-- named halls are two indistinguishable options, and a programme silently
-- splits across two rooms that are really one room.
--
-- Nothing prevented this before, at any layer: no constraint here, no check in
-- POST /api/events/[eventId]/halls, and the Venue Overview form treated a
-- duplicate as a warning that could still be saved (the design's own words --
-- "a warning, not a wall"). That reading is superseded: the rule is now
-- blocking, enforced here first so it holds regardless of which client writes.
--
-- Scoped to SIBLINGS, not the whole event:
--   * two halls named "Hall A" in one event      -> rejected
--   * two screens named "Screen 1" in one hall   -> rejected
--   * "Screen 1" under Hall A and under Hall B   -> allowed, and normal --
--     a delegate reads those as "Hall A > Screen 1" and "Hall B > Screen 1",
--     which is unambiguous.
--
-- Case- and whitespace-insensitive, because "hall a", "Hall A" and "Hall  A"
-- are the same room to a human reading a sign.
--
-- Pre-flight 2026-08-08: the only duplicates in the database were three rows in
-- the Kiosk QA test event, created by SQL during verification and removed
-- before this migration. All 20 other events were already clean, so this adds
-- no constraint that existing data violates.

create unique index if not exists halls_unique_name_per_event
  on halls (event_id, lower(regexp_replace(trim(name), '\s+', ' ', 'g')))
  where parent_id is null;

create unique index if not exists halls_unique_screen_name_per_hall
  on halls (parent_id, lower(regexp_replace(trim(name), '\s+', ' ', 'g')))
  where parent_id is not null;

comment on index halls_unique_name_per_event is
  'One room name per event. Delegates cannot tell two "Hall A"s apart, and neither can the Session Builder location picker.';
comment on index halls_unique_screen_name_per_hall is
  'One screen name per hall. "Screen 1" in two different halls is fine -- it reads as "Hall A > Screen 1".';
