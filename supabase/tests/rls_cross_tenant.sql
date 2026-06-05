-- Cross-tenant RLS verification for KAN-6 and KAN-72.
--
-- Run against a local Supabase database after migrations:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_cross_tenant.sql
--
-- The script creates two test users and two organizations in a transaction,
-- inserts one representative row per tenant-owned MVP table, switches into the
-- authenticated role for each user, and asserts that each user can only read
-- or update their own tenant rows.

begin;

create function pg_temp.assert_equal(actual bigint, expected bigint, label text)
returns text
language plpgsql
as $$
begin
  if actual is distinct from expected then
    raise exception '% expected %, got %', label, expected, actual;
  end if;

  return 'pass: ' || label;
end;
$$;

create function pg_temp.assert_membership_insert_denied(target_org_id uuid, target_user_id uuid, label text)
returns text
language plpgsql
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (target_org_id, target_user_id, 'staff');

  raise exception '% expected insert to be denied', label;
exception
  when insufficient_privilege or with_check_option_violation then
    return 'pass: ' || label;
end;
$$;

create function pg_temp.assert_whatsapp_config_select_denied(label text)
returns text
language plpgsql
as $$
declare
  row_count bigint;
begin
  select count(*) into row_count from public.whatsapp_config;

  raise exception '% expected select to be denied, got % rows', label, row_count;
exception
  when insufficient_privilege then
    return 'pass: ' || label;
end;
$$;

create function pg_temp.assert_whatsapp_message_events_select_denied(label text)
returns text
language plpgsql
as $$
declare
  row_count bigint;
begin
  select count(*) into row_count from public.whatsapp_message_events;

  raise exception '% expected select to be denied, got % rows', label, row_count;
exception
  when insufficient_privilege then
    return 'pass: ' || label;
end;
$$;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'tenant-a@example.test',
    '$2a$10$7EqJtq98hPqEX7fNZaFWoOHI7SKq9S9B9fJtLkq5YVpiAb3p5n6eW',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'tenant-b@example.test',
    '$2a$10$7EqJtq98hPqEX7fNZaFWoOHI7SKq9S9B9fJtLkq5YVpiAb3p5n6eW',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  )
on conflict (id) do nothing;

insert into public.organizations (
  id,
  name,
  timezone,
  ai_auto_send,
  ai_follow_up_delay_hours,
  business_hours
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Tenant A',
    'UTC',
    false,
    24,
    '{"enabled":false,"start":"09:00","end":"17:00","days":[1,2,3,4,5],"timezone":"UTC"}'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Tenant B',
    'UTC',
    false,
    24,
    '{"enabled":false,"start":"09:00","end":"17:00","days":[1,2,3,4,5],"timezone":"UTC"}'
  );

insert into public.organization_members (organization_id, user_id, role)
values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'owner');

insert into public.whatsapp_config (organization_id, phone_number_id, waba_id)
values
  ('11111111-1111-4111-8111-111111111111', 'phone-number-a', 'waba-a'),
  ('22222222-2222-4222-8222-222222222222', 'phone-number-b', 'waba-b');

insert into public.whatsapp_message_events (
  id,
  organization_id,
  phone_number_id,
  message_id,
  sender_phone,
  message_type
)
values
  (
    'aaaaaaaa-1000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'phone-number-a',
    'wamid-a',
    '+15555550101',
    'text'
  ),
  (
    'bbbbbbbb-1000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'phone-number-b',
    'wamid-b',
    '+15555550202',
    'text'
  );

insert into public.contacts (
  id,
  organization_id,
  external_contact_id,
  phone_number,
  display_name,
  lead_status
)
values
  (
    'aaaaaaaa-2000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    '+15555550101',
    '+15555550101',
    'Tenant A Customer',
    'active'
  ),
  (
    'bbbbbbbb-2000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    '+15555550202',
    '+15555550202',
    'Tenant B Customer',
    'active'
  );

insert into public.conversations (
  id,
  organization_id,
  contact_id,
  external_contact_id,
  customer_display_name,
  last_message_at
)
values
  (
    'aaaaaaaa-3000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-2000-4000-8000-000000000001',
    '+15555550101',
    'Tenant A Customer',
    now()
  ),
  (
    'bbbbbbbb-3000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-2000-4000-8000-000000000001',
    '+15555550202',
    'Tenant B Customer',
    now()
  );

insert into public.conversation_messages (
  id,
  organization_id,
  conversation_id,
  direction,
  external_message_id,
  sender_phone,
  recipient_phone,
  body,
  received_at
)
values
  (
    'aaaaaaaa-4000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-3000-4000-8000-000000000001',
    'inbound',
    'wamid-a-message',
    '+15555550101',
    '+15555550000',
    'Tenant A message',
    now()
  ),
  (
    'bbbbbbbb-4000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-3000-4000-8000-000000000001',
    'inbound',
    'wamid-b-message',
    '+15555550202',
    '+15555550000',
    'Tenant B message',
    now()
  );

insert into public.products (
  id,
  organization_id,
  name,
  sku,
  unit_price_cents,
  stock_quantity,
  reorder_threshold
)
values
  (
    'aaaaaaaa-5000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'Tenant A Product',
    'A-SKU',
    1000,
    2,
    5
  ),
  (
    'bbbbbbbb-5000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'Tenant B Product',
    'B-SKU',
    2000,
    3,
    5
  );

insert into public.owner_tasks (
  id,
  organization_id,
  contact_id,
  conversation_id,
  title,
  due_at,
  source_key
)
values
  (
    'aaaaaaaa-6000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-2000-4000-8000-000000000001',
    'aaaaaaaa-3000-4000-8000-000000000001',
    'Tenant A follow-up',
    now(),
    'tenant-a-follow-up'
  ),
  (
    'bbbbbbbb-6000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-2000-4000-8000-000000000001',
    'bbbbbbbb-3000-4000-8000-000000000001',
    'Tenant B follow-up',
    now(),
    'tenant-b-follow-up'
  );

insert into public.owner_notifications (
  id,
  organization_id,
  product_id,
  notification_type,
  title,
  body,
  source_key
)
values
  (
    'aaaaaaaa-7000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-5000-4000-8000-000000000001',
    'low_stock',
    'Tenant A low stock',
    'Tenant A product is low stock',
    'tenant-a-low-stock'
  ),
  (
    'bbbbbbbb-7000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-5000-4000-8000-000000000001',
    'low_stock',
    'Tenant B low stock',
    'Tenant B product is low stock',
    'tenant-b-low-stock'
  );

insert into public.owner_device_tokens (
  id,
  organization_id,
  user_id,
  push_token
)
values
  (
    'aaaaaaaa-8000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    'ExponentPushToken[tenant-a]'
  ),
  (
    'bbbbbbbb-8000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    'ExponentPushToken[tenant-b]'
  );

insert into public.ai_drafts (
  id,
  organization_id,
  conversation_id,
  source_message_id,
  draft_type,
  reply_body,
  catalog_context,
  decision_reason
)
values
  (
    'aaaaaaaa-9000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-3000-4000-8000-000000000001',
    'aaaaaaaa-4000-4000-8000-000000000001',
    'quote',
    'Tenant A quote',
    '{"matchedProducts":[]}',
    'tenant_a_quote'
  ),
  (
    'bbbbbbbb-9000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-3000-4000-8000-000000000001',
    'bbbbbbbb-4000-4000-8000-000000000001',
    'quote',
    'Tenant B quote',
    '{"matchedProducts":[]}',
    'tenant_b_quote'
  );

insert into public.ai_draft_events (
  id,
  organization_id,
  ai_draft_id,
  event_type,
  details
)
values
  (
    'aaaaaaaa-9100-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-9000-4000-8000-000000000001',
    'draft_created',
    '{"tenant":"a"}'
  ),
  (
    'bbbbbbbb-9100-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-9000-4000-8000-000000000001',
    'draft_created',
    '{"tenant":"b"}'
  );

set local role authenticated;

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
select pg_temp.assert_equal((select count(*) from public.organizations), 1::bigint, 'user A sees one organization');
select pg_temp.assert_equal((select count(*) from public.organizations where name = 'Tenant A'), 1::bigint, 'user A sees Tenant A');
select pg_temp.assert_equal((select count(*) from public.organizations where name = 'Tenant B'), 0::bigint, 'user A cannot see Tenant B');
select pg_temp.assert_equal((select count(*) from public.organization_members), 1::bigint, 'user A sees one membership');
select pg_temp.assert_equal((select count(*) from public.contacts), 1::bigint, 'Tenant A sees one contact');
select pg_temp.assert_equal((select count(*) from public.contacts where display_name = 'Tenant B Customer'), 0::bigint, 'Tenant A cannot see Tenant B contacts');
select pg_temp.assert_equal((select count(*) from public.conversations), 1::bigint, 'Tenant A sees one conversation');
select pg_temp.assert_equal((select count(*) from public.conversations where customer_display_name = 'Tenant B Customer'), 0::bigint, 'Tenant A cannot see Tenant B conversations');
select pg_temp.assert_equal((select count(*) from public.conversation_messages), 1::bigint, 'Tenant A sees one conversation message');
select pg_temp.assert_equal((select count(*) from public.conversation_messages where body = 'Tenant B message'), 0::bigint, 'Tenant A cannot see Tenant B conversation messages');
select pg_temp.assert_equal((select count(*) from public.products), 1::bigint, 'Tenant A sees one product');
select pg_temp.assert_equal((select count(*) from public.products where name = 'Tenant B Product'), 0::bigint, 'Tenant A cannot see Tenant B products');
select pg_temp.assert_equal((select count(*) from public.owner_tasks), 1::bigint, 'Tenant A sees one owner task');
select pg_temp.assert_equal((select count(*) from public.owner_tasks where title = 'Tenant B follow-up'), 0::bigint, 'Tenant A cannot see Tenant B tasks');
select pg_temp.assert_equal((select count(*) from public.owner_notifications), 1::bigint, 'Tenant A sees one owner notification');
select pg_temp.assert_equal((select count(*) from public.owner_notifications where title = 'Tenant B low stock'), 0::bigint, 'Tenant A cannot see Tenant B notifications');
select pg_temp.assert_equal((select count(*) from public.owner_device_tokens), 1::bigint, 'Tenant A sees one own device token');
select pg_temp.assert_equal((select count(*) from public.owner_device_tokens where push_token = 'ExponentPushToken[tenant-b]'), 0::bigint, 'Tenant A cannot see Tenant B device tokens');
select pg_temp.assert_equal((select count(*) from public.ai_drafts), 1::bigint, 'Tenant A sees one AI draft or quote');
select pg_temp.assert_equal((select count(*) from public.ai_drafts where reply_body = 'Tenant B quote'), 0::bigint, 'Tenant A cannot see Tenant B AI draft quotes');
select pg_temp.assert_equal((select count(*) from public.ai_draft_events), 1::bigint, 'Tenant A sees one AI draft event');
select pg_temp.assert_equal((select count(*) from public.ai_draft_events where details ->> 'tenant' = 'b'), 0::bigint, 'Tenant A cannot see Tenant B AI events');
with updated_settings as (
  update public.organizations
  set ai_auto_send = true
  where id = '22222222-2222-4222-8222-222222222222'
  returning 1
)
select pg_temp.assert_equal((select count(*) from updated_settings), 0::bigint, 'Tenant A cannot update Tenant B settings');
select pg_temp.assert_whatsapp_config_select_denied('user A cannot read whatsapp_config');
select pg_temp.assert_whatsapp_message_events_select_denied('user A cannot read whatsapp_message_events');
select pg_temp.assert_membership_insert_denied('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'user A cannot write membership rows for Tenant B');

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
select pg_temp.assert_equal((select count(*) from public.organizations), 1::bigint, 'user B sees one organization');
select pg_temp.assert_equal((select count(*) from public.organizations where name = 'Tenant B'), 1::bigint, 'user B sees Tenant B');
select pg_temp.assert_equal((select count(*) from public.organizations where name = 'Tenant A'), 0::bigint, 'user B cannot see Tenant A');
select pg_temp.assert_equal((select count(*) from public.organization_members), 1::bigint, 'user B sees one membership');
select pg_temp.assert_equal((select count(*) from public.contacts), 1::bigint, 'Tenant B sees one contact');
select pg_temp.assert_equal((select count(*) from public.contacts where display_name = 'Tenant A Customer'), 0::bigint, 'Tenant B cannot see Tenant A contacts');
select pg_temp.assert_equal((select count(*) from public.conversations), 1::bigint, 'Tenant B sees one conversation');
select pg_temp.assert_equal((select count(*) from public.conversations where customer_display_name = 'Tenant A Customer'), 0::bigint, 'Tenant B cannot see Tenant A conversations');
select pg_temp.assert_equal((select count(*) from public.conversation_messages), 1::bigint, 'Tenant B sees one conversation message');
select pg_temp.assert_equal((select count(*) from public.conversation_messages where body = 'Tenant A message'), 0::bigint, 'Tenant B cannot see Tenant A conversation messages');
select pg_temp.assert_equal((select count(*) from public.products), 1::bigint, 'Tenant B sees one product');
select pg_temp.assert_equal((select count(*) from public.products where name = 'Tenant A Product'), 0::bigint, 'Tenant B cannot see Tenant A products');
select pg_temp.assert_equal((select count(*) from public.owner_tasks), 1::bigint, 'Tenant B sees one owner task');
select pg_temp.assert_equal((select count(*) from public.owner_tasks where title = 'Tenant A follow-up'), 0::bigint, 'Tenant B cannot see Tenant A tasks');
select pg_temp.assert_equal((select count(*) from public.owner_notifications), 1::bigint, 'Tenant B sees one owner notification');
select pg_temp.assert_equal((select count(*) from public.owner_notifications where title = 'Tenant A low stock'), 0::bigint, 'Tenant B cannot see Tenant A notifications');
select pg_temp.assert_equal((select count(*) from public.owner_device_tokens), 1::bigint, 'Tenant B sees one own device token');
select pg_temp.assert_equal((select count(*) from public.owner_device_tokens where push_token = 'ExponentPushToken[tenant-a]'), 0::bigint, 'Tenant B cannot see Tenant A device tokens');
select pg_temp.assert_equal((select count(*) from public.ai_drafts), 1::bigint, 'Tenant B sees one AI draft or quote');
select pg_temp.assert_equal((select count(*) from public.ai_drafts where reply_body = 'Tenant A quote'), 0::bigint, 'Tenant B cannot see Tenant A AI draft quotes');
select pg_temp.assert_equal((select count(*) from public.ai_draft_events), 1::bigint, 'Tenant B sees one AI draft event');
select pg_temp.assert_equal((select count(*) from public.ai_draft_events where details ->> 'tenant' = 'a'), 0::bigint, 'Tenant B cannot see Tenant A AI events');
with updated_settings as (
  update public.organizations
  set ai_auto_send = true
  where id = '11111111-1111-4111-8111-111111111111'
  returning 1
)
select pg_temp.assert_equal((select count(*) from updated_settings), 0::bigint, 'Tenant B cannot update Tenant A settings');
select pg_temp.assert_whatsapp_config_select_denied('user B cannot read whatsapp_config');
select pg_temp.assert_whatsapp_message_events_select_denied('user B cannot read whatsapp_message_events');

rollback;
