-- Add participation_mode to registrations table
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS participation_mode TEXT DEFAULT 'offline'
  CHECK (participation_mode IN ('online', 'offline', 'hybrid'));

-- Add participation_mode to faculty_assignments table
ALTER TABLE faculty_assignments
  ADD COLUMN IF NOT EXISTS participation_mode TEXT DEFAULT 'offline'
  CHECK (participation_mode IN ('online', 'offline', 'hybrid'));

-- Backfill: Update registrations linked to online sessions
-- (sessions where session name contains "online")
UPDATE registrations r
SET participation_mode = 'online'
FROM faculty_assignments fa
JOIN sessions s ON fa.session_id = s.id
WHERE fa.faculty_id IS NOT NULL
  AND r.event_id = s.event_id
  AND r.attendee_email = (
    SELECT f.email FROM faculty f WHERE f.id = fa.faculty_id
  )
  AND LOWER(s.session_name) LIKE '%online%'
  AND r.participation_mode = 'offline';
