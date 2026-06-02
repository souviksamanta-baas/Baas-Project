# WhatsApp Webhook

This document tracks the Phase 0 WhatsApp webhook work for `KAN-8`.

## Scope

Phase 0 proved WhatsApp Cloud API connectivity. Phase 1 adds durable webhook
event persistence so duplicate detection survives deploys and process restarts.
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
deduplication for every received message ID.

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
