-- Phase 2 conversation and message persistence for WhatsApp inbox delivery.
-- Stores customer-visible message history separately from webhook event dedupe.

create table public.conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  whatsapp_config_id uuid references public.whatsapp_config(id) on delete set null,
  channel text not null default 'whatsapp' check (channel = 'whatsapp'),
  external_contact_id text not null,
  customer_display_name text,
  status text not null default 'open' check (status in ('open', 'closed')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel, external_contact_id)
);

create index conversations_organization_id_idx
on public.conversations (organization_id);

create index conversations_last_message_at_idx
on public.conversations (organization_id, last_message_at desc);

create trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create table public.conversation_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  whatsapp_message_event_id uuid references public.whatsapp_message_events(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  external_message_id text,
  sender_phone text,
  recipient_phone text,
  message_type text not null default 'text',
  body text,
  message_status text not null default 'received'
    check (message_status in ('received', 'pending', 'sent', 'delivered', 'read', 'failed')),
  received_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index conversation_messages_external_message_id_idx
on public.conversation_messages (organization_id, external_message_id)
where external_message_id is not null;

create index conversation_messages_conversation_id_idx
on public.conversation_messages (conversation_id, created_at);

create index conversation_messages_organization_created_idx
on public.conversation_messages (organization_id, created_at desc);

create trigger set_conversation_messages_updated_at
before update on public.conversation_messages
for each row execute function public.set_updated_at();

alter table public.conversations enable row level security;
alter table public.conversations force row level security;

alter table public.conversation_messages enable row level security;
alter table public.conversation_messages force row level security;

create policy conversations_select_members
on public.conversations
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy conversation_messages_select_members
on public.conversation_messages
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

grant select on public.conversations to authenticated;
grant select on public.conversation_messages to authenticated;
grant all on public.conversations to service_role;
grant all on public.conversation_messages to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.conversation_messages;
  end if;
exception
  when duplicate_object then null;
end;
$$;
