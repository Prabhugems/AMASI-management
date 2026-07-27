-- Kiosk Stage 3: real station identity. Attributes a check-in to the real,
-- admin-provisioned kiosk_stations row that performed it, instead of the
-- client-only getOrCreateDeviceId() placeholder that never reached the
-- server at all. Additive only.
alter table checkin_records
  add column if not exists station_id uuid references kiosk_stations(id) on delete set null;
