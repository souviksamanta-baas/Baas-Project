-- Allow Nest-owned email OTP challenges (channel=email) alongside WhatsApp.

alter table public.auth_otp_challenges
  drop constraint if exists auth_otp_challenges_channel_check;

alter table public.auth_otp_challenges
  add constraint auth_otp_challenges_channel_check
  check (channel in ('whatsapp', 'email'));

alter table public.auth_otp_challenges
  alter column phone_e164 drop not null;

alter table public.auth_otp_challenges
  add column if not exists email text;

alter table public.auth_otp_challenges
  drop constraint if exists auth_otp_challenges_identity_check;

alter table public.auth_otp_challenges
  add constraint auth_otp_challenges_identity_check
  check (
    (channel = 'whatsapp' and phone_e164 is not null and length(trim(phone_e164)) > 0)
    or (channel = 'email' and email is not null and length(trim(email)) > 0)
  );

create index if not exists auth_otp_challenges_email_created_idx
  on public.auth_otp_challenges (email, created_at desc);

comment on column public.auth_otp_challenges.email is
  'Normalized email for channel=email OTP challenges (Nest platform mailer).';
