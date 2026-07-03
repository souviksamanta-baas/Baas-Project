# iPhone install (Nexolia Owner)

This guide covers installing the working MVP build on a physical iPhone via **Expo EAS** (KAN-312).

## Prerequisites

- Apple Developer account (for device install or TestFlight)
- Expo account with EAS access
- `npm install -g eas-cli`

## One-time setup

```bash
cd apps/mobile
eas login
eas build:configure
```

`apps/mobile/eas.json` defines:

- `preview` — internal distribution for your iPhone
- `production` — App Store / TestFlight track

Bundle id: `com.nexolia.owner` (see `app.json`).

## Build for your iPhone

```bash
cd apps/mobile
eas build --platform ios --profile preview
```

When the build completes, open the EAS dashboard link on your iPhone and install the build (or add via TestFlight if you promote the build).

## Environment

Ensure `apps/mobile/.env` points to production API/Supabase before building:

```
EXPO_PUBLIC_API_BASE_URL=https://baas-project-production.up.railway.app
EXPO_PUBLIC_AUTH_LOGIN_CHANNELS=email
```

Rebuild when env changes — OTA updates cannot change native env baked at build time unless using `eas update` with matching runtime config.

## OTA updates (JS-only changes)

After the first native build:

```bash
cd apps/mobile
eas update --branch preview --message "Pilot UX batch"
```

Use the same EAS channel as the installed build profile.

## Scope for first install

Ship only verified flows:

- Email OTP login
- WhatsApp connect + inbox (inbound/outbound)
- Home metrics + recent conversations
- Copi (API-backed)
- Staff invite QR
- Inventory screens (after CSV import)

Disable or hide unfinished routes via feature flags in `useFeatureVisibility` if needed before production profile builds.
