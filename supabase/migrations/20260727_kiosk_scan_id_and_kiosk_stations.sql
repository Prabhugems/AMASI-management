-- Kiosk offline-first redesign (Stage 2 + Stage 3 groundwork), additive only.
-- See docs/superpowers/specs/2026-07-26-kiosk-print-station-sidebar-design.md
-- and the kiosk-system-redesign implementation brief for context.

-- Stage 2: scan_id idempotency.
-- checkin_records: replay of the same scan_id must return the original row.
alter table checkin_records
  add column if not exists scan_id uuid;
create unique index if not exists checkin_records_scan_id_key
  on checkin_records (scan_id) where scan_id is not null;

-- print_jobs: replay of the same scan_id must return the original job, but a
-- NEW scan_id for the same registration must still succeed as a legitimate
-- reprint (gated by allow_reprint/max_reprints in application code, not by
-- this constraint) -- so uniqueness is on scan_id alone, never paired with
-- registration_id.
alter table print_jobs
  add column if not exists scan_id uuid;
create unique index if not exists print_jobs_scan_id_key
  on print_jobs (scan_id) where scan_id is not null;

-- Stage 3: station identity. One row per physical kiosk device.
-- print_station_id links a print-mode kiosk station back to its existing
-- print_stations row (printer_settings, badge_template_id, reprint limits)
-- instead of duplicating that config here.
create table if not exists kiosk_stations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  mode text not null check (mode in ('checkin', 'print')),
  list_id uuid references checkin_lists(id) on delete set null,
  print_station_id uuid references print_stations(id) on delete set null,
  printer_config jsonb,
  exit_pin_hash text,
  exit_pin_salt text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table kiosk_stations enable row level security;
-- No policies created for anon/authenticated/public -- default-deny, same
-- pattern as event_kiosk_pins in the superseded sidebar spec. Only ever
-- read/written via the admin (service-role) Supabase client.

-- Station credential: a fresh token is minted (and the previous one
-- revoked) each time the admin explicitly re-runs the Sidebar -> Kiosk
-- mode setup flow, not on every daily reopen of an already-configured
-- device. Stored as a SHA-256 hash, not plaintext: RLS on this table is
-- default-deny today, but print_stations (below) shows that assumption can
-- silently rot, so the credential doesn't rely on RLS alone.
alter table kiosk_stations
  add column if not exists access_token_hash text,
  add column if not exists revoked_at timestamptz;
create unique index if not exists kiosk_stations_access_token_hash_key
  on kiosk_stations (access_token_hash) where access_token_hash is not null;
