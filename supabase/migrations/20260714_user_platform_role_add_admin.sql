-- src/lib/auth/role-mapping.ts maps team_members.role='admin' to
-- platform_role='admin' when auto-creating a user profile on first login.
-- The user_platform_role enum didn't include 'admin' (only super_admin,
-- event_admin, committee, faculty, delegate), so that insert always failed
-- with 22P02, silently breaking first login for any team member whose role
-- is literally 'admin' — cascading into every API route that depends on the
-- users row existing (settings save, activity logs, etc).
--
-- Discovered on the essurg-2026 project 2026-07-14; likely latent on the
-- shared prod DB too (untriggered there because existing admins' users rows
-- predate this auto-create path). Not applied to prod by this migration —
-- follow the standing out-of-band apply process for that.

ALTER TYPE user_platform_role ADD VALUE IF NOT EXISTS 'admin';
