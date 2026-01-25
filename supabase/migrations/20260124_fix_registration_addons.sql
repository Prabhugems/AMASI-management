-- Fix registration_addons table - add missing columns
-- The table was created with minimal columns, but code expects more

-- Add missing columns to registration_addons
ALTER TABLE registration_addons
ADD COLUMN IF NOT EXISTS addon_variant_id UUID REFERENCES addon_variants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS certificate_issued BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS certificate_issued_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS certificate_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update total_price from price column for existing records
UPDATE registration_addons
SET total_price = price, unit_price = price
WHERE total_price IS NULL OR total_price = 0;

-- Drop the unique constraint if it exists and recreate with variant
ALTER TABLE registration_addons DROP CONSTRAINT IF EXISTS registration_addons_registration_id_addon_id_key;

-- Add new unique constraint including variant
ALTER TABLE registration_addons
ADD CONSTRAINT registration_addons_unique_key UNIQUE (registration_id, addon_id, addon_variant_id);

-- Add course columns to addons table if not exists
ALTER TABLE addons
ADD COLUMN IF NOT EXISTS is_course BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS certificate_template_id UUID,
ADD COLUMN IF NOT EXISTS course_description TEXT,
ADD COLUMN IF NOT EXISTS course_duration TEXT,
ADD COLUMN IF NOT EXISTS course_instructor TEXT;

-- Comments
COMMENT ON COLUMN registration_addons.unit_price IS 'Price per unit at time of purchase';
COMMENT ON COLUMN registration_addons.total_price IS 'Total price (unit_price * quantity)';
COMMENT ON COLUMN registration_addons.addon_variant_id IS 'Selected variant if addon has variants';
