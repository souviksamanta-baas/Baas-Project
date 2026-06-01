# NestJS API Scaffold and Deployment

This document tracks the Phase 0 NestJS API setup for `KAN-11`.

## Scope

The BaaS MVP uses a thin NestJS API for WhatsApp webhooks, AI orchestration,
service-role database access, and future job triggers.

## App Structure

| Path | Purpose |
| --- | --- |
| `apps/api/src/main.ts` | NestJS bootstrap and raw-body parsing for webhook signatures. |
| `apps/api/src/app.module.ts` | API module wiring controllers and providers. |
| `apps/api/src/health.controller.ts` | `GET /health` endpoint for local and deployment checks. |
| `apps/api/src/supabase/supabase.service.ts` | Server-only Supabase service-role client wrapper. |
| `apps/api/src/webhooks/whatsapp/*` | Phase 0 WhatsApp webhook verification and inbound parsing. |
| `apps/api/package.json` | API workspace dependencies and scripts. |
| `railway.json` | Railway deployment configuration. |

## Local Commands

Install dependencies:

```bash
npm install
```

Run the API locally:

```bash
npm run dev:api
```

Check health:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{"status":"ok"}
```

Run API tests and typecheck:

```bash
npm test
npm run typecheck
```

Build the API:

```bash
npm run build
```

Start the compiled API:

```bash
npm run start:api:prod
```

## Supabase Service-Role Wrapper

`SupabaseService` exposes a lazy `getServiceRoleClient()` method. It reads:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The client is created only when server code asks for it. This keeps `/health`
available in local development even when service-role secrets are not present,
while still failing fast if privileged database access is attempted without the
required server-only configuration.

The service-role key must never be used in Expo, React Native, browser code, or
public build environments.

## Railway Deployment

The initial deployment target is Railway, configured in `railway.json`.

Build command:

```bash
npm ci && npm run build
```

Start command:

```bash
npm run start:api:prod
```

Health check path:

```text
/health
```

## Required Railway Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `API_PORT` | Optional | Explicit API port override. |
| `PORT` | Platform-provided | Railway-provided runtime port. Local default is `3000` when neither port variable is set. |
| `SUPABASE_URL` | Required when privileged DB access is used | Supabase project API URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required when privileged DB access is used | Server-only service-role key. |
| `WHATSAPP_VERIFY_TOKEN` | Required before Meta webhook setup | Verification token for `GET /webhooks/whatsapp`. |
| `WHATSAPP_APP_SECRET` | Required in production webhook handling | Meta app secret for webhook signature validation. |
| `WHATSAPP_WEBHOOK_PATH` | Optional | Documented path, default `/webhooks/whatsapp`. |

Do not put real secret values in source files, Jira, Confluence, or local docs.

## Deployment Verification

After Railway is connected to the repository and variables are configured:

1. Railway runs `npm ci && npm run build`.
2. Railway starts the API with `npm run start:api:prod`.
3. Railway health checks `GET /health`.
4. Verify the public endpoint manually:

```bash
curl https://<railway-domain>/health
```

Expected response:

```json
{"status":"ok"}
```

## Verification Status

For KAN-11, completion is verified when:

- `apps/api` runs locally with TypeScript and NestJS.
- `/health` returns a successful local response.
- The Supabase service-role client wrapper is server-only and lazy.
- Railway deployment configuration exists.
- Required server-only environment variables are documented.

External deployment requires connecting the repository to Railway and setting
the listed environment variables in that Railway project.
