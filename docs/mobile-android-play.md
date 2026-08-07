# Play Console — internal / closed testing

Package: `ar.com.nexolia.app`  
Epic: [KAN-346](https://souviksamanta.atlassian.net/browse/KAN-346)

## Artifact

```bash
cd apps/mobile
npm run build:android:production   # AAB via eas.json production profile
eas submit --platform android --profile production
```

EAS manages the upload keystore by default (`eas credentials`).

Production Android builds enable **R8 minify + resource shrinking** via `expo-build-properties` in `app.json` (`enableMinifyInReleaseBuilds`). That generates a ProGuard/R8 **mapping** file Play can use to deobfuscate crashes/ANRs.

### Deobfuscation file (mapping.txt)

After each production EAS Android build:

1. Open the build on Expo → download **Artifacts** / mapping (`mapping.txt` from `android/app/build/outputs/mapping/release/`).
2. In Play Console → the release (or **App bundle explorer** / **Deobfuscation files**) → upload `mapping.txt` for that `versionCode`.
3. Or when using `eas submit`, attach/upload the mapping from the same build if prompted.

Without mapping, Play shows: *“There is no deobfuscation file associated with this App Bundle.”* The current store build may lack it; the **next** production AAB after this config will produce one.

## Play Console checklist

1. Create app with application id `ar.com.nexolia.app`
2. Complete **Data safety** (auth, contacts read, photos/camera, notifications, SecureStore session)
3. Privacy policy URL
4. Account deletion URL → https://nexolia.com.ar/eliminacion-de-cuenta (also `/account-deletion`)
5. Store listing drafts: short/full description (ES), screenshots, feature graphic
6. Upload AAB to **internal testing** → invite testers (+ upload `mapping.txt`)
7. Promote to **closed testing** after smoke on physical devices
8. Production release only after Definition of Done in [mobile-android-qa.md](./mobile-android-qa.md)

## Data safety notes (MVP)

- Collected: account email/phone, business profile, device push token, optional contacts (read), camera/photos user-initiated
- Not collected for this MVP: precise location, calendar, biometrics
- Shared with processors: Supabase, Railway API, Expo push / FCM, Meta WhatsApp Cloud API (business messaging)

Update this section when product scope changes.
