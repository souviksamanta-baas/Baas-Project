-- Allow Nest-tracked SMS OTP challenges for identity linking (Supabase/Twilio delivery).

alter table public.auth_otp_challenges
  drop constraint if exists auth_otp_challenges_channel_check;

alter table public.auth_otp_challenges
  add constraint auth_otp_challenges_channel_check
  check (channel in ('whatsapp', 'email', 'sms'));

alter table public.auth_otp_challenges
  drop constraint if exists auth_otp_challenges_identity_check;

alter table public.auth_otp_challenges
  add constraint auth_otp_challenges_identity_check
  check (
    (channel in ('whatsapp', 'sms') and phone_e164 is not null and length(trim(phone_e164)) > 0)
    or (channel = 'email' and email is not null and length(trim(email)) > 0)
  );
