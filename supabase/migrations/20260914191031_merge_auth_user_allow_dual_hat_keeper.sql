-- Allow dual-hat staff+owner keepers to merge phone/email identities.
-- Still blocks absorbing a nexolia_staff donor account.

create or replace function public.merge_auth_user(p_from uuid, p_to uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_from_staff boolean;
  v_lock_a uuid;
  v_lock_b uuid;
  v_donor_member record;
  v_keeper_member_id uuid;
  v_keeper_role text;
  v_best_role text;
  v_moved_orgs integer := 0;
  v_merged_orgs integer := 0;
begin
  if p_from is null or p_to is null then
    raise exception 'merge_auth_user requires both user ids';
  end if;

  if p_from = p_to then
    return jsonb_build_object('ok', true, 'noop', true);
  end if;

  if p_from::text < p_to::text then
    v_lock_a := p_from;
    v_lock_b := p_to;
  else
    v_lock_a := p_to;
    v_lock_b := p_from;
  end if;
  perform pg_advisory_xact_lock(hashtext(v_lock_a::text), hashtext(v_lock_b::text));

  -- Never absorb a nexolia_staff auth user. Keeper may be dual-hat staff+owner.
  select exists (
    select 1 from public.nexolia_staff s where s.user_id = p_from
  ) into v_from_staff;

  if v_from_staff then
    raise exception 'No se puede vincular una cuenta de staff de Nexolia.';
  end if;

  if not exists (select 1 from auth.users where id = p_from) then
    raise exception 'La cuenta origen ya no existe.';
  end if;

  if not exists (select 1 from auth.users where id = p_to) then
    raise exception 'La cuenta destino no existe.';
  end if;

  for v_donor_member in
    select id, organization_id, role
    from public.organization_members
    where user_id = p_from
  loop
    select om.id, om.role
      into v_keeper_member_id, v_keeper_role
    from public.organization_members om
    where om.organization_id = v_donor_member.organization_id
      and om.user_id = p_to;

    if v_keeper_member_id is null then
      update public.organization_members
      set user_id = p_to
      where id = v_donor_member.id;
      v_moved_orgs := v_moved_orgs + 1;
    else
      if public.organization_member_role_rank(v_donor_member.role)
         > public.organization_member_role_rank(v_keeper_role) then
        v_best_role := v_donor_member.role;
      else
        v_best_role := v_keeper_role;
      end if;

      update public.organization_members
      set role = v_best_role
      where id = v_keeper_member_id;

      update public.business_center_members bcm
      set organization_member_id = v_keeper_member_id
      where bcm.organization_id = v_donor_member.organization_id
        and bcm.organization_member_id = v_donor_member.id
        and not exists (
          select 1
          from public.business_center_members existing
          where existing.organization_id = bcm.organization_id
            and existing.business_center_id = bcm.business_center_id
            and existing.organization_member_id = v_keeper_member_id
        );

      delete from public.business_center_members
      where organization_member_id = v_donor_member.id;

      delete from public.organization_members
      where id = v_donor_member.id;

      v_merged_orgs := v_merged_orgs + 1;
    end if;
  end loop;

  delete from public.owner_task_followers f
  using public.owner_task_followers k
  where f.user_id = p_from
    and k.user_id = p_to
    and f.task_id = k.task_id
    and f.organization_id = k.organization_id;

  update public.owner_task_followers
  set user_id = p_to
  where user_id = p_from;

  if to_regclass('public.owner_tasks') is not null then
    begin
      update public.owner_tasks set assigned_to_user_id = p_to
      where assigned_to_user_id = p_from;
    exception when undefined_column then null;
    end;
    begin
      update public.owner_tasks set created_by_user_id = p_to
      where created_by_user_id = p_from;
    exception when undefined_column then null;
    end;
    begin
      update public.owner_tasks set completed_by_user_id = p_to
      where completed_by_user_id = p_from;
    exception when undefined_column then null;
    end;
  end if;

  if to_regclass('public.appointments') is not null then
    begin
      update public.appointments set assigned_to_user_id = p_to
      where assigned_to_user_id = p_from;
    exception when undefined_column then null;
    end;
    begin
      update public.appointments set created_by_user_id = p_to
      where created_by_user_id = p_from;
    exception when undefined_column then null;
    end;
  end if;

  if to_regclass('public.user_notification_prefs') is not null then
    delete from public.user_notification_prefs d
    using public.user_notification_prefs k
    where d.user_id = p_from
      and k.user_id = p_to
      and d.organization_id = k.organization_id;

    update public.user_notification_prefs
    set user_id = p_to
    where user_id = p_from;
  end if;

  if to_regclass('public.owner_notification_reads') is not null then
    delete from public.owner_notification_reads d
    using public.owner_notification_reads k
    where d.user_id = p_from
      and k.user_id = p_to
      and d.notification_id = k.notification_id;

    update public.owner_notification_reads
    set user_id = p_to
    where user_id = p_from;
  end if;

  if to_regclass('public.owner_notifications') is not null then
    begin
      update public.owner_notifications
      set target_user_id = p_to
      where target_user_id = p_from;
    exception when undefined_column then null;
    end;
  end if;

  if to_regclass('public.copi_sessions') is not null then
    update public.copi_sessions set user_id = p_to where user_id = p_from;
  end if;

  if to_regclass('public.registered_owners') is not null then
    update public.registered_owners
    set user_id = p_to
    where user_id = p_from
      and not exists (
        select 1 from public.registered_owners r2
        where r2.user_id = p_to and r2.id <> registered_owners.id
      );

    update public.registered_owners
    set user_id = null
    where user_id = p_from;
  end if;

  update public.organization_invites
  set accepted_by_user_id = p_to
  where accepted_by_user_id = p_from;

  update public.organization_invites
  set created_by = p_to
  where created_by = p_from;

  if to_regclass('public.sales_ai_drafts') is not null then
    begin
      update public.sales_ai_drafts set approved_by = p_to where approved_by = p_from;
    exception when undefined_column then null;
    end;
  end if;

  if to_regclass('public.cash_ledger_entries') is not null then
    update public.cash_ledger_entries set created_by = p_to where created_by = p_from;
  end if;

  if to_regclass('public.sell_quotes') is not null then
    update public.sell_quotes set created_by = p_to where created_by = p_from;
  end if;

  if to_regclass('public.invoices') is not null then
    begin
      update public.invoices set created_by = p_to where created_by = p_from;
    exception when undefined_column then null;
    end;
  end if;

  if to_regclass('public.organizations') is not null then
    begin
      update public.organizations set archived_by = p_to where archived_by = p_from;
    exception when undefined_column then null;
    end;
  end if;

  if to_regclass('public.organization_llm_credentials') is not null then
    update public.organization_llm_credentials
    set provisioned_by_user_id = p_to
    where provisioned_by_user_id = p_from;
  end if;

  update public.auth_identity_merge_challenges
  set consumed_at = coalesce(consumed_at, now())
  where consumed_at is null
    and (keeper_user_id in (p_from, p_to) or donor_user_id in (p_from, p_to));

  return jsonb_build_object(
    'ok', true,
    'movedOrgs', v_moved_orgs,
    'mergedOrgs', v_merged_orgs
  );
end;
$$;

comment on function public.merge_auth_user(uuid, uuid) is
  'Remap tenant FKs from donor auth user to keeper. Service-role only. Blocks donor nexolia_staff; keeper may be dual-hat staff+owner.';
