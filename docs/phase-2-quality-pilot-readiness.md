# Phase 2 Quality and Pilot Readiness

This document is the source-controlled readiness tracker for KAN-72. It ties the
Phase 2 MVP acceptance surface to verification evidence, pilot onboarding, known
limitations, support flow, and success metrics.

## Acceptance Evidence

### WhatsApp Channel and Messaging

Status: Ready for pilot.

Verification steps:

- Confirm `GET /health` returns `{"status":"ok"}` in production.
- Confirm WhatsApp webhook verification and signature handling are documented in
  `docs/whatsapp-webhook.md`.
- Confirm inbound message persistence creates tenant-scoped `contacts`,
  `conversations`, and `conversation_messages`.
- Confirm mobile inbox receives Realtime updates through organization-scoped
  subscriptions.

Evidence:

- KAN-66, KAN-75, KAN-76, and KAN-88 were completed before KAN-72.
- `npm run ci:verify` covers API tests, typecheck, build, and mobile config.
- RLS verification covers `conversations` and `conversation_messages`.

### Universal Inbox and CRM

Status: Ready for pilot.

Verification steps:

- Confirm contacts are auto-upserted from inbound WhatsApp messages.
- Confirm conversations link to contacts and show lead status.
- Confirm tenant A cannot read tenant B contacts or conversation records.

Evidence:

- KAN-67, KAN-74, and KAN-78 were completed before KAN-72.
- `supabase/tests/rls_cross_tenant.sql` covers `contacts`, `conversations`, and
  `conversation_messages`.

### Product Catalog and Inventory

Status: Ready for pilot.

Verification steps:

- Confirm owners can create, edit, and delete products from mobile.
- Confirm product validation rejects negative measured stock and invalid price
  fields.
- Confirm low-stock state is computed from center-scoped
  `inventory_items.quantity_on_hand <= inventory_items.reorder_threshold`.
- Confirm tenant A cannot read tenant B product records.

Evidence:

- KAN-68, KAN-73, and KAN-79 were completed before KAN-72.
- `supabase/tests/rls_cross_tenant.sql` covers `products`.
- `npm run ci:verify` covers API inventory tests and mobile typecheck.

### Follow-Ups, Tasks, and Alerts

Status: Ready for pilot, with scheduler secret required operationally.

Verification steps:

- Confirm `BAAS_TASKS_JOB_SECRET` is configured before invoking
  `POST /tasks/run-maintenance`.
- Confirm follow-up task generation uses persisted business center
  `ai_follow_up_delay_hours`.
- Confirm owners can complete or snooze tasks and dismiss notifications.
- Confirm tenant A cannot read tenant B tasks, notifications, or device tokens.

Evidence:

- KAN-69, KAN-80, and KAN-82 were completed before KAN-72.
- `docs/environment.md` documents `BAAS_TASKS_JOB_SECRET`.
- `supabase/tests/rls_cross_tenant.sql` covers `owner_tasks`,
  `owner_notifications`, and `owner_device_tokens`.

### Sales AI Replies and Quotes

Status: Ready for pilot with owner review as the safe default.

Verification steps:

- Confirm catalog-backed replies are generated without inventing products.
- Confirm quote drafts require owner review before send.
- Confirm approved sends route through the API and never expose WhatsApp tokens to
  mobile.
- Confirm tenant A cannot read tenant B AI quote drafts or AI draft events.

Evidence:

- KAN-70, KAN-77, and KAN-81 were completed before KAN-72.
- `apps/api/test/sales-ai.service.spec.ts` covers draft generation and
  business-hours gating.
- `supabase/tests/rls_cross_tenant.sql` covers `ai_drafts` and
  `ai_draft_events`.

### Owner Copilot and Settings

Status: Ready for pilot.

Verification steps:

- Confirm owners can ask copilot questions from mobile.
- Confirm copilot answers messages today, low stock, and pending follow-ups.
- Confirm API response payload includes `responseTimeMs` and stays under 5
  seconds for MVP-sized data.
- Confirm only organization members can query copilot data.
- Confirm owners can update active business center AI auto-send, business hours,
  and follow-up delay.

Evidence:

- KAN-71, KAN-83, and KAN-85 were completed before KAN-72.
- `apps/api/test/owner-copilot.service.spec.ts` covers copilot tool routing and
  membership validation.
- `supabase/tests/rls_cross_tenant.sql` covers organization settings isolation.

## Tenant Isolation Evidence

The expanded RLS verification script is:

```text
supabase/tests/rls_cross_tenant.sql
```

It creates two tenants in a transaction, inserts representative data for each
tenant, switches between authenticated test users, and proves tenant A cannot
read or update tenant B data across the MVP table set.

Covered tenant tables:

- `organizations`
- `organization_members`
- `business_centers`
- `business_center_members`
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

Service-role-only exceptions:

- `whatsapp_config`
- `whatsapp_message_events`

The CI-friendly guard is:

```text
scripts/validate-rls-coverage.mjs
```

It validates that the RLS test references every MVP tenant table, that migrations
enable and force RLS for those tables, and that service-role-only tables are
explicitly revoked from `anon` and `authenticated`.

## Pilot Onboarding Checklist

Use this checklist for each of the first 1-3 pilot businesses.

- Create or confirm the owner account.
- Confirm the business organization name and timezone.
- Confirm the default business center and timezone.
- Configure WhatsApp Business Cloud API credentials in the API environment.
- Verify `GET /health` returns `{"status":"ok"}`.
- Send a test inbound WhatsApp message and confirm it appears in the mobile
  Universal Inbox.
- Add at least five real products with SKU/name, price, measured stock, unit, and
  reorder threshold.
- Enable low-stock push alerts on the owner device.
- Confirm `BAAS_TASKS_JOB_SECRET` is configured for the scheduler or maintenance
  caller.
- Run or schedule `POST /tasks/run-maintenance`.
- Ask copilot: "What needs my attention?" and confirm it returns messages,
  low-stock items, or follow-ups in under 5 seconds.
- Review a Sales AI draft and approve or reject it.
- Decide whether AI auto-send remains off or is enabled with business hours.

## Two-Week Pilot Operating Rhythm

Daily checks:

- Review open conversations and unresolved AI drafts.
- Review pending follow-ups and snoozed tasks.
- Review low-stock alerts against actual stock.
- Confirm copilot response time remains below 5 seconds for normal use.
- Check production health at
  `https://baas-project-production.up.railway.app/health`.

Twice-weekly checks:

- Review webhook/API errors and failed WhatsApp sends.
- Review missed follow-ups reported by the pilot owner.
- Review product stock discrepancies reported by the pilot owner.
- Capture owner feedback on confusing AI drafts or missing products.

End-of-pilot checks:

- Export pilot findings into the Phase 2 Confluence page.
- Decide whether the pilot business continues, pauses, or needs remediation.
- Convert recurring pilot issues into Jira follow-up tickets.

## Success Metrics

### 80% Inquiry Handling

Baseline: unknown before pilot.

Target: at least 80% of inbound product/availability/price inquiries get a
catalog-backed draft, owner-approved response, or safe fallback within the pilot
day.

Measurement:

- Count inbound customer messages in `conversation_messages`.
- Count related `ai_drafts` and sent outbound responses.
- Review samples where no draft or response was generated.

### Zero Missed Hot-Lead Follow-Ups

Baseline: no automated follow-up tracking before KAN-69.

Target: zero owner-reported missed hot-lead follow-ups during the two-week pilot.

Measurement:

- Review `owner_tasks` pending, snoozed, and completed state daily.
- Compare owner-reported missed follow-ups against generated follow-up tasks.
- Treat any lead needing urgent attention without a pending/completed task as a
  miss.

### Stock Accuracy

Baseline: pilot starts from manually entered product stock.

Target: low-stock alerts and copilot inventory answers match owner-confirmed
stock for pilot products.

Measurement:

- Compare center-scoped `inventory_items.quantity_on_hand` and
  `reorder_threshold` against owner spot-checks.
- Review `owner_notifications` for low-stock alert coverage.
- Log any manual correction as a stock accuracy issue.

### Under-5-Second Copilot Responses

Baseline: KAN-71 deterministic copilot returns `responseTimeMs` from the API.

Target: 95% of pilot copilot requests complete in under 5 seconds for MVP-sized
data.

Measurement:

- Capture `responseTimeMs` from `POST /ai/copilot/query` responses during pilot
  checks.
- Investigate any request at or above 5 seconds with API logs and query shape.

## Known Limitations

- Phone OTP production provider setup is still tracked separately; simulator
  verification currently uses email OTP.
- Sales AI is deterministic and catalog-aware. It is intentionally not a general
  LLM assistant.
- Quote generation assumes one unit per matched product until quantity parsing is
  added.
- Stock is manually maintained by the owner. KAN-130 supports decimal measured
  stock and a schema for lots/movements/transformations, but no POS or accounting
  integration is included in this MVP.
- WhatsApp outbound sends require a connected WhatsApp Business number and valid
  server-side credentials.
- Push notifications depend on Expo push token registration on the owner device.
- Scheduler behavior depends on `BAAS_TASKS_JOB_SECRET` being configured in the
  API runtime and scheduler caller.

## Support Escalation

Severity 1: production API down, webhook delivery broken, cross-tenant data
exposure, or WhatsApp sends broadly failing.

Response:

- Check production health immediately.
- Pause any unsafe automation such as AI auto-send if needed.
- Review recent deploys, API logs, and Supabase advisor output.
- Create or update a Jira incident ticket before remediation work.

Severity 2: pilot owner blocked from daily workflow, repeated failed sends,
broken mobile login, or task maintenance not running.

Response:

- Capture owner, organization, timestamp, and reproduction steps.
- Check API logs and mobile-visible error messages.
- Create a Jira bug with affected workflow and expected behavior.

Severity 3: documentation gap, confusing AI wording, product data cleanup, or
minor UI issue.

Response:

- Capture feedback during the daily or twice-weekly pilot check.
- Batch into a follow-up Jira ticket unless it blocks pilot usage.
