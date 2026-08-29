# CRM lead status tags

Contact lead tags shown in **Home → Conversaciones recientes**, **Chats**, and
conversation threads come from `contacts.lead_status`.

## UI labels (Spanish)

| `lead_status` | Badge in app |
| --- | --- |
| `new` | Nuevo |
| `opportunity` | Oportunidad |
| `active` | Seguimiento pendiente |
| `cold` | *(no badge — never show “Frío”)* |
| `won` | Ganado |
| `lost` | Perdido |
| `finished` | Terminado |

Mapping: `apps/mobile/src/lib/inboxPresentation.ts` → `leadStatusLabel()`
(`cold` returns `undefined`).

## Lifecycle (KAN-313)

1. **Nuevo (`new`):** first inbound creates/upserts the contact (default).
2. **Seguimiento pendiente (`active`):** owner outbound WhatsApp reply promotes
   `new` → `active` (`promoteNewToActive` in
   `whatsapp-conversation-message.repository.ts`).
3. **cold (hidden):** maintenance idle sweep (`tasks.service` `markContactsCold`)
   sets `cold` + `cold_at`. UI shows no legend.
4. **Oportunidad (`opportunity`):** on inbound, if contact is `cold` and
   `cold_at` is older than **365 days**, promote to `opportunity`.
5. **Ganado / Perdido / Terminado:** only via message long-press →
   **Cambiar estado a** (manual; never offer Frío or Nuevo in that submenu).

## Filters (KAN-318)

- **Nuevo** = `lead_status = new`
- **Oportunidad** = `lead_status = opportunity`
- Do not expose a **Frío** chip in the Chats filter sheet

## Schema

- `contacts.lead_status` includes `opportunity` and `finished`
  (migration `20260828210000_chats_whatsapp_like_ux.sql`)
- `contacts.cold_at` — set when status → `cold`
- `contacts.lead_status_changed_at` — audit timestamp

## Related stories

Epic [KAN-313](https://souviksamanta.atlassian.net/browse/KAN-313):

| Story | Summary |
| --- | --- |
| [KAN-314](https://souviksamanta.atlassian.net/browse/KAN-314) | Promote `new` → `active` on owner outbound reply |
| [KAN-315](https://souviksamanta.atlassian.net/browse/KAN-315) | Sync contact status from AI draft generation (optional follow-up) |
| [KAN-316](https://souviksamanta.atlassian.net/browse/KAN-316) | Manual **Cambiar estado a**: Ganado / Perdido / Terminado |
| [KAN-317](https://souviksamanta.atlassian.net/browse/KAN-317) | Document lifecycle + cold-sweep ops |
| [KAN-318](https://souviksamanta.atlassian.net/browse/KAN-318) | Align inbox **Nuevo** / **Oportunidad** filters; hide Frío |
