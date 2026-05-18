-- Discount codes: previously code-only (referenced by /api/discounts, validate,
-- create-order, registrations) but never actually present in any tenant's DB.
-- Created out-of-band on technosurg (2026-05-18); this migration formalizes
-- the shape so College / AMASI / future tenants get the same schema.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  min_order_amount NUMERIC(10,2),
  max_discount_amount NUMERIC(10,2),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  applies_to_ticket_ids UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, code)
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_event ON discount_codes(event_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- Public read of active codes only. The /api/discounts/validate endpoint
-- uses the anon client and filters by (event_id, code) — callers must know
-- both to retrieve a row, and the endpoint is rate-limited (strict tier)
-- against enumeration. Inactive codes stay hidden.
DROP POLICY IF EXISTS "Public can read active discount codes" ON discount_codes;
CREATE POLICY "Public can read active discount codes"
  ON discount_codes
  FOR SELECT
  USING (is_active = true);

-- Per-event toggle that controls whether the public checkout shows the
-- discount-code input field at all (src/app/register/[eventSlug]/checkout/page.tsx).
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS discount_enabled BOOLEAN NOT NULL DEFAULT FALSE;
