-- Link faculty_assignments to registrations for unified portal
ALTER TABLE faculty_assignments
  ADD COLUMN IF NOT EXISTS registration_id UUID REFERENCES registrations(id);

CREATE INDEX IF NOT EXISTS idx_faculty_assignments_registration_id
  ON faculty_assignments(registration_id);
