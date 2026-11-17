-- Atomic OTP attempt increment + identity lockout; Copi confirm intermediate status.

-- 1) Allow claim pending → executing before Copi executeAction.
alter table public.copi_action_proposals
  drop constraint if exists copi_action_proposals_status_check;

alter table public.copi_action_proposals
  add constraint copi_action_proposals_status_check
  check (status in (
    'pending',
    'executing',
    'confirmed',
    'rejected',
    'expired',
    'executed',
    'failed'
  ));

-- 2) Atomically claim one OTP verification attempt for an identity.
-- Returns jsonb: { ok, reason?, id?, code_hash?, attempts?, expires_at? }
create or replace function public.claim_auth_otp_attempt(
  p_channel text,
  p_purpose text,
  p_email text default null,
  p_phone_e164 text default null,
  p_max_attempts int default 5,
  p_lockout_window interval default interval '30 minutes'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identity_attempts int;
  v_row public.auth_otp_challenges%rowtype;
begin
  if p_channel is null or length(trim(p_channel)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  if p_purpose is null or length(trim(p_purpose)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  if (p_email is null or length(trim(p_email)) = 0)
     and (p_phone_e164 is null or length(trim(p_phone_e164)) = 0) then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  select coalesce(sum(c.attempts), 0)
    into v_identity_attempts
  from public.auth_otp_challenges c
  where c.channel = p_channel
    and c.purpose = p_purpose
    and c.created_at > now() - p_lockout_window
    and (
      (p_email is not null and length(trim(p_email)) > 0 and c.email = p_email)
      or (
        p_phone_e164 is not null
        and length(trim(p_phone_e164)) > 0
        and c.phone_e164 = p_phone_e164
      )
    );

  if v_identity_attempts >= p_max_attempts then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;

  select *
    into v_row
  from public.auth_otp_challenges c
  where c.channel = p_channel
    and c.purpose = p_purpose
    and c.consumed_at is null
    and (
      (p_email is not null and length(trim(p_email)) > 0 and c.email = p_email)
      or (
        p_phone_e164 is not null
        and length(trim(p_phone_e164)) > 0
        and c.phone_e164 = p_phone_e164
      )
    )
  order by c.created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  if v_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if v_row.attempts >= p_max_attempts then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;

  update public.auth_otp_challenges
  set attempts = attempts + 1
  where id = v_row.id
    and attempts < p_max_attempts
    and consumed_at is null
  returning * into v_row;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'code_hash', v_row.code_hash,
    'attempts', v_row.attempts,
    'expires_at', v_row.expires_at
  );
end;
$$;

revoke all on function public.claim_auth_otp_attempt(text, text, text, text, int, interval)
  from public, anon, authenticated;
grant execute on function public.claim_auth_otp_attempt(text, text, text, text, int, interval)
  to service_role;

comment on function public.claim_auth_otp_attempt(text, text, text, text, int, interval) is
  'Atomically increments OTP attempts for the latest unconsumed challenge and enforces identity lockout across recent challenges.';

-- 3) Identity lockout check before issuing a new challenge.
create or replace function public.auth_otp_identity_is_locked(
  p_channel text,
  p_purpose text,
  p_email text default null,
  p_phone_e164 text default null,
  p_max_attempts int default 5,
  p_lockout_window interval default interval '30 minutes'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identity_attempts int;
begin
  select coalesce(sum(c.attempts), 0)
    into v_identity_attempts
  from public.auth_otp_challenges c
  where c.channel = p_channel
    and c.purpose = p_purpose
    and c.created_at > now() - p_lockout_window
    and (
      (p_email is not null and length(trim(p_email)) > 0 and c.email = p_email)
      or (
        p_phone_e164 is not null
        and length(trim(p_phone_e164)) > 0
        and c.phone_e164 = p_phone_e164
      )
    );

  return v_identity_attempts >= p_max_attempts;
end;
$$;

revoke all on function public.auth_otp_identity_is_locked(text, text, text, text, int, interval)
  from public, anon, authenticated;
grant execute on function public.auth_otp_identity_is_locked(text, text, text, text, int, interval)
  to service_role;
