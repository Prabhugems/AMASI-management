-- Add is_active column to certificate_templates
ALTER TABLE certificate_templates ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
