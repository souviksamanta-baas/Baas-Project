# API Domain Boundaries

This document tracks the Phase 1 API domain boundary setup for `KAN-46`.

## Goal

Phase 0 kept the NestJS API thin so webhook and deployment foundations could be
verified quickly. Phase 1 introduces stable domain boundaries before Phase 2 MVP
features expand the API surface.

## Target Module Structure

| Module | Responsibility |
| --- | --- |
| `organizations/` | Organization lookup, owner/staff membership use cases, settings, and tenant-level operations. |
| `customers/` | Customer/contact identity, deduplication, and CRM profile use cases. |
| `conversations/` | Conversation threads, message persistence, inbox state, and channel event normalization. |
| `tasks/` | Follow-up tasks, reminders, and scheduled workflow state. |
| `inventory/` | Product catalog, stock levels, reorder thresholds, and stock movements. |
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
`WhatsAppModule` exposes:

- `WhatsAppConnectionService` for server-side reads of WhatsApp connection
  status and non-secret channel metadata.
- `WhatsAppConversationMessageRepository` for tenant-scoped inbound/outbound
  contact, conversation, and message records.
- `WhatsAppOutboundMessageService` for server-side WhatsApp Cloud API sends and
  send-result persistence.

`InventoryService` uses the service-role Supabase client for trusted server-side
lookups and always requires an `organizationId`. It returns product price, stock,
reorder threshold, and computed low-stock status without exposing cross-tenant
data.

Existing Phase 0 behavior is unchanged.

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
