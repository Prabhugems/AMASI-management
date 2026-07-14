-- Adds list_purpose to checkin_lists so the volunteer scanner's amber
-- "already checked in" card can distinguish between two fundamentally
-- different repeat-scan meanings:
--   entry      -> let them in (hall/session access, re-entry is fine)
--   collection -> do NOT issue again (kit/meal/paper — a repeat scan means
--                 "this person already took the item")
--
-- Existing rows: none were manually classified in time for this migration,
-- so every existing row backfills to 'collection' (the fail-safe default —
-- wrongly showing "already collected" on an entry list is far less harmful
-- than wrongly showing "let them in" on a collection list).

ALTER TABLE checkin_lists ADD COLUMN IF NOT EXISTS list_purpose TEXT;

UPDATE checkin_lists SET list_purpose = 'collection' WHERE list_purpose IS NULL;

ALTER TABLE checkin_lists ALTER COLUMN list_purpose SET NOT NULL;

ALTER TABLE checkin_lists
  ADD CONSTRAINT checkin_lists_list_purpose_check
  CHECK (list_purpose IN ('entry', 'collection'));

COMMENT ON COLUMN checkin_lists.list_purpose IS
  'entry = repeat scan lets them in; collection = repeat scan means do not issue again. Required on creation, no application-level default.';
