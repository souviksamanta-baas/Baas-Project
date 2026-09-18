---
name: copi-automated-testing
description: Design, implement, run, and report automated tests for Nexolia's owner-facing Copi assistant. Use for Copi regression, integration, end-to-end, safety, permissions, tool-calling, confirmation, conversation-quality, multimodal, or scheduled test work. Do not use for the customer-facing Sales AI except where Copi hands a confirmed reply to it.
---

# Copi Automated Testing

Build and execute a repeatable, evidence-based test program for Copi. Adapt commands and frameworks to the repository instead of assuming a particular implementation.

## Before acting

1. Inspect repository instructions, package manifests, existing tests, CI configuration, Copi orchestration, tool schemas, feature flags, auth/tenant boundaries, database migrations, and environment examples.
2. Read [references/copi-contract.md](references/copi-contract.md) and treat it as the current product contract. If code or newer project documentation conflicts, report the mismatch; do not silently rewrite expected behavior.
3. Identify the available environment: local, test, staging, or production. Never run mutating or message-sending tests against production.
4. Never expose secrets. Report missing environment variables by name only.

## Testing model

Use the smallest suitable layer for each behavior:

- Unit: date parsing, Argentine Spanish normalization, feature gates, confirmation payloads, recurrence, defaults, validation, and tool argument construction.
- Contract: tool schemas, API shapes, authorization, tenant isolation, idempotency, and backward-compatible generic confirmations.
- Integration: Copi orchestration with deterministic model/tool doubles and an isolated database seeded with representative organizations.
- Conversation regression: table-driven prompts with semantic assertions about intent, chosen tool, arguments, response language, clarifying-question count, and confirmation behavior. Avoid brittle exact-string snapshots.
- End-to-end: test build or simulator against test services. Stub paid or external services unless a dedicated sandbox exists.
- Non-functional: latency budgets, concurrency, retry/idempotency, prompt-injection resistance, file limits, malformed inputs, auditability, and sensitive-data leakage.

Prefer deterministic model stubs for CI. Keep a smaller live-model evaluation suite for periodic or release-gate runs, using tolerances and recording model/version/configuration.

## Required coverage

Build a traceability matrix covering every item in the contract. Include at minimum:

- `copi_enabled` gate only (everything-Pro). Do **not** require a Basic vs Pro product matrix, upsell, or `tier_required`.
- Turn planner kinds: `answer`, `confirm_pending`, `reject_pending`, `propose_action`, `revise_customer_reply`, `clarify`. Include Frutigran-class revise (not create_task) and mixed sí/no.
- Confirm via chat / planner through `/ai/copilot/query` (no Confirmar acción primary UX; no mobile affirmative short-circuit).
- `resolveCopiModel(role)` mapping; no reliance on `OPENAI_MODEL` / `OPENAI_VISION_MODEL` env.
- Regex/rules only as fallback when planner unavailable.
- Read tools: valid, empty, ambiguous, unauthorized, cross-tenant, pagination, date-range, and stale/missing data cases.
- Every mutation: proposal payload, visible defaults, owner confirmation in chat, cancellation, duplicate confirmation, API failure, retry, authorization, and resulting persisted state.
- The presupuesto-create exception: verify precisely when auto-execution is allowed and that all other mutations wait for confirmation.
- The four hard blockers: money, product plus quantity, appointment `Para`, and empty customer-reply body. Copi asks no more than one clarifying question.
- Tasks: multi-create, assignee resolution, lifecycle transitions, absolute `remind_at`, daily/weekly/monthly recurrence, and creation of the next instance only on completion.
- Agenda, caja, stock, product creation, presupuestos, chat assignment, Sales AI draft handoff, confirmed WhatsApp send, navigation, saved chips, and support tickets.
- Argentine Spanish, local phrasing, dates/timezone, currency, concise natural responses, and safe handling of ambiguity.
- Session resume before/at/after 14 days and organization/user isolation.
- Voice, image, and PDF-text paths when enabled, including unsupported/corrupt/oversized input and prompt injection inside attachments.
- Explicit exclusions: Copi must not claim to issue ARCA invoices, provide desktop Copi, or act as an autonomous customer WhatsApp bot.

## Safe fixtures

Use a dedicated test organization, synthetic customers/products/conversations, fixed clocks, and timezone `America/Argentina/Cordoba` unless the application defines another authoritative timezone. Generate unique run IDs. Make cleanup scoped to the run ID; never bulk-delete an unresolved target.

External boundaries:

- WhatsApp: assert the confirmed send request through a fake/sandbox adapter. Never message a real customer.
- LLM: default to recorded or deterministic responses; mark live-model tests separately and cap cost and attempts.
- Voice/vision/PDF: use small, non-sensitive fixtures committed specifically for tests.

## Execution modes

### Full suite

Use for initial setup, release gates, major Copi/tool/schema changes, or an explicit complete audit. Run static checks, unit, contract, integration, conversation regression, end-to-end where available, security, tenant-isolation, compatibility, and bounded performance tests.

### Periodic regression

Use for scheduled runs. Detect changes since the last successful baseline and always run the critical suite: auth/tenant isolation, feature gates, propose-confirm enforcement, presupuesto exception, hard blockers, WhatsApp boundary, recurrence, session expiry, and exclusions. Add impacted tests based on changed files. Run the full suite at least weekly unless repository constraints specify another cadence.

The skill itself does not schedule execution. Integrate its commands with the repository's existing CI scheduler or Cursor automation only when the user authorizes that configuration change.

## Implementing missing tests

Preserve the project's conventions. Add reusable fixtures/builders instead of duplicating setup. Mock at external boundaries, not internal business logic. Assert observable state and events, not implementation details. For probabilistic outputs, assert structured behavior and semantic rubrics with bounded retries; never hide a failure by retrying indefinitely.

Do not change production behavior merely to make a test pass. If a product-contract ambiguity affects expected behavior, stop and ask one focused question.

## Reporting

Write a concise Markdown report under the repository's existing test-artifact directory, or `test-results/copi/` if none exists. Include:

- commit, environment, timestamp, mode, commands, duration, model/configuration where relevant;
- totals for passed, failed, skipped, flaky, and not automated;
- coverage matrix by contract capability and test layer;
- each failure with severity, reproducible command, expected versus actual behavior, evidence path, and likely owning component;
- risks or blockers, including items requiring a device, sandbox credential, or human validation;
- prioritized next actions.

Exit non-zero for test failures or missing critical coverage. Never label the system “completely tested”; state what was automated, simulated, and left manual.
