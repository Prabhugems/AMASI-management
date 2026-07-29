-- Kiosk stations: shared tablets, multi-list menu, scheduled windows.
-- See docs/superpowers/specs/2026-07-29-kiosk-shared-stations-scheduled-lists-design.md
-- Additive only. Commit only -- do NOT apply until explicit user go-ahead
-- (see CLAUDE.md's migration pipeline section). kiosk_stations.list_id is
-- deprecated by this migration, not dropped -- every existing code path
-- keeps working off it until a later, separate migration removes it.

alter table checkin_lists
  add column if not exists kiosk_opens_at timestamptz null,
  add column if not exists kiosk_closes_at timestamptz null,
  add column if not exists kiosk_force_state text null
    check (kiosk_force_state is null or kiosk_force_state in ('open', 'closed'));
-- All three columns are inert until an admin explicitly sets them: null on
-- all three resolves to "open" under src/lib/kiosk-list-schedule.ts's
-- computeListState, so every existing list keeps behaving exactly as
-- today -- zero behavior change on migration apply.

create table if not exists kiosk_station_lists (
  station_id uuid not null references kiosk_stations(id) on delete cascade,
  checkin_list_id uuid not null references checkin_lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (station_id, checkin_list_id)
);
create index if not exists kiosk_station_lists_by_list on kiosk_station_lists (checkin_list_id);
alter table kiosk_station_lists enable row level security;
-- No policies -- default-deny, same posture as kiosk_stations itself. Only
-- ever read/written via the admin (service-role) Supabase client.

-- Backfill: one join row per existing station's current list_id. Idempotent
-- regardless of row count (0 in most environments today, N in production).
insert into kiosk_station_lists (station_id, checkin_list_id)
select id, list_id from kiosk_stations
where list_id is not null
on conflict (station_id, checkin_list_id) do nothing;
