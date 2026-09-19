---
name: release-regression-suite
description: Run and report Nexolia's end-to-end regression suite across all capabilities before a release, covering static checks, API/webhook E2E, Maestro device flows, and the Copi suite. Use for release gates, pre-release sign-off, release candidate verification, regression runs after large merges, or when the user asks to verify the whole app still works end to end.
---

# Release Regression Suite

Run the repeatable pre-release regression program for the Nexolia monorepo and produce an evidence-based report. Adapt commands to the repository as it actually is; never assume a layer exists.

## Before acting

1. Confirm the target: branch or tag, commit SHA, and intended release (store build, OTA update, or API deploy).
2. Inspect [package.json](../../../package.json), [vitest.config.ts](../../../vitest.config.ts), [.github/workflows/ci.yml](../../../.github/workflows/ci.yml), and [docs/ci.md](../../../docs/ci.md) to read the current scripts rather than trusting the names below.
3. Detect which layers are present: root vitest specs (`apps/**/*.spec.ts`), API E2E (`apps/api/test/e2e/`), Maestro flows (`e2e/maestro/`), Copi artifacts (`test-results/copi/`).
4. Identify the environment. Run against local or test services only. **Never run mutating, message-sending, or invoicing tests against production**, and never send to a real WhatsApp customer.
5. Report missing environment variables by name only. Never print secret values.

If a layer is absent, record it as a coverage gap in the report and fall back to the manual checklist for that area. Do not report a layer as passing when it was not executed.

## Layers

Run in this order; stop and report if a blocking layer fails.

- **Static gates** — lint, migration validation, RLS coverage, typecheck, unit/contract specs, API build, Expo config. This is `npm run ci:verify` today.
- **Layer A, API and webhook E2E** — Nest booted in-process against a local Supabase tenant with Meta stubbed. Covers the inbound webhook matrix (text, image, audio, reaction add and clear, status updates, duplicates, unknown types), the outbound matrix and exact Meta payload shapes, conversation actions, cross-tenant rejection, and one happy plus one failure path per domain. Blocking.
- **Layer B, Maestro device flows** — YAML flows on an Expo dev build with a seeded demo tenant. Covers Chats (swipe, voice notes, reactions, Adjuntar, message menu, Agregar contacto) and existing capabilities (auth, onboarding, inventory, cash, appointments, presupuestos, tasks, Copi, navigation). Blocking for store builds, advisory for API-only deploys.
- **Layer C, Copi suite** — delegate to the `copi-automated-testing` skill (everything-Pro + turn-planner contract) and cite its latest report under `test-results/copi/`. Do not duplicate Copi coverage here.
- **Manual checklist** — only what automation cannot reach: real Meta round-trip, OS keyboard microphone transcription, push notification delivery on a physical device, ARCA against the real service.

For the capability-by-capability matrix, see [references/capability-matrix.md](references/capability-matrix.md).

## Execution modes

### Release gate (default)

All layers, full matrix. Use before any store submission, OTA release, or production API deploy.

### Targeted regression

Static gates plus Layer A in full, plus the Layer B flows touching changed areas. Use after a large merge or hotfix. Always include the critical set regardless of what changed: auth and tenant isolation, WhatsApp inbound and outbound, conversation actions, Copi propose-confirm, inventory sell, cash movement.

When the change set includes products/categories/compras (multi-category, Granel subproducts, proveedores/purchases Supabase, IVA/ajuste), also include Layer B inventory/compras flows and related static/unit coverage in the critical changed-area set.

### Smoke

Static gates plus the Layer A inbound/outbound matrix and the `auth-login`, `navigation-tabs`, and one Chats flow. Use to sanity-check a branch mid-development. Never accept a smoke run as release sign-off.

## Workflow

Copy this checklist into the working notes and keep it updated:

```
Release regression progress:
- [ ] 1. Record target commit, branch, environment, mode
- [ ] 2. Detect available layers and note gaps
- [ ] 3. Static gates
- [ ] 4. Layer A API/webhook E2E
- [ ] 5. Layer B Maestro device flows
- [ ] 6. Layer C Copi suite (delegate)
- [ ] 7. Manual checklist items
- [ ] 8. Compare against previous release baseline
- [ ] 9. Write report and state the go/no-go
```

**Step 3, static gates.** Run the repository's verification script (`npm run ci:verify`). Capture failures individually; a lint failure and a failing spec are different severities.

**Step 4, Layer A.** Start local Supabase the way CI does, run the E2E project, and record per-suite results. Treat any cross-tenant leak as a release blocker regardless of anything else passing.

**Step 5, Layer B.** Requires a current Expo dev build. If no dev build is available, say so explicitly and mark Layer B as not executed rather than skipping it silently. Assert Spanish UI copy, and Spanish number and currency formatting such as `$1.250`.

**Step 8, baseline.** Compare against the previous release report in `test-results/release/`. Classify each failure as new, pre-existing, or fixed. A pre-existing failure is still reported, but it does not by itself block a release that was already shipping with it.

## Failure handling

- Reproduce a failure once before reporting it. Report the exact command.
- Distinguish product defects from harness problems, and label which one it is.
- A test may be quarantined as flaky only with a recorded failure rate across at least three runs and a linked follow-up item. Never retry until green and call it passing.
- Do not change production behavior to make a test pass. If expected behavior is genuinely ambiguous, stop and ask one focused question.

## Reporting

Write `test-results/release/<YYYY-MM-DD>-<short-sha>/REPORT.md` containing:

- target commit, branch, environment, mode, start and end time, commands run;
- per-layer totals for passed, failed, skipped, flaky, and not executed;
- the capability matrix with a status per capability and the layer that covered it;
- each failure with severity, reproducible command, expected versus actual, evidence path, and likely owning component;
- baseline comparison classifying failures as new, pre-existing, or fixed;
- coverage gaps, including anything needing a device, sandbox credential, or human validation;
- an explicit **go / no-go** recommendation with the reasoning.

Exit non-zero when a blocking layer fails or critical coverage is missing. Never describe the app as fully tested; state what was automated, what was stubbed, and what remains manual.
