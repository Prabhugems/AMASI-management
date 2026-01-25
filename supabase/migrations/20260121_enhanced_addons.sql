-- Enhanced Addons Schema
-- Supports: variants (like T-shirt sizes), ticket linking, images, free/paid

-- 1. Update addons table with new fields
ALTER TABLE addons
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS variant_type TEXT; -- e.g., "Size", "Color", "Type"

-- 2. Create addon_variants table for variant options
CREATE TABLE IF NOT EXISTS addon_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "S", "M", "L", "XL"
  price DECIMAL(10,2) DEFAULT 0, -- Override price for this variant (0 = use addon price)
  stock INTEGER, -- NULL = unlimited
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_addon_variants_addon_id ON addon_variants(addon_id);

-- 3. Create addon_ticket_links table to link addons to specific tickets
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

-- 4. RLS Policies
ALTER TABLE addon_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_ticket_links ENABLE ROW LEVEL SECURITY;

-- Service role bypass
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'addon_variants' AND policyname = 'Service role full access addon_variants') THEN
    CREATE POLICY "Service role full access addon_variants" ON addon_variants FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'addon_ticket_links' AND policyname = 'Service role full access addon_ticket_links') THEN
    CREATE POLICY "Service role full access addon_ticket_links" ON addon_ticket_links FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Comments
COMMENT ON COLUMN addons.has_variants IS 'Whether this addon has multiple variants (like sizes)';
COMMENT ON COLUMN addons.variant_type IS 'Label for variants, e.g., Size, Color, Type';
COMMENT ON TABLE addon_variants IS 'Variant options for addons (e.g., S, M, L, XL for T-shirts)';
COMMENT ON TABLE addon_ticket_links IS 'Links addons to specific ticket types with quantity limits';
