-- Enable RLS on the 32 public-schema tables that had it disabled.
--
-- WHY: Supabase's own security advisor reports 32 `rls_disabled_in_public`
-- errors on this project. Verified exploitable on 2026-08-06 using the
-- PUBLISHABLE key (the one embedded in the frontend bundle of
-- collegeofmas.org.in, public by design):
--
--   members_asi_backfill_2026_06_26                      16,931 rows readable
--   directory_access_log                                    198 rows readable
--   registrations_127_travel_details_2026_06_30_snapshot      3 rows readable
--   profile_edit_log                                          4 rows readable
--   announcements                                             2 rows readable
--
-- members_asi_backfill_2026_06_26 carries old_value/new_value of member fields;
-- directory_access_log carries viewer_member_id, query_params and ip. Both were
-- world-readable by anyone who copied the key out of the JS bundle.
--
-- ROOT CAUSE: almost all of these are one-off `*_snapshot` / `backfill_*`
-- tables created directly in the SQL editor during the out-of-band migration
-- work documented in CLAUDE.md. Postgres creates tables with RLS off, and
-- nothing in that workflow turned it on.
--
-- SAFETY: enabling RLS with no policies is default-deny for anon/authenticated
-- and a no-op for service_role, which bypasses RLS entirely. Every DB access in
-- THIS repo goes through createAdminClient() (service_role), so nothing here
-- changes behaviour. This matches the posture already used for kiosk_stations,
-- halls, agenda_settings and agenda_approval_log.
--
-- ⚠️ BEFORE APPLYING: this database is shared with the `amasi-membership` repo
-- (see CLAUDE.md "Migration Pipeline — Known Debt"). `directory_access_log`,
-- `profile_edit_log` and `announcements` are not read by this repo and are
-- likely written by that one. Confirm the membership app reaches them with the
-- service-role key and not the anon key, or those three will start returning
-- empty result sets. The 29 dated snapshot tables carry no such risk — nothing
-- reads them.
--
-- NOT INCLUDED HERE: dropping the dead snapshots. Most of the tables below are
-- disposable migration artifacts from May–July 2026 and deleting them would
-- remove this exposure permanently rather than just gating it. That is
-- irreversible, so it is deliberately left as a separate decision — verify
-- against the membership repo first, then drop.

ALTER TABLE announcements                                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_access_log                                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_edit_log                                      ENABLE ROW LEVEL SECURITY;

-- One-off migration/backfill snapshots (nothing reads these)
ALTER TABLE asi_reconcile_2026_06_24_snapshot                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE backfill_app_member_id_2026_05_20_snapshot            ENABLE ROW LEVEL SECURITY;
ALTER TABLE backfill_audit_pii_mask_2026_05_20_snapshot           ENABLE ROW LEVEL SECURITY;
ALTER TABLE backfill_clear_review_flags_2026_05_20_snapshot       ENABLE ROW LEVEL SECURITY;
ALTER TABLE backfill_completed_draft_failure_2026_05_20_snapshot  ENABLE ROW LEVEL SECURITY;
ALTER TABLE backfill_members_id_2026_05_20_snapshot               ENABLE ROW LEVEL SECURITY;
ALTER TABLE backfill_members_timestamps_2026_05_20_snapshot       ENABLE ROW LEVEL SECURITY;
ALTER TABLE backfill_payment_amount_2026_05_20_snapshot           ENABLE ROW LEVEL SECURITY;
ALTER TABLE backfill_payments_membership_strays_2026_06_14_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_assignments_127_pre_final_snapshot_2026_06_29 ENABLE ROW LEVEL SECURITY;
ALTER TABLE lm_asi_deepdive_2026_06_24_snapshot                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lm_asi_recover_2026_06_24_snapshot                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lm_downgrade2_2026_06_24_snapshot                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lm_downgrade_2026_06_24_snapshot                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE members_asi_backfill_2026_06_26                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE members_middle_name_dup_2026_06_30_snapshot           ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_payments_nonmembership_cleanup_2026_06_29  ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations_126_marksheet_pre_2026_07_02_snapshot   ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations_127_accom_2026_06_30_snapshot           ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations_127_accom_indiv_2026_06_30_snapshot     ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations_127_prabhu_2026_06_30_snapshot          ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations_127_ritika_2026_06_30_snapshot          ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations_127_sameer_pre_final_snapshot_2026_06_29 ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations_127_traincheckout_2026_06_30_snapshot   ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations_127_travel_complete_2026_06_30_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations_127_travel_details2_2026_06_30_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations_127_travel_details_2026_06_30_snapshot  ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations_127_travel_origin_2026_06_30_snapshot   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions_127_pre_final_snapshot_2026_06_29            ENABLE ROW LEVEL SECURITY;

-- Verification (expect 0 rows):
--   SELECT tablename FROM pg_tables
--   WHERE schemaname = 'public' AND rowsecurity = false;
