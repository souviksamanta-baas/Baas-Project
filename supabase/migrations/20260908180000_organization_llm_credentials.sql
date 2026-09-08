-- Per-org OpenAI credentials for Copi Pro/Enterprise (Nexolia-billed).
-- Keys are provisioned manually from admin; never exposed to org members.

create table if not exists public.organization_llm_credentials (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'openai'
    check (provider in ('openai')),
  openai_project_id text,
  openai_service_account_id text,
  openai_api_key_id text,
  api_key_encrypted text,
  monthly_spend_limit_usd numeric(12, 2),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'failed', 'revoked')),
  last_error text,
  provisioned_at timestamptz,
  provisioned_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create index if not exists organization_llm_credentials_status_idx
  on public.organization_llm_credentials (status);

create trigger set_organization_llm_credentials_updated_at
before update on public.organization_llm_credentials
for each row execute function public.set_updated_at();

alter table public.organization_llm_credentials enable row level security;
alter table public.organization_llm_credentials force row level security;

-- Service-role only (same posture as whatsapp_config / instagram_config).
revoke all on table public.organization_llm_credentials from authenticated, anon;
