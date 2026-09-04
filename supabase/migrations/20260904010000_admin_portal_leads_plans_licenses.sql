-- Nexolia admin portal: staff, leads, plans, licenses, registered owners, audit
-- KAN-405 / KAN-413

-- ---------------------------------------------------------------------------
-- Platform staff (Nexolia employees — not client org members)
-- ---------------------------------------------------------------------------
create table if not exists public.nexolia_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'admin'
    check (role in ('admin', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists nexolia_staff_email_idx
  on public.nexolia_staff (lower(email));

alter table public.nexolia_staff enable row level security;
alter table public.nexolia_staff force row level security;

-- No client RLS policies — Nest uses service_role only.
grant all on public.nexolia_staff to service_role;

-- ---------------------------------------------------------------------------
-- Plans catalog
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  price_ars_monthly integer not null default 0,
  price_ars_annual integer,
  feature_flags jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_slug_not_blank check (length(trim(slug)) > 0),
  constraint plans_display_name_not_blank check (length(trim(display_name)) > 0)
);

alter table public.plans enable row level security;
alter table public.plans force row level security;

create policy plans_select_authenticated
  on public.plans
  for select
  to authenticated
  using (is_active = true);

grant select on public.plans to authenticated;
grant all on public.plans to service_role;

insert into public.plans (slug, display_name, price_ars_monthly, price_ars_annual, feature_flags, limits, sort_order)
values
  (
    'starter',
    'Starter',
    29000,
    295800,
    jsonb_build_object(
      'account', true,
      'browser_session', true,
      'help_privacy', true,
      'inbox', true,
      'integrations', true,
      'tasks', true,
      'copi_enabled', true,
      'copi_basic_reports', true,
      'copi_freeform_questions', true,
      'billing_quotes', true,
      'billing_invoices', false,
      'billing_arca', false,
      'commerce_inventory', false,
      'commerce_pos', false
    ),
    jsonb_build_object('users', 2, 'channels', 3, 'conversations_month', 5000, 'contacts', 5000),
    10
  ),
  (
    'basico',
    'Básico',
    69000,
    703800,
    jsonb_build_object(
      'account', true,
      'browser_session', true,
      'help_privacy', true,
      'inbox', true,
      'integrations', true,
      'integrations_whatsapp', true,
      'tasks', true,
      'notifications', true,
      'copi_enabled', true,
      'copi_basic_reports', true,
      'copi_freeform_questions', true,
      'billing_quotes', true,
      'billing_invoices', true,
      'billing_arca', false,
      'commerce_inventory', true,
      'commerce_pos', true,
      'commerce_purchases', true,
      'commerce_suppliers', true
    ),
    jsonb_build_object('users', 5, 'channels', 5, 'conversations_month', 25000, 'contacts', 25000),
    20
  ),
  (
    'pro',
    'Pro',
    149000,
    1519800,
    jsonb_build_object(
      'account', true,
      'browser_session', true,
      'help_privacy', true,
      'inbox', true,
      'integrations', true,
      'integrations_whatsapp', true,
      'integrations_instagram', true,
      'tasks', true,
      'notifications', true,
      'copi_enabled', true,
      'copi_basic_reports', true,
      'copi_freeform_questions', true,
      'copi_pro_agent', true,
      'copi_voice', true,
      'copi_vision', true,
      'copi_custom_reports', true,
      'billing_quotes', true,
      'billing_invoices', true,
      'billing_arca', true,
      'commerce_inventory', true,
      'commerce_lots', true,
      'commerce_pos', true,
      'commerce_purchases', true,
      'commerce_suppliers', true,
      'multi_sucursales', true
    ),
    jsonb_build_object('users', null, 'channels', null, 'conversations_month', null, 'contacts', null),
    30
  )
on conflict (slug) do update
set
  display_name = excluded.display_name,
  price_ars_monthly = excluded.price_ars_monthly,
  price_ars_annual = excluded.price_ars_annual,
  feature_flags = excluded.feature_flags,
  limits = excluded.limits,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Org license columns
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists plan_id uuid references public.plans (id) on delete set null;

alter table public.organizations
  add column if not exists license_status text not null default 'pending_payment';

alter table public.organizations
  drop constraint if exists organizations_license_status_check;

alter table public.organizations
  add constraint organizations_license_status_check
  check (license_status in ('pending_payment', 'trial', 'active', 'paused', 'expired'));

alter table public.organizations
  add column if not exists licensed_until timestamptz;

alter table public.organizations
  add column if not exists billing_cycle text
  check (billing_cycle is null or billing_cycle in ('monthly', 'annual'));

create index if not exists organizations_plan_id_idx
  on public.organizations (plan_id);

create index if not exists organizations_license_status_idx
  on public.organizations (license_status);

-- ---------------------------------------------------------------------------
-- License payments (cash / transfer confirmation)
-- ---------------------------------------------------------------------------
create table if not exists public.license_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  method text not null check (method in ('cash', 'transfer')),
  amount_ars integer not null check (amount_ars >= 0),
  reference text,
  status text not null default 'awaiting'
    check (status in ('awaiting', 'confirmed', 'rejected')),
  received_at timestamptz,
  confirmed_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists license_payments_org_idx
  on public.license_payments (organization_id, created_at desc);

alter table public.license_payments enable row level security;
alter table public.license_payments force row level security;
-- service_role only for staff portal writes/reads

grant all on public.license_payments to service_role;

-- ---------------------------------------------------------------------------
-- Leads (public /comenzar)
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  vertical_slug text,
  selected_services jsonb not null default '[]'::jsonb,
  feature_flags jsonb not null default '{}'::jsonb,
  plan_slug text,
  billing_cycle text check (billing_cycle is null or billing_cycle in ('monthly', 'annual')),
  marketing_opt_in boolean not null default false,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'converted', 'closed')),
  organization_id uuid references public.organizations (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_email_idx on public.leads (lower(email));
create index if not exists leads_status_idx on public.leads (status, created_at desc);

alter table public.leads enable row level security;
alter table public.leads force row level security;

grant all on public.leads to service_role;

-- ---------------------------------------------------------------------------
-- Registered owners (email allowlist before first OTP)
-- ---------------------------------------------------------------------------
create table if not exists public.registered_owners (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists registered_owners_org_email_uidx
  on public.registered_owners (organization_id, lower(email));

create index if not exists registered_owners_email_idx
  on public.registered_owners (lower(email));

alter table public.registered_owners enable row level security;
alter table public.registered_owners force row level security;

grant all on public.registered_owners to service_role;

-- ---------------------------------------------------------------------------
-- Admin audit log
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_staff_id uuid references auth.users (id) on delete set null,
  via text not null default 'ui' check (via in ('ui', 'grok')),
  action text not null,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;
alter table public.admin_audit_log force row level security;

grant all on public.admin_audit_log to service_role;

-- ---------------------------------------------------------------------------
-- Extra verticals for onboarding dropdown
-- ---------------------------------------------------------------------------
insert into public.organization_verticals (slug, display_name, description, sort_order, suggested_feature_flags)
values
  ('ferreteria', 'Ferretería', 'Comercio de materiales y herramientas.', 15,
   '{"commerce_inventory":true,"commerce_pos":true,"commerce_purchases":true,"commerce_suppliers":true,"appointments":false}'::jsonb),
  ('clinica', 'Clínica', 'Servicios de salud con agenda.', 25,
   '{"appointments":true,"commerce_inventory":false,"commerce_pos":false}'::jsonb),
  ('veterinaria', 'Veterinaria', 'Clínica y productos veterinarios.', 26,
   '{"appointments":true,"commerce_inventory":true,"commerce_pos":true}'::jsonb),
  ('restaurante', 'Restaurante', 'Gastronomía con stock e insumos.', 27,
   '{"commerce_inventory":true,"commerce_pos":true,"commerce_purchases":true,"appointments":false}'::jsonb),
  ('taller', 'Taller', 'Taller o servicio técnico.', 28,
   '{"appointments":true,"commerce_inventory":true,"commerce_pos":true}'::jsonb)
on conflict (slug) do update
set
  display_name = excluded.display_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  suggested_feature_flags = excluded.suggested_feature_flags,
  is_active = true,
  updated_at = now();

-- Helper: is current user nexolia staff? (for future RLS if needed)
create or replace function private.is_nexolia_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.nexolia_staff
    where user_id = auth.uid()
  );
$$;

revoke all on function private.is_nexolia_staff() from public;
grant execute on function private.is_nexolia_staff() to authenticated, service_role;
