-- Attended vs unattended kiosk stations.
-- See conversation 2026-07-29: the entry-only self-check-in rule
-- (checkin_lists.list_purpose === "collection" always blocked on the kiosk
-- path) was written for an unattended, self-service device -- nobody
-- stopping a delegate from tapping twice and taking two kits. At AMASICON,
-- every kiosk station is staff-attended: a volunteer holds the tablet at
-- all times and enforces the duplicate warning themselves, same as the
-- existing staff scanner. This column lets an ATTENDED station serve
-- collection lists (Breakfast, Lunch, Dinner, Registration Kit) while an
-- unattended station (or the direct-URL /kiosk/[eventId]/[listId] path,
-- which never reads this table at all) stays entry-only, permanently.
--
-- Additive, default false: every existing station -- including both of
-- this event's stations -- keeps behaving exactly as it does today until
-- an admin deliberately marks it attended. No backfill in this migration;
-- flipping existing stations is a separate, explicit admin action.
alter table kiosk_stations
  add column if not exists attended boolean not null default false;
