-- APPLIED 2026-08-06 via Supabase MCP. See CLAUDE.md migration history.
--
-- Three postgres-owned views ran with SECURITY DEFINER semantics and granted
-- SELECT to anon, so reads through them bypassed RLS on the member tables.
-- Measured with the publishable key (public, ships in the frontend bundle):
--   tbl_member            18,698 rows x 55 cols -- name, father_name, email,
--                         mobile, dob, address1/2, city, pincode, mci_number,
--                         asi_membership_no, plus URLs for profile_photo,
--                         mci_certificate, pg_certificate, mbbs_certificate,
--                         asi_certificate, active_license, letter_hod
--   active_amasi_members  18,697 rows -- email, phone, name, membership_type
--   public_profiles            9 rows -- name, avatar_url
--
-- Nothing read them via anon: tbl_member/public_profiles are referenced by no
-- code in either repo, and active_amasi_members only through createAdminClient()
-- (src/lib/amasi-membership.ts). service_role is unaffected.

ALTER VIEW public.active_amasi_members SET (security_invoker = on);
ALTER VIEW public.public_profiles      SET (security_invoker = on);
ALTER VIEW public.tbl_member           SET (security_invoker = on);

REVOKE SELECT ON public.active_amasi_members FROM anon, authenticated;
REVOKE SELECT ON public.public_profiles      FROM anon, authenticated;
REVOKE SELECT ON public.tbl_member           FROM anon, authenticated;
