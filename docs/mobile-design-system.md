# Mobile Design System (Nexolia)

Shared UI tokens and components for the Expo owner app live in
`apps/mobile/src/design-system`. Prefer importing from `../design-system` (or the
package alias) in new screens instead of ad-hoc styles in feature files.

Token source of truth for brand values: [Nexolia Branding details](https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/7241737/Nexolia+Branding+details).

## Tokens

| Token file | Contents |
| --- | --- |
| `tokens/colors.ts` | Brand, text, border, semantic colors (`primary` `#08bd66`, `borderInput` `#dfe7ec`, …) |
| `tokens/spacing.ts` | 4px scale; `boxGap: 10` for list/card vertical rhythm |
| `tokens/typography.ts` | Field labels, titles, body text styles |
| `tokens/radius.ts` | Corner radii |
| `tokens/shadows.ts` | Card and elevation shadows |

## Layout primitives

| Component | Use |
| --- | --- |
| `Screen` / `ScreenContent` | Page scroll shell; content gap uses `spacing.boxGap` |
| `ScreenHeader` | Title + optional back + subtitle |
| `ListBox` | Bordered section with title and optional header meta |
| `SectionCard` | Card block for grouped form/content |

## Inputs

### SearchField / SearchActionRow

Used on **Inbox**, **Gestionar stock**, and **Ventas** (via `SearchFilterRow` →
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

Do not reuse `ComposerInput` for inbox/inventory search rows.

### TextField / DisplayField

Form labels and editable/read-only fields for inventory edit flows. Focus uses
`inputFocused` / `displayBoxHighlight` on the field box itself.

## Buttons

`PrimaryButton`, `SecondaryButton`, `OutlineButton`, `DangerButton`, `GhostButton`
— see `components/Button.tsx`.

## Where to import

```tsx
import { SearchActionRow, ListBox, colors, spacing } from '../design-system';
```

Legacy `mobileUiStyles.ts` and duplicate styles in `inventoryUi.tsx` (e.g.
`searchInput`) are deprecated; use design-system components for new work.

## Related docs

- `docs/mobile-app.md` — app structure, Expo Router navigation, local commands
- `docs/ui-mockups.md` — static mockup baseline and visual review workflow
