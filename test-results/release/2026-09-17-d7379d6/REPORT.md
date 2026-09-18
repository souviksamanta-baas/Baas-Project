# Release regression report

- **Target commit:** `d7379d6` (working tree also contains everything-Pro + turn-planner implementation not yet committed)
- **Branch:** `main`
- **Environment:** local
- **Mode:** Release gate (partial — Layer A/B not executed)
- **Started / ended:** 2026-09-17 ~20:55–20:57 local

## Commands

| Step | Command | Result |
| --- | --- | --- |
| Copi suite (Layer C) | `npx vitest run apps/api/test/copi*.spec.ts apps/api/test/owner-copilot.service.spec.ts` | **90/90 pass** — see `test-results/copi/FULL_SUITE_REPORT.md` |
| Unit/contract | `npm test` | **175/175 pass** (36 files) |
| Static gates | `npm run ci:verify` | Exit 0; ESLint still reports **53 pre-existing errors** (lint appears non-blocking in this script) |
| Layer A E2E | `npm run test:e2e` | **Not executed** (needs local Supabase + Meta stubs) |
| Layer B Maestro | `npm run test:e2e:device` | **Not executed** (no Expo dev build in this run) |

## Per-layer totals

| Layer | Passed | Failed | Skipped | Not executed |
| --- | --- | --- | --- | --- |
| Static / unit | 175 | 0 | 0 | — |
| Layer A API/webhook E2E | — | — | — | Yes |
| Layer B Maestro | — | — | — | Yes |
| Layer C Copi | 90 | 0 | 0 | Live LLM / Maestro Copi flows |

## Capability matrix (changed / Copi-critical)

| Capability | Status | Layer |
| --- | --- | --- |
| Everything-Pro / `copi_enabled` gate | Pass (code + unit) | C |
| Turn planner parse + model map | Pass | C |
| Confirm via chat (mobile short-circuit removed) | Implemented; device not run | C / B gap |
| Propose→confirm / presupuesto exception | Pass (existing suites) | C |
| WhatsApp confirm-before-send | Contract asserted; sandbox not run | C / A gap |
| Tenant membership on query | Pass (orchestrator test) | C |

## Failures

None in executed automated layers.

## Baseline

No prior release folder compared; first report for this SHA under `test-results/release/2026-09-17-d7379d6/`.

## Coverage gaps

- Layer A webhook/outbound E2E
- Layer B Maestro (incl. Asignar a Copi / sí-no device)
- Live OpenAI planner golden evals
- Pre-existing ESLint debt (53 errors) still present

## Go / no-go

**Conditional go for API unit-level Copi ship** — Copi unit/contract green and Layer C report clean. **No-go for full store/API production release gate** until Layer A (and Layer B for store builds) are executed against a test tenant.

## Docs / tickets

- Jira: [KAN-458](https://souviksamanta.atlassian.net/browse/KAN-458), [KAN-459](https://souviksamanta.atlassian.net/browse/KAN-459), [KAN-460](https://souviksamanta.atlassian.net/browse/KAN-460), [KAN-461](https://souviksamanta.atlassian.net/browse/KAN-461), [KAN-462](https://souviksamanta.atlassian.net/browse/KAN-462) under [KAN-446](https://souviksamanta.atlassian.net/browse/KAN-446)
- Confluence updated: Product & Licensing, API Reference (Architecture / hub / QA pending approval if blocked)
- Repo API docs: `docs/copi-architecture.md`, `docs/api-deployment.md`, `docs/environment.md`, `docs/mobile-app.md`, `docs/api-domain-boundaries.md`
