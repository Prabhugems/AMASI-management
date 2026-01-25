-- Faculty Assignment Tracking System
-- Tracks speaker/chairperson confirmations for sessions

-- 1. FACULTY ASSIGNMENTS TABLE
-- Links faculty to sessions with confirmation status
CREATE TABLE IF NOT EXISTS faculty_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,

  -- Faculty details (stored for history even if faculty deleted)
  faculty_name TEXT NOT NULL,
  faculty_email TEXT,
  faculty_phone TEXT,

  -- Role in session
  role TEXT NOT NULL CHECK (role IN ('speaker', 'chairperson', 'moderator', 'panelist')),

  -- Topic details (for speakers)
  topic_title TEXT,
  topic_description TEXT,
  duration_minutes INTEGER,

  -- Schedule info
  session_date DATE,
  start_time TIME,
  end_time TIME,
  hall TEXT,
  session_name TEXT,

  -- Confirmation status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'invited', 'confirmed', 'declined', 'change_requested', 'cancelled')),

  -- Response details
  response_notes TEXT,
  change_request_details TEXT,
  responded_at TIMESTAMPTZ,

  -- Invitation tracking
  invitation_sent_at TIMESTAMPTZ,
  invitation_token TEXT UNIQUE,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,

  -- Admin notes
  admin_notes TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,

  -- Constraints
  UNIQUE(session_id, faculty_email, role)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_faculty_assignments_event ON faculty_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_faculty_assignments_session ON faculty_assignments(session_id);
CREATE INDEX IF NOT EXISTS idx_faculty_assignments_faculty ON faculty_assignments(faculty_id);
CREATE INDEX IF NOT EXISTS idx_faculty_assignments_status ON faculty_assignments(status);
CREATE INDEX IF NOT EXISTS idx_faculty_assignments_email ON faculty_assignments(faculty_email);
CREATE INDEX IF NOT EXISTS idx_faculty_assignments_token ON faculty_assignments(invitation_token);

-- 2. ASSIGNMENT EMAILS TABLE
-- Track all emails sent for assignments
CREATE TABLE IF NOT EXISTS assignment_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES faculty_assignments(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Email details
  email_type TEXT NOT NULL CHECK (email_type IN ('invitation', 'reminder', 'confirmation', 'declined_ack', 'change_request', 'update', 'final_confirmation')),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body_preview TEXT,

  -- Status tracking
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Email service reference
  external_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_emails_assignment ON assignment_emails(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_emails_event ON assignment_emails(event_id);
CREATE INDEX IF NOT EXISTS idx_assignment_emails_status ON assignment_emails(status);

-- 3. SESSION CONFIRMATION SUMMARY VIEW
-- Aggregates confirmation status per session
CREATE OR REPLACE VIEW session_confirmation_summary AS
SELECT
  s.id as session_id,
  s.event_id,
  s.session_name,
  s.session_date,
  s.start_time,
  s.hall,
  s.specialty_track,
  COUNT(fa.id) as total_faculty,
  COUNT(CASE WHEN fa.status = 'confirmed' THEN 1 END) as confirmed_count,
  COUNT(CASE WHEN fa.status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN fa.status = 'invited' THEN 1 END) as invited_count,
  COUNT(CASE WHEN fa.status = 'declined' THEN 1 END) as declined_count,
  COUNT(CASE WHEN fa.status = 'change_requested' THEN 1 END) as change_requested_count,
  COUNT(CASE WHEN fa.role = 'speaker' THEN 1 END) as speaker_count,
  COUNT(CASE WHEN fa.role = 'chairperson' THEN 1 END) as chairperson_count,
  COUNT(CASE WHEN fa.role = 'moderator' THEN 1 END) as moderator_count,
  CASE
    WHEN COUNT(fa.id) = 0 THEN 'no_assignments'
    WHEN COUNT(CASE WHEN fa.status = 'confirmed' THEN 1 END) = COUNT(fa.id) THEN 'all_confirmed'
    WHEN COUNT(CASE WHEN fa.status IN ('declined', 'change_requested') THEN 1 END) > 0 THEN 'needs_attention'
    WHEN COUNT(CASE WHEN fa.status = 'pending' THEN 1 END) = COUNT(fa.id) THEN 'not_started'
    ELSE 'in_progress'
  END as overall_status
FROM sessions s
LEFT JOIN faculty_assignments fa ON s.id = fa.session_id
GROUP BY s.id, s.event_id, s.session_name, s.session_date, s.start_time, s.hall, s.specialty_track;

-- 4. RLS POLICIES
ALTER TABLE faculty_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_emails ENABLE ROW LEVEL SECURITY;

-- Service role full access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'faculty_assignments' AND policyname = 'Service role full access faculty_assignments') THEN
    CREATE POLICY "Service role full access faculty_assignments" ON faculty_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assignment_emails' AND policyname = 'Service role full access assignment_emails') THEN
    CREATE POLICY "Service role full access assignment_emails" ON assignment_emails FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. UPDATE TRIGGER for updated_at
CREATE OR REPLACE FUNCTION update_faculty_assignment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_faculty_assignment_timestamp ON faculty_assignments;
CREATE TRIGGER update_faculty_assignment_timestamp
  BEFORE UPDATE ON faculty_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_faculty_assignment_timestamp();

-- 6. Function to generate unique invitation token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..32 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 7. Function to create assignments from session speakers/chairpersons
CREATE OR REPLACE FUNCTION sync_session_faculty_assignments(p_session_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_session RECORD;
  v_count INTEGER := 0;
  v_speaker TEXT;
  v_chairperson TEXT;
  v_email TEXT;
  v_phone TEXT;
  v_parts TEXT[];
BEGIN
  -- Get session details
  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;

  IF v_session IS NULL THEN
    RETURN 0;
  END IF;

  -- Process speakers from speakers_text (format: "Name (email, phone) | Name2 (email2, phone2)")
  IF v_session.speakers_text IS NOT NULL AND v_session.speakers_text != '' THEN
    FOREACH v_speaker IN ARRAY string_to_array(v_session.speakers_text, ' | ')
    LOOP
      -- Extract name, email, phone from "Name (email, phone)" format
      v_parts := regexp_matches(v_speaker, '^([^(]+)\s*(?:\(([^,]*),?\s*([^)]*)\))?$');
      IF v_parts IS NOT NULL AND array_length(v_parts, 1) > 0 THEN
        INSERT INTO faculty_assignments (
          event_id, session_id, faculty_name, faculty_email, faculty_phone,
          role, session_date, start_time, end_time, hall, session_name,
          topic_title, invitation_token
        ) VALUES (
          v_session.event_id, p_session_id, trim(v_parts[1]),
          NULLIF(trim(v_parts[2]), ''), NULLIF(trim(v_parts[3]), ''),
          'speaker', v_session.session_date, v_session.start_time, v_session.end_time,
          v_session.hall, v_session.session_name, v_session.session_name,
          generate_invitation_token()
        )
        ON CONFLICT (session_id, faculty_email, role) DO NOTHING;
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END IF;

  -- Process chairpersons from chairpersons_text
  IF v_session.chairpersons_text IS NOT NULL AND v_session.chairpersons_text != '' THEN
    FOREACH v_chairperson IN ARRAY string_to_array(v_session.chairpersons_text, ' | ')
    LOOP
      v_parts := regexp_matches(v_chairperson, '^([^(]+)\s*(?:\(([^,]*),?\s*([^)]*)\))?$');
      IF v_parts IS NOT NULL AND array_length(v_parts, 1) > 0 THEN
        INSERT INTO faculty_assignments (
          event_id, session_id, faculty_name, faculty_email, faculty_phone,
          role, session_date, start_time, end_time, hall, session_name,
          invitation_token
        ) VALUES (
          v_session.event_id, p_session_id, trim(v_parts[1]),
          NULLIF(trim(v_parts[2]), ''), NULLIF(trim(v_parts[3]), ''),
          'chairperson', v_session.session_date, v_session.start_time, v_session.end_time,
          v_session.hall, v_session.session_name,
          generate_invitation_token()
        )
        ON CONFLICT (session_id, faculty_email, role) DO NOTHING;
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

SELECT 'Faculty assignment tracking schema created!' as status;
