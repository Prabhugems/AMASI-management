-- Add RLS policies for faculty_assignments and assignment_emails tables
-- These tables were missing authenticated user policies, causing client-side
-- queries to silently return empty results.

-- Faculty assignments: authenticated users can read and manage
DROP POLICY IF EXISTS "Authenticated users can read faculty_assignments" ON faculty_assignments;
CREATE POLICY "Authenticated users can read faculty_assignments"
ON faculty_assignments FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage faculty_assignments" ON faculty_assignments;
CREATE POLICY "Authenticated users can manage faculty_assignments"
ON faculty_assignments FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

SELECT 'Faculty assignments RLS policies added for authenticated users' as status;
