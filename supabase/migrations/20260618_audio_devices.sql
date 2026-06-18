-- Audio device tracking for live events (headset / receiver issue + return).
-- Each device has a unique scannable code; assignments record who has it now.

create table if not exists public.audio_devices (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  device_code  text not null,
  status       text not null default 'available' check (status in ('available','issued','lost','damaged')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (event_id, device_code)
);
create index if not exists audio_devices_event_idx on public.audio_devices(event_id);

create table if not exists public.audio_device_assignments (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  device_id       uuid not null references public.audio_devices(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  assigned_at     timestamptz not null default now(),
  returned_at     timestamptz,
  assigned_by     text,
  returned_by     text,
  notes           text
);
create index if not exists audio_assignments_event_idx on public.audio_device_assignments(event_id);
create index if not exists audio_assignments_device_idx on public.audio_device_assignments(device_id);
create index if not exists audio_assignments_registration_idx on public.audio_device_assignments(registration_id);

-- A device can only be "currently issued" to one person at a time.
create unique index if not exists audio_assignments_active_per_device
  on public.audio_device_assignments(device_id)
  where returned_at is null;

-- RLS — opened up to authenticated; admin client (service role) bypasses anyway.
alter table public.audio_devices              enable row level security;
alter table public.audio_device_assignments   enable row level security;

drop policy if exists audio_devices_authed              on public.audio_devices;
drop policy if exists audio_device_assignments_authed   on public.audio_device_assignments;
create policy audio_devices_authed            on public.audio_devices            for all to authenticated using (true) with check (true);
create policy audio_device_assignments_authed on public.audio_device_assignments for all to authenticated using (true) with check (true);
