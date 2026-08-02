-- Per-event help desk location (Kiosk work order §9.3). The kiosk's
-- volunteer-facing "see the help desk" copy has no location string to
-- replace today -- it's generic ("contact the registration desk"), not
-- hardcoded to a specific hall -- so this is forward-looking, not a bugfix
-- for an existing hardcoded value. NULL (default) means the UI keeps its
-- current generic copy; a set value lets a future pass show it (e.g. "See
-- the help desk near Hall A entrance").
--
-- Additive only, nullable, no backfill needed. NOT applied by this
-- migration file -- per standing repo policy, apply requires explicit human
-- go-ahead via Supabase MCP or SQL editor.

alter table event_settings
  add column if not exists help_desk_location text;

comment on column event_settings.help_desk_location is
  'Per-event help desk location shown to volunteers/delegates on kiosk help-affordance copy. NULL = no location shown (current generic copy).';
