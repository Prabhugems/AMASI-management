-- Check-in Lists (Breakfast, Lunch, Dinner, etc.)
CREATE TABLE IF NOT EXISTS checkin_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  -- Which ticket types can check in to this list (null = all tickets)
  ticket_type_ids uuid[] DEFAULT NULL,
  -- Time window for this check-in (optional)
  starts_at timestamptz,
  ends_at timestamptz,
  -- Settings
  is_active boolean DEFAULT true,
  allow_multiple_checkins boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Check-in Records (one per attendee per list)
CREATE TABLE IF NOT EXISTS checkin_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_list_id uuid REFERENCES checkin_lists(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES registrations(id) ON DELETE CASCADE,
  checked_in_at timestamptz DEFAULT now(),
  checked_in_by text,
  checked_out_at timestamptz,
  notes text,
  -- Unique constraint: one check-in per registration per list (unless multiple allowed)
  UNIQUE(checkin_list_id, registration_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checkin_lists_event ON checkin_lists(event_id);
CREATE INDEX IF NOT EXISTS idx_checkin_lists_active ON checkin_lists(event_id, is_active);
CREATE INDEX IF NOT EXISTS idx_checkin_records_list ON checkin_records(checkin_list_id);
CREATE INDEX IF NOT EXISTS idx_checkin_records_registration ON checkin_records(registration_id);
CREATE INDEX IF NOT EXISTS idx_checkin_records_time ON checkin_records(checkin_list_id, checked_in_at);

-- Enable RLS
ALTER TABLE checkin_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_records ENABLE ROW LEVEL SECURITY;

-- Policies for checkin_lists
CREATE POLICY "Allow all access to checkin_lists" ON checkin_lists FOR ALL USING (true) WITH CHECK (true);

-- Policies for checkin_records
CREATE POLICY "Allow all access to checkin_records" ON checkin_records FOR ALL USING (true) WITH CHECK (true);
