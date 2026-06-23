-- Phase 2 / M1: replace the random()-based token generator with a CSPRNG.
--
-- The previous generate_secure_token() built tokens from random() (a non-
-- cryptographic, seedable PRNG). These tokens gate PII (verify), certificate
-- downloads, and check-in QR codes, so they must be unpredictable.
--
-- gen_random_uuid() is a built-in CSPRNG on Supabase — no extension-schema
-- qualification needed (unlike pgcrypto's gen_random_bytes). One v4 UUID is
-- 32 hex chars (~122 bits of entropy), which already saturates a 32-char
-- checkin_token; the second UUID only contributes when a caller requests
-- length > 32 (none do today). 32 chars preserves both the ">= 32 == secure
-- token" contract in the verify/lookup routes and the existing checkin_token
-- length, so QR payload density is unchanged by the rotation below.
CREATE OR REPLACE FUNCTION generate_secure_token(length INTEGER DEFAULT 32)
RETURNS TEXT AS $$
  SELECT substr(
    replace(gen_random_uuid()::text, '-', '') ||
    replace(gen_random_uuid()::text, '-', ''),
    1, length
  );
$$ LANGUAGE sql VOLATILE;

-- ---------------------------------------------------------------------------
-- MANUAL POST-DEPLOY STEP — NOT auto-applied (this repo's build only schema-
-- checks; it does not run migrations). Run the block below via the Supabase
-- MCP / SQL editor ONLY AFTER the Phase 1 + M3 code is deployed, and
-- IMMEDIATELY BEFORE the badge/cert reprint. It is IRREVERSIBLE: it re-keys
-- every attendee QR token, invalidating every already-printed old-token QR.
--
--   -- Re-key all attendee QR tokens (BEFORE INSERT trigger does NOT fire on
--   -- UPDATE, so this does not recurse).
--   UPDATE registrations SET checkin_token = generate_secure_token(32);
--
--   -- Invalidate pre-rendered badge PDFs so they regenerate with the new
--   -- token + higher error-correction QR.
--   UPDATE registrations
--      SET badge_url = NULL, badge_generated_at = NULL
--    WHERE badge_url IS NOT NULL OR badge_generated_at IS NOT NULL;
--
-- Staff access_token rotation is intentionally DEFERRED to Phase 3 (M5 adds
-- access_token_expires_at + revoke). Do NOT distribute AMASICON volunteer
-- links until Phase 3 mints fresh expiring tokens for those check-in lists.
-- ---------------------------------------------------------------------------
