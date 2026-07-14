# Tenant Isolation and RLS

This document tracks the Phase 0 tenant isolation work for `KAN-6`.

## Scope

The Phase 0 tenant foundation defines:

- `organizations` as the tenant root.
- `organization_members` as the Supabase Auth user to organization membership table.
- `whatsapp_config` as a server-only table for WhatsApp Business metadata and encrypted tokens.
- `private.user_org_ids()` and `private.is_org_owner()` helper functions for RLS policies.

## Migrations

| Migration | Purpose |
| --- | --- |
| `20260601160000_create_tenant_foundation.sql` | Creates tenant tables, constraints, indexes, triggers, grants, and initial RLS policies. |
| `20260601170000_harden_tenant_rls_helpers.sql` | Moves policy helper functions to the private schema, removes public helper RPC exposure, and hardens trigger function privileges. |
| `20260604225000_add_whatsapp_connection_status.sql` | Adds safe WhatsApp connection status metadata and exposes it through `get_owner_dashboard` without granting direct client access to `whatsapp_config`. |
| `20260604231000_create_conversation_message_persistence.sql` | Adds tenant-scoped `conversations` and `conversation_messages` with authenticated read policies and server-owned writes. |
| `20260605193500_create_contacts_crm_foundation.sql` | Adds tenant-scoped `contacts`, links conversations to CRM contacts, updates dashboard metrics, and registers contact/conversation Realtime tables when available. |
| `20260605200000_create_product_catalog_inventory.sql` | Adds tenant-scoped `products`, owner-app CRUD policies, stock/reorder checks, dashboard product metrics, and product Realtime publication when available. |
| `20260605204500_create_owner_tasks_alerts.sql` | Adds tenant-scoped `owner_tasks`, `owner_notifications`, and `owner_device_tokens`; updates pending follow-up metrics; registers task/notification Realtime tables when available. |
| `20260605214500_create_sales_ai_drafts.sql` | Adds tenant-scoped `ai_drafts` and `ai_draft_events`, updates pending AI draft metrics, and registers AI drafts for Realtime when available. |
| `20260605215500_restrict_ai_draft_client_updates.sql` | Removes direct authenticated updates on `ai_drafts` so owner decisions go through API endpoints that can perform server-side WhatsApp sends. |
| `20260605223000_add_owner_settings_dashboard_fields.sql` | Extends `get_owner_dashboard` to include tenant AI/follow-up settings already stored on `organizations`. |
| `20260606011500_redesign_domain_model_centers_inventory.sql` | Adds `organization_verticals`, `business_centers`, `business_center_members`, center scope on operational tables, center-level settings, and measured inventory tables. |

## RLS Policy Model

All Phase 0 tenant tables have RLS enabled and forced:

- `organizations`
- `organization_members`
- `organization_verticals`
- `business_centers`
- `business_center_members`
- `whatsapp_config`
- `whatsapp_message_events`
- `contacts`
- `conversations`
- `conversation_messages`
- `products`
- `inventory_items`
- `inventory_lots`
- `inventory_movements`
- `inventory_transformations`
- `owner_tasks`
- `owner_notifications`
- `owner_device_tokens`
- `ai_drafts`
- `ai_draft_events`

Client users can read `organizations` and `organization_members` only when their `auth.uid()` belongs to the organization through `organization_members`.

Organization owners can update organization rows and manage membership rows for their own organization only.

KAN-130 moves owner operational settings to `business_centers`:
`ai_auto_send`, `ai_follow_up_delay_hours`, `business_hours`, and `timezone`.
The migration backfills one default `business_centers` row per organization from
the previous organization-level settings. Mobile updates now target the active
business center and remain owner-protected by RLS.

`whatsapp_config` intentionally has no client-readable policy and no `anon` or `authenticated` table privileges. It is service-role only because it stores WhatsApp identifiers and encrypted integration secrets.

`whatsapp_message_events` is also service-role only. It stores webhook delivery
dedupe and raw event processing state, so clients read customer-visible message
history through `conversation_messages` instead.

Phase 2 owner-facing WhatsApp status is exposed through `get_owner_dashboard`,
not direct table access. The RPC returns a safe `whatsappConnection` object with
status and display metadata, while encrypted tokens and webhook secrets remain
server-only.

Phase 2 conversation history is client-readable only for organization members.
The API service role owns writes for inbound webhook events and outbound
WhatsApp sends, preventing mobile clients from forging persisted message history.

Phase 2 contact records follow the same model: authenticated owners can select
contacts for their organizations, while the API service role owns writes from
trusted inbound webhook processing and future CRM workflows.

Phase 2 product records remain organization-scoped catalog data. KAN-130 moves
current stock state to center-scoped `inventory_items` with decimal measured
quantities, while `inventory_lots`, `inventory_movements`, and
`inventory_transformations` model bulk purchases and subdivisions. Negative
stock remains disallowed so owner inventory and AI lookup answers stay
conservative and accurate.

Phase 2 follow-up tasks and notifications are center-scoped under the
organization. The API service role creates follow-up tasks and low-stock
notification rows from trusted automation, while authenticated organization
members can read and update task or notification status for their own center.
`owner_tasks` also allows authenticated owners to insert manual tasks
(`owner_tasks_insert_owners` policy from `20260705200000_copi_foundation.sql`).
Mobile Task Portal uses select/update on tasks and notifications via RLS; NestJS
authenticated task CRUD is deferred (`docs/phase-3-scope.md`).

`owner_device_tokens` is scoped to both organization membership and the current
`auth.uid()`. Owners and staff can register or update only their own device token
rows, which lets the backend send Expo push notifications without exposing push
registration data across users or tenants.

Phase 2 Sales AI drafts are center-scoped. The API service role creates
`ai_drafts` from trusted inbound WhatsApp processing and logs decisions in
`ai_draft_events` with the resolved `business_center_id`. Authenticated
organization members can select drafts/events for their active center. Approval,
rejection, and send state changes go through the API so actual WhatsApp sends
are still performed by the server-side API.

The Owner Copilot endpoint uses the API service role only after validating the
Supabase bearer token against `organization_members`. Every query includes the
requested `organization_id`, and the endpoint supports only fixed MVP tools
rather than arbitrary database reads.

## Verification

The scripted verification lives at:

```text
supabase/tests/rls_cross_tenant.sql
```

It creates two temporary auth users and two organizations inside a transaction,
inserts representative rows across the MVP tenant table set, switches into the
`authenticated` role for each test user, and asserts:

- Tenant A can read Tenant A data.
- Tenant A cannot read Tenant B organizations, contacts, conversations,
  conversation messages, products, tasks, notifications, device tokens, AI draft
  quotes, or AI draft events.
- Tenant A cannot update Tenant B organization settings.
- Tenant A cannot write membership rows scoped to Tenant B.
- Tenant B can read Tenant B data.
- Tenant B cannot read Tenant A organizations, contacts, conversations,
  conversation messages, products, tasks, notifications, device tokens, AI draft
  quotes, or AI draft events.
- Tenant B cannot update Tenant A organization settings.
- Neither tenant can read `whatsapp_config` or `whatsapp_message_events`.
- Owner dashboard can expose safe WhatsApp connection status without granting
  direct `whatsapp_config` access.

The transaction rolls back at the end, so no test tenant data remains.

KAN-72 also adds a CI-safe coverage validator:

```text
scripts/validate-rls-coverage.mjs
```

`npm run validate:rls` verifies that migrations enable and force RLS for the MVP
tenant tables, service-only tables are explicitly revoked from client roles, and
the cross-tenant SQL test references every covered table. It runs as part of
`npm run ci:verify`.

## Supabase Verification Status

Live project checks confirmed:

- MVP tenant tables and service-only webhook/config tables exist.
- RLS is enabled and forced on MVP tenant tables and service-only webhook/config
  tables.
- Membership policies reference private helper functions.
- `whatsapp_config` and `whatsapp_message_events` remain service-role only.
- The expanded cross-tenant verification script completed successfully against
  the connected Supabase project inside a rollback transaction during KAN-72.
- `npm run validate:rls` completed successfully locally.

Supabase security advisor may report `rls_enabled_no_policy` for service-only
tables such as `public.whatsapp_config`. This is intentional because these
tables must not be client-readable.
