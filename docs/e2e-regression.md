# End-to-End Regression Suite

Three-layer regression program for Nexolia releases. Use the
[release-regression-suite skill](../.cursor/skills/release-regression-suite/SKILL.md)
to run and report a full gate.

## Layers

| Layer | Location | Command | Blocking |
| --- | --- | --- | --- |
| **Static gates** | repo root | `npm run ci:verify` | Yes |
| **A — API / webhook E2E** | `apps/api/test/e2e/` | `npm run test:e2e` | Yes |
| **B — Maestro device flows** | `e2e/maestro/` | `npm run test:e2e:device` | Store builds |
| **C — Copi suite** | `test-results/copi/` | see `copi-automated-testing` skill | Yes |

Run all automated layers:

```bash
npm run test:regression
```

This runs unit specs + Layer A and prints pointers for Layer B (device) and Layer C (Copi).

## Layer A — API / Webhook E2E

Vitest specs against WhatsApp webhook parsing, outbound Meta payload shapes, and
conversation mute notification logic. No full Nest boot required; Supabase is optional
for future integration specs.

- Config: [`vitest.e2e.config.ts`](../vitest.e2e.config.ts)
- Specs: [`apps/api/test/e2e/`](../apps/api/test/e2e/)
- README: [`apps/api/test/e2e/README.md`](../apps/api/test/e2e/README.md)

Coverage matrix (Chats WhatsApp UX):

- Inbound: text, image, audio, reaction add/clear
- Reaction routing: does not create `conversation_messages`
- Outbound: reaction and audio Meta payload shapes
- Conversation actions: mute skips `inbox.new_message` notifications

## Layer B — Maestro Device Flows

YAML flows for Expo dev builds with a seeded demo tenant. Flows assert Spanish UI copy
and locale formatting (e.g. `$1.250`).

- Flows: [`e2e/maestro/`](../e2e/maestro/)
- README: [`e2e/maestro/README.md`](../e2e/maestro/README.md)

Chats flows: swipe, voice notes, reactions, Adjuntar, message menu, Agregar contacto.
Existing capabilities: auth, onboarding, inventory, cash, appointments, presupuestos,
tasks, Copi, navigation.

## Layer C — Copi Suite

Delegate to the [`copi-automated-testing`](../.cursor/skills/copi-automated-testing/SKILL.md)
skill. Reports land under `test-results/copi/`.

## CI

The GitHub Actions `e2e` job (see [ci.md](./ci.md)) runs Layer A after starting local
Supabase. The job is non-fatal (`continue-on-error`) while the suite matures; specs
themselves pass without a live database.

## Manual checklist

Automation cannot replace:

- Real Meta WhatsApp round-trip
- OS keyboard microphone transcription
- Push notification delivery on a physical device
- ARCA against the real service

Record these in release reports under `test-results/release/`.
