create policy inventory_lots_insert_members
on public.inventory_lots
for insert
to authenticated
with check (organization_id in (select private.user_org_ids()));

grant insert on public.inventory_lots to authenticated;
