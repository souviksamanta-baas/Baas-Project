-- Chats WhatsApp UX: pin/mute conversations + message reactions

alter table public.conversations
  add column if not exists pinned_at timestamptz,
  add column if not exists muted_until timestamptz;

create index if not exists conversations_org_pinned_idx
  on public.conversations (organization_id, pinned_at desc nulls last)
  where deleted_at is null;

create table if not exists public.message_reactions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid not null references public.business_centers(id) on delete cascade,
  message_id uuid not null references public.conversation_messages(id) on delete cascade,
  actor text not null check (actor in ('owner', 'contact')),
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, actor)
);

create index if not exists message_reactions_message_id_idx
  on public.message_reactions (message_id);

create index if not exists message_reactions_org_bc_idx
  on public.message_reactions (organization_id, business_center_id);

alter table public.message_reactions enable row level security;
alter table public.message_reactions force row level security;

drop policy if exists message_reactions_select_members on public.message_reactions;
create policy message_reactions_select_members
on public.message_reactions
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

drop policy if exists message_reactions_insert_members on public.message_reactions;
create policy message_reactions_insert_members
on public.message_reactions
for insert
to authenticated
with check (organization_id in (select private.user_org_ids()));

drop policy if exists message_reactions_update_members on public.message_reactions;
create policy message_reactions_update_members
on public.message_reactions
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

drop policy if exists message_reactions_delete_members on public.message_reactions;
create policy message_reactions_delete_members
on public.message_reactions
for delete
to authenticated
using (organization_id in (select private.user_org_ids()));

grant select, insert, update, delete on public.message_reactions to authenticated;
