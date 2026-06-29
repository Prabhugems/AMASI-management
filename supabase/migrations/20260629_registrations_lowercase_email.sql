-- Case-mismatch bug: registrations.attendee_email is stored with mixed case for
-- some delegates (e.g. 'Drbhardwajsaket@gmail.com'), but every lookup in the app
-- queries the LOWERCASED email, e.g.:
--   .eq("attendee_email", submitter_email.toLowerCase())
-- in /api/forms/submissions (feedback check-in gate + certificate release),
-- certificate download, badge download, etc. A case-sensitive .eq never matches a
-- mixed-case stored value, so those delegates got "No registration found" and could
-- not submit feedback or download certificates even though they were registered and
-- checked in.
--
-- Root fix: keep attendee_email canonical (lowercase) at the storage layer so the
-- existing lowercased lookups always match, regardless of which of the ~28
-- registration-creation paths inserted the row.

-- 1) Backfill existing mixed-case emails (no UNIQUE constraint on attendee_email,
--    so this cannot violate any index).
UPDATE registrations
SET attendee_email = lower(attendee_email)
WHERE attendee_email IS NOT NULL
  AND attendee_email <> lower(attendee_email);

-- 2) Normalize on every future write so it can never drift again.
CREATE OR REPLACE FUNCTION lowercase_attendee_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.attendee_email IS NOT NULL THEN
    NEW.attendee_email := lower(NEW.attendee_email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lowercase_attendee_email ON registrations;
CREATE TRIGGER trg_lowercase_attendee_email
  BEFORE INSERT OR UPDATE OF attendee_email ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION lowercase_attendee_email();
