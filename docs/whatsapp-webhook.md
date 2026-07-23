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

Copi (owner AI assistant) is **not** a webhook. Owner Copi traffic uses
authenticated REST endpoints under `/ai/copilot/*`. Inbound WhatsApp webhooks may
still trigger `SalesAiService` draft generation for **customer** replies; that is
separate from Copi. See `docs/copi-architecture.md` and `docs/api-deployment.md`.

## Server Environment Variables

| Variable | Purpose |
| --- | --- |
| `API_PORT` | Local or hosted API port. Defaults to `3000`. |
| `WHATSAPP_VERIFY_TOKEN` | Shared token used by Meta during webhook setup. |
| `WHATSAPP_APP_SECRET` | Meta app secret used to validate `x-hub-signature-256`. |
| `WHATSAPP_CLOUD_ACCESS_TOKEN` | Meta Cloud API token used to verify phone numbers during owner connection registration and to send outbound messages. |
| `WHATSAPP_WEBHOOK_PATH` | Documented webhook path, default `/webhooks/whatsapp`. |
| `SUPABASE_URL` | Server-side Supabase project URL used for event persistence. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used by the API to persist webhook events. |
| `BAAS_WEBHOOK_RATE_LIMIT_MAX` | Request limit for the public WhatsApp webhook throttle window. |
| `BAAS_WEBHOOK_RATE_LIMIT_TTL_MS` | WhatsApp webhook throttle window in milliseconds. |

Copi owner endpoints (`/ai/copilot/*`) use the global API throttle and Supabase
JWT auth, not the webhook path or `WHATSAPP_*` signature validation. Copi may use
`OPENAI_API_KEY` on the API service for LLM/voice/vision (see `docs/environment.md`).

Do not expose these values to the Expo/mobile client. Store real values only in
ignored local env files or deployment secret stores.

## Platform WABA vs merchant WABA

| WABA | Env vars | Purpose |
| --- | --- | --- |
| **Nexolia platform** | `NEXOLIA_AUTH_WABA_*` | Login/staff verification OTP (`POST /auth/otp/whatsapp/*`) |
| **Merchant** | Per-row in `whatsapp_config` | Customer inbox webhooks and outbound replies |

Webhooks on `/webhooks/whatsapp` route inbound **customer** messages by merchant `phone_number_id`. Auth OTP messages use the platform WABA and do not appear in the merchant inbox.

See [meta-platform-waba-setup.md](./meta-platform-waba-setup.md) for developer setup and test limits.

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

Meta **delivery status** callbacks (`statuses` in the webhook payload) update
`conversation_messages.message_status` to `sent`, `delivered`, `read`, or `failed`
by `external_message_id`.

## Owner Connection Registration

Authenticated owners register WhatsApp via:

```text
POST /whatsapp/connection/register
Authorization: Bearer <supabase-access-token>
```

Body: `organizationId`, `phoneNumberId`, `displayPhoneNumber`, optional `wabaId`.

The API validates owner membership, checks the phone number against Meta Graph API,
and upserts `whatsapp_config` for the organization's default business center.

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

KAN-143 hardens the public webhook endpoint with configured NestJS throttling.
The API also batch-resolves `whatsapp_config` rows by `phone_number_id` for each
payload and processes message events with bounded concurrency. This avoids the
old strict serial loop while preserving database-backed duplicate detection.

`conversation_messages` is added to the `supabase_realtime` publication when the
publication exists, allowing the mobile inbox to subscribe to tenant-scoped
message changes in later inbox work.

When an inbound text message is persisted, the webhook repository also starts
Sales AI draft generation asynchronously. Draft generation uses the stored
conversation/message IDs, writes `ai_drafts` and `ai_draft_events`, and logs
errors without failing the webhook acknowledgement.

## Media (images)

Inbound and outbound **image** messages are supported for the owner inbox
([KAN-346](https://souviksamanta.atlassian.net/browse/KAN-346) Android clients
consume the same API/schema as iOS).

### Inbound images

Webhook parsing extracts Meta `image.id`, `mime_type`, and optional `caption`:

- `message_type` is stored as `image`
- caption (if any) is stored in `conversation_messages.body`
- `media_id` / `media_mime_type` are persisted on insert
- Async hydrate downloads the binary from Meta Graph, uploads to the private
  Supabase Storage bucket `whatsapp-media`, then updates
  `media_storage_path` + `media_url` (signed URL, ~30 days)

Path layout: `{organization_id}/{business_center_id}/{conversation_id}/{message_id}.{ext}`

Org members can create signed URLs client-side via Storage RLS when
`media_url` expires (mobile helper: `resolveWhatsAppMediaUrl`).

### Outbound images

Owner-authenticated:

```text
POST /whatsapp/messages/send-image
```

Body: `{ organizationId, businessCenterId, conversationId, imageBase64, mimeType?, body? }`
(`body` is the optional caption). The API uploads to Meta media, sends
`type: image`, mirrors the file into `whatsapp-media`, and persists
`message_type: image` with media columns. Max size **5 MB**. JPEG/PNG/WebP/GIF.

Mobile never calls Meta with a Cloud token; only the Nest API does.

## Outbound Sends

`WhatsAppOutboundMessageService` sends **text** and **image** messages through
the WhatsApp Cloud API from the server only:

```text
POST https://graph.facebook.com/v20.0/{phone_number_id}/messages
POST https://graph.facebook.com/v20.0/{phone_number_id}/media   # image upload
```

The service loads the connected WhatsApp configuration by organization, sends
with the server-side access token, and persists a `sent` or `failed` outbound
message record. Mobile code does not call Meta APIs directly and does not receive
WhatsApp access tokens.

Text replies: `POST /whatsapp/messages/send` with `{ body, ... }`.

KAN-70 owner-approved AI drafts and allowed auto-send replies also route through
`WhatsAppOutboundMessageService`. Auto-send is off by default and requires
`organizations.ai_auto_send = true` plus a catalog-backed safe draft. KAN-71
adds optional `organizations.business_hours` enforcement, so enabled business
hours restrict auto-send to configured days and local start/end times.

## Follow-up tasks from idle conversations

Inbound WhatsApp messages update `conversations.last_message_at`. The scheduled
task maintenance job (`POST /tasks/run-maintenance`, see `docs/api-deployment.md`)
creates duplicate-safe `owner_tasks` follow-up rows when open conversations are
idle beyond each center's `ai_follow_up_delay_hours`. Low-stock
`owner_notifications` are created in the same job. The mobile Task Portal surfaces
both item types; no webhook change is required for portal reads.

Idle conversation → follow-up task flow is server-side automation only. Outbound
task reminder pushes are not part of the current webhook surface.

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

## Inbound message not in inbox

Symptom: WhatsApp shows the message as **delivered**, but Nexolia Inbox stays on seed/test data only.

### Quick diagnosis

| Check | Healthy | Your project (if broken) |
| --- | --- | --- |
| `whatsapp_config` row for your `phone_number_id` | Present, `connected` | OK (`1251908627996729`) |
| `whatsapp_message_events` after you text the business number | New row per message | **Empty** → webhook never persisted |
| `conversation_messages` | New inbound row | Only seed “Realtime Test Customer” |

An empty `whatsapp_message_events` table means Meta did not successfully POST to Railway (or every POST was rejected before insert).

### Fix checklist (Meta console)

1. **Test recipient** — [WhatsApp → API Setup](https://developers.facebook.com/) → add your personal number (E.164, e.g. `+54911…`). Test WABAs only accept inbound chats from listed numbers.
2. **Webhook URL** — `https://baas-project-production.up.railway.app/webhooks/whatsapp`
3. **Subscribe to `messages`** — WhatsApp → Configuration → Webhook fields → `messages` must be **Subscribed**.
4. **Verify token** — must equal Railway `WHATSAPP_VERIFY_TOKEN`.
5. **App secret** — Railway `WHATSAPP_APP_SECRET` must equal Meta App → Settings → Basic → App secret. A mismatch returns **401** and Meta shows failed deliveries.
6. **Recent deliveries** — Meta app → Webhooks → inspect POST status codes and response bodies.

### Fix checklist (Railway)

1. Open API service logs and search for `whatsapp.webhook` or `401` around the time you sent the message.
2. Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set (otherwise production webhook persistence throws).
3. After fixing, send **one** new test message and re-query `whatsapp_message_events`.

### Expected flow when working

```text
Your phone → Meta WABA → POST /webhooks/whatsapp → whatsapp_message_events
  → conversation_messages + conversations → Inbox (Supabase Realtime)
```

## Verification Status

For KAN-8, completion is verified when:

- The verification route accepts a valid Meta challenge and rejects invalid
  tokens.
- The POST handler validates signatures when an app secret is configured.
- Inbound WhatsApp payload parsing extracts safe Phase 0 log fields.
- Duplicate webhook deliveries are recognized through persistent event storage.
- Server secrets are documented and read only from environment variables.

## Access tokens (Test Launch)

Outbound sends prefer `WHATSAPP_CLOUD_ACCESS_TOKEN` from the API environment.
Registering a merchant connection **does not** persist that shared token into
`whatsapp_config.access_token_encrypted` (legacy plaintext column until per-tenant KMS).
