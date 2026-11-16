-- One row per signed-in app open. The owner API writes it and staff read it.
-- No policies: anon and authenticated cannot see other businesses' samples.

create table public.app_startup_samples (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  platform text not null,
  device_model text,
  os_version text,
  app_version text,
  max_stall_ms integer not null check (max_stall_ms >= 0 and max_stall_ms <= 60000),
  time_to_first_tap_ms integer check (
    time_to_first_tap_ms is null
    or (time_to_first_tap_ms >= 0 and time_to_first_tap_ms <= 60000)
  ),
  created_at timestamptz not null default now()
);

create index app_startup_samples_created_at_idx
  on public.app_startup_samples (created_at desc);

alter table public.app_startup_samples enable row level security;

revoke all on table public.app_startup_samples from anon, authenticated;
