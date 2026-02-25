CREATE TABLE IF NOT EXISTS visa_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT,
  passport_number TEXT,
  nationality TEXT,
  passport_expiry DATE,
  visa_type TEXT DEFAULT 'conference',
  embassy_country TEXT,
  travel_dates_from DATE,
  travel_dates_to DATE,
  letter_type TEXT DEFAULT 'invitation',
  letter_status TEXT DEFAULT 'pending',  -- pending, generated, sent
  letter_url TEXT,
  letter_generated_at TIMESTAMPTZ,
  letter_sent_at TIMESTAMPTZ,
  notes TEXT,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_visa_requests_event ON visa_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_visa_requests_registration ON visa_requests(registration_id);

ALTER TABLE visa_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visa_requests_all" ON visa_requests FOR ALL USING (true);
