# Copi architecture (Nexolia)

Copi is the owner-facing AI assistant. It is separate from `SalesAiService`, which handles customer WhatsApp draft generation.

## Prompt layers

Copi LLM calls use three maintainable prompt layers under \`apps/api/src/domains/ai/prompts/\`:

1. **System** (\`copi-system.prompt.ts\`) — personality, Argentine Spanish, greetings, safety.
2. **Business context** (\`copi-business-context.prompt.ts\`) — live Nexolia entities, sales interpretation, roadmap limits.
3. **Tools** (\`copi-tools.prompt.ts\`) — selectable tools, JSON contracts, router/phraser rules.

\`buildCopiSystemPrompt(layer)\` composes them for the tool router or answer phraser. Regex intent routing remains a deterministic fallback when the LLM is off or fails.

## Flow

Mobile \`POST /ai/copilot/query\` → \`CopiOrchestratorService\` → policy check → session history → tool selector (LLM + rules fallback) → tool registry → LLM phraser → optional Pro action proposal → session persistence.

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

`messages_today`, `low_stock`, `pending_follow_ups`, `sales_summary`, `open_conversations`, `pending_ai_drafts`, `products_overview`, `attention_summary`, `tasks_overview`, `tasks_due_today`, `tasks_overdue`, `tasks_by_contact`, `my_tasks`, `staff_roster`.

## Pro actions

`create_task`, `assign_task`, `complete_task`, `snooze_task`, `cancel_task`, `reassign_task` — proposed in query response, executed only after owner confirms.

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
- `apps/mobile/src/hooks/useOwnerCopilot.ts`
- `apps/mobile/src/api/ai.ts`

## Database

- `20260705200000_copi_foundation.sql` — flags, sessions, messages, actions, reports, task columns, dashboard `features` + `weeklySalesCents`
- `20260705210000_copi_pilot_pro_flags.sql` — Pro flags for Baas Admin + NEX Biz

Confluence hub: [Copi](https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/19857410/Copi)
