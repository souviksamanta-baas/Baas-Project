-- One-time desktop pairing challenges. The poll secret never goes in the QR.
-- Only the service role can read or write this table (tokens sit here until the
-- computer polls once).

create table if not exists public.browser_session_challenges (
  id uuid primary key,
  poll_secret_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'consumed', 'expired')),
  expires_at timestamptz not null,
  user_id uuid,
  access_token text,
  refresh_token text,
  created_at timestamptz not null default now()
);

alter table public.browser_session_challenges enable row level security;
alter table public.browser_session_challenges force row level security;

revoke all on public.browser_session_challenges from anon, authenticated;
grant all on public.browser_session_challenges to service_role;
