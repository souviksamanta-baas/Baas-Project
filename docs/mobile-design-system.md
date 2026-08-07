# Mobile Design System (Nexolia)

Shared UI tokens and components for the Expo owner app live in
`apps/mobile/src/design-system`. Prefer importing from `../design-system` (or the
package alias) in new screens instead of ad-hoc styles in feature files.

Token source of truth for brand values: [Nexolia Design system](https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/7307297/Nexolia+Design+system)
(parent: [Nexolia](https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/7241737/Nexolia)).

**Implemented RN values** in `apps/mobile/src/design-system/tokens/*` are the
runtime source of truth when they differ slightly from older marketing hexes on
Confluence (e.g. primary green `#08bd66` in app vs `#0A9E56` in early brand docs).

## Tokens

| Token file | Contents |
| --- | --- |
| `tokens/colors.ts` | Brand, text, border, semantic, channel, **separator**, **tabActive / tabInactive** |
| `tokens/spacing.ts` | 4px scale; **`boxGap: 20`** for card/list vertical rhythm; `layout.bottomNavClearance` |
| `tokens/typography.ts` | WhatsApp / iOS Large Title scale (page ~34, list ~17, section ~18, tab ~10–11) |
| `tokens/radius.ts` | Corner radii including dock pill |
| `tokens/shadows.ts` | Card and dock elevation |

### Key color tokens (runtime)

| Token | Hex / value | Usage |
| --- | --- | --- |
| `primary` | `#08bd66` | CTAs, Más menu icons, `$` FAB, success |
| `navy` / `textPrimary` | `#101935` | Titles, primary copy |
| `separator` | `rgba(60, 60, 67, 0.18)` | Inset list dividers (WhatsApp-style) |
| `tabInactive` | `#3a3a3c` | Bottom tab icons/labels (inactive) |
| `tabActive` | `#1c1c1e` | Bottom tab icons/labels (selected) |

## Layout primitives

| Component | Use |
| --- | --- |
| `Screen` / `ScreenContent` | Page scroll shell; content gap uses `spacing.boxGap` (20); bottom padding uses `layout.bottomNavClearance` when the floating dock overlays content |
| `ScreenHeader` / `ScreenTitle` | Title + optional back + subtitle; collapsed header title on scroll |
| `ListBox` | Bordered section with title and optional header meta |
| `SectionCard` / `Card` | Card blocks; use `flush` for menu / list groups |
| `ActionRow` | Más / settings rows: brand-green outline icon (26), regular-weight title (17), inset divider, large chevron |
| `ConversationRow` / `NotificationRow` | Chats / home lists: 54px avatar, inset divider after avatar, `spacing.md` gap before text |

## Owner shell patterns (Jul 2026)

### Bottom navigation

Implementation: `BottomNavigation` in `components/ui.tsx`.

**iOS / web — floating pill dock**

| Rule | Value |
| --- | --- |
| Side + bottom edge inset | **16px equal** (matches WhatsApp floating tab bar) |
| Dock height | ~66 |
| Edge veil | Frosted blur + light tint in the 16px gutters (`expo-blur`) |
| Overlay | Absolute over content; screens reserve `layout.bottomNavClearance` (~100) |

**Android only — edge-to-edge tab bar** (Instagram / Facebook style)

| Rule | Value |
| --- | --- |
| Width | Full bleed (no side insets, square corners) |
| Height | `layout.tabBarHeight` (56) + `SafeAreaInsets.bottom` |
| System nav | Bar sits **above** gesture / 3-button nav via safe-area padding |
| Chrome | Top hairline + elevation; no floating pill / gutter blur |
| Center Copi | Flush with other tabs (no protruding FAB) |
| Content clearance | `getBottomNavClearance(insets.bottom)` |

Shared tab rules: icons **32px**, stroke ~1.55; selected grey pill behind icon; labels **Inicio**, **Chats**, **Copi**, **Más**. Route id for chats remains `inbox` / `/(app)/inbox`.

### Status bar (Android-only)

Light app chrome (`colors.background` / `#fbfcfb`) requires **dark** status icons on Android:

| Setting | Value |
| --- | --- |
| `app.json` → `androidStatusBar.barStyle` | `dark-content` |
| `androidStatusBar.backgroundColor` | `#fbfcfb` |
| `androidStatusBar.translucent` | `true` |
| Root `app/_layout.tsx` | `StatusBar` `dark-content` + matching background (iOS stays default / unchanged) |

Do not use `light-content` with a dark status bar background — icons become invisible on the light header.

### Header

- Notification bell matches Más row icons: **26px**, stroke 1.7.
- Collapsed scroll header shows page title (e.g. **Chats**); FlatList screens must call `useHeaderCollapseOnScroll`.

### Más menu

- No section group titles (Inventarios / Operaciones removed from UI).
- Flat card groups: inventory + Facturación + Caja; Integraciones + Proveedores; Privacidad + Ayuda at bottom.
- **Compras** is an expandable parent row (chevron up/down) with children Gestionar compras and Cargar compra.
- Brand-green outline icons; privacy uses `shield`.
- WhatsApp-style inset subdividers between rows; tighter horizontal padding (~10–14).
- Bottom action sheets (`MobileContainedModal`) use text action lines (not Apply/Cancel) for purchase status/edit.

### Lists (Chats, home conversaciones, Copi suggestions)

- Inset hairline separators start after the leading icon/avatar (not full-bleed).
- Avatar ↔ text gap: `spacing.md` (16) so channel badges do not crowd previews.

## Inputs

### SearchField / SearchActionRow

Used on **Chats** (Inbox route), **Gestionar stock**, and **Ventas** (via `SearchFilterRow` →
`SearchActionRow`).

**Visual rule:** the border belongs on the **parent shell** that wraps the search
icon and text input together. On focus, only that shell highlights — not the inner
`TextInput`.

| State | Border |
| --- | --- |
| Default | `colors.borderInput` (`#dfe7ec`), 1px, 10px radius, 36px height |
| Focused | `colors.primary` (`#08bd66`) on the full shell |

**Native (iOS/Android):** `onFocus` / `onBlur` toggle `searchFieldShellFocused` on
the shell `View`.

**Web:** the shell receives `data-search-field-shell`. Global CSS uses
`:focus-within` so the shell border turns primary green when the input is focused.
Inner inputs have no border, outline, or box-shadow (avoids a nested focus ring).

CSS is injected at module load in `Input.tsx` and mirrored in `app/+html.tsx` for
SSR.

**SearchActionRow** composes `SearchField` with optional camera and filter icon
buttons (inventory screens).

### ComposerInput (Copi only)

Copi chat composer is intentionally different: the **leading icon sits outside** the
field, and the **border + focus ring live on the `TextInput`**, not a wrapper shell.

Do not reuse `ComposerInput` for chats/inventory search rows.

### TextField / DisplayField

Form labels and editable/read-only fields for inventory edit flows. Focus uses
`inputFocused` / `displayBoxHighlight` on the field box itself.

## Buttons

`PrimaryButton`, `SecondaryButton`, `OutlineButton`, `DangerButton`, `GhostButton`
— see `components/Button.tsx`.

## Where to import

```tsx
import { SearchActionRow, ListBox, colors, spacing, layout } from '../design-system';
```

Legacy `mobileUiStyles.ts` and duplicate styles in `inventoryUi.tsx` (e.g.
`searchInput`) are deprecated; use design-system components for new work.

## Related docs

- `docs/mobile-app.md` — app structure, Expo Router navigation, local commands
- `docs/ui-mockups.md` — static mockup baseline and visual review workflow
- Confluence: [React Native Design System Implementation](https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/14221315/React+Native+Design+System+Implementation)
- Confluence: [Owner app UI polish (Jul 2026)](https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/28835842/Owner+app+UI+polish+Jul+2026)
- Confluence: [Compras — Cargar y gestionar (Owner app)](https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/30769153/Compras+Cargar+y+gestionar+Owner+app)
