-- Allow org members to update inventory lots (e.g. mark remaining_quantity = 0 when reversing a purchase).
create policy inventory_lots_update_members
on public.inventory_lots
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

grant update on public.inventory_lots to authenticated;
