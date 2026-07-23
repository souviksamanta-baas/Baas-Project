# Android install (Nexolia Owner)

This guide covers installing the working MVP build on a physical Android device via **Expo EAS** ([KAN-346](https://souviksamanta.atlassian.net/browse/KAN-346)).

Confluence: [Android compatibility and adaptation](https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/26083329/Android+compatibility+and+adaptation).

## Framing

Nexolia Owner is already React Native + Expo (SDK 56). Android work is a **compatibility and adaptation** stream, not a rebuild. Done means core owner workflows pass on **physical Android**, not only that a build compiles.

## Prerequisites

- Copy `apps/mobile/google-services.json.example` → `google-services.json` and fill Firebase values (required for Android push)
- Google account for Play Console (internal testing) or ability to sideload APKs
- Expo account with EAS access
- `npm install -g eas-cli`
- Firebase project (for Android push / FCM — see KAN-357)

## One-time setup

```bash
cd apps/mobile
eas login
eas build:configure   # links EAS projectId into app.json extra.eas.projectId
```

Ensure [`apps/mobile/app.json`](../apps/mobile/app.json):

- `android.package`: `com.nexolia.owner` (same as iOS bundle id)
- `extra.eas.projectId`: run `eas build:configure` and replace `REPLACE_WITH_EAS_PROJECT_ID` in `app.json`
- Adaptive icon / splash / notification icon wired under `assets/images/`

[`apps/mobile/eas.json`](../apps/mobile/eas.json) profiles:

| Profile | Android artifact | Use |
| --- | --- | --- |
| `development` | APK (dev client) | Emulator + day-to-day adaptation |
| `preview` | APK | Pilot sideload / EAS install page |
| `production` | AAB | Play internal → closed → production |

## Environment

Ensure `apps/mobile/.env` points to production API/Supabase **before** building:

```
EXPO_PUBLIC_API_BASE_URL=https://baas-project-production.up.railway.app
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
EXPO_PUBLIC_AUTH_LOGIN_CHANNELS=email
```

Rebuild when env changes — OTA updates cannot change native-baked `EXPO_PUBLIC_*` values unless using `eas update` with matching runtime.

Auth sessions use **SecureStore** on native (see Test Launch hardening). API calls use Bearer Supabase JWT against Nest (`EXPO_PUBLIC_API_BASE_URL`).

## Development build

```bash
cd apps/mobile
npm run build:android:development
# or:
eas build --platform android --profile development
```

Install on emulator and a physical device. Smoke: cold start, email OTP login, dashboard load, session after kill/reopen.

## Preview APK (pilots)

```bash
cd apps/mobile
npm run build:android:preview
# or:
eas build --platform android --profile preview
```

When the build completes, open the EAS dashboard install link on the Android device (allow unknown sources if sideloading).

## Production / Play

```bash
cd apps/mobile
npm run build:android:production
eas submit --platform android --profile production
```

Create the Play app with application id `com.nexolia.owner`, complete data-safety, then use **internal** then **closed** testing tracks (KAN-361).

## OTA updates (JS-only)

```bash
cd apps/mobile
eas update --branch preview --message "Android pilot UX"
```

Use the same EAS channel as the installed build profile.


## Remaining manual gates (credentials)

These cannot be completed from CI/agent without your Expo/Google accounts:

1. `eas login` then `eas build:configure` → write real `extra.eas.projectId` (replace `REPLACE_WITH_EAS_PROJECT_ID`)
2. Place Firebase `apps/mobile/google-services.json` and configure EAS FCM credentials
3. `npm run build:android:development` / `preview` / `production` and install on hardware
4. Play Console app + data-safety + internal/closed tracks ([mobile-android-play.md](./mobile-android-play.md))
5. Execute the physical-device Definition of Done in [mobile-android-qa.md](./mobile-android-qa.md)

## Related docs

- [mobile-android-qa.md](./mobile-android-qa.md) — layout / back / permissions / device matrix
- [mobile-android-play.md](./mobile-android-play.md) — Play internal/closed AAB
- [mobile-iphone-install.md](./mobile-iphone-install.md) — iOS parallel path
- [mobile-app.md](./mobile-app.md) — owner app overview
- [whatsapp-webhook.md](./whatsapp-webhook.md) — inbound/outbound WhatsApp including images
- [environment.md](./environment.md) — `EXPO_PUBLIC_*` and API secrets
- [api-deployment.md](./api-deployment.md) — Railway API

## Scope for first Android install

Ship only verified flows on device:

- Email OTP login
- WhatsApp connect + inbox (text + images)
- Home metrics + conversations
- Copi (API-backed)
- Staff invite
- Inventory / sell paths that already ship on iOS

Track remaining adaptation work under epic **KAN-346**.
