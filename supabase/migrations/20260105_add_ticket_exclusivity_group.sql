-- Add exclusivity_group column to ticket_types
-- Tickets in the same exclusivity group are mutually exclusive - only ONE can be selected per order
-- Example: Surgery exam vs Gynecology exam - attendees must choose one

ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS exclusivity_group text;

-- Add comment for documentation
COMMENT ON COLUMN ticket_types.exclusivity_group IS 'Tickets in the same exclusivity group are mutually exclusive - only ONE can be selected per order';

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_ticket_types_exclusivity_group ON ticket_types(exclusivity_group) WHERE exclusivity_group IS NOT NULL;
