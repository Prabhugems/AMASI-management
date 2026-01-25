-- ============================================
-- AMASI Event Management - Buyer/Group Registration Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. EVENT SETTINGS TABLE
-- Stores per-event configuration for registration behavior
CREATE TABLE IF NOT EXISTS event_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE UNIQUE,

  -- Login Settings
  allow_attendee_login BOOLEAN DEFAULT false,

  -- Attendee Settings
  allow_multiple_ticket_types BOOLEAN DEFAULT false,
  allow_multiple_addons BOOLEAN DEFAULT true,

  -- Registration ID Settings
  customize_registration_id BOOLEAN DEFAULT false,
  registration_prefix TEXT,
  registration_start_number INT DEFAULT 1,
  registration_suffix TEXT,
  current_registration_number INT DEFAULT 0,

  -- BUYER SETTINGS (Group Registration)
  allow_buyers BOOLEAN DEFAULT false,
  buyer_form_id UUID REFERENCES forms(id) ON DELETE SET NULL,

  -- Other Settings
  require_approval BOOLEAN DEFAULT false,
  send_confirmation_email BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_event_settings_event_id ON event_settings(event_id);

-- 2. BUYERS TABLE
-- Stores buyer (coordinator) information for group registrations
CREATE TABLE IF NOT EXISTS buyers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,

  -- Basic Info (Always collected)
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,

  -- Custom form data (from buyer_form_id form)
  form_data JSONB DEFAULT '{}',

  -- Payment tracking
  total_amount DECIMAL(10,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_buyers_event_id ON buyers(event_id);
CREATE INDEX IF NOT EXISTS idx_buyers_email ON buyers(email);

-- 3. ORDERS TABLE
-- Links multiple registrations to a single payment
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES buyers(id) ON DELETE SET NULL,

  order_number TEXT UNIQUE,

  -- Pricing
  subtotal DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'INR',

  -- Payment
  payment_status TEXT DEFAULT 'pending',
  payment_method TEXT,
  payment_id TEXT,

  -- Coupon
  coupon_code TEXT,
  discount_code_id UUID,  -- References discount_codes(id) if table exists

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- 4. ADDONS TABLE
-- Additional items that can be added to registrations
CREATE TABLE IF NOT EXISTS addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  quantity_total INT,
  quantity_sold INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_addons_event_id ON addons(event_id);

-- 5. REGISTRATION ADDONS JUNCTION TABLE
-- Links registrations to their selected add-ons
CREATE TABLE IF NOT EXISTS registration_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id UUID REFERENCES registrations(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES addons(id) ON DELETE CASCADE,
  quantity INT DEFAULT 1,
  price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(registration_id, addon_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_registration_addons_registration_id ON registration_addons(registration_id);
CREATE INDEX IF NOT EXISTS idx_registration_addons_addon_id ON registration_addons(addon_id);

-- 6. ADD COLUMNS TO REGISTRATIONS TABLE
-- Add buyer_id and order_id to link registrations to buyers and orders
ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES buyers(id) ON DELETE SET NULL;

ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_registrations_buyer_id ON registrations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_registrations_order_id ON registrations(order_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to generate custom registration ID
CREATE OR REPLACE FUNCTION generate_custom_registration_id(p_event_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_settings event_settings%ROWTYPE;
  v_next_number INT;
  v_reg_id TEXT;
BEGIN
  SELECT * INTO v_settings FROM event_settings WHERE event_id = p_event_id;

  IF NOT FOUND THEN
    -- No settings, generate default format
    RETURN 'REG-' || LPAD((EXTRACT(EPOCH FROM NOW())::INT % 100000)::TEXT, 5, '0');
  END IF;

  -- Get next number
  v_next_number := COALESCE(v_settings.current_registration_number, 0) + 1;
  IF v_next_number < COALESCE(v_settings.registration_start_number, 1) THEN
    v_next_number := v_settings.registration_start_number;
  END IF;

  -- Generate ID based on settings
  IF v_settings.customize_registration_id THEN
    v_reg_id := COALESCE(v_settings.registration_prefix, '') ||
                LPAD(v_next_number::TEXT, 4, '0') ||
                COALESCE(v_settings.registration_suffix, '');
  ELSE
    v_reg_id := 'REG-' || LPAD(v_next_number::TEXT, 6, '0');
  END IF;

  -- Update counter
  UPDATE event_settings
  SET current_registration_number = v_next_number,
      updated_at = NOW()
  WHERE event_id = p_event_id;

  RETURN v_reg_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                        LPAD((EXTRACT(EPOCH FROM NOW())::INT % 10000)::TEXT, 4, '0') ||
                        '-' || UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 4));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order number generation
DROP TRIGGER IF EXISTS set_order_number ON orders;
CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

-- Auto-update updated_at triggers
CREATE TRIGGER update_event_settings_updated_at BEFORE UPDATE ON event_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_buyers_updated_at BEFORE UPDATE ON buyers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_addons_updated_at BEFORE UPDATE ON addons FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_addons ENABLE ROW LEVEL SECURITY;

-- Event Settings policies (simplified - no profiles dependency)
CREATE POLICY "Anyone can view event_settings" ON event_settings FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage event_settings" ON event_settings FOR ALL TO authenticated USING (true);

-- Buyers policies
CREATE POLICY "Anyone can view buyers" ON buyers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert buyers" ON buyers FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can manage buyers" ON buyers FOR ALL TO authenticated USING (true);

-- Orders policies
CREATE POLICY "Anyone can view orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Anyone can insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can manage orders" ON orders FOR ALL TO authenticated USING (true);

-- Addons policies
CREATE POLICY "Anyone can view active addons" ON addons FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated can manage addons" ON addons FOR ALL TO authenticated USING (true);

-- Registration Addons policies
CREATE POLICY "Anyone can view registration_addons" ON registration_addons FOR SELECT USING (true);
CREATE POLICY "Anyone can insert registration_addons" ON registration_addons FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can manage registration_addons" ON registration_addons FOR ALL TO authenticated USING (true);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Create default event_settings for existing events that don't have settings
INSERT INTO event_settings (event_id)
SELECT id FROM events e
WHERE NOT EXISTS (SELECT 1 FROM event_settings es WHERE es.event_id = e.id)
ON CONFLICT DO NOTHING;
