# Copi automated testing report

- **Commit:** `d7379d6` (working tree includes everything-Pro + turn-planner changes)
- **Branch:** `main`
- **Environment:** local unit/contract (no live OpenAI key in harness)
- **Timestamp:** 2026-09-17T20:55:40-03:00
- **Mode:** Full suite (unit/contract layer available in repo)
- **Command:** `npx vitest run apps/api/test/copi*.spec.ts apps/api/test/owner-copilot.service.spec.ts`
- **Duration:** ~443ms
- **Model/config:** planner path stubbed (no API key → regex fallback); `resolveCopiModel` asserted in unit tests

## Totals

| Result | Count |
| --- | --- |
| Passed | 90 |
| Failed | 0 |
| Skipped | 0 |
| Flaky | 0 |
| Not automated (this run) | Live-model planner evals, Maestro device confirm-via-chat, WhatsApp sandbox send |

## Coverage matrix (contract)

| Capability | Layer | Status |
| --- | --- | --- |
| Everything-Pro / `copi_enabled` gate (no Basic wall) | Unit defaults + orchestrator mocks | Pass (defaults + docs/skill contract updated) |
| `resolveCopiModel` role map | Unit | Pass |
| Turn plan JSON parse / whitelist | Unit | Pass |
| Planner kinds schema in prompts | Unit | Pass |
| Frutigran-class revise ≠ create_task (regex fallback) | Unit | Pass |
| Mixed sí/no confirmTarget parse | Unit | Pass |
| Propose→confirm / presupuesto exception / task parse | Existing unit suites | Pass |
| Intent router / tool selector / session / timezone | Unit | Pass |
| Orchestrator read path (attention, low stock) with planner fallback | Integration-style unit | Pass |
| Live LLM planner end-to-end | Live eval | Not automated this run |
| Mobile confirm-via-query (no short-circuit) | Code review + unit N/A | Implemented; Maestro not run |
| WhatsApp confirm-before-send boundary | Contract asserted in skill; E2E not run | Gap (needs sandbox) |
| Cross-tenant / auth isolation | Partial via membership check in orchestrator test | Pass (limited) |

## Failures

None.

## Risks / blockers

- No OpenAI key in the harness: planner is skipped and regex fallback is exercised instead of live `gpt-4o` planning.
- Device Maestro Copi flows and Layer A webhook E2E were not part of this Copi-skill run (covered under release-regression skill).
- `tier_required` remains in OpenAPI/mobile type unions for backward compatibility but is no longer returned by the orchestrator product path.

## Next actions

1. Add a recorded/stubbed planner response harness for orchestrator kind branches without live OpenAI.
2. Run Maestro Copi flow for sí/no confirm and Asignar a Copi → draft → confirm.
3. Periodic live-model golden Spanish set (Frutigran revise, mixed sí/no, stock Q&A) with cost caps.
