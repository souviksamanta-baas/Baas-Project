# Auth and Organization Onboarding

This document tracks auth and onboarding for Nexolia owners and staff (**KAN-272**).

## Intent-first entry

Unauthenticated users land on **Bienvenido** (`/(auth)/welcome`) before login:

1. **Unirme con invitación (QR)** → scan → phone OTP on invite-accept (same phone as invite)
2. **Crear un negocio nuevo** → email OTP → create-org form (skips post-auth choice)
3. **Ya tengo cuenta** → normal login OTP → home or onboarding if they still need an org

Do **not** open email/phone login as the first screen for new users.

## Tri-channel login

Owners and staff choose how to receive a one-time code at login:

| Channel | Delivery | Cost profile |
| --- | --- | --- |
| **Email** (recommended) | NestJS → Resend from `noreply@nexolia.com.ar` | ~ARS 0 |
| **WhatsApp** | Meta AUTHENTICATION template from **Nexolia platform WABA** via NestJS | ~ARS 29 / OTP |
| **SMS** (optional) | Supabase phone OTP → **Twilio SMS only** (hosted dashboard) | ~ARS 114+ / OTP |

**Provider rule:** Twilio is used **only** for the SMS login channel. Email and WhatsApp login both go through NestJS (Resend / Meta). Never use Supabase Auth SMTP or Twilio WhatsApp for login.

**Important:** The phone used for login does **not** need to be the merchant business WhatsApp number. Customer messaging uses each merchant's own WABA (`whatsapp_config`) after login.

## Email OTP

```typescript
await fetch(`${API}/auth/otp/email/request`, {
  method: 'POST',
  body: JSON.stringify({ email: normalizedEmail }),
});

const { tokenHash } = await fetch(`${API}/auth/otp/email/verify`, {
  method: 'POST',
  body: JSON.stringify({ email: normalizedEmail, code: otpCode }),
}).then((r) => r.json());

await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
```

Nest sends a **6-digit** code (same length as WhatsApp/SMS). Requires `RESEND_API_KEY` and a verified sending domain — see [supabase-smtp-setup.md](./supabase-smtp-setup.md) (platform mailer).

### Ops / rate limits

| Limit | Behavior |
| --- | --- |
| Resend domain | Must be verified to send to any recipient |
| Cooldown per email | ~45 seconds between Nest OTP sends |
| Code TTL | 10 minutes |
| Verify attempts | 5 per challenge |

Supabase Auth email rate limits **do not** apply to this path.

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

1. Owner opens **Invitar miembro** (Mi cuenta → staff invite).
2. Optionally picks a device contact (**+ Agregar desde contactos**) to fill
   nombre + teléfono, or types them manually.
3. Selects **rol** (empleado / administrador / co-dueño).
4. API `POST /organizations/invites` receives the active/default
   `businessCenterId` (sucursales multi-select UI is deferred; the invite still
   attaches the default center server-side).
5. App shows QR encoding `baas-owner://invite-accept?token=…`
6. Staff verifies **the same phone** via WhatsApp/SMS login OTP (not email).
7. API accepts invite → `organization_members` + `business_center_members` for
   the assigned center.

Contact picker uses the Expo Contacts class API (`Contact.getAllDetails`) and a
branded in-app list (`ContactPickerModal`). See
[contacts-permissions.md](./contacts-permissions.md).

### When is the phone verified?

| Path | Email OTP | Phone OTP |
| --- | --- | --- |
| Owner creates a new business after **email** login | At login | **Not required** for creating the org |
| Staff joins via invite QR | Optional / not used on accept | **At invite accept** — after scanning the QR, the app asks for the invited phone and sends a WhatsApp/SMS code; that verified E.164 must match the invite |

So: scanning the member QR does **not** verify the phone by itself. Phone verification happens on the **Aceptar invitación** screen that opens after a valid QR (or deep link), before `POST /organizations/invites/accept`.

### Post-login choice (no org yet)

If `get_owner_dashboard` says the user should onboard, the app shows a choice first:

1. **Unirme con invitación (QR)** → camera → invite-accept (phone OTP as above)
2. **Crear un negocio nuevo** → name + nav shortcut + **Crear negocio** (sticky footer)
3. **Cerrar sesión** / **‹ Volver** from the create form

## Onboarding RPCs

After any channel login:

1. App calls `get_owner_dashboard`
2. If `shouldOnboard`, show create-vs-join choice (above)
3. Owner creating a business calls `create_organization_with_owner`
4. Owner may connect merchant WABA later (independent of login phone)

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
