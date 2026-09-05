# Store release — Play Console + App Store Connect

Package IDs:

| Store | ID |
| --- | --- |
| Google Play | `ar.com.nexolia.app` |
| App Store | `com.nexolia.owner` (ASC app id `6804087507`) |

Marketing version today: `0.1.0` (`apps/mobile/app.json`). Native build numbers auto-increment on EAS (`eas.json` → `production.autoIncrement`, `appVersionSource: remote`).

## Before the first production build

1. **Expo login** (required — cloud builds fail with GraphQL Forbidden when the session is stale):

   ```bash
   cd apps/mobile
   npx eas-cli login
   npx eas-cli whoami
   ```

2. **EAS production environment variables** (`.env` is gitignored and is **not** uploaded to EAS). Create/update under environment `production`:

   - `EXPO_PUBLIC_API_BASE_URL`
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `EXPO_PUBLIC_AUTH_LOGIN_CHANNELS` (e.g. `email`)

   ```bash
   npx eas-cli env:list --environment production
   # create/update as needed, then:
   npm run build:store
   ```

3. **Android push (optional for first listing, required for notifications):** copy `google-services.json` into `apps/mobile/` (gitignored) and ensure FCM credentials are configured in EAS. See [mobile-android-install.md](./mobile-android-install.md).

4. **Apple / Google accounts:** App Store Connect API key or Apple ID for `eas submit`; Play Console service account JSON or interactive Google login for Android submit.

## Build

```bash
cd apps/mobile
npm run build:store
# or separately:
npm run build:android:production   # AAB for Play
npm run build:ios:production       # IPA for TestFlight / App Store
```

Artifacts appear in the [Expo / EAS dashboard](https://expo.dev). After Android finishes, download **mapping.txt** and attach it in Play Console ([mobile-android-play.md](./mobile-android-play.md)).

## Submit

```bash
npm run submit:android   # internal track, draft (eas.json)
npm run submit:ios       # App Store Connect / TestFlight via ascAppId
# or both:
npm run submit:store
```

## Console checklists

### Play Console (`ar.com.nexolia.app`)

- [ ] App created with package `ar.com.nexolia.app`
- [ ] Data safety (auth, contacts read/write for add-to-phonebook, camera/photos, mic, notifications, SecureStore session)
- [ ] Privacy policy URL
- [ ] Account deletion URL → https://nexolia.com.ar/eliminacion-de-cuenta
- [ ] Store listing (ES): short + full description, icon, feature graphic, phone screenshots
- [ ] Upload AAB to **internal testing** + `mapping.txt`
- [ ] Smoke on physical devices → promote to closed / production

### App Store Connect (`com.nexolia.owner`)

- [ ] App record matches bundle id; ASC id `6804087507`
- [ ] Privacy nutrition labels aligned with Data safety notes
- [ ] Account deletion URL + privacy policy
- [ ] Screenshots (phone): use `tmp/asc-screenshots/` draft set
  - `01-inicio.png`, `02-copi.png`, `03-stock.png`, `04-ventas.png`, `05-nueva-tarea.png`
- [ ] Export compliance: `ITSAppUsesNonExemptEncryption = false` already in `app.json`
- [ ] Upload via `eas submit` → TestFlight → App Review

## Related

- [mobile-android-play.md](./mobile-android-play.md)
- [mobile-iphone-install.md](./mobile-iphone-install.md)
- [mobile-android-install.md](./mobile-android-install.md)
- [account-deletion.md](./account-deletion.md)
- [environment.md](./environment.md)
