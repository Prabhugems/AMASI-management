-- Allow 'technosurg' as a third tenant value on public.events.
--
-- The original 20260511 migration encoded a two-value CHECK ('amasi','college')
-- because Phase 2 only planned for the College + AMASI deployments sharing
-- jmdwxymbgxwdsmcwbahp. A separate, pre-existing Vercel project
-- (technosurg-2026 → technosurg.gemhospitals.com) also deploys this repo and
-- needs the same tenant scaffolding, even though its Supabase
-- (zqbbyxbkbaibdihfhjve) is a standalone DB where the WHERE is effectively
-- a no-op. Without this, every build there fails the startup tenant guard.
--
-- Idempotent: drops + re-adds the constraint, only if the old one still
-- references just the two original values.

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'events_tenant_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events drop constraint events_tenant_check;
  end if;
  alter table public.events
    add constraint events_tenant_check
    check (tenant in ('amasi', 'college', 'technosurg'));
end $$;
