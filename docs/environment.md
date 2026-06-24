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
| `EXPO_PUBLIC_AUTH_OTP_CHANNEL` | OTP channel used by the mobile app | `sms` for Twilio phone OTP (production); set `email` for simulator-only email OTP. |
| `EXPO_PUBLIC_API_BASE_URL` | Deployed NestJS API base URL for authenticated mobile actions | Current production URL: `https://baas-project-production.up.railway.app` |

The Expo app in `apps/mobile` must only use `EXPO_PUBLIC_*` variables. Server-only
values below must never be referenced from mobile source files.

## Server-Only Variables

These values must never be bundled into mobile/client code.

| Variable | Purpose | Allowed locations |
| --- | --- | --- |
| `API_PORT` | Local/API server port for the NestJS API | API server, local dev |
| `PORT` | Platform-provided API server port | Deployment runtime |
| `BAAS_CORS_ALLOWED_ORIGINS` | Comma-separated browser origin allowlist for API CORS | API server, deployment secret/config store |
| `BAAS_RATE_LIMIT_MAX` | Global API request limit per TTL window | API server, deployment config |
| `BAAS_RATE_LIMIT_TTL_MS` | Global API rate-limit window in milliseconds | API server, deployment config |
| `BAAS_WEBHOOK_RATE_LIMIT_MAX` | WhatsApp webhook request limit per TTL window | API server, deployment config |
| `BAAS_WEBHOOK_RATE_LIMIT_TTL_MS` | WhatsApp webhook rate-limit window in milliseconds | API server, deployment config |
| `SUPABASE_URL` | Supabase API URL for server processes | API server, jobs, CI |
| `SUPABASE_PROJECT_REF` | Project reference for Supabase CLI workflows | Local dev, CI |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS for trusted backend operations | API server, backend jobs, CI secret store |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI automation token | Local dev, CI secret store |
| `SUPABASE_DB_PASSWORD` | Database password for migration workflows when needed | Local dev, CI secret store |
| `WHATSAPP_VERIFY_TOKEN` | Meta webhook setup token checked by `GET /webhooks/whatsapp` | API server, deployment secret store |
| `WHATSAPP_APP_SECRET` | Meta app secret used to validate `x-hub-signature-256` | API server, deployment secret store |
| `WHATSAPP_WEBHOOK_PATH` | Documented webhook path for deployment routing | API server, local dev |
| `BAAS_TASKS_JOB_SECRET` | Shared secret required by `POST /tasks/run-maintenance` | API server, scheduler secret store |
| `SUPABASE_AUTH_SMS_PROVIDER` | Name of the hosted SMS provider configured for phone OTP | Supabase dashboard or deployment notes only |
| `SUPABASE_AUTH_SMS_PROVIDER_SECRET` | Provider token/password/API key for phone OTP | Supabase dashboard secret storage only |

The API reads `API_PORT`, then `PORT`, then falls back to `3000`. Railway usually
provides `PORT` automatically.

## API Hardening Configuration

The NestJS API validates production environment variables during startup. In
`NODE_ENV=production`, missing Supabase service-role, WhatsApp webhook, or task
maintenance secrets fail boot instead of surfacing later during requests.

CORS is explicit and environment-driven:

- `BAAS_CORS_ALLOWED_ORIGINS` is a comma-separated list of browser origins, for
  example `https://owner.example.com,https://admin.example.com`.
- Do not use `*`. Wildcard origins are rejected during startup validation.
- Requests without an `Origin` header remain allowed for mobile apps,
  server-to-server jobs, health checks, and Meta webhook calls.

Rate limiting is enabled in the API:

- `BAAS_RATE_LIMIT_MAX` and `BAAS_RATE_LIMIT_TTL_MS` control the global API
  throttle.
- `BAAS_WEBHOOK_RATE_LIMIT_MAX` and `BAAS_WEBHOOK_RATE_LIMIT_TTL_MS` control the
  stricter `/webhooks/whatsapp` throttle.
- `GET /health` is excluded from throttling so Railway health checks are not
  rate limited.

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

Phone OTP is the intended production owner login method. The current simulator
verification flow uses email OTP so mobile Realtime behavior can be tested before
SMS provider setup. The local `supabase/config.toml` enables SMS signup and sets
the message template, but hosted OTP delivery still requires an SMS provider such
as Twilio or another Supabase-supported provider.

Rules:

- Store SMS provider credentials only in Supabase dashboard configuration or a
  deployment secret store.
- Do not commit provider account IDs, auth tokens, sender numbers, or message
  service IDs.
- Do not log OTP codes, full phone numbers, or SMS provider responses with
  credentials.
- Use E.164 phone numbers in client and test data. The mobile app accepts `011…`,
  `+5411…`, `+54911…`, and `5411…`, then normalizes to `+549…` before calling Supabase.

## WhatsApp Webhook Secret Handling

The Phase 0 webhook API reads Meta verification and signature secrets only from
server environment variables.

Rules:

- `WHATSAPP_VERIFY_TOKEN` must be generated per environment and configured in
  the Meta webhook setup screen.
- `WHATSAPP_APP_SECRET` must be available only to the NestJS API process.
- Never expose WhatsApp secrets to Expo/mobile builds or client logs.
- Validate `x-hub-signature-256` whenever `WHATSAPP_APP_SECRET` is configured.
- In production, the API rejects webhook requests if `WHATSAPP_APP_SECRET` is
  missing.

## Task Maintenance Job Secret

KAN-69 adds `POST /tasks/run-maintenance` for scheduled follow-up and low-stock
processing. The endpoint requires `BAAS_TASKS_JOB_SECRET` and the caller must
send it in the `x-baas-job-secret` header. If the secret is not configured, the
endpoint returns service unavailable instead of running automation.

Do not expose this secret to Expo/mobile builds. It belongs only in the API
runtime and whichever scheduler invokes the backend job.

## Local Files

Use `.env.local` for developer machines. The repository `.gitignore` ignores
`.env` and `.env.*` while allowing `.env.example` to be committed.

```bash
cp .env.example .env.local
```

Fill placeholders locally. Do not commit `.env.local`.

## CI And Deployment

CI should read secrets from the CI provider, not from committed files.

GitHub Actions uses these repository variables and secrets for migration dry-runs
and manual deploys:

| Name | Type | Purpose |
| --- | --- | --- |
| `SUPABASE_PROJECT_REF` | Repository variable | Hosted Supabase project ref used by `supabase link`. |
| `SUPABASE_ACCESS_TOKEN` | Repository secret | Supabase CLI access token. |
| `SUPABASE_DB_PASSWORD` | Repository secret | Hosted database password used by Supabase CLI migration commands. |

`SUPABASE_SERVICE_ROLE_KEY` should only be added to CI for trusted server-side
integration tests that explicitly need privileged backend access.

Deployment platforms should define:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` for the NestJS API only
- `BAAS_TASKS_JOB_SECRET` for the task maintenance endpoint
- `EXPO_PUBLIC_API_BASE_URL` for mobile builds that need server-side owner
  actions such as AI draft approve/send and Owner Copilot questions
- Mobile public variables through Expo or app build environment configuration

## Verification

For KAN-14, the acceptance criteria are satisfied when:

- Public client variables are documented separately from server-only secrets.
- `.env.example` exists with placeholders only.
- Service-role handling is explicitly documented as server-only.
