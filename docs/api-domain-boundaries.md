# API Domain Boundaries

This document tracks the Phase 1 API domain boundary setup for `KAN-46`.

## Goal

Phase 0 kept the NestJS API thin so webhook and deployment foundations could be
verified quickly. Phase 1 introduces stable domain boundaries before Phase 2 MVP
features expand the API surface.

## Target Module Structure

| Module | Responsibility |
| --- | --- |
| `organizations/` | Organization lookup, owner/staff membership use cases, verticals, business centers, settings, and tenant-level operations. |
| `customers/` | Customer/contact identity, deduplication, and CRM profile use cases. |
| `conversations/` | Conversation threads, message persistence, inbox state, and channel event normalization. |
| `tasks/` | Follow-up tasks, reminders, and scheduled workflow state. |
| `inventory/` | Product catalog lookup plus center-scoped measured stock, reorder thresholds, lots, movements, and transformations. |
| `ai/` | AI orchestration, tool calls, prompt policy, and draft/auto-send decisions. |
| `whatsapp/` | WhatsApp Business connection status, channel configuration reads, message persistence, outbound sends, and server-only channel metadata. |

`apps/api/src/domains/domain.module.ts` imports and exports these domain modules
so new Phase 2 work has an explicit home.

## Current Boundary

The first concrete boundaries are `OrganizationsModule` and `WhatsAppModule`:

```text
apps/api/src/domains/organizations/
apps/api/src/domains/whatsapp/
```

`OrganizationsModule` exposes `OrganizationsService`, which wraps organization
reads behind a domain service instead of letting future controllers call
Supabase directly. The `customers/` and `conversations/` domains now have
database-backed ownership through `contacts`, `conversations`, and
`conversation_messages`, even while their NestJS modules remain thin.
`InventoryModule` exposes `InventoryService` for product and stock lookup
needed by app, AI, copilot, and low-stock workflows.
`AiModule` exposes:

- `SalesAiService` for deterministic catalog-aware reply/quote draft generation,
  AI draft persistence, auto-send policy enforcement, and owner approval send
  orchestration.
- `OwnerCopilotService` for authenticated owner questions over the MVP tool set:
  messages today, low-stock products, and pending follow-up tasks.
- `AiController` for authenticated owner actions on AI drafts:
  `POST /ai/drafts/:draftId/approve`, `POST /ai/drafts/:draftId/reject`, and
  `POST /ai/copilot/query`.

`TasksModule` exposes:

- `TasksService` for follow-up task automation, low-stock alert generation, and
  Expo push notification dispatch through registered owner devices.
- `TasksController` for the secured `POST /tasks/run-maintenance` trigger used
  by a scheduler or manual backend job runner.

`WhatsAppModule` exposes:

- `WhatsAppConnectionService` for server-side reads of WhatsApp connection
  status and non-secret channel metadata.
- `WhatsAppConversationMessageRepository` for tenant-scoped inbound/outbound
  contact, conversation, and message records.
- `WhatsAppOutboundMessageService` for server-side WhatsApp Cloud API sends and
  send-result persistence.

The webhook event repository resolves WhatsApp configs in a batch for each
payload and processes inbound events with bounded concurrency. Durable database
deduplication remains the source of truth for retries and duplicate deliveries.

`InventoryService` uses the service-role Supabase client for trusted server-side
lookups and always requires an `organizationId`. KAN-130 adds optional
`businessCenterId`; if omitted, the service resolves the default active business
center. It returns product price plus `inventory_items` stock, unit, reorder
threshold, and computed low-stock status without exposing cross-tenant data.

`TasksService` is intentionally orchestration-heavy because KAN-69 spans CRM,
conversations, inventory, and notifications. It keeps that cross-domain workflow
inside `tasks/` and now iterates active business centers so generated tasks,
alerts, and push lookups include both organization and center scope. KAN-143
adds bounded concurrency for center maintenance, bulk follow-up task insertion,
bulk contact cold-status updates, and one owner device-token lookup per center
for low-stock push notifications.

`SalesAiService` owns the KAN-70 cross-domain workflow. It reads catalog data
through `InventoryService`, persists `ai_drafts` and `ai_draft_events`, and uses
`WhatsAppOutboundMessageService` for any approved or auto-sent message so mobile
never receives WhatsApp access tokens. Auto-send remains disabled unless the
active `business_centers.ai_auto_send` is enabled and the generated draft is
catalog-backed and marked safe. When `business_centers.business_hours` is
enabled, auto-send is also limited to the configured center timezone, days, start
time, and end time.

`OwnerCopilotService` owns the KAN-71 query workflow. It validates the Supabase
bearer token against `organization_members`, then uses service-role reads scoped
to the requested organization and default business center, plus
`InventoryService` for low-stock lookup. It does not expose a general SQL or LLM
interface; the MVP endpoint returns deterministic answers for the supported
owner questions.

Existing Phase 0 behavior is unchanged.

## API Bootstrap and Hardening Boundary

KAN-143 adds production hardening at the API bootstrap/module boundary:

- `apps/api/src/app.module.ts` owns global environment validation through
  `ConfigModule`, global throttling through `ThrottlerModule`, and the global
  `ThrottlerGuard`.
- `apps/api/src/main.ts` owns transport-level hardening: Helmet security headers,
  Railway/proxy trust, explicit CORS allowlist handling, and raw-body JSON
  parsing for WhatsApp signature verification.
- `HealthController` is explicitly excluded from throttling so deployment health
  checks do not compete with application traffic.
- `WhatsAppWebhookController` applies a stricter configured throttle because it
  is a public internet-facing endpoint.

Environment validation belongs in `apps/api/src/config/`; domain services should
not duplicate production boot checks.

## Controller Rules

Controllers should stay thin:

- Validate transport-level inputs.
- Call domain services.
- Translate domain/service errors into HTTP responses.
- Avoid embedding Supabase query details.
- Avoid owning cross-domain orchestration logic.

## Service and Persistence Rules

Domain services own use-case behavior. Persistence access should sit behind:

- Domain services when the query is simple and clearly owned by one domain.
- Repository-style helpers when persistence logic is reused, complex, or needs
  database-specific conflict/error handling.

Server-side Supabase access must use `SupabaseService` and service-role
configuration only in the API process. Service-role keys must never be imported
or referenced by Expo/mobile code.

## Dependency Direction

Preferred dependency direction:

```text
Controller -> Domain Service -> Repository/Persistence -> SupabaseService
```

Cross-domain calls should be explicit and rare. If a feature needs multiple
domains, create an orchestration service in the domain that owns the user-facing
workflow.
