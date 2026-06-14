-- payment_alerts: admin-visible log of payment anomalies / actions worth a human
-- look. The table was referenced from three insertion sites that all swallowed
-- their errors (see verify-public, razorpay webhook, payment-reconciliation cron)
-- because the table was never created — leaving the alerting safety net silently
-- dead. Schema unifies the shape all three call sites already write.

create table public.payment_alerts (
  id                   uuid primary key default gen_random_uuid(),

  -- Source linkage. All three nullable: orphan alerts have no payment_id;
  -- membership alerts have no event_id; webhook alerts at the order stage
  -- may have neither yet.
  event_id             uuid references public.events(id) on delete set null,
  payment_id           uuid references public.payments(id) on delete set null,
  razorpay_payment_id  text,
  razorpay_order_id    text,

  alert_type           text not null,
  severity             text not null default 'medium'
    check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  message              text not null,
  metadata             jsonb not null default '{}'::jsonb,

  status               text not null default 'pending'
    check (status in ('pending', 'acknowledged', 'resolved', 'dismissed')),
  acknowledged_at      timestamptz,
  acknowledged_by      uuid references auth.users(id) on delete set null,
  resolved_at          timestamptz,
  resolved_by          uuid references auth.users(id) on delete set null,
  resolution_notes     text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index payment_alerts_status_severity_idx
  on public.payment_alerts (status, severity, created_at desc);

create index payment_alerts_event_idx
  on public.payment_alerts (event_id)
  where event_id is not null;

create index payment_alerts_payment_idx
  on public.payment_alerts (payment_id)
  where payment_id is not null;

create index payment_alerts_razorpay_payment_idx
  on public.payment_alerts (razorpay_payment_id)
  where razorpay_payment_id is not null;

-- Auto-bump updated_at on row updates. update_updated_at() is the shared
-- helper already used by other tables in this schema.
create trigger update_payment_alerts_timestamp
  before update on public.payment_alerts
  for each row execute function update_updated_at();

-- Admin client bypasses RLS; restrictive default keeps direct-client reads
-- blocked-by-default until/unless explicit policies are added.
alter table public.payment_alerts enable row level security;
