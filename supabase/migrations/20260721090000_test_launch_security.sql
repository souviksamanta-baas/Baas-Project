-- Test Launch security: Copi message RLS (session owner), atomic invite accept, OTP cooldown.

-- 1) copi_messages: only the session owner can SELECT (org membership alone is insufficient).
drop policy if exists copi_messages_select_members on public.copi_messages;
drop policy if exists copi_messages_select_owner on public.copi_messages;

create policy copi_messages_select_owner
on public.copi_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.copi_sessions s
    where s.id = copi_messages.session_id
      and s.organization_id = copi_messages.organization_id
      and s.user_id = auth.uid()
      and s.organization_id in (select private.user_org_ids())
  )
);

-- 2) OTP resend cooldown support (API enforces; column stores last successful send).
alter table public.auth_otp_challenges
  add column if not exists last_sent_at timestamptz;

comment on column public.auth_otp_challenges.last_sent_at is
  'When this challenge OTP was last dispatched (for resend cooldown).';

-- 3) Atomic invite accept: claim invite + memberships in one transaction.
create or replace function public.accept_organization_invite(
  p_token_hash text,
  p_user_id uuid,
  p_verified_phone_e164 text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.organization_invites%rowtype;
  v_member_id uuid;
  v_center_ids uuid[];
  v_center_id uuid;
  v_default_center_id uuid;
begin
  if p_token_hash is null or length(trim(p_token_hash)) = 0 then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;

  if p_user_id is null then
    raise exception 'INVALID_USER' using errcode = 'P0001';
  end if;

  if p_verified_phone_e164 is null or length(trim(p_verified_phone_e164)) = 0 then
    raise exception 'PHONE_REQUIRED' using errcode = 'P0001';
  end if;

  select *
  into v_invite
  from public.organization_invites
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;

  if v_invite.revoked_at is not null or v_invite.accepted_at is not null then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'INVITE_EXPIRED' using errcode = 'P0001';
  end if;

  if v_invite.invited_phone_e164 <> trim(p_verified_phone_e164) then
    raise exception 'PHONE_MISMATCH' using errcode = 'P0001';
  end if;

  update public.organization_invites
  set
    accepted_at = now(),
    accepted_by_user_id = p_user_id
  where id = v_invite.id
    and accepted_at is null
    and revoked_at is null;

  if not found then
    raise exception 'INVALID_INVITE' using errcode = 'P0001';
  end if;

  select id
  into v_member_id
  from public.organization_members
  where organization_id = v_invite.organization_id
    and user_id = p_user_id;

  if v_member_id is null then
    insert into public.organization_members (organization_id, user_id, role)
    values (v_invite.organization_id, p_user_id, v_invite.org_role)
    returning id into v_member_id;
  end if;

  v_center_ids := coalesce(
    (
      select array_agg(distinct x)
      from unnest(coalesce(v_invite.invited_business_center_ids, '{}'::uuid[])) as t(x)
      where x is not null
    ),
    '{}'::uuid[]
  );

  if cardinality(v_center_ids) = 0 and v_invite.business_center_id is not null then
    v_center_ids := array[v_invite.business_center_id];
  end if;

  if cardinality(v_center_ids) = 0 then
    select id
    into v_default_center_id
    from public.business_centers
    where organization_id = v_invite.organization_id
      and is_default = true
    limit 1;

    if v_default_center_id is not null then
      v_center_ids := array[v_default_center_id];
    end if;
  end if;

  foreach v_center_id in array v_center_ids
  loop
    insert into public.business_center_members (
      organization_id,
      business_center_id,
      organization_member_id,
      role
    )
    values (
      v_invite.organization_id,
      v_center_id,
      v_member_id,
      v_invite.center_role
    )
    on conflict (organization_id, business_center_id, organization_member_id) do nothing;
  end loop;

  return v_invite.organization_id;
end;
$$;

revoke all on function public.accept_organization_invite(text, uuid, text) from public, anon, authenticated;
grant execute on function public.accept_organization_invite(text, uuid, text) to service_role;

comment on function public.accept_organization_invite(text, uuid, text) is
  'Atomically claims a staff invite and upserts org/center memberships. Phone must match invite; called only with service role after API auth.';
