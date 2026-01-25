-- AMASI Faculty Management System - Safe Migration
-- This script won't fail on existing objects

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS (Create only if not exists)
-- ============================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'staff', 'faculty');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE event_type AS ENUM ('conference', 'workshop', 'course', 'webinar');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE event_status AS ENUM ('draft', 'planning', 'active', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE session_type AS ENUM ('plenary', 'symposium', 'panel', 'workshop', 'hands_on', 'video', 'lecture');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'tentative');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE faculty_role AS ENUM ('speaker', 'moderator', 'panelist', 'chairperson', 'faculty');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded', 'waived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE delegate_source AS ENUM ('manual', 'csv_import', 'tito', 'online');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE certificate_type AS ENUM ('attendance', 'participation', 'speaker', 'moderator', 'faculty');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE travel_mode AS ENUM ('flight', 'train', 'car', 'self');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE accommodation_status AS ENUM ('pending', 'confirmed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- TABLES (Create only if not exists)
-- ============================================

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role user_role DEFAULT 'staff',
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  type event_type NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  venue TEXT,
  city TEXT,
  status event_status DEFAULT 'draft',
  max_delegates INTEGER,
  registration_fee DECIMAL(10,2),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type session_type NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  hall TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faculty
CREATE TABLE IF NOT EXISTS faculty (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  salutation TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  whatsapp TEXT,
  designation TEXT,
  institution TEXT,
  city TEXT,
  country TEXT DEFAULT 'India',
  specialization TEXT,
  bio TEXT,
  photo_url TEXT,
  amasi_member_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faculty Invitations
CREATE TABLE IF NOT EXISTS faculty_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  status invitation_status DEFAULT 'pending',
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  invitation_token TEXT UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, faculty_id)
);

-- Faculty Commitments
CREATE TABLE IF NOT EXISTS faculty_commitments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES faculty_invitations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role faculty_role NOT NULL,
  topic TEXT,
  duration_minutes INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delegates
CREATE TABLE IF NOT EXISTS delegates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registration_id TEXT NOT NULL,
  salutation TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  designation TEXT,
  institution TEXT,
  city TEXT,
  country TEXT DEFAULT 'India',
  category TEXT,
  registration_type TEXT,
  payment_status payment_status DEFAULT 'pending',
  amount_paid DECIMAL(10,2),
  badge_printed BOOLEAN DEFAULT FALSE,
  checked_in BOOLEAN DEFAULT FALSE,
  check_in_time TIMESTAMPTZ,
  source delegate_source DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, registration_id)
);

-- Certificates
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  delegate_id UUID REFERENCES delegates(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES faculty(id) ON DELETE CASCADE,
  type certificate_type NOT NULL,
  certificate_number TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  downloaded_at TIMESTAMPTZ,
  template_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (delegate_id IS NOT NULL OR faculty_id IS NOT NULL)
);

-- Travel Details
CREATE TABLE IF NOT EXISTS travel_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES faculty_invitations(id) ON DELETE CASCADE UNIQUE,
  travel_mode travel_mode DEFAULT 'self',
  arrival_date DATE,
  arrival_time TIME,
  arrival_details TEXT,
  departure_date DATE,
  departure_time TIME,
  departure_details TEXT,
  pickup_required BOOLEAN DEFAULT FALSE,
  drop_required BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accommodation
CREATE TABLE IF NOT EXISTS accommodation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES faculty_invitations(id) ON DELETE CASCADE UNIQUE,
  hotel_name TEXT,
  room_type TEXT,
  check_in_date DATE,
  check_out_date DATE,
  confirmation_number TEXT,
  status accommodation_status DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES (Create only if not exists)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_events_code ON events(code);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_dates ON events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_sessions_event ON sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_faculty_email ON faculty(email);
CREATE INDEX IF NOT EXISTS idx_faculty_name ON faculty(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_invitations_event ON faculty_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_invitations_faculty ON faculty_invitations(faculty_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON faculty_invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON faculty_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_commitments_invitation ON faculty_commitments(invitation_id);
CREATE INDEX IF NOT EXISTS idx_commitments_session ON faculty_commitments(session_id);
CREATE INDEX IF NOT EXISTS idx_delegates_event ON delegates(event_id);
CREATE INDEX IF NOT EXISTS idx_delegates_email ON delegates(email);
CREATE INDEX IF NOT EXISTS idx_delegates_registration ON delegates(registration_id);
CREATE INDEX IF NOT EXISTS idx_delegates_checked_in ON delegates(event_id, checked_in);
CREATE INDEX IF NOT EXISTS idx_certificates_event ON certificates(event_id);
CREATE INDEX IF NOT EXISTS idx_certificates_delegate ON certificates(delegate_id);
CREATE INDEX IF NOT EXISTS idx_certificates_faculty ON certificates(faculty_id);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON certificates(certificate_number);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate certificate number
CREATE OR REPLACE FUNCTION generate_certificate_number(event_code TEXT, cert_type TEXT)
RETURNS TEXT AS $$
DECLARE
  seq_num INTEGER;
  cert_num TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq_num FROM certificates WHERE certificate_number LIKE event_code || '-' || cert_type || '-%';
  cert_num := event_code || '-' || cert_type || '-' || LPAD(seq_num::TEXT, 5, '0');
  RETURN cert_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS (Drop and recreate)
-- ============================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
DROP TRIGGER IF EXISTS update_faculty_updated_at ON faculty;
DROP TRIGGER IF EXISTS update_invitations_updated_at ON faculty_invitations;
DROP TRIGGER IF EXISTS update_commitments_updated_at ON faculty_commitments;
DROP TRIGGER IF EXISTS update_delegates_updated_at ON delegates;
DROP TRIGGER IF EXISTS update_travel_updated_at ON travel_details;
DROP TRIGGER IF EXISTS update_accommodation_updated_at ON accommodation;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_faculty_updated_at BEFORE UPDATE ON faculty FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON faculty_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_commitments_updated_at BEFORE UPDATE ON faculty_commitments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_delegates_updated_at BEFORE UPDATE ON delegates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_travel_updated_at BEFORE UPDATE ON travel_details FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_accommodation_updated_at BEFORE UPDATE ON accommodation FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE accommodation ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view events" ON events;
DROP POLICY IF EXISTS "Admins can insert events" ON events;
DROP POLICY IF EXISTS "Admins can update events" ON events;
DROP POLICY IF EXISTS "Admins can delete events" ON events;
DROP POLICY IF EXISTS "Authenticated users can view sessions" ON sessions;
DROP POLICY IF EXISTS "Admins can manage sessions" ON sessions;
DROP POLICY IF EXISTS "Authenticated users can view faculty" ON faculty;
DROP POLICY IF EXISTS "Staff can manage faculty" ON faculty;
DROP POLICY IF EXISTS "Authenticated users can view invitations" ON faculty_invitations;
DROP POLICY IF EXISTS "Staff can manage invitations" ON faculty_invitations;
DROP POLICY IF EXISTS "Authenticated users can view commitments" ON faculty_commitments;
DROP POLICY IF EXISTS "Staff can manage commitments" ON faculty_commitments;
DROP POLICY IF EXISTS "Authenticated users can view delegates" ON delegates;
DROP POLICY IF EXISTS "Staff can manage delegates" ON delegates;
DROP POLICY IF EXISTS "Authenticated users can view certificates" ON certificates;
DROP POLICY IF EXISTS "Staff can manage certificates" ON certificates;
DROP POLICY IF EXISTS "Authenticated users can view travel" ON travel_details;
DROP POLICY IF EXISTS "Staff can manage travel" ON travel_details;
DROP POLICY IF EXISTS "Authenticated users can view accommodation" ON accommodation;
DROP POLICY IF EXISTS "Staff can manage accommodation" ON accommodation;

-- Create policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
);

CREATE POLICY "Authenticated users can view events" ON events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert events" ON events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
);
CREATE POLICY "Admins can update events" ON events FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
);
CREATE POLICY "Admins can delete events" ON events FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
);

CREATE POLICY "Authenticated users can view sessions" ON sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sessions" ON sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'staff'))
);

CREATE POLICY "Authenticated users can view faculty" ON faculty FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage faculty" ON faculty FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'staff'))
);

CREATE POLICY "Authenticated users can view invitations" ON faculty_invitations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage invitations" ON faculty_invitations FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'staff'))
);

CREATE POLICY "Authenticated users can view commitments" ON faculty_commitments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage commitments" ON faculty_commitments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'staff'))
);

CREATE POLICY "Authenticated users can view delegates" ON delegates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage delegates" ON delegates FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'staff'))
);

CREATE POLICY "Authenticated users can view certificates" ON certificates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage certificates" ON certificates FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'staff'))
);

CREATE POLICY "Authenticated users can view travel" ON travel_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage travel" ON travel_details FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'staff'))
);

CREATE POLICY "Authenticated users can view accommodation" ON accommodation FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage accommodation" ON accommodation FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'staff'))
);

-- ============================================
-- SAMPLE DATA
-- ============================================

INSERT INTO events (name, code, type, description, start_date, end_date, venue, city, status) VALUES
('AMASICON 2026', 'AMASICON2026', 'conference', 'Annual Conference of Association of Minimal Access Surgeons of India', '2026-08-28', '2026-08-30', 'Marriott Hotel', 'Jaipur', 'planning')
ON CONFLICT (code) DO NOTHING;

-- Done!
SELECT 'AMASI Schema migration completed successfully!' as status;
