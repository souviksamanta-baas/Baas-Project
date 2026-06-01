# Mobile Owner App

This document tracks the Phase 0 Expo owner app work for `KAN-9`.

## Scope

The MVP is mobile-first. Phase 0 adds an Expo TypeScript app skeleton at
`apps/mobile` that can authenticate with Supabase, create an organization, and
render the empty owner dashboard.

## App Structure

| Path | Purpose |
| --- | --- |
| `apps/mobile/App.tsx` | Phase 0 login, OTP verification, onboarding, and dashboard UI. |
| `apps/mobile/app.json` | Expo app metadata. |
| `apps/mobile/tsconfig.json` | Mobile TypeScript configuration. |
| `apps/mobile/src/lib/supabase.ts` | Supabase client configured for React Native. |
| `apps/mobile/src/features/onboarding.ts` | Calls onboarding/dashboard RPCs. |
| `apps/mobile/src/types/dashboard.ts` | Dashboard bootstrap response type. |

## Supabase Client

The mobile app uses only public Expo environment variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_AUTH_OTP_CHANNEL`

The app does not read service-role keys, database passwords, WhatsApp secrets,
or any server-only variables.

## Navigation Flow

Phase 0 keeps navigation intentionally simple and state-based:

1. `loading`: checks the current Supabase session.
2. `login`: requests a phone OTP with `supabase.auth.signInWithOtp`.
3. `verify`: verifies the OTP with `supabase.auth.verifyOtp`.
4. `onboarding`: calls `create_organization_with_owner` when no org exists.
5. `dashboard`: calls `get_owner_dashboard` and renders the empty owner state.

This can be replaced with a router once more screens are added in Phase 1.

## Empty Dashboard

After organization creation, the dashboard shows:

- Active organization name.
- Zero-count metrics for contacts, open conversations, products, and low stock.
- Setup prompts for WhatsApp, product catalog, and follow-up rules.

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
