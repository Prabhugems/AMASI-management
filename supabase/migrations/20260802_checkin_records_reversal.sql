-- Help desk "reverse a wrong check-in" (Kiosk work order §4), implemented as
-- a compensating record per explicit product decision: the original
-- checkin_records row is NEVER deleted, only marked. This is distinct from
-- the existing checked_out_at column (which already means "this person
-- left" / staff scan page's own "Undo" button) -- reversed_at specifically
-- means "an admin determined this check-in was a mistake", which needs its
-- own trail so §7 reconciliation/duplicate reports can tell "left normally"
-- apart from "was never really here".
--
-- checkin_records keeps its existing UNIQUE(checkin_list_id, registration_id)
-- constraint unchanged -- a reversal (or a fresh manual check-in after one)
-- updates the same row rather than inserting a second one, exactly like the
-- existing checked_out_at re-check-in path already does.
--
-- Additive, all nullable, zero backfill needed, zero behaviour change until
-- the help desk's reversal code (not yet applied) reads/writes these.

alter table checkin_records
  add column if not exists reversed_at timestamptz;

alter table checkin_records
  add column if not exists reversed_by uuid references users(id) on delete set null;

alter table checkin_records
  add column if not exists reversal_reason text;

comment on column checkin_records.reversed_at is
  'Set when an admin determines this check-in was a mistake (help desk "reverse" action). Row is kept, never deleted -- distinct from checked_out_at (delegate legitimately left).';
comment on column checkin_records.reversed_by is
  'users.id of the admin who performed the reversal.';
comment on column checkin_records.reversal_reason is
  'Optional free-text note on why the check-in was reversed.';
