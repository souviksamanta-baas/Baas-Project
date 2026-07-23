# Play Console — internal / closed testing

Package: `com.nexolia.owner`  
Epic: [KAN-346](https://souviksamanta.atlassian.net/browse/KAN-346)

## Artifact

```bash
cd apps/mobile
npm run build:android:production   # AAB via eas.json production profile
eas submit --platform android --profile production
```

EAS manages the upload keystore by default (`eas credentials`).

## Play Console checklist

1. Create app with application id `com.nexolia.owner`
2. Complete **Data safety** (auth, contacts read, photos/camera, notifications, SecureStore session)
3. Privacy policy URL
4. Store listing drafts: short/full description (ES), screenshots, feature graphic
5. Upload AAB to **internal testing** → invite testers
6. Promote to **closed testing** after smoke on physical devices
7. Production release only after Definition of Done in [mobile-android-qa.md](./mobile-android-qa.md)

## Data safety notes (MVP)

- Collected: account email/phone, business profile, device push token, optional contacts (read), camera/photos user-initiated
- Not collected for this MVP: precise location, calendar, biometrics
- Shared with processors: Supabase, Railway API, Expo push / FCM, Meta WhatsApp Cloud API (business messaging)

Update this section when product scope changes.
