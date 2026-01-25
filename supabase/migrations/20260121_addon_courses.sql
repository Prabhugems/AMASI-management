-- Addon Courses & Certificate System
-- Tracks purchased addons and links courses to certificates

-- 1. Registration Addons - Track what addons each registration purchased
CREATE TABLE IF NOT EXISTS registration_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  addon_variant_id UUID REFERENCES addon_variants(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) DEFAULT 0,
  -- For course addons
  certificate_issued BOOLEAN DEFAULT false,
  certificate_issued_at TIMESTAMPTZ,
  certificate_url TEXT,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(registration_id, addon_id, addon_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_registration_addons_registration ON registration_addons(registration_id);
CREATE INDEX IF NOT EXISTS idx_registration_addons_addon ON registration_addons(addon_id);

-- 2. Add certificate template linking to addons (for course addons)
ALTER TABLE addons
ADD COLUMN IF NOT EXISTS is_course BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS certificate_template_id UUID REFERENCES certificate_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS course_description TEXT,
ADD COLUMN IF NOT EXISTS course_duration TEXT,
ADD COLUMN IF NOT EXISTS course_instructor TEXT;

-- 3. RLS for registration_addons
ALTER TABLE registration_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access registration_addons"
  ON registration_addons FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own registration addons"
  ON registration_addons FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM registrations r
      WHERE r.id = registration_addons.registration_id
      AND r.user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE registration_addons IS 'Tracks addons purchased with each registration';
COMMENT ON COLUMN registration_addons.certificate_issued IS 'Whether certificate has been issued for this course addon';
COMMENT ON COLUMN addons.is_course IS 'Whether this addon is a course that can issue certificates';
COMMENT ON COLUMN addons.certificate_template_id IS 'Certificate template to use for course completion';
