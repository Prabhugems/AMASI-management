-- =====================================================
-- AMASI Event Registration & Payment System Schema
-- Run this in Supabase SQL Editor
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ADD RAZORPAY CREDENTIALS TO EVENTS TABLE
-- Each event can have its own Razorpay account
-- =====================================================

-- Razorpay Credentials
ALTER TABLE events ADD COLUMN IF NOT EXISTS razorpay_key_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS razorpay_key_secret TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS razorpay_webhook_secret TEXT;

-- Payment Methods Configuration (each event can enable/disable)
ALTER TABLE events ADD COLUMN IF NOT EXISTS payment_methods_enabled JSONB DEFAULT '{
  "razorpay": true,
  "bank_transfer": false,
  "cash": false,
  "free": true
}'::jsonb;

-- Bank Transfer Details (shown when bank_transfer is enabled)
ALTER TABLE events ADD COLUMN IF NOT EXISTS bank_account_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS bank_ifsc_code TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS bank_upi_id TEXT;

-- Add comments for documentation
COMMENT ON COLUMN events.razorpay_key_id IS 'Event-specific Razorpay Key ID';
COMMENT ON COLUMN events.razorpay_key_secret IS 'Event-specific Razorpay Key Secret (encrypted)';
COMMENT ON COLUMN events.razorpay_webhook_secret IS 'Event-specific Razorpay Webhook Secret';
COMMENT ON COLUMN events.payment_methods_enabled IS 'JSON object with enabled payment methods: razorpay, bank_transfer, cash, free';
COMMENT ON COLUMN events.bank_account_name IS 'Bank account holder name for bank transfer';
COMMENT ON COLUMN events.bank_account_number IS 'Bank account number for bank transfer';
COMMENT ON COLUMN events.bank_ifsc_code IS 'IFSC code for bank transfer';
COMMENT ON COLUMN events.bank_upi_id IS 'UPI ID for direct UPI transfers';

-- =====================================================
-- ENUMS
-- =====================================================

-- Ticket Status
DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('draft', 'active', 'paused', 'sold_out', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Registration Status
DO $$ BEGIN
  CREATE TYPE registration_status AS ENUM ('pending', 'confirmed', 'cancelled', 'refunded', 'waitlisted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Payment Type
DO $$ BEGIN
  CREATE TYPE payment_type AS ENUM ('registration', 'membership', 'sponsorship', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Payment Method
DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('razorpay', 'bank_transfer', 'cash', 'cheque', 'complimentary');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Payment Status
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Membership Type
DO $$ BEGIN
  CREATE TYPE membership_type AS ENUM ('annual', 'lifetime', 'student', 'senior', 'international');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Subscription Status
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('pending', 'active', 'expired', 'cancelled', 'grace_period');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Discount Type
DO $$ BEGIN
  CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- TICKET TYPES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS ticket_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  quantity_total INTEGER,
  quantity_sold INTEGER DEFAULT 0,
  min_per_order INTEGER DEFAULT 1,
  max_per_order INTEGER DEFAULT 10,
  sale_start_date TIMESTAMPTZ,
  sale_end_date TIMESTAMPTZ,
  status ticket_status DEFAULT 'draft',
  is_hidden BOOLEAN DEFAULT FALSE,
  requires_approval BOOLEAN DEFAULT FALSE,
  tax_percentage DECIMAL(5,2) DEFAULT 18,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_types_event ON ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_status ON ticket_types(status);

-- =====================================================
-- PAYMENTS TABLE (Create before registrations due to FK)
-- =====================================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_number TEXT NOT NULL UNIQUE,
  payment_type payment_type NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'razorpay',

  -- Payer Information
  payer_name TEXT NOT NULL,
  payer_email TEXT NOT NULL,
  payer_phone TEXT,

  -- Amount Details
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2) NOT NULL,

  -- Razorpay Details
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,

  -- Refund Details
  refund_amount DECIMAL(10,2) DEFAULT 0,
  refund_reason TEXT,
  razorpay_refund_id TEXT,
  refunded_at TIMESTAMPTZ,
  refunded_by UUID,

  -- Status & Reference
  status payment_status DEFAULT 'pending',
  event_id UUID REFERENCES events(id),

  -- Metadata
  metadata JSONB DEFAULT '{}',
  notes TEXT,

  -- Timestamps
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment ON payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_event ON payments(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_number ON payments(payment_number);

-- =====================================================
-- REGISTRATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
  registration_number TEXT NOT NULL UNIQUE,

  -- Attendee Information
  salutation TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  designation TEXT,
  institution TEXT,
  department TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',

  -- Registration Details
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR',

  -- Status & Tracking
  status registration_status DEFAULT 'pending',
  payment_id UUID REFERENCES payments(id),
  discount_code TEXT,

  -- Additional Data
  dietary_preference TEXT,
  tshirt_size TEXT,
  special_requirements TEXT,
  how_heard_about_us TEXT,
  metadata JSONB DEFAULT '{}',

  -- Check-in
  checked_in BOOLEAN DEFAULT FALSE,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID,
  badge_printed BOOLEAN DEFAULT FALSE,
  badge_printed_at TIMESTAMPTZ,

  -- Timestamps
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_ticket ON registrations(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(email);
CREATE INDEX IF NOT EXISTS idx_registrations_number ON registrations(registration_number);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);

-- =====================================================
-- MEMBERSHIP PLANS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS membership_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type membership_type NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  duration_months INTEGER,
  benefits JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MEMBER SUBSCRIPTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS member_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id),
  plan_id UUID NOT NULL REFERENCES membership_plans(id),
  payment_id UUID REFERENCES payments(id),

  -- Subscription Period
  start_date DATE NOT NULL,
  end_date DATE,

  -- Status
  status subscription_status DEFAULT 'pending',
  auto_renew BOOLEAN DEFAULT FALSE,

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_member ON member_subscriptions(member_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON member_subscriptions(status);

-- =====================================================
-- DISCOUNT CODES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type discount_type NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  max_uses INTEGER,
  times_used INTEGER DEFAULT 0,
  min_order_amount DECIMAL(10,2),
  max_discount_amount DECIMAL(10,2),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  event_id UUID REFERENCES events(id),
  ticket_type_ids UUID[],
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_event ON discount_codes(event_id);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to generate registration number
CREATE OR REPLACE FUNCTION generate_registration_number(event_short_name TEXT)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  reg_number TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(registration_number FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM registrations
  WHERE registration_number LIKE event_short_name || '-%';

  reg_number := event_short_name || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN reg_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate payment number
CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  pay_number TEXT;
  year_str TEXT;
BEGIN
  year_str := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(payment_number FROM '[0-9]+$') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM payments
  WHERE payment_number LIKE 'PAY-' || year_str || '-%';

  pay_number := 'PAY-' || year_str || '-' || LPAD(next_num::TEXT, 5, '0');
  RETURN pay_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- Ticket Types: Public read for active, admin write
CREATE POLICY "Public can view active tickets" ON ticket_types
  FOR SELECT USING (status = 'active' AND is_hidden = FALSE);

CREATE POLICY "Admins can manage tickets" ON ticket_types
  FOR ALL USING (auth.role() = 'authenticated');

-- Registrations: Users can view their own, admins can view all
CREATE POLICY "Users can view own registrations" ON registrations
  FOR SELECT USING (email = auth.jwt() ->> 'email');

CREATE POLICY "Admins can manage registrations" ON registrations
  FOR ALL USING (auth.role() = 'authenticated');

-- Payments: Users can view their own, admins can view all
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (payer_email = auth.jwt() ->> 'email');

CREATE POLICY "Admins can manage payments" ON payments
  FOR ALL USING (auth.role() = 'authenticated');

-- Membership Plans: Public read
CREATE POLICY "Public can view active plans" ON membership_plans
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage plans" ON membership_plans
  FOR ALL USING (auth.role() = 'authenticated');

-- Member Subscriptions: Users can view their own
CREATE POLICY "Users can view own subscriptions" ON member_subscriptions
  FOR SELECT USING (
    member_id IN (
      SELECT id FROM members WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Admins can manage subscriptions" ON member_subscriptions
  FOR ALL USING (auth.role() = 'authenticated');

-- Discount Codes: Only admins
CREATE POLICY "Admins can manage discounts" ON discount_codes
  FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Insert sample membership plans
INSERT INTO membership_plans (name, type, description, price, duration_months, benefits, sort_order) VALUES
  ('Annual Membership', 'annual', 'Full access to all AMASI benefits for 1 year', 2000, 12,
   '["Access to all events", "Member discounts", "Newsletter subscription", "Voting rights"]'::jsonb, 1),
  ('Lifetime Membership', 'lifetime', 'Lifetime access to all AMASI benefits', 15000, NULL,
   '["Lifetime event access", "All member benefits", "Special recognition", "Legacy benefits"]'::jsonb, 2),
  ('Student Membership', 'student', 'Discounted membership for students', 500, 12,
   '["Student event rates", "Learning resources", "Mentorship access"]'::jsonb, 3)
ON CONFLICT DO NOTHING;
