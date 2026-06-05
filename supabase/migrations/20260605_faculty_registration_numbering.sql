-- Add faculty-specific registration numbering to event_settings so faculty
-- registrations can follow a separate prefix/counter from delegates.
-- Per TechnoSurg requirement: faculty must be TECH-F-1001 onwards, not
-- shared with the delegate counter (Technosurg2026A1001+).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_settings' AND column_name = 'faculty_registration_prefix'
  ) THEN
    ALTER TABLE event_settings ADD COLUMN faculty_registration_prefix TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_settings' AND column_name = 'faculty_registration_start_number'
  ) THEN
    ALTER TABLE event_settings ADD COLUMN faculty_registration_start_number INT DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_settings' AND column_name = 'faculty_registration_suffix'
  ) THEN
    ALTER TABLE event_settings ADD COLUMN faculty_registration_suffix TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_settings' AND column_name = 'current_faculty_registration_number'
  ) THEN
    ALTER TABLE event_settings ADD COLUMN current_faculty_registration_number INT DEFAULT 0;
  END IF;
END $$;
