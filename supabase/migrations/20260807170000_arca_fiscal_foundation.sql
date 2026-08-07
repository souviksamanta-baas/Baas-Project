-- ARCA fiscal foundation: org emitter fields, arca_accounts, invoices, product IVA, contact receptor fields.

-- ---------------------------------------------------------------------------
-- Organization emitter (fiscal identity)
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists cuit text,
  add column if not exists tax_condition text
    check (tax_condition is null or tax_condition in (
      'monotributo',
      'responsable_inscripto',
      'exento',
      'no_responsable',
      'consumidor_final'
    )),
  add column if not exists legal_name text,
  add column if not exists fiscal_address_line1 text,
  add column if not exists fiscal_city text,
  add column if not exists fiscal_province text,
  add column if not exists fiscal_postal_code text;

comment on column public.organizations.cuit is 'Emitter CUIT (11 digits, no dashes).';
comment on column public.organizations.tax_condition is 'Emitter IVA / tax condition for ARCA voucher type selection.';

-- ---------------------------------------------------------------------------
-- Products — IVA rate
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists iva_rate numeric(5, 2) not null default 21
    check (iva_rate in (0, 10.5, 21, 27));

comment on column public.products.iva_rate is 'IVA alícuota percent for Factura A/B line breakdown.';

-- ---------------------------------------------------------------------------
-- Contacts — billing receptor fields
-- ---------------------------------------------------------------------------
alter table public.contacts
  add column if not exists document_type text
    check (document_type is null or document_type in (
      'CUIT', 'CUIL', 'DNI', 'Pasaporte', 'CI', 'LC', 'LE', 'CF'
    )),
  add column if not exists document_number text,
  add column if not exists tax_condition text
    check (tax_condition is null or tax_condition in (
      'monotributo',
      'responsable_inscripto',
      'exento',
      'no_responsable',
      'consumidor_final'
    )),
  add column if not exists fiscal_name text;

-- ---------------------------------------------------------------------------
-- ARCA connection per organization
-- ---------------------------------------------------------------------------
create table if not exists public.arca_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cuit text not null,
  tax_condition text not null
    check (tax_condition in (
      'monotributo',
      'responsable_inscripto',
      'exento',
      'no_responsable',
      'consumidor_final'
    )),
  environment text not null default 'homologacion'
    check (environment in ('homologacion', 'production')),
  point_of_sale integer not null
    check (point_of_sale > 0 and point_of_sale <= 99999),
  authorization_status text not null default 'pending'
    check (authorization_status in (
      'pending',
      'connected',
      'error',
      'disabled',
      'awaiting_delegation'
    )),
  certificate_encrypted text,
  private_key_encrypted text,
  representation_metadata jsonb not null default '{}'::jsonb,
  wsaa_token_encrypted text,
  wsaa_sign_encrypted text,
  wsaa_token_expires_at timestamptz,
  connected_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create trigger set_arca_accounts_updated_at
before update on public.arca_accounts
for each row execute function public.set_updated_at();

create index if not exists arca_accounts_cuit_idx
  on public.arca_accounts (cuit);

alter table public.arca_accounts enable row level security;
alter table public.arca_accounts force row level security;

-- Secrets / certs: service-role only (same posture as instagram_config).
-- Mobile reads connection status via Nest /arca endpoints (no client secrets).
revoke all on table public.arca_accounts from authenticated, anon;
grant all on table public.arca_accounts to service_role;

-- ---------------------------------------------------------------------------
-- Invoices (fiscal comprobantes)
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_center_id uuid,
  sell_quote_id text references public.sell_quotes(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,

  voucher_type text not null
    check (voucher_type in (
      'FA', 'FB', 'FC',
      'NCA', 'NCB', 'NCC',
      'NDA', 'NDB', 'NDC'
    )),
  -- AFIP numeric codes stored alongside for WSFE
  voucher_type_code integer not null,
  point_of_sale integer not null
    check (point_of_sale > 0),
  voucher_number integer,

  issue_date date not null default (timezone('America/Argentina/Buenos_Aires', now()))::date,
  currency text not null default 'ARS',
  exchange_rate numeric(18, 6) not null default 1,

  net_amount_cents bigint not null default 0,
  vat_amount_cents bigint not null default 0,
  exempt_amount_cents bigint not null default 0,
  total_amount_cents bigint not null default 0,

  customer_document_type text,
  customer_document_number text,
  customer_tax_condition text,
  customer_name text,

  line_items jsonb not null default '[]'::jsonb,
  related_invoice_id uuid references public.invoices(id) on delete set null,

  arca_status text not null default 'draft'
    check (arca_status in (
      'draft',
      'pending',
      'authorized',
      'rejected',
      'error',
      'cancelled'
    )),
  cae text,
  cae_expiration date,
  arca_request jsonb,
  arca_response jsonb,
  qr_url text,
  pdf_storage_path text,
  last_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, point_of_sale, voucher_type_code, voucher_number)
);

create trigger set_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create index if not exists invoices_org_created_idx
  on public.invoices (organization_id, created_at desc);

create index if not exists invoices_org_status_idx
  on public.invoices (organization_id, arca_status, created_at desc);

create index if not exists invoices_sell_quote_idx
  on public.invoices (sell_quote_id)
  where sell_quote_id is not null;

alter table public.invoices enable row level security;
alter table public.invoices force row level security;

create policy invoices_select_members
on public.invoices
for select
to authenticated
using (organization_id in (select private.user_org_ids()));

create policy invoices_insert_members
on public.invoices
for insert
to authenticated
with check (organization_id in (select private.user_org_ids()));

create policy invoices_update_members
on public.invoices
for update
to authenticated
using (organization_id in (select private.user_org_ids()))
with check (organization_id in (select private.user_org_ids()));

grant select, insert, update on public.invoices to authenticated;
grant all on public.invoices to service_role;

-- ---------------------------------------------------------------------------
-- Issuance locks (serialize CUIT + PV + voucher type)
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_issuance_locks (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cuit text not null,
  point_of_sale integer not null,
  voucher_type_code integer not null,
  locked_by text,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (organization_id, point_of_sale, voucher_type_code)
);

alter table public.invoice_issuance_locks enable row level security;
alter table public.invoice_issuance_locks force row level security;
revoke all on table public.invoice_issuance_locks from authenticated, anon;
grant all on table public.invoice_issuance_locks to service_role;
