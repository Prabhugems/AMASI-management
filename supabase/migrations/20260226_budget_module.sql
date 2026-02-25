-- Budget categories for an event
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,  -- venue, catering, printing, travel, marketing, av_equipment, gifts, miscellaneous
  estimated_amount DECIMAL(12,2) DEFAULT 0,
  actual_amount DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'planned',  -- planned, approved, spent, closed
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual expense items
CREATE TABLE IF NOT EXISTS budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  vendor TEXT,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  receipt_url TEXT,
  invoice_number TEXT,
  paid_date DATE,
  payment_method TEXT,  -- cash, bank_transfer, upi, card
  status TEXT DEFAULT 'pending',  -- pending, approved, paid, rejected
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_budgets_event ON budgets(event_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_budget ON budget_items(budget_id);

-- RLS policies
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets_all" ON budgets FOR ALL USING (true);
CREATE POLICY "budget_items_all" ON budget_items FOR ALL USING (true);
