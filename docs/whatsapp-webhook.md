# WhatsApp Webhook

This document tracks the Phase 0 WhatsApp webhook work for `KAN-8`.

## Scope

Phase 0 proved WhatsApp Cloud API connectivity. Phase 1 adds durable webhook
event persistence so duplicate detection survives deploys and process restarts.
Phase 2 adds owner-visible connection status for the WhatsApp Business number.
The NestJS API exposes:

- `GET /webhooks/whatsapp` for Meta webhook verification.
- `POST /webhooks/whatsapp` for inbound webhook payload receipt and structured
  logging.
- `GET /health` for deployment health checks.

## Server Environment Variables

| Variable | Purpose |
| --- | --- |
| `API_PORT` | Local or hosted API port. Defaults to `3000`. |
| `WHATSAPP_VERIFY_TOKEN` | Shared token used by Meta during webhook setup. |
| `WHATSAPP_APP_SECRET` | Meta app secret used to validate `x-hub-signature-256`. |
| `WHATSAPP_WEBHOOK_PATH` | Documented webhook path, default `/webhooks/whatsapp`. |
| `SUPABASE_URL` | Server-side Supabase project URL used for event persistence. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used by the API to persist webhook events. |

Do not expose these values to the Expo/mobile client. Store real values only in
ignored local env files or deployment secret stores.

## Connection Status

WhatsApp Business connection metadata is stored in:

```text
public.whatsapp_config
```

The table remains service-role only because it can contain server-side
integration metadata and encrypted access tokens. Phase 2 adds safe status
fields:

- `display_phone_number`
- `connection_status` (`pending`, `connected`, `error`, `disabled`)
- `verified_at`
- `disconnected_at`
- `last_error`
- `last_status_check_at`

The owner mobile dashboard does not read `whatsapp_config` directly. It calls
`get_owner_dashboard`, which returns a safe `whatsappConnection` object with
connection state and non-secret display metadata only.

## Meta Verification Flow

Meta calls:

```text
GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<challenge>
```

The API reads `WHATSAPP_VERIFY_TOKEN` from server env. If the mode is
`subscribe` and the token matches, it returns the challenge string. Invalid
requests are rejected with `403`.

## Inbound Payload Handling

Meta sends inbound events to:

```text
POST /webhooks/whatsapp
```

The API validates `x-hub-signature-256` when `WHATSAPP_APP_SECRET` is
configured. In production, missing `WHATSAPP_APP_SECRET` rejects requests.

For each inbound message, the API persists and logs:

- `messageId`
- `senderPhone`
- `phoneNumberId`
- `timestamp`
- `messageType`
- `duplicate`

Message content is intentionally not logged. Phase 1 persists safe event
metadata with tenant mapping when a WhatsApp config exists and database-level
deduplication for every received message ID. Phase 2 also stores message bodies
in tenant-scoped conversation history when the inbound phone number maps to a
configured organization.

## Event Persistence

Inbound message events are stored in:

```text
public.whatsapp_message_events
```

The table stores:

- `organization_id`
- `whatsapp_config_id`
- `phone_number_id`
- `message_id`
- `sender_phone`
- `message_type`
- `message_timestamp`
- `processing_status`
- `payload_metadata`
- first/last received timestamps

The API resolves `organization_id` and `whatsapp_config_id` from
`whatsapp_config.phone_number_id` when a matching config exists. If a config does
not exist yet, the event is still deduplicated by `phone_number_id` and
`message_id`.

The table is service-role only. Mobile clients and authenticated user sessions do
not receive direct table grants.

## Conversation and Message Persistence

Phase 2 stores customer-visible message history in:

```text
public.contacts
public.conversations
public.conversation_messages
```

`contacts` stores one CRM identity per organization/contact phone number.
`conversations` tracks one WhatsApp thread per organization/contact phone number
and links to the contact record. `conversation_messages` stores inbound and
outbound message records with:

- `organization_id`
- `conversation_id`
- `direction` (`inbound`, `outbound`)
- `external_message_id`
- sender/recipient phone metadata
- `message_type`
- `body`
- `message_status`
- received/sent/failed timestamps

Authenticated users can select only rows for organizations they belong to. Writes
remain server-owned through the API service role so mobile clients cannot forge
conversation history.

Inbound webhook processing upserts the contact before linking/upserting the
conversation. Unknown WhatsApp numbers therefore become CRM contacts
automatically, and existing numbers update `last_seen_at` and conversation
metadata without duplicating the contact.

`conversation_messages` is added to the `supabase_realtime` publication when the
publication exists, allowing the mobile inbox to subscribe to tenant-scoped
message changes in later inbox work.

## Outbound Sends

`WhatsAppOutboundMessageService` sends text messages through the WhatsApp Cloud
API from the server only:

```text
POST https://graph.facebook.com/v20.0/{phone_number_id}/messages
```

The service loads the connected WhatsApp configuration by organization, sends
with the server-side access token, and persists a `sent` or `failed` outbound
message record. Mobile code does not call Meta APIs directly and does not receive
WhatsApp access tokens.

## Duplicate Deliveries

Durable duplicate detection uses the database unique constraint on:

```text
(phone_number_id, message_id)
```

The webhook handler inserts the event before downstream processing. If Postgres
returns a unique-constraint conflict, the API marks the event as
`duplicate: true`, updates `last_received_at`, and continues without treating the
duplicate delivery as a service failure.

The API no longer uses an unbounded in-memory `Set` as the dedupe source of
truth. This means duplicate protection survives Railway restarts and memory does
not grow with every historical WhatsApp message ID. A bounded cache can still be
added later as a performance hint, but persistent event storage remains the
source of truth.

## Local Commands

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Start the API:

```bash
npm run dev:api
```

## Verification Status

For KAN-8, completion is verified when:

- The verification route accepts a valid Meta challenge and rejects invalid
  tokens.
- The POST handler validates signatures when an app secret is configured.
- Inbound WhatsApp payload parsing extracts safe Phase 0 log fields.
- Duplicate webhook deliveries are recognized through persistent event storage.
- Server secrets are documented and read only from environment variables.
