-- APPLIED 2026-08-06 via Supabase MCP. See CLAUDE.md migration history.
--
-- A02 Security Misconfiguration. "Public can upload to event-assets" granted
-- INSERT on storage.objects to the PUBLIC role, i.e. to anon.
--
-- VERIFIED EXPLOITABLE with only the publishable key (the one in the frontend
-- bundle): POST of a 1x1 PNG returned 200 and the object was immediately
-- readable at the bucket's public URL. An earlier probe with text/plain was
-- rejected by the bucket's MIME allowlist, NOT by authorization -- images and
-- application/pdf are permitted, which is ample for hosting phishing or malware
-- on a supabase.co URL belonging to this project, and for storage-cost abuse.
-- There is no DELETE policy for public, so anonymous uploads could only be
-- removed with the service role.
--
-- The policy could not simply be dropped: the badge designer, certificate
-- designer and addons page upload to this bucket from the BROWSER via
-- createClient() (@/lib/supabase/client). Those pages sit behind admin auth and
-- the browser client carries the admin's Supabase session, so their requests
-- arrive as `authenticated`. Narrowing the role keeps them working and closes
-- anonymous writes -- mirroring "Authenticated can insert to uploads", which
-- already existed on the uploads bucket in this same database.

DROP POLICY IF EXISTS "Public can upload to event-assets" ON storage.objects;

CREATE POLICY "Authenticated can upload to event-assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-assets');
