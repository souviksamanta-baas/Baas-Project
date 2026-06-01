# WhatsApp Webhook

This document tracks the Phase 0 WhatsApp webhook work for `KAN-8`.

## Scope

Phase 0 proves WhatsApp Cloud API connectivity without building the full inbox
or persistence pipeline. The NestJS API exposes:

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

For each inbound message, Phase 0 logs:

- `messageId`
- `senderPhone`
- `phoneNumberId`
- `timestamp`
- `messageType`
- `duplicate`

Message content is intentionally not logged. Phase 1 will persist messages with
tenant mapping and database-level deduplication.

## Duplicate Deliveries

The Phase 0 API recognizes duplicate message IDs in process and marks repeated
deliveries with `duplicate: true` in structured logs. This is enough for webhook
validation. Phase 1 will use the database unique constraint on
`(organization_id, whatsapp_message_id)` when message persistence is added.

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
- Duplicate webhook deliveries are recognized in process.
- Server secrets are documented and read only from environment variables.
