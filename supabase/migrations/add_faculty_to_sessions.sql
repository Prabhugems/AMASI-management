-- Add faculty fields to sessions table for quick program management
-- These fields store faculty info directly on sessions for simpler import/export

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS faculty_name TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS faculty_email TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS faculty_phone TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS faculty_id UUID REFERENCES faculty(id);

-- Create index for faculty lookups
CREATE INDEX IF NOT EXISTS idx_sessions_faculty_id ON sessions(faculty_id);
CREATE INDEX IF NOT EXISTS idx_sessions_faculty_email ON sessions(faculty_email);

COMMENT ON COLUMN sessions.faculty_name IS 'Quick faculty name storage for simple programs';
COMMENT ON COLUMN sessions.faculty_email IS 'Faculty email for linking/reference';
COMMENT ON COLUMN sessions.faculty_phone IS 'Faculty phone number';
COMMENT ON COLUMN sessions.faculty_id IS 'Optional link to faculty master table';
