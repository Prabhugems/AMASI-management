-- Print Stations Table
-- Stores print station configurations for badge/label printing at events
CREATE TABLE IF NOT EXISTS print_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Print mode: 'label', 'overlay', 'full_badge'
  print_mode VARCHAR(50) NOT NULL DEFAULT 'full_badge',

  -- Link to badge template (reusing existing badge_templates table)
  badge_template_id UUID REFERENCES badge_templates(id) ON DELETE SET NULL,

  -- Print settings (stored as JSON)
  print_settings JSONB DEFAULT '{
    "paper_size": "4x6",
    "orientation": "portrait",
    "margins": {"top": 0, "right": 0, "bottom": 0, "left": 0},
    "scale": 100,
    "copies": 1
  }'::jsonb,

  -- Station settings
  is_active BOOLEAN DEFAULT true,
  allow_reprint BOOLEAN DEFAULT true,
  max_reprints INTEGER DEFAULT 3,
  auto_print BOOLEAN DEFAULT false,  -- Print immediately on scan
  require_checkin BOOLEAN DEFAULT false,  -- Check-in attendee when printing

  -- Access control
  access_token VARCHAR(255) UNIQUE,  -- For shareable link
  token_expires_at TIMESTAMPTZ,

  -- Ticket type restrictions (null = all ticket types)
  ticket_type_ids UUID[] DEFAULT NULL,

  -- Stats (denormalized for quick access)
  total_prints INTEGER DEFAULT 0,
  unique_prints INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Print Jobs Table
-- Tracks all print jobs for audit and reprint control
CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  print_station_id UUID NOT NULL REFERENCES print_stations(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,

  -- Print details
  print_number INTEGER NOT NULL DEFAULT 1,  -- 1 = first print, 2+ = reprint
  status VARCHAR(50) DEFAULT 'completed',  -- 'pending', 'printing', 'completed', 'failed', 'cancelled'

  -- Metadata
  printed_at TIMESTAMPTZ DEFAULT NOW(),
  printed_by UUID REFERENCES auth.users(id),
  printer_name VARCHAR(255),

  -- Error tracking
  error_message TEXT,

  -- Device info
  device_info JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_print_stations_event_id ON print_stations(event_id);
CREATE INDEX IF NOT EXISTS idx_print_stations_access_token ON print_stations(access_token);
CREATE INDEX IF NOT EXISTS idx_print_stations_active ON print_stations(event_id, is_active);

CREATE INDEX IF NOT EXISTS idx_print_jobs_station_id ON print_jobs(print_station_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_registration_id ON print_jobs(registration_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_printed_at ON print_jobs(printed_at);

-- Unique constraint: one active print per registration per station (for reprint counting)
CREATE UNIQUE INDEX IF NOT EXISTS idx_print_jobs_unique_print
ON print_jobs(print_station_id, registration_id, print_number);

-- Function to generate access token
CREATE OR REPLACE FUNCTION generate_print_station_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(24), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Trigger to update print station stats
CREATE OR REPLACE FUNCTION update_print_station_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE print_stations
    SET
      total_prints = total_prints + 1,
      unique_prints = (
        SELECT COUNT(DISTINCT registration_id)
        FROM print_jobs
        WHERE print_station_id = NEW.print_station_id
      ),
      updated_at = NOW()
    WHERE id = NEW.print_station_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_print_station_stats
AFTER INSERT ON print_jobs
FOR EACH ROW
EXECUTE FUNCTION update_print_station_stats();

-- Enable RLS
ALTER TABLE print_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for print_stations
CREATE POLICY "Users can view print stations for their events"
ON print_stations FOR SELECT
USING (true);

CREATE POLICY "Users can insert print stations"
ON print_stations FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update print stations"
ON print_stations FOR UPDATE
USING (true);

CREATE POLICY "Users can delete print stations"
ON print_stations FOR DELETE
USING (true);

-- RLS Policies for print_jobs
CREATE POLICY "Users can view print jobs"
ON print_jobs FOR SELECT
USING (true);

CREATE POLICY "Users can insert print jobs"
ON print_jobs FOR INSERT
WITH CHECK (true);
