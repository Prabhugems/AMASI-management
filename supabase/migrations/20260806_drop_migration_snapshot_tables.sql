-- APPLIED 2026-08-06 via Supabase MCP. See CLAUDE.md migration history.
--
-- Drops the 30 one-off snapshot/backfill tables created directly in the SQL
-- editor during the out-of-band migration work of May-July 2026. They held
-- copies of member and registration PII -- 76,746 rows -- that nothing reads.
-- 20260806_enable_rls_on_unprotected_public_tables gated them; this removes
-- them, which is the actual fix.
--
-- Preconditions verified, not assumed:
--   * Zero references in AMASI-management or amasi-membership. The only greps
--     that hit were generated database.types.ts, CLAUDE.md prose, and the RLS
--     migration itself.
--   * amasi-membership shares this database, so it was cloned and checked
--     directly rather than inferred.
--   * All 30 confirmed rowsecurity=true beforehand.
--
-- members_nicobar_fix_2026_05_21_snapshot (750 rows) is included although it
-- was not in the original exposure set: it already had RLS on so it never
-- surfaced in the security advisor, but it is the same class of artifact.
--
-- NOTE: the earlier RLS migration still names these tables. It is left as the
-- historical record of what was applied. A from-scratch `supabase db push`
-- would fail on it -- but that pipeline is already broken by the 63-version
-- drift documented in CLAUDE.md, and fixing it is the post-AMASICON project.

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
DROP TABLE IF EXISTS members_nicobar_fix_2026_05_21_snapshot;
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
