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
| `META_APP_ID` / `META_APP_SECRET` | Required for Instagram OAuth | Platform Meta app credentials (aliases `INSTAGRAM_APP_*`). Ops sets these in Railway dashboard—never paste into chat. Merchants use OAuth only. |
| `INSTAGRAM_VERIFY_TOKEN` | Required before Instagram webhook setup | Verification for `GET /integrations/meta/instagram/webhook` (alias `/webhooks/instagram`). |
| `INSTAGRAM_OAUTH_REDIRECT_URI` | Optional | HTTPS OAuth callback registered in Meta. Default: `https://baas-project-production.up.railway.app/integrations/meta/instagram/oauth/callback`. |
| `BAAS_TOKEN_ENCRYPTION_KEY` | Required when encrypting Instagram tokens | AES-256-GCM key for `instagram_config`. |

Client onboarding (Spanish): Confluence [Onboarding de clientes](https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/27230209/Onboarding+de+clientes). Ops checklist: [Instagram Messaging](https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/26247169/Instagram+Messaging+Owner+inbox).

| `BAAS_TASKS_JOB_SECRET` | Required for task automation trigger | Shared secret expected in `x-baas-job-secret` for `POST /tasks/run-maintenance`. |
| `OPENAI_API_KEY` | Optional | Enables Copi LLM phrasing, voice STT, and vision. Falls back to deterministic templates when unset. |
| `OPENAI_MODEL` | Optional | Copi phrasing model. Default `gpt-4o-mini`. |
| `OPENAI_VISION_MODEL` | Optional | Copi vision model. Default `gpt-4o-mini`. |
| `BAAS_CORS_ALLOWED_ORIGINS` | Required for Expo Web | Comma-separated origin allowlist for browser clients. |

Do not put real secret values in source files, Jira, Confluence, or local docs.

## Copi (Owner AI) Endpoints

All Copi routes require `Authorization: Bearer <supabase-access-token>` and org
membership. Feature flags on `organizations.feature_flags` gate Basic vs Pro.

| Method | Path | Tier | Purpose |
| --- | --- | --- | --- |
| `POST` | `/ai/copilot/query` | Basic+ | Ask Copi a business question |
| `GET` | `/ai/copilot/sessions/:sessionId/messages` | Basic+ | Load session history |
| `POST` | `/ai/copilot/actions/:actionId/confirm` | Pro | Confirm a proposed write action (multi-task create, assignee resolve with creator fallback, or create presupuesto + task) |
| `POST` | `/ai/copilot/voice` | Pro | Transcribe voice note (OpenAI) |
| `POST` | `/ai/copilot/vision` | Pro | Analyze image (OpenAI) |
| `POST` | `/ai/copilot/reports/run` | Pro | Run a built-in or saved report |

Pilot orgs **Baas Admin** and **NEX Biz** have Pro flags enabled in production.
See `docs/copi-architecture.md` and Confluence → Nexolia → Copi.

## Task Maintenance Trigger

KAN-69 adds a secured backend trigger for follow-up and alert automation:

```bash
curl -X POST https://<railway-domain>/tasks/run-maintenance \
  -H "x-baas-job-secret: <secret>"
```

The trigger:

- Creates duplicate-safe follow-up tasks for idle open conversations based on
  each organization's `ai_follow_up_delay_hours`.
- Creates duplicate-safe low-stock notification rows from inventory data.
- Sends Expo push notifications to active tokens in `owner_device_tokens`.

If `BAAS_TASKS_JOB_SECRET` is missing or the header does not match, the endpoint
does not run the job.

### Task Portal REST (KAN-401)

Authenticated owner session (Bearer) can list/create/update tasks under `/tasks`
in addition to the job secret maintenance trigger:

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/tasks` | Org + center scoped list |
| `GET` | `/tasks/:taskId` | Single task |
| `POST` | `/tasks` | Create (title, description, dueAt, assignedToUserId required) |
| `PATCH` | `/tasks/:taskId` | Update fields |
| `POST` | `/tasks/:taskId/assign` | Reassign (assignee, owner, or co-owner) |
| `POST` | `/tasks/:taskId/start` | → `in_progress` |
| `POST` | `/tasks/:taskId/complete` | → `completed` |
| `POST` | `/tasks/:taskId/cancel` | → `cancelled` (Eliminar) |
| `POST` | `/tasks/:taskId/postpone` | → `postponed` + `postponedUntil` |
| `POST` | `/tasks/:taskId/snooze-reminder` | Silence reminder (`reminder_snoozed_until`) |
| `POST`/`DELETE` | `/tasks/:taskId/followers` | Follow / unfollow |
| `POST` | `/tasks/:taskId/appointments` | Create meeting linked via `appointments.task_id` |

Statuses: `pending` \| `in_progress` \| `completed` \| `cancelled` \| `postponed`.
Mobile client: `apps/mobile/src/api/tasks.ts`. See `docs/mobile-app.md` and
Confluence Task Portal / push catalog.

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

## Test Launch security

See [test-launch-security.md](./test-launch-security.md) (epic KAN-333).

- Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) in `main.ts`.
- OpenAPI UI at `/docs` is **disabled in production** unless `BAAS_ENABLE_OPENAPI_DOCS=true`.
- All Copi OpenAI/history routes require a valid Supabase bearer token and org membership.
