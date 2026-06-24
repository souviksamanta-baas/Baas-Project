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
- `EXPO_PUBLIC_API_BASE_URL`

The app does not read service-role keys, database passwords, WhatsApp secrets,
or any server-only variables.

## Navigation Flow

The owner app primary entry is **Expo Router** (`expo-router/entry` in
`package.json`). File-based routes live under `apps/mobile/app/`.

### Route groups

| Group | Paths | Purpose |
| --- | --- | --- |
| `(auth)/` | `login`, `verify`, `onboarding` | Supabase OTP and org bootstrap |
| `(app)/` | `index`, `inbox`, `copi`, `more`, … | Authenticated shell with header + bottom nav |
| `(app)/inventory/` | `manage-stock`, `product/[id]`, `sell`, … | Inventory and POS stack |
| `(app)/` | `account`, `notifications` | Header / More destinations |

Route constants and helpers: `apps/mobile/src/navigation/routes.ts` (`tabRoute`,
`conversationRoute`, inventory helpers, `getActiveTab`, `shouldHideBottomNav`).

Tab switches use `router.replace()` to avoid stacking duplicate tab screens. Nested
stacks (inbox conversation, Copi chat, inventory) use `router.push()` / `replace()`
as appropriate.

### Legacy navigator

`OwnerAppNavigator.tsx` remains for the no-Supabase dev fallback and
`DashboardScreen` embedding. New screens and journeys should wire through Expo
Router only.

Epic [KAN-259](https://souviksamanta.atlassian.net/browse/KAN-259) tracks the Expo
Router migration (stories KAN-260–KAN-267). Future Tasks tab routes (KAN-268–KAN-270)
stay open until Tasks UI exists.

### Phase 0 state machine (historical)

Phase 0 originally used state-based routing in `App.tsx`:

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

_(Superseded for the mockup review app by Expo Router — see **Navigation Flow**
above.)_

## Design System

Screen polish for Inbox, inventory, and Copi uses shared components in
`apps/mobile/src/design-system`. See **`docs/mobile-design-system.md`** for tokens,
`SearchField` / `SearchActionRow` focus behavior (green shell border on focus),
`ComposerInput`, `ListBox`, and button variants.

## Authentication Note

Phone OTP is the production owner login method (**KAN-129 — Done**). Set
`EXPO_PUBLIC_AUTH_OTP_CHANNEL=sms` and configure Twilio in the Supabase dashboard.
For simulator-only testing without SMS, set `EXPO_PUBLIC_AUTH_OTP_CHANNEL=email`.
Future Twilio Verify + WhatsApp OTP: [KAN-271](https://souviksamanta.atlassian.net/browse/KAN-271).

Argentina phone input accepts `011…`, `+5411…`, `+54911…`, and `5411…`. The client
normalizes to E.164 (`+549…`) in `apps/mobile/src/services/phone.ts` before
calling `signInWithOtp`. Login errors render inline on web via `authErrors.ts`.

SMS template (hosted dashboard + `supabase/config.toml`):

`El código para ingresar a nexolia es {{ .Code }}`

Smoke test:

```bash
export SUPABASE_ANON_KEY='your-anon-or-publishable-key'
./scripts/test-phone-otp.sh +5411XXXXXXXX
./scripts/test-phone-otp.sh +54911XXXXXXXX 123456
```

## Empty Dashboard

After organization creation, the dashboard shows:

- Active organization name.
- WhatsApp Business connection status from the safe `get_owner_dashboard`
  response.
- Active/default business center metadata for center-scoped settings and filters.
- Zero-count metrics for contacts, open conversations, products, and low stock.
- Setup prompts for WhatsApp, product catalog, and follow-up rules.

The dashboard renders only non-secret WhatsApp metadata:

- connection status
- display phone number or phone number ID
- last non-secret setup error, when present

The mobile app never reads WhatsApp access tokens, webhook verify tokens, app
secrets, or service-role configuration.

## WhatsApp Connection (KAN-75)

Owners connect WhatsApp Business from **Mi cuenta → WhatsApp** or the setup banner on
Home/Inbox when `whatsappConnection.status` is not `connected`.

Route: `/(app)/whatsapp-connect` (`WhatsAppConnectScreen`)

Flow:

1. Owner enters Meta **Phone Number ID**, optional **WABA ID**, and visible phone number.
2. Mobile calls `POST /whatsapp/connection/register` with the Supabase session bearer token.
3. API verifies the number against Meta Graph API using server-only
   `WHATSAPP_CLOUD_ACCESS_TOKEN`, then upserts `whatsapp_config` for the organization.
4. Mobile refreshes `get_owner_dashboard` and shows live connection state on Home,
   Inbox, and Account.

Connection labels and banners use `whatsappConnectionLabel()` in
`apps/mobile/src/services/whatsapp.ts`.

## Realtime Message Delivery

Phase 2 message history is stored in `conversation_messages`, which is registered
with Supabase Realtime by the migration when the `supabase_realtime` publication
exists. KAN-130 adds `business_center_id` to operational records, so the mobile
inbox uses the active/default business center for reads and subscriptions.

The dashboard now includes a compact live WhatsApp message preview that:

- Loads recent `conversation_messages` rows for the active business center.
- Subscribes to `INSERT` and `UPDATE` events with
  `business_center_id=eq.<active-center-id>`.
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

- Loads catalog `products` joined through center-scoped `inventory_items`.
- Creates, edits, and deletes active catalog products from the owner app.
- Captures product name, SKU/code, description, unit price, currency, stock
  quantity, and reorder threshold.
- Validates that product names are present and measured numeric fields are
  non-negative before writing.
- Shows low-stock state when `inventory_items.quantity_on_hand <=
  inventory_items.reorder_threshold`.
- Subscribes to product and `inventory_items` changes through Supabase Realtime
  and refreshes the catalog when rows change.

Negative stock is not allowed in the MVP. KAN-130 keeps legacy product stock
columns populated for compatibility, but the active stock source is
`inventory_items` so future bulk-weight inventory, lots, and transformations can
track decimal quantities.

## Follow-Ups and Alerts

KAN-69 adds an owner task surface to the mobile dashboard:

- Loads pending and snoozed `owner_tasks` for the active business center.
- Shows task contact/conversation context, due time, and snooze status.
- Lets the owner mark follow-up tasks complete or snooze them for 24 hours.
- Loads recent `owner_notifications` for low-stock alerts.
- Lets the owner dismiss handled alerts.
- Subscribes to center-scoped task and notification Realtime changes.
- Shows foreground in-app alerts when a new notification arrives.

Low-stock push alerts use Expo notifications. The owner taps **Enable low-stock
push alerts**, grants permission, and the app registers the Expo push token in
`owner_device_tokens` through authenticated Supabase RLS. The mobile app stores
only the Expo push token, organization ID, business center ID, and current
authenticated user ID; it does not receive service-role keys or WhatsApp secrets.

## Sales AI Drafts and Quotes

KAN-70 adds an owner review surface for Sales AI drafts:

- Loads pending and failed `ai_drafts` for the active business center.
- Shows whether the draft is a catalog reply or text-only quote.
- Displays the AI decision reason and any send error.
- Lets the owner edit draft text inline before approval.
- Calls the API `POST /ai/drafts/:draftId/approve` endpoint with the current
  Supabase access token so WhatsApp sends remain server-side.
- Lets the owner reject a draft through `POST /ai/drafts/:draftId/reject`.
- Subscribes to center-scoped `ai_drafts` Realtime changes.

`EXPO_PUBLIC_API_BASE_URL` points mobile to the deployed NestJS API for these
owner actions. The app still uses Supabase RLS for draft reads and never receives
Meta WhatsApp credentials.

## Owner Copilot and Settings

KAN-71 adds two owner dashboard surfaces:

- The Owner Copilot chat sends authenticated questions to
  `POST /ai/copilot/query` with the active organization ID and Supabase access
  token. The API validates membership and answers the MVP query set: messages
  today, low-stock products, and pending follow-ups.
- The AI and follow-up settings card edits active business center settings
  through authenticated Supabase RLS: `ai_auto_send`,
  `ai_follow_up_delay_hours`, and `business_hours`.

Settings validation happens client-side before writes:

- Follow-up delay must be a whole number from 0 to 168 hours.
- Business hours use `HH:MM` values with different start and end times.
- Business hours can be weekdays or every day, and are stored with the business
  center timezone.

AI auto-send remains off by default. When enabled, only catalog-backed safe
drafts can auto-send, and configured business hours further restrict when those
sends can happen.

## Mobile UI Screen Redesign

KAN-170 introduces the design-to-code implementation for the mobile mockups:

- The dashboard route now renders a mobile app shell with Nexolia header,
  notification shortcut, business-center switcher, avatar entry point, bottom
  navigation, and central sales/action button.
- The shell supports the approved tabs: Inicio, Inbox, Copi, and Más, with a
  My Account profile surface reachable from the avatar and More menu.
- The Home screen shows Copi entry, business summary metrics, recent
  conversations, stock CTA, and recent alerts.
- The Inbox screen shows channel filters, status tabs, conversation rows, and a
  selected thread state using the existing `useInbox` hook.
- The Copi screen supports a suggested-question state and active chat state using
  the existing `useOwnerCopilot` hook.
- The More screen groups operation, growth, and configuration actions while
  preserving the existing sign-out path.
- The My Account screen summarizes owner profile, active organization, active
  business center, role, AI settings, and timezone.

The new screen styles live in `apps/mobile/src/mobileUiStyles.ts`, while the
route implementation remains in `apps/mobile/src/screens/DashboardScreen.tsx`.
The static React/Tailwind reference prototype is documented in
`docs/ui-mockups.md`.

## Inventory and POS React Native Screens

[KAN-226](https://souviksamanta.atlassian.net/browse/KAN-226) adds static Expo
React Native screens for the approved inventory and POS mockups
([KAN-217](https://souviksamanta.atlassian.net/browse/KAN-217)). Visual review
was accepted on 2026-06-20.

Implementation paths:

| Path | Purpose |
| --- | --- |
| `apps/mobile/src/screens/inventory/InventoryScreens.tsx` | Eight inventory/POS screen components. |
| `apps/mobile/src/design-system/components/Input.tsx` | `SearchField`, `SearchActionRow`, form inputs (see `docs/mobile-design-system.md`). |
| `apps/mobile/src/components/inventoryUi.tsx` | Shared inventory UI: product cards, form fields, cart rows, totals, and action buttons (`SearchFilterRow` wraps `SearchActionRow`). |
| `apps/mobile/src/components/icons.tsx` | Inventory-specific icons (search, camera, barcode, QR, edit, trash, check, clock, shield, and others). |
| `apps/mobile/src/api/inventoryMockData.ts` | Static mock data for review. |
| `apps/mobile/app/(app)/inventory/*` | Expo Router inventory stack (replaces `OwnerAppNavigator` for mock review). |
| `apps/mobile/src/navigation/routes.ts` | Route constants and tab/inventory navigation helpers. |

Accepted static screens:

| Screen | Entry points |
| --- | --- |
| Gestionar stock | Home → Ver inventario, Más → Inventario |
| Producto | Tap base product row in Gestionar stock |
| Editar producto / Editar subproducto | Producto action bar or linked subproduct rows |
| Agregar stock / Eliminar producto | Producto action bar |
| Vender productos | Bottom nav `$` |
| Confirmar cobro | Vender productos → `$ Cobrar` |

Review locally:

```bash
cd apps/mobile && npx expo start --web --port 8152 --host localhost
```

Static review uses mock data only. API wiring for catalog, stock, lots, and POS
checkout remains future work under epic
[KAN-201](https://souviksamanta.atlassian.net/browse/KAN-201).

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
