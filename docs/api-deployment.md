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
| `apps/api/src/domains/*` | Phase 1 domain module boundaries for Phase 2 MVP growth. |
| `apps/api/src/health.controller.ts` | `GET /health` endpoint for local and deployment checks. |
| `apps/api/src/supabase/supabase.service.ts` | Server-only Supabase service-role client wrapper. |
| `apps/api/src/webhooks/whatsapp/*` | Phase 0 WhatsApp webhook verification and inbound parsing. |
| `apps/api/package.json` | API workspace dependencies and scripts. |
| `railway.json` | Railway service command configuration. |
| `railpack.json` | Railpack install/build plan scoped to the API workspace. |

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

## API Domain Boundaries

Phase 1 introduces `DomainModule` and domain modules for:

- `organizations`
- `customers`
- `conversations`
- `tasks`
- `inventory`
- `ai`

Controllers should stay focused on transport concerns and call domain services.
Persistence should be kept behind domain services or repository-style helpers
that use `SupabaseService`; controllers should not scatter Supabase queries.

Detailed conventions are tracked in `docs/api-domain-boundaries.md`.

## Railway Deployment

The initial deployment target is Railway, configured in `railway.json`.

Runtime selection:

- Root `package.json` declares `engines.node = 22.x`.
- `.node-version` also declares `22` for Railway/Railpack-style runtime detection.
- CI already uses Node 22, so Railway and CI run the same Node major version.

Monorepo targeting:

- This repo is an npm workspace monorepo with `apps/api` and `apps/mobile`.
- Railway should deploy only `@baas/api`.
- `railpack.json` overrides the Railpack install step to run
  `npm run railway:install`, which installs only the API workspace with
  `npm ci --workspace @baas/api --include-workspace-root=false --include=dev`.
- `railway.json` uses API-only build/start scripts and does not invoke the mobile
  workspace.

Build command:

```bash
npm run railway:build
```

Start command:

```bash
npm run railway:start
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

1. Railpack runs `npm run railway:install`, installing only `@baas/api`.
2. Railway runs `npm run railway:build`.
3. Railway starts the API with `npm run railway:start`.
4. Railway health checks `GET /health`.
5. Verify the public endpoint manually:

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
