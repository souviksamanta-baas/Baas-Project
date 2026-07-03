# CRM lead status tags

Contact lead tags shown in **Home → Conversaciones recientes**, **Inbox**, and
conversation threads come from `contacts.lead_status`.

## UI labels (Spanish)

| `lead_status` | Badge in app |
| --- | --- |
| `new` | Nuevo lead |
| `active` | Seguimiento |
| `cold` | Frío |
| `won` | Ganado |
| `lost` | Perdido |

Mapping: `apps/mobile/src/lib/inboxPresentation.ts` → `leadStatusLabel()`.

## Current behavior (Jul 2026)

- New WhatsApp contacts default to `lead_status = 'new'` on first inbound message.
- Inbound contact upsert does **not** promote status on later messages.
- AI draft generation sets `lead_status` on `ai_drafts` rows only — **not** on
  `contacts`, so the UI badge stays **Nuevo lead** even after owner replies.
- `tasks.service` `markContactsCold()` can set `cold` when
  `POST /tasks/run-maintenance` runs (requires `BAAS_TASKS_JOB_SECRET`).

## Planned work

Epic [KAN-313](https://souviksamanta.atlassian.net/browse/KAN-313):

| Story | Summary |
| --- | --- |
| [KAN-314](https://souviksamanta.atlassian.net/browse/KAN-314) | Promote `new` → `active` on owner outbound reply |
| [KAN-315](https://souviksamanta.atlassian.net/browse/KAN-315) | Sync contact status from AI draft generation |
| [KAN-316](https://souviksamanta.atlassian.net/browse/KAN-316) | Manual status picker in thread |
| [KAN-317](https://souviksamanta.atlassian.net/browse/KAN-317) | Document lifecycle + cold-sweep ops |
| [KAN-318](https://souviksamanta.atlassian.net/browse/KAN-318) | Align inbox **Nuevo** filter with semantics |

## Schema

`contacts.lead_status` — `supabase/migrations/20260605193500_create_contacts_crm_foundation.sql`
