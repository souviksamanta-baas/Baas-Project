# Maestro Device Flows (Layer B)

Layer B of the release regression suite. YAML flows run against an **Expo dev build**
(not Expo Go) with a seeded demo tenant.

## Prerequisites

1. **Expo dev build** installed on simulator or physical device:

   ```bash
   npm run build:android:development   # or iOS equivalent
   ```

2. **Maestro CLI** — [install guide](https://maestro.mobile.dev/getting-started/installing-maestro)

3. **Seeded demo tenant** — local Supabase with demo data (see root `supabase/` migrations
   and seed scripts). Point the dev build at your local API.

4. Start the mobile app and API locally before running flows.

## Run all flows

From the repository root:

```bash
npm run test:e2e:device
# equivalent:
maestro test e2e/maestro
```

Run a single flow:

```bash
maestro test e2e/maestro/chats-swipe.yaml
```

## Conventions

- **Spanish UI copy** — assertions use Spanish labels (`Chats`, `Silenciar`, `$1.250`, etc.).
- **appId** — Android `ar.com.nexolia.app`; iOS flows may need `com.nexolia.owner`.
- Flows are **stubs** until selectors and seed data are wired. Uncomment steps as the
  Chats WhatsApp UX ships.

## Flow index

| Flow | Capability |
| --- | --- |
| `chats-swipe.yaml` | Swipe actions on conversation list |
| `chats-voice-note.yaml` | Record and send voice note |
| `chats-reactions.yaml` | Add/clear message reactions |
| `chats-adjuntar.yaml` | Attach image via Adjuntar |
| `chats-message-menu.yaml` | Long-press message menu |
| `chats-add-contact.yaml` | Agregar contacto from chat |
| `auth-login.yaml` | Owner login |
| `onboarding.yaml` | First-run onboarding |
| `inventory-sell.yaml` | Register a sale |
| `inventory-add-stock.yaml` | Add stock to product |
| `cash-movement.yaml` | Record cash in/out |
| `appointments-create.yaml` | Create appointment |
| `presupuesto-create.yaml` | Create presupuesto |
| `tasks-create.yaml` | Create task |
| `copi-ask-confirm.yaml` | Copi propose-confirm flow |
| `navigation-tabs.yaml` | Bottom tab navigation |

See [docs/e2e-regression.md](../../docs/e2e-regression.md) for the full three-layer program.
