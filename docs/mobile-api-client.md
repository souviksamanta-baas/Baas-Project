# Mobile API Client Layer

Tracks the incremental migration from `apps/mobile/src/services/` to `apps/mobile/src/api/`.

**Jira epic:** [KAN-278](https://souviksamanta.atlassian.net/browse/KAN-278)

## Goals

- One place for network transport (NestJS `fetch` + shared auth headers + Spanish errors).
- Clear domain modules aligned with product areas (inbox, tasks, inventory, …).
- Screens and Expo routes stay presentation-only; hooks own UI state.
- No big-bang rewrite — migrate module-by-module after higher-priority work (e.g. WhatsApp inbound E2E).

## Two backends (unchanged)

| Transport | Used for | Client module |
| --- | --- | --- |
| **Supabase** (RLS + Realtime) | Inbox, tasks, catalog, settings, dashboard RPC | `conversations`, `tasks`, `inventory`, `customers`, `dashboard`, `auth` (OTP) |
| **NestJS API** | WhatsApp connect, staff invites, AI drafts, Copi (copilot) | `whatsapp`, `staffInvites`, `ai` |

`api/client.ts` handles **NestJS only**. Supabase stays on `lib/supabase.ts`; domain modules wrap `supabase.from` / `supabase.rpc` / channels.

## Target layout

```text
apps/mobile/src/api/
  client.ts           # apiFetch, getAccessToken, formatApiFetchError
  auth.ts             # signInWithOtp, verifyOtp, signOut (from services/auth + authApi)
  dashboard.ts        # get_owner_dashboard, create_organization_with_owner
  conversations.ts    # inbox list, thread messages, Realtime subscriptions
  tasks.ts
  inventory.ts        # products / stock reads
  customers.ts          # contacts / CRM reads
  whatsapp.ts           # POST /whatsapp/connection/register
  staffInvites.ts
  ai.ts                 # Copi + AI draft actions (NestJS)
  index.ts              # optional barrel — prefer direct imports per module
```

## Layer rules

| Layer | May import | Must not |
| --- | --- | --- |
| `app/`, `screens/` | hooks, design-system, types | `fetch`, `supabase`, `api/*` directly |
| `hooks/` | `api/*`, types, utils | `fetch`, raw `supabase` (except rare bootstrap) |
| `api/*` | `client.ts`, `lib/supabase`, types | React, screens, hooks |

## Rollout plan

Work in order. Each layer is a separate Jira story under KAN-278.

| Layer | Jira | Summary | Done when | Status |
| --- | --- | --- | --- | --- |
| **0** | [KAN-279](https://souviksamanta.atlassian.net/browse/KAN-279) | Architecture doc + conventions | This doc merged; `mobile-app.md` links here | Done — doc in `bded48f` |
| **1** | [KAN-280](https://souviksamanta.atlassian.net/browse/KAN-280) | `api/client.ts` foundation | `getAccessToken`, `apiFetch`, `apiFetchJson`; unit tests or typecheck clean | Done — `src/api/client.ts` + `services/apiClient.ts` shim |
| **2** | [KAN-281](https://souviksamanta.atlassian.net/browse/KAN-281) | NestJS domains on client | `whatsapp`, `staffInvites`, `ai` use `api/client`; no raw `fetch` in those files | Done — `api/whatsapp.ts`, `staffInvites.ts`, `ai.ts` |
| **3** | [KAN-282](https://souviksamanta.atlassian.net/browse/KAN-282) | Conversations module | `messages.ts` → `api/conversations.ts`; hooks updated | Done — hooks + `[conversationId]` route |
| **4** | [KAN-283](https://souviksamanta.atlassian.net/browse/KAN-283) | Auth module | Merge `auth.ts` + `authApi.ts`; hooks/screens use `api/auth` | Done — `api/auth.ts`; screens no longer call `supabase.auth` |
| **5** | [KAN-284](https://souviksamanta.atlassian.net/browse/KAN-284) | Supabase domains | `dashboard`, `tasks`, `inventory`, `customers`, `settings` under `api/` | Done — `api/dashboard.ts`, `tasks.ts`, `inventory.ts`, `customers.ts`, `settings.ts` |
| **6** | [KAN-285](https://souviksamanta.atlassian.net/browse/KAN-285) | Boundary enforcement | No `supabase`/`fetch` in `app/` or `screens/`; `services/` re-exports deprecated | Done — typecheck clean; `services/*` shims retained |

## Current → target mapping

| Current `services/` | Target `api/` |
| --- | --- |
| `apiClient.ts` | `client.ts` |
| `auth.ts`, `authApi.ts` | `auth.ts` |
| `authChannel.ts`, `authOtp.ts`, `authErrors.ts` | stay in `services/` or `lib/` (UI/channel config, not I/O) |
| `messages.ts` | `conversations.ts` |
| `tasks.ts` | `tasks.ts` |
| `products.ts` | `inventory.ts` |
| `contacts.ts` | `customers.ts` |
| `features/onboarding.ts` | `dashboard.ts` |
| `settings.ts` | `dashboard.ts` or `settings.ts` |
| `whatsapp.ts` | `whatsapp.ts` |
| `staffInvites.ts` | `staffInvites.ts` |
| `copilot.ts`, `aiDrafts.ts` | `ai.ts` |

## `api/ai.ts` (NestJS)

| Function | Endpoint | Notes |
| --- | --- | --- |
| `askOwnerCopilot` | `POST /ai/copilot/query` | Basic+; returns `sessionId`, `tools`, optional `proposedAction` |
| `getCopiSessionMessages` | `GET /ai/copilot/sessions/:id/messages` | Reload chat history |
| `confirmCopiAction` | `POST /ai/copilot/actions/:id/confirm` | Pro; executes pending task action |
| `transcribeCopiVoice` | `POST /ai/copilot/voice` | Pro; needs `OPENAI_API_KEY` on API |
| `analyzeCopiVision` | `POST /ai/copilot/vision` | Pro; needs `OPENAI_API_KEY` on API |
| `runCopiReport` | `POST /ai/copilot/reports/run` | Pro |
| `approveAiDraft` / `rejectAiDraft` | `POST /ai/drafts/:id/approve\|reject` | Customer reply drafts |
| `getPendingAiDrafts` | Supabase `ai_drafts` | RLS read + Realtime subscription |

Feature visibility comes from dashboard `features` (`useFeatureVisibility`). See
`docs/copi-architecture.md`.

## `api/client.ts` sketch

```typescript
// NestJS transport only
export async function getAccessToken(): Promise<string>;
export function formatApiFetchError(error: unknown): Error;
export async function apiFetch(input: string, init?: RequestInit): Promise<Response>;
export async function apiFetchJson<T>(path: string, init?: RequestInit): Promise<T>;
```

- Reads `EXPO_PUBLIC_API_BASE_URL`.
- Attaches `Authorization: Bearer <supabase session>` when required.
- Maps `Failed to fetch` to Spanish CORS/network hints (Expo Web).

## Migration pattern (per module)

1. Copy or move implementation to `api/<domain>.ts`.
2. Update hooks to import from `api/<domain>`.
3. Leave `services/<old>.ts` as `export * from '../api/<domain>'` for one PR if needed.
4. Delete shim in a follow-up PR once call sites are migrated.

## Review checklist (Layer 6)

- [x] `rg "from '.*supabase'" apps/mobile/app apps/mobile/src/screens` → only `hasSupabaseConfig` bootstrap in `app/` layouts
- [x] `rg "fetch\(" apps/mobile/src/screens apps/mobile/app` → empty
- [x] All NestJS calls go through `api/client.ts`
- [x] `npm run typecheck` in `apps/mobile` passes
- [ ] WhatsApp connect + staff invite smoke-tested on Expo Web (CORS)

## Related docs

- [mobile-app.md](./mobile-app.md) — app structure and env vars
- [auth-onboarding.md](./auth-onboarding.md) — auth flows
- [api-domain-boundaries.md](./api-domain-boundaries.md) — NestJS server domains
