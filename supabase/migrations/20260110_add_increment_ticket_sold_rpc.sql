-- Migration: Add increment_ticket_sold RPC function
-- This function atomically increments the quantity_sold field to prevent race conditions

CREATE OR REPLACE FUNCTION increment_ticket_sold(
  ticket_id UUID,
  increment_by INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ticket_types
  SET quantity_sold = COALESCE(quantity_sold, 0) + increment_by
  WHERE id = ticket_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_ticket_sold(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_ticket_sold(UUID, INTEGER) TO service_role;
