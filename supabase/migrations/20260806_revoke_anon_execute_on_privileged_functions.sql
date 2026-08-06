-- APPLIED 2026-08-06 via Supabase MCP. See CLAUDE.md migration history.
--
-- CRITICAL. These SECURITY DEFINER functions were EXECUTE-able by `anon`, i.e.
-- by anyone holding the publishable key. The grant was never written down --
-- it is PostgreSQL's default EXECUTE-to-PUBLIC, which Supabase's anon and
-- authenticated roles inherit. sql/015_admin_user_functions.sql issues no GRANT.
--
--   create_admin_user(email,name,password,role) -- raw INSERT INTO admin_users
--     with is_active=true and a caller-supplied role, no authorization check.
--     Anyone could POST /rest/v1/rpc/create_admin_user and mint a super_admin.
--   verify_admin_password(email,password) -- unauthenticated password oracle,
--     no rate limiting, and it RETURNS a.totp_secret on success, so a correct
--     guess also hands over the 2FA seed.
--   device_tokens_by_zone(zone) -- every Expo push token in a zone.
--   log_position_audit(...) -- lets an anonymous caller forge audit rows.
--
-- Both admin functions are called only server-side via createAdminClient()
-- (amasi-membership: api/admin/users/route.ts, api/auth/login/route.ts).
--
-- NOT revoked: current_user_is_admin, is_super_admin, current_user_zone are
-- referenced by 9, 8 and 4 RLS policies. The querying role must execute them
-- or policy evaluation fails.

REVOKE EXECUTE ON FUNCTION public.create_admin_user(text, text, text, text)   FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_admin_password(text, text)           FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.device_tokens_by_zone(text)                 FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_position_audit(text, uuid, uuid, text, text, text, uuid, jsonb, text) FROM anon, authenticated, PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_admin_user(text, text, text, text)    TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_admin_password(text, text)            TO service_role;
GRANT EXECUTE ON FUNCTION public.device_tokens_by_zone(text)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.log_position_audit(text, uuid, uuid, text, text, text, uuid, jsonb, text) TO service_role;

-- Both admin functions also had a mutable search_path, hijackable in a
-- SECURITY DEFINER context. Pin it.
ALTER FUNCTION public.create_admin_user(text, text, text, text)  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.verify_admin_password(text, text)          SET search_path = public, extensions, pg_temp;
