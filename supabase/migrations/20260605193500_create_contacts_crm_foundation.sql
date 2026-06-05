-- Phase 2 Universal Inbox and CRM foundation.
-- Adds tenant-scoped contacts and links WhatsApp conversations to CRM identity.

create table public.contacts (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null default 'whatsapp' check (channel = 'whatsapp'),
  external_contact_id text not null,
  phone_number text,
  display_name text,
  lead_status text not null default 'new'
    check (lead_status in ('new', 'active', 'cold', 'won', 'lost')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel, external_contact_id)
);

create index contacts_organization_id_idx
on public.contacts (organization_id);

create index contacts_organization_last_seen_idx
on public.contacts (organization_id, last_seen_at desc);

create trigger set_contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

alter table public.conversations
add column if not exists contact_id uuid references public.contacts(id) on delete set null;

create index if not exists conversations_contact_id_idx
on public.conversations (contact_id);

alter table public.contacts enable row level security;
alter table public.contacts force row level security;

create policy contacts_select_members
on public.contacts
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

grant select on public.contacts to authenticated;
grant all on public.contacts to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.conversations;
    alter publication supabase_realtime add table public.contacts;
  end if;
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.get_owner_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with active_org as (
    select *
    from public.get_my_organizations()
    order by created_at asc
    limit 1
  ),
  whatsapp_connection as (
    select
      wc.phone_number_id,
      wc.display_phone_number,
      wc.connection_status,
      wc.verified_at,
      wc.last_status_check_at,
      wc.last_error
    from public.whatsapp_config wc
    join active_org ao on ao.organization_id = wc.organization_id
    limit 1
  ),
  dashboard_metrics as (
    select
      coalesce((select count(*) from public.contacts c join active_org ao on ao.organization_id = c.organization_id), 0) as contacts,
      coalesce((select count(*) from public.conversations cv join active_org ao on ao.organization_id = cv.organization_id where cv.status = 'open'), 0) as open_conversations
  )
  select jsonb_build_object(
    'shouldOnboard', not exists (select 1 from active_org),
    'organization', (
      select jsonb_build_object(
        'id', organization_id,
        'name', name,
        'role', role,
        'timezone', timezone
      )
      from active_org
    ),
    'whatsappConnection', coalesce(
      (
        select jsonb_build_object(
          'status', connection_status,
          'phoneNumberId', phone_number_id,
          'displayPhoneNumber', display_phone_number,
          'verifiedAt', verified_at,
          'lastStatusCheckAt', last_status_check_at,
          'lastError', last_error
        )
        from whatsapp_connection
      ),
      jsonb_build_object(
        'status', 'not_configured',
        'phoneNumberId', null,
        'displayPhoneNumber', null,
        'verifiedAt', null,
        'lastStatusCheckAt', null,
        'lastError', null
      )
    ),
    'metrics', (
      select jsonb_build_object(
        'contacts', contacts,
        'openConversations', open_conversations,
        'products', 0,
        'lowStockItems', 0,
        'pendingFollowUps', 0
      )
      from dashboard_metrics
    ),
    'emptyStates', jsonb_build_array(
      'Connect WhatsApp to start receiving customer messages.',
      'Add products to answer stock and price questions.',
      'Create follow-up rules after the first conversations arrive.'
    )
  )
$$;

revoke all on function public.get_owner_dashboard() from public;
revoke all on function public.get_owner_dashboard() from anon;
grant execute on function public.get_owner_dashboard() to authenticated;
