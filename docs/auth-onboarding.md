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

## Staff QR invite (KAN-273)

1. Owner creates invite with intended phone (contacts picker or manual entry)
2. App shows QR encoding `baas-owner://invite-accept?token=…`
3. Staff verifies **the same phone** via WhatsApp or SMS
4. API accepts invite → `organization_members` for the same `organization_id`

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
