-- APPLIED 2026-08-06 via Supabase MCP. See CLAUDE.md migration history.
--
-- airtable_members is a foreign table (airtable_membership_server FDW) in the
-- public schema with a standing SELECT grant to anon. RLS does not protect
-- foreign tables the way it protects ordinary ones, so the grant is the only
-- control. The REST endpoint already answered 401 and no code references it,
-- so this removes a latent path rather than a live one.

REVOKE SELECT ON public.airtable_members FROM anon, authenticated;
