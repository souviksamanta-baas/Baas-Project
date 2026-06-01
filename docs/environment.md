# Environment Variables

This guide documents Supabase environment variables for local development, CI,
and deployed BaaS environments.

Do not commit real secrets. Use `.env.example` as a template only.

## Environments

| Name | Purpose | Storage |
| --- | --- | --- |
| `local` | Developer machine and Supabase CLI local stack | `.env.local` files ignored by git |
| `development` | Hosted Supabase project for Phase 0 validation | Deployment platform secrets |
| `staging` | Pre-production validation before production data | Separate Supabase project or branch |
| `production` | Live customer data | Separate Supabase project and locked-down secret store |

## Client-Safe Variables

These values may be used by Expo/mobile client code. They should still be loaded
from environment configuration instead of hardcoded in source files.

| Variable | Purpose | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase API URL for the mobile app | Current development URL: `https://efcyejbvcskbnipwdfge.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key for client requests | Prefer this for new client work |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Legacy anon key for client requests | Use only if a library or integration requires the legacy JWT key |
| `EXPO_PUBLIC_AUTH_OTP_CHANNEL` | OTP channel used by the mobile app | Phase 0 default: `sms` |

## Server-Only Variables

These values must never be bundled into mobile/client code.

| Variable | Purpose | Allowed locations |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase API URL for server processes | API server, jobs, CI |
| `SUPABASE_PROJECT_REF` | Project reference for Supabase CLI workflows | Local dev, CI |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS for trusted backend operations | API server, backend jobs, CI secret store |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI automation token | Local dev, CI secret store |
| `SUPABASE_DB_PASSWORD` | Database password for migration workflows when needed | Local dev, CI secret store |
| `SUPABASE_AUTH_SMS_PROVIDER` | Name of the hosted SMS provider configured for phone OTP | Supabase dashboard or deployment notes only |
| `SUPABASE_AUTH_SMS_PROVIDER_SECRET` | Provider token/password/API key for phone OTP | Supabase dashboard secret storage only |

## Service-Role Handling

The service-role key bypasses Row Level Security. Treat it as a privileged
backend credential.

Rules:

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to Expo, React Native, browser code,
  or any public runtime.
- Never paste service-role keys into Jira, Confluence, chat, screenshots, logs,
  or committed files.
- Load service-role keys only from ignored local env files, deployment secrets,
  or CI secret stores.
- Keep service-role operations inside the NestJS API or trusted backend jobs.
- Rotate the key immediately if it is committed, logged, pasted into a shared
  tool, or otherwise exposed.

## Phone OTP Provider Handling

Phone OTP is the primary owner login method for Phase 0. The local
`supabase/config.toml` enables SMS signup and sets the message template, but
hosted OTP delivery still requires an SMS provider such as Twilio or another
Supabase-supported provider.

Rules:

- Store SMS provider credentials only in Supabase dashboard configuration or a
  deployment secret store.
- Do not commit provider account IDs, auth tokens, sender numbers, or message
  service IDs.
- Do not log OTP codes, full phone numbers, or SMS provider responses with
  credentials.
- Use E.164 phone numbers in client and test data.

## Local Files

Use `.env.local` for developer machines. The repository `.gitignore` ignores
`.env` and `.env.*` while allowing `.env.example` to be committed.

```bash
cp .env.example .env.local
```

Fill placeholders locally. Do not commit `.env.local`.

## CI And Deployment

CI should read secrets from the CI provider, not from committed files.

Recommended CI variables:

- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD` when direct database operations are required
- `SUPABASE_SERVICE_ROLE_KEY` only for trusted server-side integration tests

Deployment platforms should define:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` for the NestJS API only
- Mobile public variables through Expo or app build environment configuration

## Verification

For KAN-14, the acceptance criteria are satisfied when:

- Public client variables are documented separately from server-only secrets.
- `.env.example` exists with placeholders only.
- Service-role handling is explicitly documented as server-only.
