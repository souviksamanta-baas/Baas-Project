-- Mitigation 17: FORCE RLS on app_startup_samples (service-role writes only).
-- Mitigation 21: store browser QR device context for pairing challenges.

alter table public.app_startup_samples force row level security;

alter table public.browser_session_challenges
  add column if not exists device_user_agent text,
  add column if not exists device_ip text;
