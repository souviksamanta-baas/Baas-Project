-- Phase 1 WhatsApp webhook event persistence.
-- Durable event storage is the source of truth for duplicate detection.

create table public.whatsapp_message_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  whatsapp_config_id uuid references public.whatsapp_config(id) on delete set null,
  phone_number_id text not null,
  message_id text not null,
  sender_phone text not null,
  message_type text not null default 'unknown',
  message_timestamp timestamptz,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'duplicate', 'processed', 'failed')),
  payload_metadata jsonb not null default '{}'::jsonb,
  first_received_at timestamptz not null default now(),
  last_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phone_number_id, message_id)
);

create index whatsapp_message_events_organization_id_idx
on public.whatsapp_message_events (organization_id);

create index whatsapp_message_events_phone_number_id_idx
on public.whatsapp_message_events (phone_number_id);

create index whatsapp_message_events_processing_status_idx
on public.whatsapp_message_events (processing_status);

create trigger set_whatsapp_message_events_updated_at
before update on public.whatsapp_message_events
for each row execute function public.set_updated_at();

alter table public.whatsapp_message_events enable row level security;
alter table public.whatsapp_message_events force row level security;

revoke all on public.whatsapp_message_events from anon, authenticated;
grant all on public.whatsapp_message_events to service_role;
