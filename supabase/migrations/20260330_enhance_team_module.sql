-- Team Module Enhancements
-- Adds team invitations, activity logs, and enhances team_members table

-- ============================================================================
-- 1. CREATE team_invitations TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'coordinator',
  permissions JSONB DEFAULT '[]',
  event_ids UUID[] DEFAULT '{}',
  invited_by UUID REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for team_invitations
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);

-- ============================================================================
-- 2. ALTER team_members TABLE
-- ============================================================================

-- Change permissions from TEXT[] to JSONB (two-step: add new column, copy data, swap)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members'
      AND column_name = 'permissions'
      AND data_type = 'ARRAY'
  ) THEN
    -- Step 1: Add a temporary JSONB column (default to empty array, not object)
    ALTER TABLE team_members ADD COLUMN permissions_jsonb JSONB DEFAULT '[]';

    -- Step 2: Migrate data - convert TEXT[] to JSONB array (e.g. ["flights","hotels"])
    UPDATE team_members
    SET permissions_jsonb = CASE
      WHEN permissions IS NULL OR array_length(permissions::text[], 1) IS NULL THEN '[]'::jsonb
      ELSE (
        SELECT jsonb_agg(elem)
        FROM unnest(permissions::text[]) AS elem
      )
    END;

    -- Step 3: Drop old column, rename new one
    ALTER TABLE team_members DROP COLUMN permissions;
    ALTER TABLE team_members RENAME COLUMN permissions_jsonb TO permissions;
  END IF;
END $$;

-- Add invited_by column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'invited_by'
  ) THEN
    ALTER TABLE team_members ADD COLUMN invited_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Add accepted_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE team_members ADD COLUMN accepted_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- 3. CREATE team_activity_logs TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'team_member',
  target_id UUID,
  target_email TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for team_activity_logs
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_actor_id ON team_activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_target_id ON team_activity_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_action ON team_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_created_at ON team_activity_logs(created_at);

-- ============================================================================
-- 4. ENABLE RLS ON NEW TABLES
-- ============================================================================

-- team_invitations RLS
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_invitations' AND policyname = 'Allow authenticated read team_invitations') THEN
    CREATE POLICY "Allow authenticated read team_invitations" ON team_invitations
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_invitations' AND policyname = 'Service role full access team_invitations') THEN
    CREATE POLICY "Service role full access team_invitations" ON team_invitations
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- team_activity_logs RLS
ALTER TABLE team_activity_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_activity_logs' AND policyname = 'Allow authenticated read team_activity_logs') THEN
    CREATE POLICY "Allow authenticated read team_activity_logs" ON team_activity_logs
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_activity_logs' AND policyname = 'Service role full access team_activity_logs') THEN
    CREATE POLICY "Service role full access team_activity_logs" ON team_activity_logs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- 5. UPDATE TRIGGERS for updated_at
-- ============================================================================

-- Trigger for team_invitations
CREATE OR REPLACE FUNCTION update_team_invitation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_team_invitation_timestamp ON team_invitations;
CREATE TRIGGER update_team_invitation_timestamp
  BEFORE UPDATE ON team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_team_invitation_timestamp();

-- Trigger for team_members updated_at (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_team_members_timestamp'
      AND tgrelid = 'team_members'::regclass
  ) THEN
    CREATE OR REPLACE FUNCTION update_team_members_timestamp()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    CREATE TRIGGER update_team_members_timestamp
      BEFORE UPDATE ON team_members
      FOR EACH ROW
      EXECUTE FUNCTION update_team_members_timestamp();
  END IF;
END $$;

SELECT 'Team module enhancements applied!' as status;
