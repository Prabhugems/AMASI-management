-- Add form_id column to ticket_types table
-- This allows linking a specific form to a ticket type

ALTER TABLE ticket_types
ADD COLUMN IF NOT EXISTS form_id UUID REFERENCES forms(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ticket_types_form ON ticket_types(form_id);

-- Comment for documentation
COMMENT ON COLUMN ticket_types.form_id IS 'Optional form that appears when this ticket is selected during registration';
