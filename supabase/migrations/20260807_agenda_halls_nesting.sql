-- Agenda Builder Phase 1: halls can contain screens.
--
-- Venues vary by event: some are a single hall, some are one hall split across
-- four screens. The Venue Overview screen needs that structure, and Phase 3 is
-- where hall structure gets locked into the session editors, the hall picker and
-- the conflict library -- so the model has to exist before those are built, or
-- the same pages get wired twice.
--
-- Deliberately a SELF-FK ON `halls`, not a new `venue_spaces` table. `halls` is
-- already per-event and already load-bearing: 34 rows, 2,360 sessions linked via
-- sessions.hall_id, 19 hall_coordinators rows, plus src/lib/agenda-conflicts.ts
-- and the session-checkin auto-provisioning. A new table would mean re-pointing
-- all of that and re-running a backfill that already surfaced one 195-row
-- pagination bug (see CLAUDE.md, 2026-07-31). Two columns buy the same tree.
--
-- Additive only, with a default that makes every existing row a top-level hall --
-- do NOT apply until explicit user go-ahead.

alter table halls add column if not exists parent_id uuid references halls(id) on delete cascade;
alter table halls add column if not exists kind text not null default 'hall' check (kind in ('hall','screen'));

create index if not exists idx_halls_parent on halls(parent_id);

-- Structural rules the tree depends on. Enforced here rather than in app code so
-- a bad write cannot corrupt the hierarchy.
--
--   1. Exactly two levels. A screen belongs to a hall; a hall belongs to nobody.
--      Deeper nesting has no venue meaning and would break the double-booking
--      logic below, which assumes parent/child and not arbitrary depth.
alter table halls drop constraint if exists halls_two_level_tree;
alter table halls add constraint halls_two_level_tree check (
  (kind = 'hall'   and parent_id is null) or
  (kind = 'screen' and parent_id is not null)
);

--   2. A hall cannot be its own parent. (The two-level rule already prevents
--      longer cycles, since a screen's parent must be a hall and a hall has no
--      parent -- but this closes the one-node case explicitly.)
alter table halls drop constraint if exists halls_no_self_parent;
alter table halls add constraint halls_no_self_parent check (parent_id is null or parent_id <> id);

comment on column halls.parent_id is
  'Set on a screen, pointing at its containing hall. Null on a hall. Two levels only -- enforced by halls_two_level_tree.';
comment on column halls.kind is
  'hall = a physical room; screen = a projection area inside one. Every pre-existing row defaults to hall, so this migration changes no behaviour on its own.';

-- Existing 34 rows all become kind='hall', parent_id=null -- i.e. exactly what
-- they already are. No backfill script needed and no session relinking: a
-- session keeps pointing at the same halls.id it always did.
--
-- NOT DONE HERE, and deliberately: a same-event cross-parent guard (a screen
-- whose parent belongs to a different event). It cannot be expressed as a CHECK
-- because it needs a lookup, and a trigger for it is worth writing only once the
-- Venue Overview UI exists to create screens at all. Until then no code path
-- writes parent_id. Flagged for whoever builds that screen.
--
-- CONSEQUENCE FOR PHASE 4 -- findHallDoubleBookings (src/lib/agenda-conflicts.ts:55)
-- currently compares hall_id equality and is correct only for a flat venue. With
-- the tree it must be revised BEFORE it can be trusted:
--   * two sessions on DIFFERENT screens of the same hall  -> not a clash
--   * a session on the PARENT hall while any child screen is in use -> a clash
--   * two sessions on the SAME screen -> a clash, as today
-- Its unit tests must gain cases for all three, or the Conflicts screen will
-- quietly report false clashes on every multi-screen event.
