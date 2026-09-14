-- Identity linking: OTP purpose (login vs link) + merge_auth_user for email/phone bind.

-- ---------------------------------------------------------------------------
-- auth_otp_challenges.purpose
-- ---------------------------------------------------------------------------
alter table public.auth_otp_challenges
  add column if not exists purpose text not null default 'login';

alter table public.auth_otp_challenges
  drop constraint if exists auth_otp_challenges_purpose_check;

alter table public.auth_otp_challenges
  add constraint auth_otp_challenges_purpose_check
  check (purpose in ('login', 'link'));

create index if not exists auth_otp_challenges_email_purpose_created_idx
  on public.auth_otp_challenges (email, purpose, created_at desc);

create index if not exists auth_otp_challenges_phone_purpose_created_idx
  on public.auth_otp_challenges (phone_e164, purpose, created_at desc);

comment on column public.auth_otp_challenges.purpose is
  'login = mint session; link = bind identity on authenticated user (Actualizar perfil).';

-- ---------------------------------------------------------------------------
-- Short-lived merge confirmation after a successful link OTP
-- ---------------------------------------------------------------------------
create table if not exists public.auth_identity_merge_challenges (
  id uuid primary key default extensions.gen_random_uuid(),
  token_hash text not null unique,
  keeper_user_id uuid not null references auth.users(id) on delete cascade,
  donor_user_id uuid not null references auth.users(id) on delete cascade,
  identity_kind text not null check (identity_kind in ('email', 'phone')),
  identity_value text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint auth_identity_merge_challenges_distinct_users
    check (keeper_user_id <> donor_user_id)
);

create index if not exists auth_identity_merge_challenges_keeper_idx
  on public.auth_identity_merge_challenges (keeper_user_id, created_at desc);

alter table public.auth_identity_merge_challenges enable row level security;
alter table public.auth_identity_merge_challenges force row level security;

revoke all on public.auth_identity_merge_challenges from anon, authenticated;
grant all on public.auth_identity_merge_challenges to service_role;

-- ---------------------------------------------------------------------------
-- Lookup helpers (service_role only)
-- ---------------------------------------------------------------------------
create or replace function public.find_auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

create or replace function public.find_auth_user_id_by_phone(p_phone_e164 text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select u.id
  from auth.users u
  where (
      u.phone = p_phone_e164
      or u.raw_user_meta_data->>'auth_phone' = p_phone_e164
    )
  order by case when u.phone = p_phone_e164 then 0 else 1 end
  limit 1;
$$;

revoke all on function public.find_auth_user_id_by_email(text) from public, anon, authenticated;
revoke all on function public.find_auth_user_id_by_phone(text) from public, anon, authenticated;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;
grant execute on function public.find_auth_user_id_by_phone(text) to service_role;

-- ---------------------------------------------------------------------------
-- Role rank for same-org membership merge
-- ---------------------------------------------------------------------------
create or replace function public.organization_member_role_rank(p_role text)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'owner' then 4
    when 'co_owner' then 3
    when 'manager' then 2
    when 'staff' then 1
    else 0
  end;
$$;

-- ---------------------------------------------------------------------------
-- merge_auth_user: remap donor → keeper, then caller deletes donor auth user
-- ---------------------------------------------------------------------------
create or replace function public.merge_auth_user(p_from uuid, p_to uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_from_staff boolean;
  v_to_staff boolean;
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

  -- Deterministic advisory lock order
  if p_from::text < p_to::text then
    v_lock_a := p_from;
    v_lock_b := p_to;
  else
    v_lock_a := p_to;
    v_lock_b := p_from;
  end if;
  perform pg_advisory_xact_lock(hashtext(v_lock_a::text), hashtext(v_lock_b::text));

  select exists (
    select 1 from public.nexolia_staff s where s.user_id = p_from
  ) into v_from_staff;

  select exists (
    select 1 from public.nexolia_staff s where s.user_id = p_to
  ) into v_to_staff;

  if v_from_staff or v_to_staff then
    raise exception 'No se puede vincular una cuenta de staff de Nexolia.';
  end if;

  if not exists (select 1 from auth.users where id = p_from) then
    raise exception 'La cuenta origen ya no existe.';
  end if;

  if not exists (select 1 from auth.users where id = p_to) then
    raise exception 'La cuenta destino no existe.';
  end if;

  -- organization_members (+ business_center_members)
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

      -- Re-point center memberships onto keeper member, drop duplicates
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

  -- owner_task_followers (unique-ish on org+task+user)
  delete from public.owner_task_followers f
  using public.owner_task_followers k
  where f.user_id = p_from
    and k.user_id = p_to
    and f.task_id = k.task_id
    and f.organization_id = k.organization_id;

  update public.owner_task_followers
  set user_id = p_to
  where user_id = p_from;

  -- owner tasks assignees / creators (if columns exist)
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

  -- appointments
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

  -- notification prefs
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

  -- notification reads
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

  -- notifications target_user_id
  if to_regclass('public.owner_notifications') is not null then
    begin
      update public.owner_notifications
      set target_user_id = p_to
      where target_user_id = p_from;
    exception when undefined_column then null;
    end;
  end if;

  -- copi sessions / messages
  if to_regclass('public.copi_sessions') is not null then
    update public.copi_sessions set user_id = p_to where user_id = p_from;
  end if;

  -- registered_owners: unique on email typically — remount user_id when present
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

  -- invites
  update public.organization_invites
  set accepted_by_user_id = p_to
  where accepted_by_user_id = p_from;

  update public.organization_invites
  set created_by = p_to
  where created_by = p_from;

  -- soft FKs (set null on delete normally — reassign when possible)
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

  -- consume outstanding merge challenges involving either side
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

revoke all on function public.merge_auth_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_auth_user(uuid, uuid) to service_role;

revoke all on function public.organization_member_role_rank(text) from public, anon, authenticated;
grant execute on function public.organization_member_role_rank(text) to service_role;

comment on function public.merge_auth_user(uuid, uuid) is
  'Remap tenant FKs from donor auth user to keeper. Service-role only. Caller deletes donor auth.users.';
