-- Add ticket_type_ids column to addons table
-- This allows addons to be restricted to specific ticket types

ALTER TABLE addons
ADD COLUMN IF NOT EXISTS ticket_type_ids uuid[] DEFAULT NULL;

COMMENT ON COLUMN addons.ticket_type_ids IS 'Restrict addon to only these ticket types. NULL means available for all ticket types.';

-- Create GIN index for efficient array queries
CREATE INDEX IF NOT EXISTS idx_addons_ticket_type_ids ON addons USING GIN (ticket_type_ids);
