-- Sponsors Module: Sponsors, Tiers, Contacts, and Stalls

-- Sponsor Tiers Table
CREATE TABLE IF NOT EXISTS sponsor_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Platinum, Gold, Silver, Bronze
  display_order INTEGER DEFAULT 0,
  color TEXT DEFAULT '#6366f1',
  benefits JSONB DEFAULT '[]', -- Array of benefit strings
  logo_size TEXT DEFAULT 'medium', -- small, medium, large, xlarge
  stall_size TEXT, -- 3x3, 6x3, 9x3, etc.
  complimentary_passes INTEGER DEFAULT 0,
  price DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sponsors Table
CREATE TABLE IF NOT EXISTS sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES sponsor_tiers(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  logo_url TEXT,
  website TEXT,
  description TEXT,

  -- Company details
  company_address TEXT,
  company_phone TEXT,
  company_email TEXT,

  -- Status
  status TEXT DEFAULT 'pending', -- pending, confirmed, cancelled
  confirmed_at TIMESTAMPTZ,

  -- Payment
  amount_agreed DECIMAL(12,2) DEFAULT 0,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending', -- pending, partial, paid

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sponsor Contacts Table
CREATE TABLE IF NOT EXISTS sponsor_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID REFERENCES sponsors(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  designation TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,

  -- For badge generation
  needs_badge BOOLEAN DEFAULT true,
  badge_generated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stalls/Booths Table
CREATE TABLE IF NOT EXISTS stalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  sponsor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL,

  stall_number TEXT NOT NULL,
  stall_name TEXT, -- Optional custom name
  size TEXT, -- 3x3, 6x3, 9x3, custom
  location TEXT, -- Hall A, Hall B, Outdoor

  -- Position for floor plan (grid-based)
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 1,
  height INTEGER DEFAULT 1,

  -- Status
  status TEXT DEFAULT 'available', -- available, reserved, assigned, setup_complete

  -- Amenities
  amenities JSONB DEFAULT '[]', -- power, wifi, table, chairs, etc.

  -- Pricing
  price DECIMAL(12,2) DEFAULT 0,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sponsor_tiers_event ON sponsor_tiers(event_id);
CREATE INDEX IF NOT EXISTS idx_sponsors_event ON sponsors(event_id);
CREATE INDEX IF NOT EXISTS idx_sponsors_tier ON sponsors(tier_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_contacts_sponsor ON sponsor_contacts(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_stalls_event ON stalls(event_id);
CREATE INDEX IF NOT EXISTS idx_stalls_sponsor ON stalls(sponsor_id);

-- Enable RLS
ALTER TABLE sponsor_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stalls ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all for authenticated users" ON sponsor_tiers FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON sponsors FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON sponsor_contacts FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON stalls FOR ALL USING (true);
