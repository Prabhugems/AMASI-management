-- ============================================================
-- AMASI Management Portal
-- Event Settings Module v2.0 — Migration
-- Run: supabase db push  OR  paste into Supabase SQL editor
-- Safe to re-run: all changes use IF NOT EXISTS / DO blocks
-- ============================================================


-- ============================================================
-- 1. events table — new columns
-- ============================================================

-- Date & Time
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS registration_deadline timestamptz;

-- Location
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS venue_address text;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS venue_map_url text;

-- Branding
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS favicon_url text;

-- Links & Contact
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS contact_phone text;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS social_twitter text;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS social_instagram text;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS social_linkedin text;

-- SEO
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS seo_title text;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS seo_description text;

-- Comments
COMMENT ON COLUMN events.registration_deadline  IS 'Auto-closes registration at this datetime, overrides registration_open toggle';
COMMENT ON COLUMN events.venue_address          IS 'Street address of venue, used in travel emails and invitation letters';
COMMENT ON COLUMN events.venue_map_url          IS 'Google Maps share URL for the venue';
COMMENT ON COLUMN events.favicon_url            IS 'ICO or PNG favicon for the public registration page';
COMMENT ON COLUMN events.contact_phone          IS 'Support phone number shown on registration page (E.164 format preferred)';
COMMENT ON COLUMN events.social_twitter         IS 'Twitter/X profile or event URL';
COMMENT ON COLUMN events.social_instagram       IS 'Instagram profile or event URL';
COMMENT ON COLUMN events.social_linkedin        IS 'LinkedIn page or event URL';
COMMENT ON COLUMN events.seo_title              IS 'Browser tab title and OG title for public registration page (max 70 chars)';
COMMENT ON COLUMN events.seo_description        IS 'Meta description for search engines and social sharing (max 160 chars)';


-- ============================================================
-- 2. event_settings table — new columns
-- ============================================================

-- Automation — reminder
ALTER TABLE event_settings
  ADD COLUMN IF NOT EXISTS auto_send_reminder   boolean NOT NULL DEFAULT false;

ALTER TABLE event_settings
  ADD COLUMN IF NOT EXISTS reminder_lead_days   integer NOT NULL DEFAULT 3
    CHECK (reminder_lead_days BETWEEN 1 AND 30);

-- Registration
ALTER TABLE event_settings
  ADD COLUMN IF NOT EXISTS auto_waitlist        boolean NOT NULL DEFAULT false;

-- Integrations (all stored as single JSON blob)
ALTER TABLE event_settings
  ADD COLUMN IF NOT EXISTS integrations         jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN event_settings.auto_send_reminder  IS 'Send reminder email N days before event start';
COMMENT ON COLUMN event_settings.reminder_lead_days  IS 'Days before event to send reminder (1–30)';
COMMENT ON COLUMN event_settings.auto_waitlist       IS 'Auto-switch to waitlist when max_attendees is reached (requires Waitlist module ON)';
COMMENT ON COLUMN event_settings.integrations        IS 'Per-event integration config: razorpay, zepto, gallabox. Secrets stored encrypted, never returned in GET.';


-- ============================================================
-- 3. event_settings_log table — new table
-- ============================================================

CREATE TABLE IF NOT EXISTS event_settings_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  changed_by   uuid,                          -- auth.users id; nullable so service_role inserts work
  changed_at   timestamptz NOT NULL DEFAULT now(),
  section      text NOT NULL,                 -- general | date | location | registration | modules | automation | branding | links | integrations | team | advanced
  summary      text,                          -- human-readable change summary
  snapshot     jsonb                          -- full settings snapshot at time of save
);

-- Index for fast per-event log queries
CREATE INDEX IF NOT EXISTS idx_event_settings_log_event_id
  ON event_settings_log(event_id, changed_at DESC);

COMMENT ON TABLE  event_settings_log             IS 'Audit log of all event settings changes';
COMMENT ON COLUMN event_settings_log.changed_by  IS 'auth.users id of the admin who made the change (nullable for service_role operations)';
COMMENT ON COLUMN event_settings_log.section     IS 'Which settings tab was saved';
COMMENT ON COLUMN event_settings_log.summary     IS 'Server-generated human-readable summary of what changed';
COMMENT ON COLUMN event_settings_log.snapshot    IS 'Full settings snapshot for audit/rollback purposes';


-- ============================================================
-- 4. event_members table — new table
-- ============================================================

CREATE TABLE IF NOT EXISTS event_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role         text NOT NULL DEFAULT 'viewer'
                 CHECK (role IN ('owner','admin','editor','viewer','checkin_staff')),
  invited_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at   timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz,                   -- null until invite is accepted
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- one role per user per event
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_members_event_id
  ON event_members(event_id);

CREATE INDEX IF NOT EXISTS idx_event_members_user_id
  ON event_members(user_id);

COMMENT ON TABLE  event_members              IS 'Per-event team members and their roles';
COMMENT ON COLUMN event_members.role         IS 'owner | admin | editor | viewer | checkin_staff';
COMMENT ON COLUMN event_members.accepted_at  IS 'Null until the invited user accepts the invite';


-- ============================================================
-- 5. Row Level Security
-- ============================================================

-- event_settings_log: admins of the event can read; service_role writes
ALTER TABLE event_settings_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_settings_log_select" ON event_settings_log;
CREATE POLICY "event_settings_log_select"
  ON event_settings_log FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM event_members
      WHERE event_id = event_settings_log.event_id
        AND role IN ('owner','admin','editor')
    )
  );

-- event_members: event owners/admins can manage; members can read their own row
ALTER TABLE event_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_members_select" ON event_members;
CREATE POLICY "event_members_select"
  ON event_members FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM event_members em2
      WHERE em2.event_id = event_members.event_id
    )
  );

DROP POLICY IF EXISTS "event_members_insert_update_delete" ON event_members;
CREATE POLICY "event_members_insert_update_delete"
  ON event_members FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM event_members em2
      WHERE em2.event_id = event_members.event_id
        AND em2.role IN ('owner','admin')
    )
  );


-- ============================================================
-- 6. Regenerate types reminder (run locally after migration)
-- ============================================================
-- supabase gen types typescript --linked > src/types/database.types.ts
