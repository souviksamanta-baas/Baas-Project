# API / Webhook E2E (Layer A)

Layer A of the release regression suite. These specs exercise WhatsApp inbound parsing,
outbound Meta payload shapes, and conversation mute notification logic without booting
the full Nest application.

## Prerequisites

Most specs run with **no external services** — they use Vitest mocks against service
classes directly.

Optional local Supabase (for future integration specs):

```bash
supabase start --exclude studio,imgproxy,edge-runtime,logflare,vector,realtime
eval "$(supabase status -o env)"
export SUPABASE_URL
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
```

## Run

From the repository root:

```bash
npm run test:e2e
```

Or directly:

```bash
npx vitest run --config vitest.e2e.config.ts
```

## Specs

| File | Coverage |
| --- | --- |
| `whatsapp-inbound.e2e.spec.ts` | `parseInboundMessages` for text, image, audio, reaction add/clear; reaction routing does not create `conversation_messages` |
| `whatsapp-outbound.e2e.spec.ts` | Meta Cloud API payload shapes for reactions and audio (mocked `fetch`) |
| `conversation-actions.e2e.spec.ts` | `notifyInboxNewMessage` mute skip logic |

## CI

The GitHub Actions `e2e` job runs `npm run test:e2e` after starting local Supabase.
Current specs do not require a live database; Supabase is started for future integration
coverage.

See also [docs/e2e-regression.md](../../../docs/e2e-regression.md) and
[.cursor/skills/release-regression-suite/SKILL.md](../../../.cursor/skills/release-regression-suite/SKILL.md).
