-- Cap on distinct workshop/course add-ons a single registrant may select.
-- NULL (default) = unlimited, preserving existing behavior for events that
-- don't set it. ESSURG 2026 sets this to 3 (main conference registration
-- required, max 3 workshops per delegate per the event's registration policy).

ALTER TABLE event_settings
  ADD COLUMN IF NOT EXISTS max_course_addons INTEGER;

COMMENT ON COLUMN event_settings.max_course_addons IS 'Max number of distinct is_course addons a registrant may select. NULL = unlimited.';
