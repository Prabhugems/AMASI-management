-- Enable Row Level Security Policies for Dashboard Access
-- Run this in your Supabase SQL Editor

-- 1. Enable RLS on tables (if not already enabled)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 2. Create policies for reading members (for authenticated users)
DROP POLICY IF EXISTS "Allow authenticated users to read members" ON members;
CREATE POLICY "Allow authenticated users to read members"
ON members FOR SELECT
TO authenticated
USING (true);

-- 3. Create policies for reading faculty
DROP POLICY IF EXISTS "Allow authenticated users to read faculty" ON faculty;
CREATE POLICY "Allow authenticated users to read faculty"
ON faculty FOR SELECT
TO authenticated
USING (true);

-- 4. Create policies for reading events
DROP POLICY IF EXISTS "Allow authenticated users to read events" ON events;
CREATE POLICY "Allow authenticated users to read events"
ON events FOR SELECT
TO authenticated
USING (true);

-- 5. Create policies for reading participants
DROP POLICY IF EXISTS "Allow authenticated users to read participants" ON participants;
CREATE POLICY "Allow authenticated users to read participants"
ON participants FOR SELECT
TO authenticated
USING (true);

-- 6. Create policies for reading sessions
DROP POLICY IF EXISTS "Allow authenticated users to read sessions" ON sessions;
CREATE POLICY "Allow authenticated users to read sessions"
ON sessions FOR SELECT
TO authenticated
USING (true);

-- 7. Create policies for reading event_faculty
DROP POLICY IF EXISTS "Allow authenticated users to read event_faculty" ON event_faculty;
CREATE POLICY "Allow authenticated users to read event_faculty"
ON event_faculty FOR SELECT
TO authenticated
USING (true);

-- 8. Create policies for users table
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can read all users" ON users;
CREATE POLICY "Admins can read all users"
ON users FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND platform_role IN ('super_admin', 'admin')
  )
);

-- ALTERNATIVE: If you want to allow anonymous access (not recommended for production)
-- Uncomment these if you need public read access without authentication:

-- DROP POLICY IF EXISTS "Allow anon to read members" ON members;
-- CREATE POLICY "Allow anon to read members"
-- ON members FOR SELECT
-- TO anon
-- USING (true);

-- DROP POLICY IF EXISTS "Allow anon to read faculty" ON faculty;
-- CREATE POLICY "Allow anon to read faculty"
-- ON faculty FOR SELECT
-- TO anon
-- USING (true);

-- DROP POLICY IF EXISTS "Allow anon to read events" ON events;
-- CREATE POLICY "Allow anon to read events"
-- ON events FOR SELECT
-- TO anon
-- USING (true);

-- DROP POLICY IF EXISTS "Allow anon to read participants" ON participants;
-- CREATE POLICY "Allow anon to read participants"
-- ON participants FOR SELECT
-- TO anon
-- USING (true);

-- Verify policies are created
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
