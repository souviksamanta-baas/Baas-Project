-- Lock down client-side updates on `organizations` so a compromised owner JWT
-- cannot promote its org (change plan, flip feature flags, extend licence,
-- un-archive, …). The RLS policy `organizations_update_owners` still allows
-- owners to edit the profile columns the app already writes
-- (name, timezone, contact_email, contact_phone, address_*, city, province,
-- postal_code, country, nav_shortcut, business_hours, ai_auto_send,
-- ai_follow_up_delay_hours, default_iva_rate_percent, fiscal_* fields and
-- avatars). Fiscal + license columns remain service-role only via this
-- trigger which fires only for non-service-role callers.
--
-- Supabase's service role runs with `auth.role() = 'service_role'`, so our
-- admin + API paths continue to update these columns normally. The trigger
-- aborts the UPDATE whenever a client JWT (authenticated/anon) attempts to
-- change one of the protected columns.

create or replace function private.forbid_client_org_privileged_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := coalesce(auth.role(), '');
begin
  if caller_role in ('service_role', '') then
    -- Service-role writes (admin API, migrations, triggers) are always
    -- allowed. An empty role means we are inside a trigger / migration /
    -- direct DB session, not a client request.
    return new;
  end if;

  if new.license_status is distinct from old.license_status then
    raise exception using
      errcode = '42501',
      message = 'organizations.license_status is managed by Nexolia staff.';
  end if;

  if new.license_status_before_pause is distinct from old.license_status_before_pause then
    raise exception using
      errcode = '42501',
      message = 'organizations.license_status_before_pause is managed by Nexolia staff.';
  end if;

  if new.plan_id is distinct from old.plan_id then
    raise exception using
      errcode = '42501',
      message = 'organizations.plan_id is managed by Nexolia staff.';
  end if;

  if new.feature_flags is distinct from old.feature_flags then
    raise exception using
      errcode = '42501',
      message = 'organizations.feature_flags is managed by Nexolia staff.';
  end if;

  if new.archived_at is distinct from old.archived_at then
    raise exception using
      errcode = '42501',
      message = 'organizations.archived_at is managed by the API.';
  end if;

  -- Defense in depth: companion columns that travel with the above.
  if new.archived_by is distinct from old.archived_by then
    raise exception using
      errcode = '42501',
      message = 'organizations.archived_by is managed by the API.';
  end if;

  if new.licensed_until is distinct from old.licensed_until then
    raise exception using
      errcode = '42501',
      message = 'organizations.licensed_until is managed by Nexolia staff.';
  end if;

  if new.billing_cycle is distinct from old.billing_cycle then
    raise exception using
      errcode = '42501',
      message = 'organizations.billing_cycle is managed by Nexolia staff.';
  end if;

  return new;
end;
$$;

revoke all on function private.forbid_client_org_privileged_updates() from public;
revoke all on function private.forbid_client_org_privileged_updates() from anon;
revoke all on function private.forbid_client_org_privileged_updates() from authenticated;

drop trigger if exists organizations_forbid_client_privileged_updates
  on public.organizations;

create trigger organizations_forbid_client_privileged_updates
before update on public.organizations
for each row
execute function private.forbid_client_org_privileged_updates();
