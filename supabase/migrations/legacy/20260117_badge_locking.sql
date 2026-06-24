-- Badge Template Locking and Badge Storage
-- Once badges are generated/printed, the template is locked to prevent changes

-- Add locking columns to badge_templates
ALTER TABLE badge_templates
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS locked_by TEXT,
ADD COLUMN IF NOT EXISTS badges_generated_count INTEGER DEFAULT 0;

-- Add badge storage columns to registrations
ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS badge_url TEXT,
ADD COLUMN IF NOT EXISTS badge_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS badge_template_id UUID REFERENCES badge_templates(id) ON DELETE SET NULL;

-- Create index for faster badge lookups
CREATE INDEX IF NOT EXISTS idx_registrations_badge_url ON registrations(badge_url) WHERE badge_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registrations_badge_template ON registrations(badge_template_id) WHERE badge_template_id IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN badge_templates.is_locked IS 'Template is locked after first badge generation';
COMMENT ON COLUMN badge_templates.locked_at IS 'When the template was locked';
COMMENT ON COLUMN badge_templates.locked_by IS 'Who locked the template (user email or system)';
COMMENT ON COLUMN badge_templates.badges_generated_count IS 'Number of badges generated with this template';
COMMENT ON COLUMN registrations.badge_url IS 'URL to the stored badge PDF/image';
COMMENT ON COLUMN registrations.badge_generated_at IS 'When the badge was last generated';
COMMENT ON COLUMN registrations.badge_template_id IS 'Which template was used to generate the badge';
