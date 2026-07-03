# Auth and Organization Onboarding

This document tracks auth and onboarding for Nexolia owners and staff (**KAN-272**).

## Tri-channel login

Owners and staff choose how to receive a one-time code at login:

| Channel | Delivery | Cost profile |
| --- | --- | --- |
| **Email** (recommended) | Supabase Auth email OTP | ~ARS 0 |
| **WhatsApp** | Meta AUTHENTICATION template from **Nexolia platform WABA** via NestJS | ~ARS 29 / OTP |
| **SMS** (optional) | Supabase phone OTP → **Twilio SMS only** (hosted dashboard) | ~ARS 114+ / OTP |

**Provider rule:** Twilio is used **only** for the SMS login channel. Email stays on Supabase Auth. WhatsApp login uses Meta Cloud API (platform WABA) via NestJS — never Twilio.

**Important:** The phone used for login does **not** need to be the merchant business WhatsApp number. Customer messaging uses each merchant's own WABA (`whatsapp_config`) after login.

## Email OTP

```typescript
await supabase.auth.signInWithOtp({ email: normalizedEmail });
await supabase.auth.verifyOtp({ email: normalizedEmail, token: otpCode, type: 'email' });
```

Hosted Supabase sends an **8-digit** code. The mobile app accepts 8 digits for email OTP.

### Spanish Nexolia email template (hosted dashboard)

Repo source of truth: `supabase/templates/magic_link.html` and `supabase/config.toml` (`[auth.email.template.magic_link]`).

**Apply on hosted Supabase** (project `efcyejbvcskbnipwdfge`):

1. [Supabase Dashboard](https://supabase.com/dashboard/project/efcyejbvcskbnipwdfge/auth/templates) → **Authentication** → **Email Templates** → **Magic Link**
2. **Subject:** `Tu código para ingresar a Nexolia`
3. **Body** (must include `{{ .Token }}` for OTP, not only a link):

```html
<h2>Tu código para ingresar a Nexolia</h2>

<p>Tu código de acceso es:</p>

<p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">{{ .Token }}</p>

<p>Ingresá este código en la app para continuar.</p>

<p style="color: #56627b; font-size: 14px;">Si no pediste este código, podés ignorar este correo.</p>
```

4. Save. Request a new login code to verify the Spanish Nexolia copy.

### Email rate limits (testing)

Supabase throttles OTP emails on the hosted project:

| Limit | Default (built-in email) |
| --- | --- |
| Emails per hour (project-wide) | **2** — only raised with [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) |
| Cooldown per email address | **60 seconds** between requests |

If login shows a rate-limit error during QA, wait 60s for the per-user cooldown or up to an hour for the project email cap. Reuse the last code if it has not expired. Adjust OTP cooldowns in [Authentication → Rate Limits](https://supabase.com/dashboard/project/efcyejbvcskbnipwdfge/auth/rate-limits).

Replace any legacy **BaaS** subject/body in the dashboard — hosted templates are **not** deployed from git.

## WhatsApp OTP (platform WABA)

```typescript
await fetch(`${API}/auth/otp/whatsapp/request`, {
  method: 'POST',
  body: JSON.stringify({ phone: '+5491112345678' }),
});

const { tokenHash } = await fetch(`${API}/auth/otp/whatsapp/verify`, {
  method: 'POST',
  body: JSON.stringify({ phone: '+5491112345678', code: otpCode }),
}).then((r) => r.json());

await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
```

Supabase native `channel: 'whatsapp'` requires Twilio — Nexolia uses direct Meta Cloud API instead.

## SMS OTP (optional — Twilio only)

SMS is the **only** channel that uses Twilio. Configure Twilio under Supabase → Authentication → Providers → Phone. The mobile app never calls Twilio directly; Supabase sends the SMS.

```typescript
await supabase.auth.signInWithOtp({ phone: e164PhoneNumber });
await supabase.auth.verifyOtp({ phone: e164PhoneNumber, token: otpCode, type: 'sms' });
```

Hosted template (Spanish):

```text
El código para ingresar a nexolia es {{ .Code }}
```

Do **not** enable Supabase WhatsApp OTP via Twilio — Nexolia WhatsApp login uses Meta direct (see above).

## Staff QR invite (KAN-273 / KAN-307)

1. Owner opens **Invitar miembro** (profile → staff invite).
2. Enters **nombre** (required), **teléfono**, **rol**, and one or more **sucursales** (`+ Agregar sucursal`).
3. API `POST /organizations/invites` accepts `businessCenterIds[]` (stored on
   `organization_invites.invited_business_center_ids`).
4. App shows QR encoding `baas-owner://invite-accept?token=…`
5. Staff verifies **the same phone** via email/WhatsApp/SMS login OTP.
6. API accepts invite → `organization_members` + `business_center_members` per selected branch.

Contact picker (`Elegir de contactos`) is removed until a future release.

See [contacts-permissions.md](./contacts-permissions.md).

## Onboarding RPCs

After any channel login:

1. App calls `get_owner_dashboard`
2. If `shouldOnboard`, owner creates business via `create_organization_with_owner`
3. Owner may connect merchant WABA later (independent of login phone)

## Architecture notes

| WABA | Purpose |
| --- | --- |
| Nexolia platform WABA | Login / staff verification OTP only |
| Merchant WABA | Customer inbox and outbound messaging |

Supersedes Twilio-only direction from KAN-129. Replaces KAN-271 (Twilio Verify) with KAN-272.

## Verification

```text
supabase/tests/onboarding_flow.sql
```
