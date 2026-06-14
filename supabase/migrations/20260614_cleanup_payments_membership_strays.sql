-- Cleanup of 300 stray rows in public.payments that were inserted by the
-- payment-reconciliation cron treating membership orders as event orphans.
-- See companion code fix in src/app/api/cron/payment-reconciliation/route.ts
-- (PR #56). This migration removes the existing back-catalog; PR #56 stops
-- the bleed. Apply order: ship PR #56 first, then this — running the other
-- way would let the cron re-create rows during the gap.
--
-- Target set (surveyed 2026-06-14, total ₹12,40,640 across 300 rows from
-- 2026-05-12 to 2026-06-14):
--   * event_id IS NULL
--   * metadata.created_from_cron_reconciliation = 'true'
--   * razorpay_order_id present in public.membership_payments.gateway_order_id
--
-- 276 of the 300 carry notes.membership_type as well — that's how the cron
-- fix recognises them; the other 24 needed the DB cross-check, which is why
-- both filters live in PR #56.
--
-- Snapshot table preserves the full row for rollback. Drop suggested
-- ~2026-09-14 (90 days) after we're confident nothing needs restoring.
-- Naming follows backfill_*_YYYY_MM_DD_snapshot convention used elsewhere
-- in this schema.
--
-- Idempotent + tenant-safe: re-running is a no-op (snapshot only created
-- once), and on the technosurg standalone Supabase (zqbbyxbkbaibdihfhjve)
-- the membership_payments table doesn't exist — we skip cleanly instead of
-- erroring.

do $$
declare
  rows_snapshotted bigint;
  rows_deleted bigint;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'membership_payments'
  ) then
    raise notice
      'Skipping payments stray cleanup: membership_payments table not present (technosurg tenant).';
    return;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'backfill_payments_membership_strays_2026_06_14_snapshot'
  ) then
    raise notice
      'Skipping payments stray cleanup: snapshot table already exists, migration already applied.';
    return;
  end if;

  -- Snapshot the rows that will be deleted. Full row preserved for rollback.
  create table public.backfill_payments_membership_strays_2026_06_14_snapshot as
    select p.*
    from public.payments p
    where p.event_id is null
      and p.metadata->>'created_from_cron_reconciliation' = 'true'
      and p.razorpay_order_id in (
        select gateway_order_id from public.membership_payments
      );

  get diagnostics rows_snapshotted = row_count;

  -- Delete the same set. Same WHERE clause, same transaction → MVCC sees
  -- exactly the rows that were just snapshotted.
  delete from public.payments p
  where p.event_id is null
    and p.metadata->>'created_from_cron_reconciliation' = 'true'
    and p.razorpay_order_id in (
      select gateway_order_id from public.membership_payments
    );

  get diagnostics rows_deleted = row_count;

  if rows_snapshotted <> rows_deleted then
    raise exception
      'payments stray cleanup mismatch: snapshotted %, deleted %. Aborting.',
      rows_snapshotted, rows_deleted;
  end if;

  raise notice 'payments stray cleanup complete: % rows moved to snapshot.', rows_deleted;
end$$;

comment on table public.backfill_payments_membership_strays_2026_06_14_snapshot is
  'Snapshot of stray membership-order rows removed from public.payments on '
  '2026-06-14. See supabase/migrations/20260614_cleanup_payments_membership_strays.sql. '
  'Safe to drop after 2026-09-14 if no restore is needed.';
