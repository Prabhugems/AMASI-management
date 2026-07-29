-- Lets addon variants (e.g. per-workshop fee-slab pricing) auto-hide outside
-- their sale window, mirroring ticket_types.sale_start_date/sale_end_date.
-- A variant with no dates set is always available (e.g. non-date-based
-- variants like room type), so this is fully backward-compatible.
ALTER TABLE addon_variants ADD COLUMN IF NOT EXISTS sale_start_date timestamptz;
ALTER TABLE addon_variants ADD COLUMN IF NOT EXISTS sale_end_date timestamptz;
