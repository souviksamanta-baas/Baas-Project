# Current Copi product contract

Copi is Nexolia's owner-facing AI assistant in the mobile app. It answers in Argentine Spanish, uses live organization data, and proposes actions for owner confirmation in chat. It is not the customer-facing WhatsApp bot. Sales AI drafts customer replies; Copi sends only after owner confirmation.

There is **one Copi** (everything-Pro). Gate product access on `copi_enabled`. Do not test a Basic vs Pro product matrix, composer lock, Pro upsell, or `tier_required` walls.

## Interaction and entitlements

- Resume a chat session for up to 14 days.
- Accept freeform questions and optional voice, vision, and PDF-text context.
- Flags (defaults on): `copi_enabled`, `copi_basic_reports`, `copi_freeform_questions`, `copi_pro_agent`, `copi_voice`, `copi_vision`, `copi_custom_reports`.
- Primary understanding path: **LLM turn planner** (`CopiLlmTurnPlannerService` / `resolveCopiModel('planner')` → `gpt-4o`). Regex/rules are fallback only (no API key or planner failure).
- Confirm / reject / partial confirms (“sí”, “no”, “sí al mensaje, no a la tarea”) via natural language through the planner and `POST /ai/copilot/query`. No Confirmar acción button as primary UX; no mobile affirmative short-circuit to confirm API.
- Default mutation pattern: propose with visible defaults, then owner sí/no in chat. Server pending proposal is source of truth.
- Ask at most one clarifying question only when hard-blocked by missing money, product plus quantity, appointment `Para`, or an empty customer-reply body.
- Models via `resolveCopiModel(role)` in code — not `OPENAI_MODEL` / `OPENAI_VISION_MODEL` env vars.

## Planner kinds (required coverage)

- `answer` — read tools + phraser
- `confirm_pending` / `reject_pending` — including mixed sí/no targets
- `propose_action` — writes wait for confirm (except presupuesto auto-exec)
- `revise_customer_reply` — Frutigran-class: refining a WA draft is never `create_task`
- `clarify` — one clarifying question

## Reads

- Attention, inbox, sales, stock, lots, staff, agenda, and tasks.
- Product search.
- Today's cashbox and reports for today, yesterday, week, month, or explicit dates.
- Conversation threads, including chats assigned to Copi.
- List and analyze presupuestos.

## Actions

- Tasks: multi-create with assignee by name; assign/reassign; start; complete; postpone; cancel; absolute `remind_at`; daily/weekly/monthly recurrence whose next instance is created on completion; `schedule_reminder`.
- Agenda: create, update, or assign appointments with custom `remind_at`.
- Caja: confirm ingreso or egreso.
- Products: add stock by name or ID; create product.
- Presupuestos: create a draft from chat, image, or lines, with follow-up task and deep link. This is the sole action currently allowed to auto-execute where supported.
- Chats: assign to Copi; propose a Sales AI customer-reply draft, confirm it in chat, then send through WhatsApp.
- Platform: `navigate_to`, save custom question chips, create a support ticket.

## Mobile compatibility

The API remains backward-compatible. Rich navigation and recurrence UI may require a newer mobile build. Older builds still confirm via chat messages.

## Not supported

- Fiscal or ARCA invoices.
- Desktop web Copi.
- Fully autonomous customer WhatsApp bot.
- Silent WhatsApp send without owner confirm.
- Freeform SQL instead of the tool registry.

Update this contract when product behavior changes. Keep dated changes in source control rather than accumulating contradictory rules here.
