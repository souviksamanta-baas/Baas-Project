-- Phase 2 WhatsApp connection status metadata.
-- Keeps secrets server-only while exposing safe connection state through owner RPCs.

alter table public.whatsapp_config
add column if not exists display_phone_number text,
add column if not exists connection_status text not null default 'pending'
  check (connection_status in ('pending', 'connected', 'error', 'disabled')),
add column if not exists verified_at timestamptz,
add column if not exists disconnected_at timestamptz,
add column if not exists last_error text,
add column if not exists last_status_check_at timestamptz;

create index if not exists whatsapp_config_organization_status_idx
on public.whatsapp_config (organization_id, connection_status);

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
    'metrics', jsonb_build_object(
      'contacts', 0,
      'openConversations', 0,
      'products', 0,
      'lowStockItems', 0,
      'pendingFollowUps', 0
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
