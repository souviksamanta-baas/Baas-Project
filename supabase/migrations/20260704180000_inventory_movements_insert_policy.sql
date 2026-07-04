create policy inventory_movements_insert_members
on public.inventory_movements
for insert
to authenticated
with check (organization_id in (select private.user_org_ids()));

grant insert on public.inventory_movements to authenticated;
