-- Atomic ticket increment function to prevent race conditions
-- This function uses row-level locking to ensure safe concurrent updates

-- Drop existing function if exists (to recreate with correct signature)
DROP FUNCTION IF EXISTS increment_ticket_sold_atomic(UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION increment_ticket_sold_atomic(
  p_ticket_type_id UUID,
  p_payment_id UUID,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_sold INTEGER;
  v_quantity_total INTEGER;
  v_metadata JSONB;
  v_processed_payments JSONB;
  v_payment_exists BOOLEAN;
BEGIN
  -- Lock the row for update to prevent concurrent modifications
  SELECT
    COALESCE(quantity_sold, 0),
    quantity_total,
    COALESCE(metadata, '{}'::jsonb)
  INTO v_current_sold, v_quantity_total, v_metadata
  FROM ticket_types
  WHERE id = p_ticket_type_id
  FOR UPDATE;

  -- Check if ticket exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'ticket_not_found'
    );
  END IF;

  -- Get processed payments array from metadata
  v_processed_payments := COALESCE(v_metadata->'processed_payments', '[]'::jsonb);

  -- Check if payment was already processed (idempotency)
  v_payment_exists := v_processed_payments ? p_payment_id::TEXT;

  IF v_payment_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'already_processed',
      'quantity_sold', v_current_sold
    );
  END IF;

  -- Check if there's enough capacity (if quantity_total is set)
  IF v_quantity_total IS NOT NULL AND (v_current_sold + p_quantity) > v_quantity_total THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'insufficient_capacity',
      'quantity_sold', v_current_sold,
      'quantity_total', v_quantity_total
    );
  END IF;

  -- Add payment to processed list (keep last 100)
  v_processed_payments := v_processed_payments || to_jsonb(p_payment_id::TEXT);

  -- Trim to last 100 if needed
  IF jsonb_array_length(v_processed_payments) > 100 THEN
    v_processed_payments := (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(v_processed_payments) AS elem
        ORDER BY 1 DESC
        LIMIT 100
      ) sub
    );
  END IF;

  -- Update the ticket count atomically
  UPDATE ticket_types
  SET
    quantity_sold = v_current_sold + p_quantity,
    metadata = v_metadata || jsonb_build_object('processed_payments', v_processed_payments),
    updated_at = NOW()
  WHERE id = p_ticket_type_id;

  RETURN jsonb_build_object(
    'success', true,
    'quantity_sold', v_current_sold + p_quantity,
    'incremented_by', p_quantity
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'reason', 'error',
    'message', SQLERRM
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_ticket_sold_atomic(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_ticket_sold_atomic(UUID, UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION increment_ticket_sold_atomic IS 'Atomically increment ticket_sold with idempotency check using payment_id. Uses row-level locking to prevent race conditions.';
