-- Complete Sessions table update for AI Import
-- This adds all required columns for the program import feature

-- First, add the new-style columns (import uses session_name, session_date, session_type)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_name TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_date DATE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_type TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS specialty_track TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- Speaker/Chairperson columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS speakers TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS chairpersons TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS moderators TEXT;

-- Contact details columns (for reports)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS speakers_text TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS chairpersons_text TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS moderators_text TEXT;

-- Faculty link columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS faculty_name TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS faculty_email TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS faculty_phone TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS faculty_id UUID;

-- Coordinator columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS coordinator_status VARCHAR(50) DEFAULT 'scheduled';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS coordinator_notes TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS coordinator_checklist JSONB;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS audience_count INTEGER;

-- Make original required columns nullable (for backwards compatibility)
-- This allows insert without the old column values
ALTER TABLE sessions ALTER COLUMN name DROP NOT NULL;
ALTER TABLE sessions ALTER COLUMN type DROP NOT NULL;
ALTER TABLE sessions ALTER COLUMN date DROP NOT NULL;
ALTER TABLE sessions ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE sessions ALTER COLUMN end_time DROP NOT NULL;

-- Create a trigger to sync old and new column names
CREATE OR REPLACE FUNCTION sync_session_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- If new-style columns are provided, copy to old-style
  IF NEW.session_name IS NOT NULL AND NEW.name IS NULL THEN
    NEW.name := NEW.session_name;
  END IF;
  IF NEW.session_date IS NOT NULL AND NEW.date IS NULL THEN
    NEW.date := NEW.session_date;
  END IF;
  -- If old-style columns are provided, copy to new-style
  IF NEW.name IS NOT NULL AND NEW.session_name IS NULL THEN
    NEW.session_name := NEW.name;
  END IF;
  IF NEW.date IS NOT NULL AND NEW.session_date IS NULL THEN
    NEW.session_date := NEW.date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_session_columns_trigger ON sessions;
CREATE TRIGGER sync_session_columns_trigger
  BEFORE INSERT OR UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION sync_session_columns();

-- Add comments
COMMENT ON COLUMN sessions.speakers_text IS 'Speaker names with contact details: "Name (email, phone) | Name2"';
COMMENT ON COLUMN sessions.chairpersons_text IS 'Chairperson names with contact details';
COMMENT ON COLUMN sessions.moderators_text IS 'Moderator names with contact details';
COMMENT ON COLUMN sessions.specialty_track IS 'Track/session group name from CSV';
