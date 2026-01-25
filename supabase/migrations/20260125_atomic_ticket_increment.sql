-- Atomic ticket increment function to prevent race conditions
-- This function uses row-level locking to ensure safe concurrent updates

CREATE OR REPLACE FUNCTION increment_ticket_sold_atomic(
  p_ticket_type_id UUID,
  p_payment_id UUID,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_sold INTEGER;
  v_quantity_total INTEGER;
  v_processed_payments TEXT[];
  v_result JSONB;
BEGIN
  -- Lock the row for update to prevent concurrent modifications
  SELECT
    quantity_sold,
    quantity_total,
    COALESCE((metadata->>'processed_payments')::TEXT[], ARRAY[]::TEXT[])
  INTO v_current_sold, v_quantity_total, v_processed_payments
  FROM ticket_types
  WHERE id = p_ticket_type_id
  FOR UPDATE;

  -- Check if payment was already processed (idempotency)
  IF p_payment_id::TEXT = ANY(v_processed_payments) THEN
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

  -- Update the ticket count atomically
  UPDATE ticket_types
  SET
    quantity_sold = COALESCE(quantity_sold, 0) + p_quantity,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'processed_payments',
      (SELECT jsonb_agg(elem) FROM (
        SELECT unnest(
          array_append(
            v_processed_payments[array_length(v_processed_payments, 1) - 99:], -- Keep last 100
            p_payment_id::TEXT
          )
        ) AS elem
      ) sub)
    ),
    updated_at = NOW()
  WHERE id = p_ticket_type_id;

  RETURN jsonb_build_object(
    'success', true,
    'quantity_sold', v_current_sold + p_quantity,
    'incremented_by', p_quantity
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_ticket_sold_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION increment_ticket_sold_atomic TO service_role;

COMMENT ON FUNCTION increment_ticket_sold_atomic IS 'Atomically increment ticket_sold with idempotency check using payment_id';
