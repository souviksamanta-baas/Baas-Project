-- Chats WhatsApp-like UX + lead legend expansion (KAN-313 / KAN-402)

-- Conversations: read / archive / soft-delete / clear messages
alter table public.conversations
  add column if not exists last_owner_read_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists messages_cleared_at timestamptz;

create index if not exists conversations_org_deleted_idx
  on public.conversations (organization_id)
  where deleted_at is null;

create index if not exists conversations_org_archived_idx
  on public.conversations (organization_id, archived_at)
  where deleted_at is null;

-- Contacts: opportunity / finished + cold_at for Oportunidad rule
alter table public.contacts
  drop constraint if exists contacts_lead_status_check;

alter table public.contacts
  add constraint contacts_lead_status_check
  check (lead_status in ('new', 'active', 'cold', 'won', 'lost', 'opportunity', 'finished'));

alter table public.contacts
  add column if not exists cold_at timestamptz,
  add column if not exists lead_status_changed_at timestamptz;

-- ai_drafts lead_status allow new values
alter table public.ai_drafts
  drop constraint if exists ai_drafts_lead_status_check;

alter table public.ai_drafts
  add constraint ai_drafts_lead_status_check
  check (lead_status is null or lead_status in ('new', 'active', 'cold', 'won', 'lost', 'opportunity', 'finished'));

-- Message edit / reply / soft-hide / link preview
alter table public.conversation_messages
  add column if not exists edited_at timestamptz,
  add column if not exists reply_to_message_id uuid references public.conversation_messages(id) on delete set null,
  add column if not exists owner_hidden_at timestamptz,
  add column if not exists link_preview jsonb not null default '{}'::jsonb,
  add column if not exists media_duration_ms integer;

-- Members can update conversation owner-facing fields
drop policy if exists conversations_update_members on public.conversations;
create policy conversations_update_members
on public.conversations
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

-- Members can update contact lead_status (manual Ganado/Perdido/Terminado)
drop policy if exists contacts_update_members on public.contacts;
create policy contacts_update_members
on public.contacts
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

-- Members can soft-hide / edit metadata on messages they can see
drop policy if exists conversation_messages_update_members on public.conversation_messages;
create policy conversation_messages_update_members
on public.conversation_messages
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

grant select, update on public.conversations to authenticated;
grant select, update on public.contacts to authenticated;
grant select, update on public.conversation_messages to authenticated;
