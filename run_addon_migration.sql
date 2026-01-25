-- Add new columns to addons table (without certificate foreign key for now)
ALTER TABLE addons
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS variant_type TEXT,
ADD COLUMN IF NOT EXISTS is_course BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS certificate_template_id UUID,
ADD COLUMN IF NOT EXISTS course_description TEXT,
ADD COLUMN IF NOT EXISTS course_duration TEXT,
ADD COLUMN IF NOT EXISTS course_instructor TEXT;

-- Create addon_ticket_links if not exists
CREATE TABLE IF NOT EXISTS addon_ticket_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  max_quantity_per_attendee INTEGER DEFAULT 1,
  is_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(addon_id, ticket_type_id)
);
CREATE INDEX IF NOT EXISTS idx_addon_ticket_links_addon_id ON addon_ticket_links(addon_id);
CREATE INDEX IF NOT EXISTS idx_addon_ticket_links_ticket_id ON addon_ticket_links(ticket_type_id);

-- RLS for addon_ticket_links
ALTER TABLE addon_ticket_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'addon_ticket_links' AND policyname = 'Service role full access addon_ticket_links') THEN
    CREATE POLICY "Service role full access addon_ticket_links" ON addon_ticket_links FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
