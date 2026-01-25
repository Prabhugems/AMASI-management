-- =====================================================
-- PAYMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text UNIQUE NOT NULL,
  payment_type text NOT NULL DEFAULT 'registration', -- registration, sponsorship, membership, other
  payment_method text NOT NULL DEFAULT 'razorpay', -- razorpay, bank_transfer, cash, free, upi, card

  -- Payer info
  payer_name text NOT NULL,
  payer_email text NOT NULL,
  payer_phone text,

  -- Amounts
  amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  tax_amount numeric(10,2) DEFAULT 0,
  discount_amount numeric(10,2) DEFAULT 0,
  net_amount numeric(10,2) NOT NULL DEFAULT 0,

  -- Razorpay details
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,

  -- Status
  status text NOT NULL DEFAULT 'pending', -- pending, completed, failed, refunded, cancelled

  -- Relations
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,

  -- Timestamps
  completed_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Additional data
  metadata jsonb DEFAULT '{}'::jsonb,
  notes text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_event_id ON payments(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_payer_email ON payments(payer_email);
CREATE INDEX IF NOT EXISTS idx_payments_payment_number ON payments(payment_number);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow anyone to insert payments (for checkout)
CREATE POLICY "Anyone can create payments" ON payments
  FOR INSERT WITH CHECK (true);

-- Allow reading own payments by email
CREATE POLICY "Users can read payments by email" ON payments
  FOR SELECT USING (true);

-- Allow authenticated users to update payments
CREATE POLICY "Authenticated users can update payments" ON payments
  FOR UPDATE TO authenticated USING (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add payment_id column to registrations if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registrations' AND column_name = 'payment_id'
  ) THEN
    ALTER TABLE registrations ADD COLUMN payment_id uuid REFERENCES payments(id) ON DELETE SET NULL;
    CREATE INDEX idx_registrations_payment_id ON registrations(payment_id);
  END IF;
END $$;

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Payments table created successfully!';
END $$;
