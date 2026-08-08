# Platform email OTP (Resend)

Login email codes are sent by the **NestJS API** via Resend HTTP API — **not** Supabase Auth SMTP.

## Why not Supabase SMTP?

Supabase Auth SMTP (built-in or custom) was brittle for Nexolia:

- Built-in: **2 emails/hour** project-wide
- Custom Resend SMTP in **test mode**: only delivers to the Resend account owner until a domain is verified
- Auth templates and rate limits lived in the hosted dashboard, separate from the platform OTP path used for WhatsApp

Email login now mirrors WhatsApp: Nest owns the challenge (`auth_otp_challenges`, `channel=email`), sends the code, then mints a Supabase session via admin `generateLink` + mobile `verifyOtp({ token_hash })`.

## Required setup (production)

### 1. Verify `nexolia.com.ar` in Resend

1. Open [resend.com/domains](https://resend.com/domains)
2. Add `nexolia.com.ar`
3. Paste the DNS records Resend shows into Cloudflare (DNS for `nexolia.com.ar`)
4. Wait until Resend marks the domain **Verified**

Until the domain is verified, Resend stays in testing mode and will only send to the Resend account owner mailbox.

### 2. Railway (API) env

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | Resend API key (server secret) |
| `NEXOLIA_AUTH_EMAIL_FROM` | `Nexolia <noreply@nexolia.com.ar>` (optional; this is the default) |
| `BAAS_OTP_PEPPER` | Shared HMAC pepper for OTP hashes (same as WhatsApp) |

Redeploy the API after setting secrets.

### 3. Database

Migration `supabase/migrations/20260807210000_auth_otp_email_channel.sql` allows `channel=email` and a nullable `phone_e164` with an `email` column. Apply on hosted Supabase if not already applied.

## API

```http
POST /auth/otp/email/request
{ "email": "dueño@negocio.com" }

POST /auth/otp/email/verify
{ "email": "dueño@negocio.com", "code": "123456" }
→ { "tokenHash": "…" }
```

Mobile exchanges `tokenHash` with:

```typescript
await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
```

Codes are **6 digits**, TTL 10 minutes, ~45s resend cooldown, max 5 verify attempts.

## Legacy: Supabase Auth SMTP

Supabase SMTP is **no longer required for login OTP**. You can leave it configured for other Auth emails (password recovery, etc.) if you use those features, but owner/staff login email codes do not go through it.

If Auth logs still show Resend testing errors on `/auth/v1/otp`, the mobile app is still calling Supabase `signInWithOtp` — update to the Nest routes above.
