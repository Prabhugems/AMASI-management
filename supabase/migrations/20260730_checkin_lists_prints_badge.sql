-- Scopes badge printing to specific check-in lists instead of the whole
-- kiosk station. Previously, any list served by a checkin_and_print-mode
-- station showed print controls -- including lists like Lunch/Kit
-- Collection that have nothing to do with printing. Backfilled true for
-- every list currently on a checkin_and_print station so no station's
-- current printing behavior changes the moment this lands; admins can then
-- turn it off per-list going forward.
alter table checkin_lists
  add column if not exists prints_badge boolean not null default false;

update checkin_lists
set prints_badge = true
where id in (
  select ksl.checkin_list_id
  from kiosk_station_lists ksl
  join kiosk_stations ks on ks.id = ksl.station_id
  where ks.mode = 'checkin_and_print'
);
