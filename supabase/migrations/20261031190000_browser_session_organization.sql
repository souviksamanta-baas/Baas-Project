-- Remember which business the phone was using when it approved the computer.

alter table public.browser_session_challenges
  add column if not exists organization_id uuid;
