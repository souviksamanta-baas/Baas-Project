# Instagram Webhook

Inbound Meta Instagram Messaging webhook for the owner inbox ([KAN-365](https://souviksamanta.atlassian.net/browse/KAN-365) / [KAN-370](https://souviksamanta.atlassian.net/browse/KAN-370)).

Canonical product guide: `docs/instagram-messaging.md`.

## Endpoints

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/integrations/meta/instagram/webhook` | Hub verify challenge (primary) |
| `POST` | `/integrations/meta/instagram/webhook` | Inbound events (primary) |
| `GET`/`POST` | `/webhooks/instagram` | Alias during cutover |

Both paths share the same verify + ack-then-process implementation.

## Environment

| Variable | Purpose |
| --- | --- |
| `INSTAGRAM_VERIFY_TOKEN` | `hub.verify_token` (falls back to `WHATSAPP_VERIFY_TOKEN`) |
| `INSTAGRAM_APP_SECRET` / `META_APP_SECRET` | `x-hub-signature-256` HMAC (falls back to `WHATSAPP_APP_SECRET`) |
| `BAAS_WEBHOOK_RATE_LIMIT_MAX` | Throttle max (shared pattern with WhatsApp) |
| `BAAS_WEBHOOK_RATE_LIMIT_TTL_MS` | Throttle window |

Do not expose these to the mobile client.

## Verify challenge

Meta calls:

```http
GET /integrations/meta/instagram/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
```

API returns the challenge plaintext when token matches.

## Signature

`POST` requires header `x-hub-signature-256: sha256=<hex>` over the **raw body**. Invalid or missing signature → 401/403. Raw body capture is enabled in Nest bootstrap (same as WhatsApp).

## Ack-then-process

1. Validate signature.
2. For each `entry[].messaging[]` text message with `message.mid` + `sender.id`:
   - Resolve `instagram_config` by `recipient.id` / entry id (`ig_user_id` or `page_id`).
   - Insert `instagram_message_events` keyed by unique `external_message_id` (mid).
3. Respond **HTTP 200** `{ accepted: true, queued: N }` immediately.
4. Background `InstagramEventProcessor`:
   - Upsert `contacts` (`channel='instagram'`)
   - Upsert `conversations` with `last_inbound_at` + `messaging_window_expires_at` (+24h)
   - Insert `conversation_messages` (inbound text)
   - Set `processed_at` (or `process_error`)

Idempotency: unique mid. Already-processed events are skipped. Unprocessed rows can be re-queued on Meta retry.

## Payload shape (simplified)

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "<ig-user-or-page-id>",
      "messaging": [
        {
          "sender": { "id": "<IGSID>" },
          "recipient": { "id": "<ig-user-id>" },
          "timestamp": 1717790400000,
          "message": { "mid": "mid.xxx", "text": "Hola" }
        }
      ]
    }
  ]
}
```

Non-message events (seen / reaction / postback) may be stored or marked processed without creating inbox messages in v1.

## Realtime

Mobile inbox updates via existing Supabase Realtime on `conversation_messages` (same as WhatsApp).

## Meta app configuration

1. Callback URL: `https://<api-host>/integrations/meta/instagram/webhook`
2. Verify token: value of `INSTAGRAM_VERIFY_TOKEN`
3. Subscribe object `instagram` fields used with `subscribed_apps` after OAuth: `messages`, `messaging_seen`, `message_reactions`, `messaging_postbacks`, `messaging_referral`

## Related

- WhatsApp mirror: `docs/whatsapp-webhook.md`
- Deploy secrets: `docs/api-deployment.md`, `docs/environment.md`
