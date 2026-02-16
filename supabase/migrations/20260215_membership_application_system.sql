-- Membership Application System Migration
-- Adds extended member fields and membership_applications table

-- ============================================================
-- 1. Add new columns to members table
-- ============================================================

-- Personal
ALTER TABLE members ADD COLUMN IF NOT EXISTS father_name TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS application_no TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS application_date DATE;

-- Contact
ALTER TABLE members ADD COLUMN IF NOT EXISTS mobile_code TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS landline TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS std_code TEXT;

-- Address
ALTER TABLE members ADD COLUMN IF NOT EXISTS street_address_1 TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS street_address_2 TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Education - UG
ALTER TABLE members ADD COLUMN IF NOT EXISTS ug_college TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS ug_university TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS ug_year TEXT;

-- Education - PG
ALTER TABLE members ADD COLUMN IF NOT EXISTS pg_degree TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS pg_college TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS pg_university TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS pg_year TEXT;

-- Medical Council
ALTER TABLE members ADD COLUMN IF NOT EXISTS mci_council_number TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS mci_council_state TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS imr_registration_no TEXT;

-- ASI / Organization
ALTER TABLE members ADD COLUMN IF NOT EXISTS asi_membership_no TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS asi_state TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS other_intl_org TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS other_intl_org_value TEXT;

-- ============================================================
-- 2. Create membership_applications table
-- ============================================================

CREATE TABLE IF NOT EXISTS membership_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Personal
  name TEXT NOT NULL,
  father_name TEXT,
  date_of_birth DATE,
  nationality TEXT DEFAULT 'Indian',
  gender TEXT,
  membership_type TEXT,

  -- Contact
  email TEXT NOT NULL,
  phone TEXT,
  mobile_code TEXT DEFAULT '+91',
  landline TEXT,
  std_code TEXT,

  -- Address
  street_address_1 TEXT,
  street_address_2 TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  postal_code TEXT,

  -- Education - UG
  ug_college TEXT,
  ug_university TEXT,
  ug_year TEXT,

  -- Education - PG
  pg_degree TEXT,
  pg_college TEXT,
  pg_university TEXT,
  pg_year TEXT,

  -- Medical Council
  mci_council_number TEXT,
  mci_council_state TEXT,
  imr_registration_no TEXT,

  -- ASI / Organization
  asi_membership_no TEXT,
  asi_state TEXT,
  other_intl_org TEXT,
  other_intl_org_value TEXT,

  -- Workflow
  status TEXT NOT NULL DEFAULT 'pending',
  application_number TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  assigned_amasi_number INTEGER,
  member_id UUID REFERENCES members(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. RLS Policies for membership_applications
-- ============================================================

ALTER TABLE membership_applications ENABLE ROW LEVEL SECURITY;

-- Anyone (anon) can insert applications (public form)
CREATE POLICY "anon_insert_applications" ON membership_applications
  FOR INSERT TO anon
  WITH CHECK (true);

-- Authenticated users can do everything (admin review)
CREATE POLICY "authenticated_all_applications" ON membership_applications
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 4. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_membership_applications_status ON membership_applications(status);
CREATE INDEX IF NOT EXISTS idx_membership_applications_email ON membership_applications(email);
CREATE INDEX IF NOT EXISTS idx_members_application_no ON members(application_no);
