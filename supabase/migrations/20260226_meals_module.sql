CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL,  -- breakfast, lunch, dinner, tea, snack
  venue TEXT,
  capacity INTEGER,
  start_time TIME,
  end_time TIME,
  menu_description TEXT,
  is_included BOOLEAN DEFAULT true,
  price DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meal_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  dietary_preference TEXT DEFAULT 'regular',  -- regular, vegetarian, vegan, jain, halal
  allergies TEXT,
  special_requests TEXT,
  status TEXT DEFAULT 'registered',  -- registered, checked_in, no_show, cancelled
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meal_plan_id, registration_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meal_plans_event ON meal_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_meal_registrations_plan ON meal_registrations(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_meal_registrations_reg ON meal_registrations(registration_id);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meal_plans_all" ON meal_plans FOR ALL USING (true);
CREATE POLICY "meal_registrations_all" ON meal_registrations FOR ALL USING (true);
