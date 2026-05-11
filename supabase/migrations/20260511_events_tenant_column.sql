-- Multi-tenant scope for the events table.
--
-- Applied manually on jmdwxymbgxwdsmcwbahp before code merge (PR #35) — this
-- file is committed for reproducibility on fresh environments and preview
-- deployments. Idempotent so re-running on the live DB is a no-op.
--
-- Companion code in src/lib/tenant.ts (getTenant / withTenant /
-- selectEventsForTenant) enforces the same scope in app queries. The DB
-- column is the source of truth; the helper exists so reads can't accidentally
-- leak across tenants if a future refactor drops the inline WHERE.
--
-- Default is 'college' so the existing collegeofmas.org.in deployment keeps
-- inserting valid rows without code changes during the rollout window. Once
-- both deployments are confirmed setting tenant explicitly, the default can
-- be dropped in a follow-up migration (optional cleanup, not required).

alter table public.events
  add column if not exists tenant text not null default 'college';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_tenant_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_tenant_check
      check (tenant in ('amasi', 'college'));
  end if;
end $$;

create index if not exists events_tenant_status_end_date_idx
  on public.events (tenant, status, end_date);
