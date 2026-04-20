-- Observability table for cron jobs. Every run inserts a row at start, then
-- updates it on success/failure. Combined with the dashboard widget, this
-- replaces the silent-failure mode that let syncAddressesFromAirtable return
-- 0 records for two weeks without anyone noticing.

create table if not exists cron_runs (
  id           bigint generated always as identity primary key,
  job          text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running'
               check (status in ('running', 'success', 'error')),
  synced_count integer,
  error        text,
  metadata     jsonb
);

create index if not exists cron_runs_job_started_idx
  on cron_runs (job, started_at desc);

-- RLS: only super_admin can read; writes happen via service-role admin client
alter table cron_runs enable row level security;

drop policy if exists cron_runs_select_super_admin on cron_runs;
create policy cron_runs_select_super_admin on cron_runs
  for select
  using (
    exists (
      select 1 from users
      where users.id = auth.uid()
        and (users.is_super_admin = true or users.platform_role = 'super_admin')
    )
  );
