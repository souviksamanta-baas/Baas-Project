# Android QA — Nexolia Owner

Epic: [KAN-346](https://souviksamanta.atlassian.net/browse/KAN-346). Companion to [mobile-android-install.md](./mobile-android-install.md).

## Screen layout punch list

Check every Owner surface on a physical Android device (gesture + 3-button nav):

| Area | What to verify |
| --- | --- |
| Auth | Login / OTP / onboarding; keyboard does not cover fields; Spanish labels wrap |
| Chrome | Header under status bar; bottom tabs above gesture/nav bar |
| Home / Inbox / Copi / Más | No clipped FABs or fixed footers |
| Chat composers | Keyboard resize + stick-to-bottom after images |
| Inventory / sell / payment | Forms scroll; long Spanish copy; decimal inputs |
| Sheets / modals | Attachment sheet, filters, contact picker, timezone picker |
| Elevation | Cards and dock show Android elevation (not only iOS shadows) |
| Font / display scale | Large system font still usable (no truncated primary CTAs) |

Prefer shared styles / `Platform.select` over `.android.tsx` unless a screen needs a large Android-only tree.

## Android Back semantics

Expected order:

1. Close modal / sheet / picker (`onRequestClose` + `useAndroidBackHandler`)
2. Pop nested route
3. Confirm discard on dirty profile edits (`useAndroidUnsavedBack`)
4. Do not return to auth after login
5. Exit app only from authenticated tab roots (`useAndroidRootExitBack`)

## Permissions matrix

| Feature | API | Deny / “Don’t ask again” |
| --- | --- | --- |
| Camera | `expo-image-picker` / `expo-camera` | `showPermissionDeniedAlert('camera')` → Ajustes |
| Photos | `expo-image-picker` | `showPermissionDeniedAlert('photos')` |
| Mic | `expo-audio` | `showPermissionDeniedAlert('microphone')` |
| Contacts (READ) | `expo-contacts` | `showPermissionDeniedAlert('contacts')`; WRITE blocked in app.json |
| Notifications | `expo-notifications` | Spanish channels + deny → Ajustes |

Do **not** declare unused location / calendar / biometrics permissions.

## Notifications (FCM)

1. Create Firebase Android app for `com.nexolia.owner`
2. Place real `apps/mobile/google-services.json` (see `.example`)
3. `eas credentials` → upload FCM / Google service account for Android
4. Channels created in Spanish at startup: `tareas`, `ventas`, `stock`, `pagos` (`androidNotificationChannels.ts`)
5. Cold / background / foreground tap + deep link smoke

## Integrations checklist (Android-only)

- [ ] WhatsApp `wa.me` / package visibility (`HelpSupportScreen`)
- [ ] `tel:` / `mailto:` / browser
- [ ] Supabase OTP + email magic links
- [ ] Scheme `baas-owner://` (intent filter in `app.json`)
- [ ] Share sheet / PDF if in scope
- [ ] Barcode / QR scan (`BarcodeScannerScreen`)
- [ ] Clipboard paste into forms
- [ ] Camera / gallery for Copi + inbox images

## Lifecycle / restoration

| Scenario | Expected |
| --- | --- |
| Background mid-sale | Cart restored from provider or clear message |
| WhatsApp round-trip | Return to same screen |
| Camera round-trip | Pending image retained when possible |
| Process death | SecureStore session survives; forms may discard with confirmation |
| Offline mid-save | Error banner; no double charge on retry where API is idempotent |
| Notification reopen | Lands on task / conversation when payload present |

## Performance

- Inbox list uses `FlatList` virtualization
- Inventory lists remain paginated (`MANAGE_STOCK_PAGE_SIZE`)
- Prefer lower image `quality` on camera/gallery picks (already ~0.8)

## Accessibility

- ~48dp targets on primary tabs / center sell action / attachment circles
- TalkBack labels on icon-only controls (extend as punch-list items appear)
- Status not conveyed by color alone where badges exist

## Device matrix (minimum)

| Device class | Nav | Font / display | Network |
| --- | --- | --- | --- |
| Small phone | 3-button | Default + large | Wi-Fi |
| Mid-range | Gesture | Default | Wi-Fi + cellular |
| Lower-end physical | Either | Large display size | Slow / interrupted |
| Large phone | Gesture | Default | Wi-Fi |

Tablet: usable portrait without full tablet IA. Landscape only where already supported.

## Definition of done (physical Android)

Registration/login OTP · products/stock · customers · sales/cart/payment · invoices/quotes if shipped · notifications (if FCM enabled) · WhatsApp inbox text+images · Copi text/voice/image · camera scan.
