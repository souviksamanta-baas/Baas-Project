# Supabase custom SMTP (Nexolia)

Supabase’s **built-in email** allows only **2 auth emails per hour** per project. During login QA you will hit `email rate limit exceeded` / `over_email_send_rate_limit` until you configure custom SMTP.

## Quick fix: Resend + Supabase

1. Create a [Resend](https://resend.com) account and verify a sending domain (or use Resend’s onboarding domain for early tests).
2. Create an API key in Resend.
3. Open [Authentication → SMTP](https://supabase.com/dashboard/project/efcyejbvcskbnipwdfge/auth/smtp) for project `efcyejbvcskbnipwdfge`.
4. Enable custom SMTP and set:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key |
| Sender email | Verified address, e.g. `noreply@yourdomain.com`. For early tests use Resend’s onboarding sender `beth.t@example.com`. |
| Sender name | `Nexolia` |

5. Save.
6. Open [Authentication → Rate Limits](https://supabase.com/dashboard/project/efcyejbvcskbnipwdfge/auth/rate-limits) and raise **Email sent** if needed (default 30/hour with custom SMTP).
7. Confirm the Spanish Nexolia template under [Email Templates → Magic Link](https://supabase.com/dashboard/project/efcyejbvcskbnipwdfge/auth/templates).

Request a new login code — it should send immediately through Resend.

## Other providers

Any SMTP provider works (SendGrid, AWS SES, Postmark, Brevo). See [Supabase SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp).

## Built-in SMTP restrictions (why QA breaks)

- **2 emails/hour** project-wide — not configurable without custom SMTP
- **60 seconds** cooldown per email address between OTP requests
- Intended for template setup only, not production or repeated testing
