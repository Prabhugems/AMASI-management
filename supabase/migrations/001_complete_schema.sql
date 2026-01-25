-- ============================================
-- AMASI Event Management - Complete Schema
-- Run this ONCE to set up all tables/columns
-- ============================================

-- 0. EVENTS TABLE - Add missing columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS edition INT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS scientific_chairman TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizing_chairman TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#10b981';
ALTER TABLE events ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_open BOOLEAN DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_attendees INT;

-- 1. TICKET TYPES - Add missing columns
ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS form_id UUID REFERENCES forms(id) ON DELETE SET NULL;
ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS exclusivity_group TEXT;
CREATE INDEX IF NOT EXISTS idx_ticket_types_form_id ON ticket_types(form_id);

-- 2. EVENT SETTINGS - Extended settings for buyer/group registration
DO $$
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_settings' AND column_name = 'allow_buyers') THEN
    ALTER TABLE event_settings ADD COLUMN allow_buyers BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_settings' AND column_name = 'allow_multiple_ticket_types') THEN
    ALTER TABLE event_settings ADD COLUMN allow_multiple_ticket_types BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_settings' AND column_name = 'allow_multiple_addons') THEN
    ALTER TABLE event_settings ADD COLUMN allow_multiple_addons BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_settings' AND column_name = 'customize_registration_id') THEN
    ALTER TABLE event_settings ADD COLUMN customize_registration_id BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_settings' AND column_name = 'registration_prefix') THEN
    ALTER TABLE event_settings ADD COLUMN registration_prefix TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_settings' AND column_name = 'registration_start_number') THEN
    ALTER TABLE event_settings ADD COLUMN registration_start_number INT DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_settings' AND column_name = 'registration_suffix') THEN
    ALTER TABLE event_settings ADD COLUMN registration_suffix TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_settings' AND column_name = 'current_registration_number') THEN
    ALTER TABLE event_settings ADD COLUMN current_registration_number INT DEFAULT 0;
  END IF;
END $$;

-- 3. BUYERS TABLE - For group registrations
CREATE TABLE IF NOT EXISTS buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  gst_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_buyers_event_id ON buyers(event_id);
CREATE INDEX IF NOT EXISTS idx_buyers_email ON buyers(email);

-- 4. ORDERS TABLE - Links buyer to registrations
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES buyers(id) ON DELETE SET NULL,
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  payment_status TEXT DEFAULT 'pending',
  payment_id UUID REFERENCES payments(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);

-- 5. ADDONS TABLE - Additional items for tickets
CREATE TABLE IF NOT EXISTS addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) DEFAULT 0,
  quantity_total INT,
  quantity_sold INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_addons_event_id ON addons(event_id);

-- 6. Add order_id to registrations
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_registrations_order_id ON registrations(order_id);

-- 7. EVENT PAGE ANALYTICS
CREATE TABLE IF NOT EXISTS event_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  page_type TEXT NOT NULL DEFAULT 'event',
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  device_type TEXT,
  browser TEXT,
  country TEXT,
  city TEXT,
  ip_hash TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_page_views_event_id ON event_page_views(event_id);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON event_page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_id ON event_page_views(visitor_id);

-- 8. DAILY ANALYTICS SUMMARY
CREATE TABLE IF NOT EXISTS event_analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  page_views INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,
  registration_page_views INT DEFAULT 0,
  checkout_page_views INT DEFAULT 0,
  registrations INT DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  top_referrer TEXT,
  top_utm_source TEXT,
  desktop_views INT DEFAULT 0,
  mobile_views INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, date)
);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_event_date ON event_analytics_daily(event_id, date);

-- 9. EVENT LEADS
CREATE TABLE IF NOT EXISTS event_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  source TEXT DEFAULT 'notify_me',
  visitor_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  status TEXT DEFAULT 'new',
  converted_at TIMESTAMPTZ,
  registration_id UUID REFERENCES registrations(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, email)
);
CREATE INDEX IF NOT EXISTS idx_leads_event_id ON event_leads(event_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON event_leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON event_leads(status);

-- 10. RLS POLICIES FOR NEW TABLES
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_leads ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for API operations)
DO $$
BEGIN
  -- Buyers
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'buyers' AND policyname = 'Service role full access buyers') THEN
    CREATE POLICY "Service role full access buyers" ON buyers FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- Orders
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Service role full access orders') THEN
    CREATE POLICY "Service role full access orders" ON orders FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- Addons
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'addons' AND policyname = 'Service role full access addons') THEN
    CREATE POLICY "Service role full access addons" ON addons FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- Page Views
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_page_views' AND policyname = 'Allow public insert page_views') THEN
    CREATE POLICY "Allow public insert page_views" ON event_page_views FOR INSERT TO public WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_page_views' AND policyname = 'Service role full access page_views') THEN
    CREATE POLICY "Service role full access page_views" ON event_page_views FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- Analytics Daily
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_analytics_daily' AND policyname = 'Service role full access analytics') THEN
    CREATE POLICY "Service role full access analytics" ON event_analytics_daily FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- Leads
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_leads' AND policyname = 'Allow public insert leads') THEN
    CREATE POLICY "Allow public insert leads" ON event_leads FOR INSERT TO public WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_leads' AND policyname = 'Service role full access leads') THEN
    CREATE POLICY "Service role full access leads" ON event_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Done!
SELECT 'Schema migration complete!' as status;
