-- Platform auth OTP challenges (WhatsApp via Nexolia platform WABA) and staff QR invites.

create table public.auth_otp_challenges (
  id uuid primary key default extensions.gen_random_uuid(),
  channel text not null check (channel in ('whatsapp')),
  phone_e164 text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index auth_otp_challenges_phone_created_idx
on public.auth_otp_challenges (phone_e164, created_at desc);

alter table public.auth_otp_challenges enable row level security;
alter table public.auth_otp_challenges force row level security;

revoke all on public.auth_otp_challenges from anon, authenticated;
grant all on public.auth_otp_challenges to service_role;

create table public.organization_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid references public.business_centers(id) on delete set null,
  invited_phone_e164 text not null,
  invited_display_name text,
  org_role text not null default 'staff' check (org_role in ('owner', 'staff')),
  center_role text not null default 'staff' check (center_role in ('manager', 'staff')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint organization_invites_phone_not_blank check (length(trim(invited_phone_e164)) > 0)
);

create index organization_invites_org_created_idx
on public.organization_invites (organization_id, created_at desc);

create index organization_invites_token_hash_idx
on public.organization_invites (token_hash);

alter table public.organization_invites enable row level security;
alter table public.organization_invites force row level security;

create policy organization_invites_select_owner
on public.organization_invites
for select
to authenticated
using (private.is_org_owner(organization_id));

revoke all on public.organization_invites from anon;
grant select on public.organization_invites to authenticated;
grant all on public.organization_invites to service_role;
