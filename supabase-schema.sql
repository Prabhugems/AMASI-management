-- =====================================================
-- AMASI EVENT MANAGEMENT - COMPLETE DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. TICKET TYPES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ticket_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  quantity_total INTEGER,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  min_per_order INTEGER NOT NULL DEFAULT 1,
  max_per_order INTEGER NOT NULL DEFAULT 10,
  sale_start_date TIMESTAMPTZ,
  sale_end_date TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'sold_out', 'expired')),
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  tax_percentage DECIMAL(5, 2) NOT NULL DEFAULT 18,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. DISCOUNT CODES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  min_order_amount DECIMAL(10, 2),
  max_discount_amount DECIMAL(10, 2),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  applies_to_ticket_ids UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, code)
);

-- =====================================================
-- 3. REGISTRATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id) ON DELETE RESTRICT,
  registration_number VARCHAR(50) NOT NULL UNIQUE,

  -- Attendee Information
  attendee_name VARCHAR(255) NOT NULL,
  attendee_email VARCHAR(255) NOT NULL,
  attendee_phone VARCHAR(20),
  attendee_institution VARCHAR(255),
  attendee_designation VARCHAR(255),
  attendee_city VARCHAR(100),
  attendee_state VARCHAR(100),
  attendee_country VARCHAR(100) DEFAULT 'India',

  -- Pricing
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'refunded', 'waitlist')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),

  -- Check-in
  checked_in BOOLEAN NOT NULL DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES auth.users(id),

  -- References
  discount_code_id UUID REFERENCES discount_codes(id),
  payment_id UUID,

  -- Additional
  notes TEXT,
  custom_fields JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 4. PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_number VARCHAR(50) NOT NULL UNIQUE,

  -- Payment Type
  payment_type VARCHAR(30) NOT NULL DEFAULT 'registration' CHECK (payment_type IN ('registration', 'membership', 'sponsorship', 'other')),

  -- References
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,

  -- Payer Information
  payer_name VARCHAR(255) NOT NULL,
  payer_email VARCHAR(255) NOT NULL,
  payer_phone VARCHAR(20),

  -- Amounts
  amount DECIMAL(10, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',

  -- Payment Method
  payment_method VARCHAR(30) NOT NULL DEFAULT 'razorpay' CHECK (payment_method IN ('razorpay', 'bank_transfer', 'cash', 'free', 'other')),

  -- Razorpay Details
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  razorpay_signature VARCHAR(255),

  -- Bank Transfer Details
  bank_reference VARCHAR(100),
  bank_transfer_date DATE,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded')),

  -- Refund Details
  refund_amount DECIMAL(10, 2),
  refund_reason TEXT,
  refunded_at TIMESTAMPTZ,
  razorpay_refund_id VARCHAR(100),

  -- Metadata
  metadata JSONB,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 5. MEMBERSHIP PLANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS membership_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  membership_type VARCHAR(30) NOT NULL CHECK (membership_type IN ('annual', 'lifetime', 'student', 'institutional', 'honorary')),
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  duration_months INTEGER,
  benefits JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 6. MEMBER SUBSCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS member_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,

  start_date DATE NOT NULL,
  end_date DATE,

  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),

  auto_renew BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Ticket Types Indexes
CREATE INDEX IF NOT EXISTS idx_ticket_types_event_id ON ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_status ON ticket_types(status);
CREATE INDEX IF NOT EXISTS idx_ticket_types_sort_order ON ticket_types(sort_order);

-- Discount Codes Indexes
CREATE INDEX IF NOT EXISTS idx_discount_codes_event_id ON discount_codes(event_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active);

-- Registrations Indexes
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_ticket_type_id ON registrations(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_payment_status ON registrations(payment_status);
CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(attendee_email);
CREATE INDEX IF NOT EXISTS idx_registrations_registration_number ON registrations(registration_number);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at DESC);

-- Payments Indexes
CREATE INDEX IF NOT EXISTS idx_payments_event_id ON payments(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_registration_id ON payments(registration_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Member Subscriptions Indexes
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_member_id ON member_subscriptions(member_id);
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_status ON member_subscriptions(status);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (admin access)
CREATE POLICY "ticket_types_auth_policy" ON ticket_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "discount_codes_auth_policy" ON discount_codes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "registrations_auth_policy" ON registrations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "payments_auth_policy" ON payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "membership_plans_auth_policy" ON membership_plans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "member_subscriptions_auth_policy" ON member_subscriptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public read access for ticket_types (for registration pages)
CREATE POLICY "ticket_types_public_read" ON ticket_types
  FOR SELECT TO anon USING (status = 'active' AND is_hidden = false);

-- Public read access for membership_plans
CREATE POLICY "membership_plans_public_read" ON membership_plans
  FOR SELECT TO anon USING (is_active = true);

-- Public insert for registrations (for registration flow)
CREATE POLICY "registrations_public_insert" ON registrations
  FOR INSERT TO anon WITH CHECK (true);

-- Public insert for payments (for payment flow)
CREATE POLICY "payments_public_insert" ON payments
  FOR INSERT TO anon WITH CHECK (true);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to generate registration number
CREATE OR REPLACE FUNCTION generate_registration_number()
RETURNS TRIGGER AS $$
DECLARE
  event_short VARCHAR(10);
  seq_num INTEGER;
BEGIN
  -- Get event short name or use default
  SELECT COALESCE(UPPER(LEFT(REGEXP_REPLACE(short_name, '[^a-zA-Z0-9]', '', 'g'), 4)), 'EVT')
  INTO event_short
  FROM events WHERE id = NEW.event_id;

  -- Get sequence number for this event
  SELECT COUNT(*) + 1 INTO seq_num
  FROM registrations WHERE event_id = NEW.event_id;

  NEW.registration_number := event_short || '-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for registration number
DROP TRIGGER IF EXISTS set_registration_number ON registrations;
CREATE TRIGGER set_registration_number
  BEFORE INSERT ON registrations
  FOR EACH ROW
  WHEN (NEW.registration_number IS NULL OR NEW.registration_number = '')
  EXECUTE FUNCTION generate_registration_number();

-- Function to generate payment number
CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.payment_number := 'PAY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for payment number
DROP TRIGGER IF EXISTS set_payment_number ON payments;
CREATE TRIGGER set_payment_number
  BEFORE INSERT ON payments
  FOR EACH ROW
  WHEN (NEW.payment_number IS NULL OR NEW.payment_number = '')
  EXECUTE FUNCTION generate_payment_number();

-- Function to update ticket quantity_sold
CREATE OR REPLACE FUNCTION update_ticket_quantity_sold()
RETURNS TRIGGER AS $$
BEGIN
  -- When registration is confirmed, increment sold count
  IF NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status != 'confirmed') THEN
    UPDATE ticket_types
    SET quantity_sold = quantity_sold + COALESCE(NEW.quantity, 1)
    WHERE id = NEW.ticket_type_id;
  -- When registration is un-confirmed (cancelled/refunded), decrement sold count
  ELSIF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
    UPDATE ticket_types
    SET quantity_sold = GREATEST(0, quantity_sold - COALESCE(OLD.quantity, 1))
    WHERE id = NEW.ticket_type_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ticket quantity
DROP TRIGGER IF EXISTS update_ticket_sold ON registrations;
CREATE TRIGGER update_ticket_sold
  AFTER INSERT OR UPDATE ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_quantity_sold();

-- Function to update discount code usage
CREATE OR REPLACE FUNCTION update_discount_code_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- When registration with discount is confirmed, increment usage
  IF NEW.discount_code_id IS NOT NULL AND NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status != 'confirmed') THEN
    UPDATE discount_codes
    SET current_uses = current_uses + 1
    WHERE id = NEW.discount_code_id;
  -- When registration with discount is un-confirmed, decrement usage
  ELSIF NEW.discount_code_id IS NOT NULL AND OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
    UPDATE discount_codes
    SET current_uses = GREATEST(0, current_uses - 1)
    WHERE id = NEW.discount_code_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for discount usage
DROP TRIGGER IF EXISTS update_discount_usage ON registrations;
CREATE TRIGGER update_discount_usage
  AFTER INSERT OR UPDATE ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_discount_code_usage();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_ticket_types_updated_at ON ticket_types;
CREATE TRIGGER update_ticket_types_updated_at
  BEFORE UPDATE ON ticket_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_discount_codes_updated_at ON discount_codes;
CREATE TRIGGER update_discount_codes_updated_at
  BEFORE UPDATE ON discount_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_registrations_updated_at ON registrations;
CREATE TRIGGER update_registrations_updated_at
  BEFORE UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_membership_plans_updated_at ON membership_plans;
CREATE TRIGGER update_membership_plans_updated_at
  BEFORE UPDATE ON membership_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_member_subscriptions_updated_at ON member_subscriptions;
CREATE TRIGGER update_member_subscriptions_updated_at
  BEFORE UPDATE ON member_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- ADD MISSING COLUMNS TO EVENTS TABLE (if needed)
-- =====================================================

-- Add slug column if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'slug') THEN
    ALTER TABLE events ADD COLUMN slug VARCHAR(100) UNIQUE;
  END IF;
END $$;

-- Add registration settings columns if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'is_public') THEN
    ALTER TABLE events ADD COLUMN is_public BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'registration_open') THEN
    ALTER TABLE events ADD COLUMN registration_open BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'max_attendees') THEN
    ALTER TABLE events ADD COLUMN max_attendees INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'timezone') THEN
    ALTER TABLE events ADD COLUMN timezone VARCHAR(50) DEFAULT 'Asia/Kolkata';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'description') THEN
    ALTER TABLE events ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'contact_email') THEN
    ALTER TABLE events ADD COLUMN contact_email VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'website_url') THEN
    ALTER TABLE events ADD COLUMN website_url VARCHAR(500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'banner_url') THEN
    ALTER TABLE events ADD COLUMN banner_url VARCHAR(500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'logo_url') THEN
    ALTER TABLE events ADD COLUMN logo_url VARCHAR(500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'primary_color') THEN
    ALTER TABLE events ADD COLUMN primary_color VARCHAR(20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'country') THEN
    ALTER TABLE events ADD COLUMN country VARCHAR(100) DEFAULT 'India';
  END IF;
END $$;

-- =====================================================
-- SAMPLE DATA (Optional - Comment out if not needed)
-- =====================================================

-- Insert sample membership plans
INSERT INTO membership_plans (name, description, membership_type, price, duration_months, benefits, sort_order) VALUES
('Annual Membership', 'Standard annual membership with full benefits', 'annual', 2000, 12, '["Access to all events", "Newsletter subscription", "Member directory listing", "Voting rights"]', 1),
('Lifetime Membership', 'One-time payment for lifetime access', 'lifetime', 15000, NULL, '["All annual benefits", "Lifetime access", "Priority registration", "Special recognition"]', 2),
('Student Membership', 'Discounted membership for students', 'student', 500, 12, '["Access to student events", "Newsletter subscription", "Career resources"]', 3)
ON CONFLICT DO NOTHING;

-- =====================================================
-- VIEWS FOR REPORTING
-- =====================================================

-- Registration summary view
CREATE OR REPLACE VIEW registration_summary AS
SELECT
  e.id AS event_id,
  e.name AS event_name,
  COUNT(r.id) AS total_registrations,
  COUNT(CASE WHEN r.status = 'confirmed' THEN 1 END) AS confirmed,
  COUNT(CASE WHEN r.status = 'pending' THEN 1 END) AS pending,
  COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END) AS cancelled,
  COUNT(CASE WHEN r.checked_in = true THEN 1 END) AS checked_in,
  COALESCE(SUM(CASE WHEN r.status = 'confirmed' THEN r.total_amount END), 0) AS total_revenue
FROM events e
LEFT JOIN registrations r ON e.id = r.event_id
GROUP BY e.id, e.name;

-- Ticket sales view
CREATE OR REPLACE VIEW ticket_sales_summary AS
SELECT
  t.id AS ticket_id,
  t.event_id,
  t.name AS ticket_name,
  t.price,
  t.quantity_total,
  t.quantity_sold,
  CASE WHEN t.quantity_total IS NOT NULL THEN t.quantity_total - t.quantity_sold ELSE NULL END AS available,
  t.status,
  COALESCE(SUM(r.total_amount), 0) AS revenue
FROM ticket_types t
LEFT JOIN registrations r ON t.id = r.ticket_type_id AND r.status = 'confirmed'
GROUP BY t.id;

-- =====================================================
-- DONE!
-- =====================================================
SELECT 'Schema created successfully!' AS status;
