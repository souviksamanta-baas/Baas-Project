# UI Mockups

This document tracks the React, Tailwind, and HTML mockup workspace for the Nexolia
mobile and desktop screen design phase.

## Scope

The static prototype lives in `apps/ui-mockups` and supports two surfaces:

- Mobile routes based on `/Users/souviksamanta/Documents/Nexolia/Nexolia mocks/Mobile`.
- Desktop routes based on `/Users/souviksamanta/Documents/Nexolia/Nexolia mocks/Desktop`.

The current prototype is being revised screen-by-screen for visual parity. The
first committed version was a structural prototype, not a pixel-perfect match.
Jira has been reopened for parity work, starting with the mobile `Inicio` screen.

During parity work, each implemented screen should be reviewed against its source
image before the related Jira issue is closed again.

## Visual Review Workflow

Run the prototype locally:

```bash
npm run dev:ui-mockups
```

For the active screen, compare:

- Target reference image from the source folder.
- React/Tailwind implementation.
- Spacing, typography, colors, radius, shadows, icons, avatar/robot assets, and
  screen frame dimensions.

Do not mark a screen as complete until visual review is accepted.

## Branding Guidance

Use the `Nexolia Branding details` Confluence parent page as the design source of
truth for future mockups:

`https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/7241737/Nexolia+Branding+details`

The related branding pages define Nexolia as a mobile-first intelligent business
platform for small and medium business owners. Mockups should feel smart but not
technical, professional but approachable, calm, organized, business-focused, and
friendly for non-technical users.

Apply these rules during screen-by-screen design:

- Use a clean rounded sans-serif style such as Inter, SF Pro, or Plus Jakarta Sans.
- Prefer lightweight, readable typography optimized for small screens.
- Use the Nexolia wordmark, primary emerald accents, dark navy text, and muted slate
  secondary text consistently.
- Keep layouts mobile-native, spacious, calm, and action-oriented.
- Present AI assistance as supportive and practical, not overly technical.
- Use cards, subtle borders, soft shadows, and rounded corners to keep the interface
  approachable and organized.
- Treat visual parity with the provided image mockups as the immediate acceptance
  criteria, while using the branding documentation for all new design decisions.

## Confirmed Mobile Inicio and Chats Baseline

The current mobile `Inicio` and **Chats** (legacy mockup name: Inbox) screens are
the visual baseline for list/card language and should be reused as the component
reference for upcoming mobile screens.

Reusable confirmed components:

- Sticky iPhone-style header with status indicators, Nexolia wordmark image,
  tagline, notification icon (**26px**, same as Más menu icons), and profile avatar.
- Header must cover the top edge of the scroll area so content never passes behind
  a visible gap. Non-home screens collapse to mark + centered page title on scroll.
- Copi assistant card with soft tinted background, subtle border, rounded radius,
  left-aligned larger robot illustration, constrained text column, and separate
  non-overlapping chat action button.
- Copi robot includes the green antenna touching the head, black face, green eyes,
  small smile, small near-white side ears, side hands, green oval body badge with
  infinity mark, and visible soft shadow.
- Typography follows WhatsApp / iOS Large Title conventions in
  `design-system/tokens/typography.ts` (page titles ~34, list titles ~17,
  section titles ~18).
- **Search rows (Chats, Gestionar stock, Ventas):** use a single bordered shell
  (icon + input). Focus highlights the **entire shell** in primary emerald
  (`#08bd66`); the inner input has no separate focus ring. Implemented in
  `SearchField` / `SearchActionRow` — see `docs/mobile-design-system.md`.
- `Resumen del día` metrics use plain tone-colored icons (no heavy circular wells),
  2×2 grid, and section title ~18px.
- Conversation rows use **54px** avatars, channel badges, **inset separators**
  (start after avatar), and `spacing.md` gap before text.
- Card-to-card vertical rhythm uses **`boxGap: 20`**.
- **Bottom nav:** floating white pill with **equal 16px** side and bottom insets;
  tab icons **32px** charcoal; selected grey pill behind **icon only**; center
  green `$` FAB with white ring shadow; frosted semi-transparent gutters. Not a
  full-bleed dock glued to the phone frame.
- Channel markers use vector-style WhatsApp, Instagram, Facebook, and purple
  email logos. Shared by Inicio conversation rows and Chats list rows.
- The Chats filter button uses the accepted vector slider icon style, and the
  search/chip/tab/list components should be reused for later messaging screens.
- Conversation detail and Copi chat use lighter, less prominent outer borders,
  sticky profile headers below the shared app header, and tighter message bubbles
  with reduced padding so each message box hugs the content more closely.
- Copi chat should not show a standalone page title above the thread. The chat
  header carries the Copi identity, using the smaller `CopiRobotAvatar` treatment
  so the robot reads as a profile image.
- Feature release visibility is controlled in `apps/ui-mockups/src/mockups.tsx`
  through `mockupFeatureVisibility` and `FeatureGate`. Set a feature key to
  `false` to hide that page block while keeping the component code available for
  later rollout.

Visual review is performed locally with `npm run dev:ui-mockups` by comparing
each route against its source PNG in the Nexolia mocks folder. Live Expo app
polish (Jul 2026) supersedes older mockup footer sizes where noted above.

## Confirmed Mobile Inventory and POS Baseline

The eight inventory and POS mobile mockups under [KAN-217](https://souviksamanta.atlassian.net/browse/KAN-217) were visually reviewed and accepted on 2026-06-18. Reuse these screens as the component reference for future inventory, stock, and POS work.

Accepted routes:

| Route id | Screen |
| --- | --- |
| `mobile-manage-stock` | Gestionar stock |
| `mobile-product-detail` | Producto |
| `mobile-edit-product` | Editar producto |
| `mobile-edit-subproduct` | Editar subproducto |
| `mobile-add-stock` | Agregar stock |
| `mobile-delete-product` | Eliminar producto |
| `mobile-sell-products` | Vender productos |
| `mobile-confirm-payment` | Confirmar cobro |

Implementation files:

- `apps/ui-mockups/src/inventory-mockups.tsx`
- `apps/ui-mockups/src/pixel-primitives.tsx`
- `apps/ui-mockups/src/mockups.tsx`

Reusable confirmed patterns from this batch:

- 18px page titles across mobile screens.
- Shared `PixelBottomNav` with Home, Inbox, green `$`, Copi, and hamburger `Más` icons.
- Inbox-style icon-only filter button for list screens.
- Product summary cards, status badges, form fields, and action button rows.
- Inventory list rows with 15px edit/delete icons and 17px add icon.
- Product detail subproducts reuse the Gestionar stock inventory list row pattern.
- Product detail lotes y precios table uses three columns: combined lote/date/qty,
  combined costo/precio, and estado badges aligned to brand colors.
- Product detail action bar uses blue (`#3978e8`) for Editar producto.
- Product detail sections for movimientos, barcode, and notes.

## React Native Inventory and POS Implementation

The approved mockups above were translated into static Expo React Native screens
under [KAN-226](https://souviksamanta.atlassian.net/browse/KAN-226) (Done
2026-06-20). Reuse `apps/mobile/src/components/inventoryUi.tsx` and
`apps/mobile/src/components/icons.tsx` for future inventory and POS work in the
owner app.

Documented in `docs/mobile-app.md`. Epic
[KAN-201](https://souviksamanta.atlassian.net/browse/KAN-201) remains open for
API integration and additional RN screens.

## Verified Mobile Image Inventory

| File | Screen/state |
| --- | --- |
| `Inicio.png` | Home dashboard |
| `inicio___sucursales_nexolia_logo.png` | Home dashboard with business-center dropdown |
| `inbox_nexolia_logo.png` | Inbox conversation list |
| `inbox_extended_nexolia_logo.png` | Conversation detail thread |
| `copi_nexolia_logo.png` | Copi landing and suggested questions |
| `copi_extended_nexolia_logo.png` | Copi active chat |
| `notifications_nexolia_logo.png` | Notifications |
| `Menu - Mas.png` | More menu |
| `Mi cuenta.png` | My Account |
| `Gestionar stock.png` | Inventory list and stock management |
| `Productos_granel.png` | Product detail (granel) |
| `Editar producto.png` | Edit base product |
| `Editar subprod.png` | Edit subproduct |
| `Agregar stock.png` | Add stock intake |
| `Eliminar producto.png` | Delete product confirmation |
| `Vender productos.png` | POS sell products |
| `Confirmar cobro.png` | Confirm payment |

## Verified Desktop Image Inventory

| File | Screen/state |
| --- | --- |
| `Inicio.png` | Home dashboard |
| `Inicio_Sucursales.png` | Home dashboard with business-center dropdown |
| `Inbox.png` | Inbox conversation list |
| `Inbox - extended.png` | Conversation detail thread |
| `Copi.png` | Copi landing and suggested questions |
| `Copi - extended.png` | Copi active chat |
| `Notificaciones.png` | Notifications |
| `Menu - Mas.png` | More menu |
| `Mi cuenta.png` | My Account |

## Commands

Run the prototype locally:

```bash
npm run dev:ui-mockups
```

Typecheck:

```bash
npm run typecheck --workspace @baas/ui-mockups
```

Build:

```bash
npm run build --workspace @baas/ui-mockups
```

## Jira and Confluence

- Mobile epic: `KAN-170`
- Desktop epic: `KAN-171`
- Inventory and POS mockup story: `KAN-217` (Done)
- Inventory/POS mockup subtasks: `KAN-218` through `KAN-225` (Done)
- Inventory/POS RN story: `KAN-226` (Done)
- Inventory/POS RN subtasks: `KAN-227` through `KAN-234` (Done)
- Mobile mockup prototype story: `KAN-172` (Done)
- RN implementation epic: `KAN-201` (In Progress)
- Mobile Confluence page: `Mobile UI Mockups and App Screen design`
- Desktop Confluence page: `Desktop UI Mockups and App Screen design`
