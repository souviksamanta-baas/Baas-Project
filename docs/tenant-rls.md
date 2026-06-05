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

## RLS Policy Model

All Phase 0 tenant tables have RLS enabled and forced:

- `organizations`
- `organization_members`
- `whatsapp_config`
- `contacts`
- `conversations`
- `conversation_messages`

Client users can read `organizations` and `organization_members` only when their `auth.uid()` belongs to the organization through `organization_members`.

Organization owners can update organization rows and manage membership rows for their own organization only.

`whatsapp_config` intentionally has no client-readable policy and no `anon` or `authenticated` table privileges. It is service-role only because it stores WhatsApp identifiers and encrypted integration secrets.

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

## Verification

The scripted verification lives at:

```text
supabase/tests/rls_cross_tenant.sql
```

It creates two temporary auth users and two organizations inside a transaction, switches into the `authenticated` role for each test user, and asserts:

- Tenant A can read Tenant A data.
- Tenant A cannot read Tenant B data.
- Tenant A cannot write membership rows scoped to Tenant B.
- Tenant B can read Tenant B data.
- Tenant B cannot read Tenant A data.
- Neither tenant can read `whatsapp_config`.
- Owner dashboard can expose safe WhatsApp connection status without granting
  direct `whatsapp_config` access.

The transaction rolls back at the end, so no test tenant data remains.

## Supabase Verification Status

Live project checks confirmed:

- `organizations`, `organization_members`, and `whatsapp_config` exist.
- RLS is enabled and forced on all three tables.
- Membership policies reference private helper functions.
- `whatsapp_config` has no RLS policies and remains service-role only.
- The cross-tenant verification script completed successfully against the connected Supabase project.

Supabase security advisor currently reports `rls_enabled_no_policy` for `public.whatsapp_config`. This is intentional for Phase 0 because the table must not be client-readable.
