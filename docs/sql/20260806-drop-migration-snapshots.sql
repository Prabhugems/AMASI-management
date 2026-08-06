-- ⚠️ NOT A MIGRATION. Deliberately kept out of supabase/migrations/ so that
-- `supabase db push` can never execute it. Run by hand, once, after the checks
-- below pass.
--
-- PURPOSE: permanently delete the 29 one-off snapshot/backfill tables created
-- during the out-of-band migration work of May–July 2026. The companion
-- migration (supabase/migrations/20260806_enable_rls_on_unprotected_public_tables.sql)
-- gates them behind RLS; this removes them outright, which is the real fix —
-- copies of member and registration PII that nothing reads should not exist.
--
-- IRREVERSIBLE. These tables were snapshots taken *before* destructive
-- backfills, so they are the only record of some pre-backfill state. Once
-- dropped, a "what did this row look like before the 24 June reconcile?"
-- question can no longer be answered.
--
-- BEFORE RUNNING, ALL THREE MUST HOLD:
--   1. Nothing in the `amasi-membership` sibling repo queries any name below.
--      This database is shared (see CLAUDE.md); absence from THIS repo proves
--      nothing. grep that repo.
--   2. You have a current database backup, or have exported anything you might
--      still want (`\copy <table> TO 'file.csv' CSV HEADER`).
--   3. The backfills these snapshot are confirmed settled — no open question
--      about whether one needs reverting.
--
-- Deliberately NOT in this list, because they look live rather than disposable:
--   announcements, directory_access_log, profile_edit_log
-- Those keep RLS as their protection.

BEGIN;

DROP TABLE IF EXISTS asi_reconcile_2026_06_24_snapshot;
DROP TABLE IF EXISTS backfill_app_member_id_2026_05_20_snapshot;
DROP TABLE IF EXISTS backfill_audit_pii_mask_2026_05_20_snapshot;
DROP TABLE IF EXISTS backfill_clear_review_flags_2026_05_20_snapshot;
DROP TABLE IF EXISTS backfill_completed_draft_failure_2026_05_20_snapshot;
DROP TABLE IF EXISTS backfill_members_id_2026_05_20_snapshot;
DROP TABLE IF EXISTS backfill_members_timestamps_2026_05_20_snapshot;
DROP TABLE IF EXISTS backfill_payment_amount_2026_05_20_snapshot;
DROP TABLE IF EXISTS backfill_payments_membership_strays_2026_06_14_snapshot;
DROP TABLE IF EXISTS faculty_assignments_127_pre_final_snapshot_2026_06_29;
DROP TABLE IF EXISTS lm_asi_deepdive_2026_06_24_snapshot;
DROP TABLE IF EXISTS lm_asi_recover_2026_06_24_snapshot;
DROP TABLE IF EXISTS lm_downgrade2_2026_06_24_snapshot;
DROP TABLE IF EXISTS lm_downgrade_2026_06_24_snapshot;
DROP TABLE IF EXISTS members_asi_backfill_2026_06_26;
DROP TABLE IF EXISTS members_middle_name_dup_2026_06_30_snapshot;
DROP TABLE IF EXISTS membership_payments_nonmembership_cleanup_2026_06_29;
DROP TABLE IF EXISTS registrations_126_marksheet_pre_2026_07_02_snapshot;
DROP TABLE IF EXISTS registrations_127_accom_2026_06_30_snapshot;
DROP TABLE IF EXISTS registrations_127_accom_indiv_2026_06_30_snapshot;
DROP TABLE IF EXISTS registrations_127_prabhu_2026_06_30_snapshot;
DROP TABLE IF EXISTS registrations_127_ritika_2026_06_30_snapshot;
DROP TABLE IF EXISTS registrations_127_sameer_pre_final_snapshot_2026_06_29;
DROP TABLE IF EXISTS registrations_127_traincheckout_2026_06_30_snapshot;
DROP TABLE IF EXISTS registrations_127_travel_complete_2026_06_30_snapshot;
DROP TABLE IF EXISTS registrations_127_travel_details2_2026_06_30_snapshot;
DROP TABLE IF EXISTS registrations_127_travel_details_2026_06_30_snapshot;
DROP TABLE IF EXISTS registrations_127_travel_origin_2026_06_30_snapshot;
DROP TABLE IF EXISTS sessions_127_pre_final_snapshot_2026_06_29;

-- Inspect the result, then COMMIT. ROLLBACK if anything looks wrong.
-- COMMIT;

ROLLBACK;
