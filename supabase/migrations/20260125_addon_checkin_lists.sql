-- Add addon_ids column to checkin_lists
-- This allows check-in lists to be filtered by addon purchases

ALTER TABLE checkin_lists
ADD COLUMN IF NOT EXISTS addon_ids uuid[] DEFAULT NULL;

COMMENT ON COLUMN checkin_lists.addon_ids IS 'Filter list to only show registrations with these addon purchases';

-- Create GIN index for efficient array queries
CREATE INDEX IF NOT EXISTS idx_checkin_lists_addon_ids ON checkin_lists USING GIN (addon_ids);
