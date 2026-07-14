-- Display-only GST rate for tickets priced GST-inclusive (tax_percentage=0 so
-- checkout doesn't add tax on top of an already-inclusive price). Receipts/
-- invoices use this to back-calculate a base/GST breakdown for compliance,
-- purely for display — it never affects what the customer is charged.
-- NULL (default) = no breakdown shown, preserving existing behavior.

ALTER TABLE ticket_types
  ADD COLUMN IF NOT EXISTS gst_inclusive_rate NUMERIC(5,2);

COMMENT ON COLUMN ticket_types.gst_inclusive_rate IS 'GST rate already embedded in price, for receipt/invoice display only. NULL = no inclusive breakdown shown.';
