-- Hotels table for managing hotel inventory per event
CREATE TABLE IF NOT EXISTS hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  contact_person TEXT,

  -- Room inventory
  total_rooms INTEGER DEFAULT 0,
  standard_rooms INTEGER DEFAULT 0,
  deluxe_rooms INTEGER DEFAULT 0,
  suite_rooms INTEGER DEFAULT 0,

  -- Rates (per night in INR)
  standard_rate DECIMAL(10,2) DEFAULT 0,
  deluxe_rate DECIMAL(10,2) DEFAULT 0,
  suite_rate DECIMAL(10,2) DEFAULT 0,

  -- Dates
  check_in_time TEXT DEFAULT '14:00',
  check_out_time TEXT DEFAULT '12:00',

  -- Booking info
  booking_reference TEXT,
  booking_contact TEXT,

  notes TEXT,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_hotels_event_id ON hotels(event_id);

-- RLS policies
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hotels are viewable by authenticated users"
  ON hotels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Hotels are manageable by authenticated users"
  ON hotels FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to count assigned rooms per hotel
CREATE OR REPLACE FUNCTION get_hotel_room_count(hotel_id_param UUID, event_id_param UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM registrations
    WHERE event_id = event_id_param
    AND custom_fields->>'assigned_hotel_id' = hotel_id_param::TEXT
  );
END;
$$ LANGUAGE plpgsql;
