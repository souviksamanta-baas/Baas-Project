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

## Confirmed Mobile Inicio and Inbox Baseline

The current mobile `Inicio` and `Inbox` mockups are accepted as the final visual
baseline for these pages and should be reused as the component reference for
upcoming mobile screens.

Reusable confirmed components:

- Sticky iPhone-style header with status indicators, Nexolia wordmark image,
  tagline, notification icon, shop icon, centered chevron, and 30px profile holder.
- Header must cover the top edge of the scroll area so content never passes behind
  a visible gap.
- Copi assistant card with soft tinted background, subtle border, rounded radius,
  left-aligned larger robot illustration, constrained text column, and separate
  non-overlapping chat action button.
- Copi robot includes the green antenna touching the head, black face, green eyes,
  small smile, small near-white side ears, side hands, green oval body badge with
  infinity mark, and visible soft shadow.
- Typography utilities in the mockup intentionally map `.font-extrabold` to 600
  and `.font-medium` to 300 for closer visual parity with the supplied images.
- `Resumen del dia` metrics use 18px icons inside soft tone-matched circular
  backgrounds, 12px metric values, left-aligned icon/value/label groups, and
  subtle vertical dividers.
- Conversation rows, inventory CTA, alert rows, cards, borders, and shadows should
  follow the accepted `Inicio` spacing, muted slate text treatment, and rounded
  white/tinted card language.
- The mobile bottom nav is fixed to the phone frame, not part of the scrollable
  content. Footer SVG icons are normalized to 22px by CSS, and selected and
  unselected icon states reuse the same SVG structure with only color/fill
  treatment changing.
- `Inbox` reuses the same header, footer, channel logo badges, typography weight
  mapping, card radius, soft borders, and muted slate text treatment from
  `Inicio`.
- Channel markers use vector-style WhatsApp, Instagram, Facebook, and purple
  email logos. These markers are shared by `Inicio` conversation rows and
  `Inbox` message rows.
- The Inbox filter button uses the accepted vector slider icon style, and the
  search/chip/tab/list components should be reused for later inbox-related
  screens.
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
each route against its source PNG in the Nexolia mocks folder.

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
- Inventory/POS subtasks: `KAN-218` through `KAN-225` (Done)
- Mobile Confluence page: `Mobile UI Mockups and App Screen design`
- Desktop Confluence page: `Desktop UI Mockups and App Screen design`
