# Mobile Owner App

This document tracks the Phase 0 Expo owner app work for `KAN-9`.

## Scope

The MVP is mobile-first. Phase 0 adds an Expo TypeScript app skeleton at
`apps/mobile` that can authenticate with Supabase, create an organization, and
render the empty owner dashboard.

## App Structure

| Path | Purpose |
| --- | --- |
| `apps/mobile/App.tsx` | App composition and state-based route rendering. |
| `apps/mobile/app.json` | Expo app metadata. |
| `apps/mobile/tsconfig.json` | Mobile TypeScript configuration. |
| `apps/mobile/src/lib/supabase.ts` | Supabase client configured for React Native. |
| `apps/mobile/src/features/onboarding.ts` | Calls onboarding/dashboard RPCs. |
| `apps/mobile/src/hooks/useOwnerSession.ts` | Owner session, OTP, onboarding, dashboard, and sign-out state. |
| `apps/mobile/src/screens/*` | Loading, login, OTP, onboarding, and dashboard screen components. |
| `apps/mobile/src/components/*` | Reusable button and metric components. |
| `apps/mobile/src/services/auth.ts` | Supabase auth operation wrappers. |
| `apps/mobile/src/types/dashboard.ts` | Dashboard bootstrap response type. |

## Supabase Client

The mobile app uses only public Expo environment variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_AUTH_OTP_CHANNEL`

The app does not read service-role keys, database passwords, WhatsApp secrets,
or any server-only variables.

## Navigation Flow

Phase 0 keeps navigation intentionally simple and state-based, but Phase 1 split
the shell into maintainable boundaries before the MVP screens expand:

1. `loading`: checks the current Supabase session.
2. `login`: requests an email OTP with `supabase.auth.signInWithOtp`.
3. `verify`: verifies the OTP with `supabase.auth.verifyOtp`.
4. `onboarding`: calls `create_organization_with_owner` when no org exists.
5. `dashboard`: calls `get_owner_dashboard` and renders the empty owner state.

`App.tsx` now focuses on app composition and route selection. It delegates:

| Path | Responsibility |
| --- | --- |
| `apps/mobile/src/screens/` | Route-level UI for loading, login, OTP verification, onboarding, and dashboard. |
| `apps/mobile/src/components/` | Reusable UI primitives such as buttons and metric cards. |
| `apps/mobile/src/hooks/useOwnerSession.ts` | Session bootstrapping, route state, OTP actions, onboarding, dashboard loading, and sign-out behavior. |
| `apps/mobile/src/services/auth.ts` | Supabase auth operations used by the owner session hook. |
| `apps/mobile/src/features/onboarding.ts` | Supabase RPC calls for organization creation and owner dashboard data. |
| `apps/mobile/src/styles.ts` | Shared Phase 0/1 style primitives. |

This structure can be replaced with a router once more screens are added in Phase
2, while keeping screens, hooks, services, and reusable components separate.

## Authentication Note

The simulator verification flow currently uses Supabase email OTP so KAN-88
Realtime behavior can be tested without a configured SMS provider. Production
phone OTP remains the target owner login path and is tracked separately under
KAN-129 for Twilio/Supabase Phone provider setup.

## Empty Dashboard

After organization creation, the dashboard shows:

- Active organization name.
- WhatsApp Business connection status from the safe `get_owner_dashboard`
  response.
- Zero-count metrics for contacts, open conversations, products, and low stock.
- Setup prompts for WhatsApp, product catalog, and follow-up rules.

The dashboard renders only non-secret WhatsApp metadata:

- connection status
- display phone number or phone number ID
- last non-secret setup error, when present

The mobile app never reads WhatsApp access tokens, webhook verify tokens, app
secrets, or service-role configuration.

## Realtime Message Delivery

Phase 2 message history is stored in `conversation_messages`, which is registered
with Supabase Realtime by the migration when the `supabase_realtime` publication
exists. The future inbox screen should subscribe with an organization-scoped
filter and rely on RLS so owners only receive messages for organizations where
they are members.

The dashboard now includes a compact live WhatsApp message preview that:

- Loads recent `conversation_messages` rows for the active organization.
- Subscribes to `INSERT` events with `organization_id=eq.<active-org-id>`.
- Updates the visible preview when new messages arrive without manual refresh.

## Universal Inbox

Phase 2 expands the dashboard preview into a lightweight Universal Inbox:

- Loads tenant-scoped `conversations` with linked `contacts`.
- Shows the latest message preview and timestamp for each conversation.
- Opens a selected thread and loads persisted `conversation_messages`.
- Groups message bubbles by `inbound` and `outbound` direction.
- Shows contact identity, phone number, and lead status inline.
- Subscribes to conversation and message changes through Supabase Realtime and
  cleans up the subscription when the dashboard unmounts.

The reply entry point is intentionally documented as server-routed. Mobile must
not call WhatsApp Cloud API directly; outbound sends continue through the
approved API/domain send path.

## Product Catalog

Phase 2 adds an inline mobile product catalog surface to the owner dashboard:

- Loads tenant-scoped `products` through authenticated Supabase RLS.
- Creates, edits, and deletes active catalog products from the owner app.
- Captures product name, SKU/code, description, unit price, currency, stock
  quantity, and reorder threshold.
- Validates that product names are present and numeric fields are non-negative
  before writing.
- Shows low-stock state when `stock_quantity <= reorder_threshold`.
- Subscribes to tenant-scoped product changes through Supabase Realtime and
  refreshes the catalog when rows change.

Negative stock is not allowed in the MVP. Stock adjustments must keep
`stock_quantity` at zero or above so inventory lookup and future AI answers do
not overstate availability.

## Follow-Ups and Alerts

KAN-69 adds an owner task surface to the mobile dashboard:

- Loads pending and snoozed `owner_tasks` for the active organization.
- Shows task contact/conversation context, due time, and snooze status.
- Lets the owner mark follow-up tasks complete or snooze them for 24 hours.
- Loads recent `owner_notifications` for low-stock alerts.
- Lets the owner dismiss handled alerts.
- Subscribes to tenant-scoped task and notification Realtime changes.
- Shows foreground in-app alerts when a new notification arrives.

Low-stock push alerts use Expo notifications. The owner taps **Enable low-stock
push alerts**, grants permission, and the app registers the Expo push token in
`owner_device_tokens` through authenticated Supabase RLS. The mobile app stores
only the Expo push token, organization ID, and current authenticated user ID; it
does not receive service-role keys or WhatsApp secrets.

## Local Commands

Install dependencies:

```bash
npm install
```

Typecheck API and mobile:

```bash
npm run typecheck
```

Run API tests:

```bash
npm test
```

Start Expo:

```bash
npm run dev:mobile
```

## Verification Status

For KAN-9, completion is verified when:

- `apps/mobile` exists with Expo and TypeScript configuration.
- Supabase client uses public Expo env vars only.
- Login, OTP verification, onboarding, and dashboard routes exist.
- Organization creation calls the Phase 0 onboarding RPC.
- Dashboard renders the Phase 0 empty state after onboarding.
- No server-only secrets are bundled in mobile source.
- `App.tsx` delegates screen rendering to `src/screens`.
- Session and onboarding behavior live in `src/hooks/useOwnerSession.ts`.
