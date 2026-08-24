-- Targeted notifications (e.g. task.assigned) must only be visible to the
-- intended recipient. Broadcast rows keep target_user_id null.

drop policy if exists owner_notifications_select_members on public.owner_notifications;
create policy owner_notifications_select_members
on public.owner_notifications
for select
to authenticated
using (
  organization_id in (select private.user_org_ids())
  and (target_user_id is null or target_user_id = auth.uid())
);

drop policy if exists owner_notifications_update_members on public.owner_notifications;
create policy owner_notifications_update_members
on public.owner_notifications
for update
to authenticated
using (
  organization_id in (select private.user_org_ids())
  and (target_user_id is null or target_user_id = auth.uid())
)
with check (
  organization_id in (select private.user_org_ids())
  and (target_user_id is null or target_user_id = auth.uid())
);

-- Hide stale Copi confirm nudges when the proposal was already executed in chat.
update public.owner_notifications as n
set status = 'dismissed'
where n.notification_type = 'copi.action_needed'
  and n.status <> 'dismissed'
  and exists (
    select 1
    from public.copi_action_proposals as p
    where n.source_key = concat('copi.action_needed:', p.id::text)
      and p.status = 'executed'
  );

-- Also clear premature nudges created before the 5-minute delay rule.
update public.owner_notifications as n
set status = 'dismissed'
where n.notification_type = 'copi.action_needed'
  and n.status <> 'dismissed'
  and exists (
    select 1
    from public.copi_action_proposals as p
    where n.source_key = concat('copi.action_needed:', p.id::text)
      and p.status = 'pending'
      and p.created_at > now() - interval '5 minutes'
  );
