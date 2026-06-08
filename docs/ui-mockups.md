# UI Mockups

This document tracks the React, Tailwind, and HTML mockup workspace for the Nexolia
mobile and desktop screen design phase.

## Scope

The static prototype lives in `apps/ui-mockups` and supports two surfaces:

- Mobile routes based on `/Users/souviksamanta/Documents/Nexolia/Nexolia mocks/Mobile`.
- Desktop routes based on `/Users/souviksamanta/Documents/Nexolia/Nexolia mocks/Desktop`.

The prototype uses representative static data so visual hierarchy, spacing,
component states, and navigation can be reviewed before production data wiring.

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
- Mobile Confluence page: `Mobile UI Mockups and App Screen design`
- Desktop Confluence page: `Desktop UI Mockups and App Screen design`
