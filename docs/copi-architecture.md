# Copi architecture (Nexolia)

Copi is the owner-facing AI assistant. It is separate from `SalesAiService`, which handles customer WhatsApp draft generation.

There is **one Copi** (everything-Pro): gate product access on `copi_enabled` only. There is no Basic composer lock, Pro upsell, or `tier_required` product wall. Org OpenAI / subscription spend caps still apply.

## Prompt layers

Copi LLM calls use maintainable prompt layers under `apps/api/src/domains/ai/prompts/`:

1. **System** (`copi-system.prompt.ts`) — personality/language/behavior (ROLE, greetings, Argentine Spanish, safety).
2. **Business context** (`copi-business-context.prompt.ts`) — Nexolia modules, live vs roadmap help areas.
3. **Tools** (`copi-tools.prompt.ts`) — live tool aliases, JSON contracts, router schema.
4. **Planner** (`copi-planner.prompt.ts`) — turn plan JSON schema and kind rules.

`buildCopiSystemPrompt(layer)` composes them for `planner`, `router`, or `phraser`.

## Turn planner (primary path)

```
Owner message + history + pendingProposal
  → CopiLlmTurnPlannerService (gpt-4o via resolveCopiModel('planner'))
  → plan.kind → execute
```

Plan kinds: `answer` | `confirm_pending` | `reject_pending` | `propose_action` | `revise_customer_reply` | `clarify`.

Regex/rules (affirm/deny, unclear exit, `inferCopiActionType`, customer-reply short-circuit) run **only as fallback** when there is no API key or the planner fails.

Safety is unchanged: propose → owner confirms in chat (“sí” / “no” / partial) before writes; WhatsApp send always needs confirm; tool registry is source of truth for stock/prices.

## Models (`resolveCopiModel`)

Models are chosen **in code** by role — not via Railway `OPENAI_MODEL` / `OPENAI_VISION_MODEL`:

| Role | Model |
| --- | --- |
| `planner` | `gpt-4o` |
| `phrase` / `whatsapp_draft` / `vision` / `router` | `gpt-4o-mini` |

Server env: `OPENAI_API_KEY` (shared fallback), optional `OPENAI_ADMIN_KEY` (staff provision).

## Flow

Mobile `POST /ai/copilot/query` → `CopiOrchestratorService` → policy (`copi_enabled`) → session → **LLM turn planner** → tools / confirm / propose / revise WA draft → phraser when answering → session persistence.

All owner messages including sí/no go through `/ai/copilot/query` (no client confirm short-circuit). Server pending proposal is source of truth.

`GET /ai/copilot/session/active` resumes the thread (messages from the last 14 days).

## Feature flags

Organization `feature_flags` on `organizations` (defaults all Copi capabilities **on**):

- `copi_enabled` — master gate
- `copi_basic_reports`, `copi_freeform_questions`, `copi_pro_agent`, `copi_voice`, `copi_vision`, `copi_custom_reports`

Dashboard exposes flags as `features` from `get_owner_dashboard()`. Mobile reads them via `useFeatureVisibility`. Composer unlocks when Copi is enabled.

## API endpoints

All require `Authorization: Bearer <supabase-jwt>`.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/ai/copilot/query` | Ask Copi; sí/no confirms/rejects pending proposals |
| GET | `/ai/copilot/session/active` | Resume active thread |
| GET | `/ai/copilot/sessions/:sessionId/messages?organizationId=` | Session history |
| POST | `/ai/copilot/actions/:actionId/confirm` | Optional programmatic confirm (chat is primary UX) |
| POST | `/ai/copilot/voice` | STT |
| POST | `/ai/copilot/vision` | Image analysis |
| POST | `/ai/copilot/reports/run` | Saved/built-in reports |

## Per-org OpenAI keys

Nexolia pays OpenAI. Customers are never billed by OpenAI and never paste keys.

| Secret | Where | Notes |
| --- | --- | --- |
| `OPENAI_API_KEY` | Railway | Shared fallback for orgs without a dedicated key |
| `OPENAI_ADMIN_KEY` | Railway | Admin API only — create projects/keys from staff portal |
| Per-org `sk-…` | Supabase `organization_llm_credentials.api_key_encrypted` | Staff **Provisionar clave OpenAI** |

Default hard spend limits (synced to the OpenAI project): Pro **$25**/mo, Enterprise **$150**/mo. When the project hard cap is hit, that org’s Copi calls get `429` / `project_spend_limit_exceeded`; other orgs keep working.

Staff API (no raw key returned):

- `GET /admin/organizations/:id/llm-credentials`
- `POST /admin/organizations/:id/llm-credentials/provision`
- `POST /admin/organizations/:id/llm-credentials/revoke`

## Read tools

`messages_today`, `low_stock`, `expiring_lots`, `pending_follow_ups`, `sales_summary`, `sales_today`, `sales_yesterday`, `open_conversations`, `pending_ai_drafts`, `products_overview`, `attention_summary`, `tasks_overview`, `tasks_due_today`, `tasks_overdue`, `tasks_by_contact`, `my_tasks`, `staff_roster`, `appointments_upcoming`, `appointments_today`, `find_product`, `cash_day`, `cash_report`, `conversation_thread`, `list_presupuestos`, `analyze_presupuesto`.

## Actions (propose → confirm)

Task lifecycle: `create_task`, `assign_task`, `complete_task`, `start_task`, `snooze_task`, `cancel_task`, `reassign_task`.

Agent actions: `schedule_reminder`, `navigate_to`, `create_support_ticket`, `save_custom_question`, `add_stock`, `create_product`, `cash_ingreso`, `cash_egreso`, `propose_customer_reply` (confirm before WhatsApp send), `assign_conversation_to_copi`, appointments create/update/assign.

`create_presupuesto` **auto-executes** on the query (no confirm). Other mutations propose + confirm via chat.

### Defaults / ask policy

Prefer propose-with-defaults over multi-turn Q&A. Soft defaults appear in the proposal summary. Hard-ask only for money amount+concept, product+qty, appointment Para, or empty customer reply.

### Automations (tasks)

`owner_tasks` supports `remind_at`, `recurrence_freq` (`daily|weekly|monthly`), `recurrence_weekday`, `template_key`. Scheduler uses `fireAt = remind_at ?? (due_at − lead)`. Completing a recurring task materializes the next instance with a unique `source_key`.

Migration: `20260914200000_copi_agent_task_automations.sql`.

### Multi-task create + inline assignment

`copi-task-parse.ts` splits numbered / “tarea para …” messages into one or more cleaned task items. Confirm creates **all** items in one `create_task` proposal.

- “mañana” is a scheduling hint, not snooze, when creating tasks.
- “asignarlo a Beto” stores `assigneeName`; execute resolves org members via Auth metadata; fallback = creator.
- “Creá un presupuesto…” uses `create_presupuesto` with tappable `[[presupuesto:ID|…]]` links.
- Revising a WhatsApp reply (“no es una tarea… respondé…”) is `revise_customer_reply` / `propose_customer_reply` — never invent `create_task`.

Tests: `apps/api/test/copi-task-parse.spec.ts`, `apps/api/test/copi-action-confirm.spec.ts`, `apps/api/test/copi-llm-turn-planner.spec.ts`, `apps/api/test/copi-defaults.spec.ts`.
