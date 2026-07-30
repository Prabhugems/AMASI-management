-- Add Kiosk Stations as its own independently-toggleable event module
-- (previously piggybacked on enable_checkin; see event-sidebar.tsx nav item)
alter table event_settings add column if not exists enable_kiosk_stations boolean default true;
