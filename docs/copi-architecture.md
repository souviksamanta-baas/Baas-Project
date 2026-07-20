# Copi architecture (Nexolia)

Copi is the owner-facing AI assistant. It is separate from `SalesAiService`, which handles customer WhatsApp draft generation.

## Prompt layers

Copi LLM calls use three maintainable prompt layers under \`apps/api/src/domains/ai/prompts/\`:

1. **System** (\`copi-system.prompt.ts\`) — full personality/language/behavior brief from product (ROLE, greetings, Argentine Spanish, safety, proactive help, GOAL).
2. **Business context** (\`copi-business-context.prompt.ts\`) — Nexolia modules, live vs roadmap help areas, sale/WhatsApp relationships, KPI limits, owner-language mapping.
3. **Tools** (\`copi-tools.prompt.ts\`) — brief→live tool aliases, Basic/Pro permissions, JSON contracts, router schema.

\`buildCopiSystemPrompt(layer)\` composes them for the tool router or answer phraser.

**Routing philosophy:** the LLM understands freeform Argentine Spanish first. Regex \`selectCopiTools\` is only a safety net when the model returns nothing or wrongly picks generic \`attention_summary\` for a specific ask. Do not treat suggested UI questions as an exhaustive wired list — they are examples of coverage.

## Flow

Mobile \`POST /ai/copilot/query\` → \`CopiOrchestratorService\` → policy check → **resume active session within 14 days** (or create) → session history → tool selector (LLM + rules safety net) → tool registry → LLM phraser → optional Pro action proposal → session persistence.

\`GET /ai/copilot/session/active\` resumes the same WhatsApp-style thread (messages from the last 14 days) without requiring a new question.

## Licensing

Organization `feature_flags` JSON on `organizations`:

- Basic: `copi_enabled`, `copi_basic_reports`, `copi_freeform_questions`
- Pro add-on: `copi_pro_agent`, `copi_voice`, `copi_vision`, `copi_custom_reports`

Dashboard exposes flags as `features` from `get_owner_dashboard()`. Mobile reads them via `useFeatureVisibility`.

## API endpoints

All require `Authorization: Bearer <supabase-jwt>`.

| Method | Path | Tier |
| --- | --- | --- |
| POST | `/ai/copilot/query` | Basic+ |
| GET | `/ai/copilot/sessions/:sessionId/messages?organizationId=` | Basic+ |
| POST | `/ai/copilot/actions/:actionId/confirm` | Pro |
| POST | `/ai/copilot/voice` | Pro |
| POST | `/ai/copilot/vision` | Pro |
| POST | `/ai/copilot/reports/run` | Pro |

Server env: `OPENAI_API_KEY`, optional `OPENAI_MODEL` / `OPENAI_VISION_MODEL`.

## Read tools (Basic)

`messages_today`, `low_stock`, `expiring_lots`, `pending_follow_ups`, `sales_summary`, `open_conversations`, `pending_ai_drafts`, `products_overview`, `attention_summary`, `tasks_overview`, `tasks_due_today`, `tasks_overdue`, `tasks_by_contact`, `my_tasks`, `staff_roster`.

## Pro actions

`create_task`, `assign_task`, `complete_task`, `snooze_task`, `cancel_task`, `reassign_task` — proposed in query response, executed only after owner confirms.

### Multi-task create + inline assignment

`copi-task-parse.ts` splits numbered / “tarea para …” messages into one or more
cleaned task items (titles, due dates, reminders). Confirm creates **all** items
in one `create_task` proposal.

- Phrases like “mañana” are scheduling hints, **not** snooze. Create-task intent
  always wins over snooze when the owner asks to create tasks.
- “asignarlo a Beto” / “asignar a …” strips the assignee from the title and
  stores `assigneeName`. On confirm, `CopiActionService` resolves the name to an
  org member via Auth `user_metadata` (`preferred_name` / `full_name`). If no
  match, the task is still created and metadata notes the unresolved assignee.
- Misclassified pending proposals (legacy snooze with `taskId: null`) are
  recovered to `create_task` on confirm. Confirm domain errors surface as HTTP
  400 with a Spanish message instead of an opaque 500.

Tests: `apps/api/test/copi-task-parse.spec.ts`, `apps/api/test/copi-action-confirm.spec.ts`.

## Key modules

- `apps/api/src/domains/ai/prompts/copi-system.prompt.ts`
- `apps/api/src/domains/ai/prompts/copi-business-context.prompt.ts`
- `apps/api/src/domains/ai/prompts/copi-tools.prompt.ts`
- `apps/api/src/domains/ai/prompts/copi-prompt-composer.ts`
- `apps/api/src/domains/ai/copi-orchestrator.service.ts`
- `apps/api/src/domains/ai/copi-tool-registry.ts`
- `apps/api/src/domains/ai/copi-policy.service.ts`
- `apps/api/src/domains/ai/copi-llm-phraser.service.ts`
- `apps/api/src/domains/ai/copi-action.service.ts`
- `apps/api/src/domains/ai/copi-task-parse.ts`
- `apps/mobile/src/hooks/useOwnerCopilot.ts`
- `apps/mobile/src/api/ai.ts`
- `apps/mobile/src/lib/workQueue.ts` — Task Portal presentation; product links in chat use `returnTo` navigation to inventory and back to Copi chat

## Task Portal integration

Copi task write tools (`create_task`, `assign_task`, etc.) execute through
`copi-action.service.ts` after owner confirmation. Task and alert reads in the
mobile Centro de tareas use the same `owner_tasks` / `owner_notifications` data.
Product names in Copi answers link to inventory with `[[product:UUID|Name]]` markup;
from Copi chat, product detail back navigation returns to chat (`returnTo=copi-chat`).
From the task portal, low-stock alerts open product detail with `returnTo=tasks-portal`.

## Database

- `20260705200000_copi_foundation.sql` — flags, sessions, messages, actions, reports, task columns, dashboard `features` + `weeklySalesCents`
- `20260705210000_copi_pilot_pro_flags.sql` — Pro flags for Baas Admin + NEX Biz

Confluence hub: [Copi](https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/19857410/Copi)
