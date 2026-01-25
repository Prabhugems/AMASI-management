-- Certificate Templates table (similar to badge_templates but for certificates)
CREATE TABLE IF NOT EXISTS certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  size text DEFAULT 'A4-landscape',
  template_image_url text,
  template_data jsonb DEFAULT '{}',
  ticket_type_ids uuid[],
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_certificate_templates_event_id ON certificate_templates(event_id);

-- Enable RLS
ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users
CREATE POLICY "Allow authenticated users full access to certificate_templates"
  ON certificate_templates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
