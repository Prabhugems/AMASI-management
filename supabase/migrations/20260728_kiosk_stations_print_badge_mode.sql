-- Kiosk "Check-in + Print Badge" mode: a station can now check a delegate
-- in AND print their badge, linked to an existing Print Station's printer
-- config (print_station_id, already present since Stage 1) rather than
-- duplicating printer setup. auto_print_badge controls whether the badge
-- prints automatically on a successful check-in, or only via the manual
-- "Print Badge" button (which always renders on this mode either way).
alter table kiosk_stations drop constraint if exists kiosk_stations_mode_check;
alter table kiosk_stations add constraint kiosk_stations_mode_check
  check (mode in ('checkin', 'print', 'checkin_and_print'));

alter table kiosk_stations add column if not exists auto_print_badge boolean not null default false;
