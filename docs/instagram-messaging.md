# Instagram Messaging (Owner inbox)

Canonical product/ops guide for Instagram DMs in Nexolia ([KAN-365](https://souviksamanta.atlassian.net/browse/KAN-365)).

**Confluence**

- Integration / ops: [Instagram Messaging (Owner inbox)](https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/26247169/Instagram+Messaging+Owner+inbox)
- **Client onboarding (Spanish):** [Onboarding de clientes — Instagram](https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/27230209/Onboarding+de+clientes+Instagram)

## Platform vs merchant

| Actor | Action | Secrets |
| --- | --- | --- |
| **Nexolia ops** | Meta Developer app + Railway Variables **once** per environment | `META_APP_ID`, `META_APP_SECRET`, verify token, `BAAS_TOKEN_ENCRYPTION_KEY` |
| **Merchant (client)** | Integraciones → **Conectar cuenta existente** → Meta OAuth | Tenant token encrypted in `instagram_config` |

Merchants never open Railway and never provide Meta App Secret. Ops sets platform vars in the Railway dashboard (or local CLI)—**do not paste secrets into Cursor/chat**.

If connect fails with a server-configuration message, it is an ops gap (`META_APP_*` missing), not a client mistake.

## Product shape

Owners connect an Instagram Professional account with **Instagram Business Login** (OAuth). Inbound DMs land in the same inbox tables as WhatsApp (`conversations` / `conversation_messages`, `channel='instagram'`). Tokens are AES-256-GCM encrypted in `instagram_config.access_token_encrypted`.

| Concept | Table |
| --- | --- |
| Channel connection | `instagram_config` |
| Thread | `conversations` (+ `instagram_config_id`, messaging window cols) |
| Message | `conversation_messages` (`external_message_id` = Meta mid) |

## Owner connect flow

1. Mobile **Integraciones → Instagram → Conectar cuenta existente**
2. `POST /instagram/oauth/start` → Meta authorize URL (`instagram_business_basic`, `instagram_business_manage_messages`)
3. Redirect `baas-owner://instagram-oauth?code=&state=`
4. `POST /instagram/oauth/callback` → long-lived token, profile, encrypt+upsert, `subscribed_apps`
5. Best-effort Conversations API history import (async; **not** a full-history promise)
6. `POST /instagram/connection/disconnect` disables the config and clears the token

Manual `POST /instagram/connection/register` is deprecated (ops only).

Client-facing Spanish steps: Confluence **Onboarding de clientes — Instagram**.

## Messaging window

From last customer inbound, owners have **24 hours** to reply (`reply_available`).

| State | Meaning |
| --- | --- |
| `customer_must_message_first` | No inbound yet |
| `reply_available` | Inside 24h window |
| `window_expired` | Past 24h; wait for customer |
| `human_reply_only` | Reserved (v1 unused) |
| `meta_approval_required` | Reserved for Advanced Access UX |

API: `GET /instagram/messages/window-state?organizationId=&conversationId=`  
Send: `POST /instagram/messages/send` via `https://graph.instagram.com/v21.0/{ig-user-id}/messages`

No Copi Human Agent automation outside the 24h window in v1.

## Webhooks

Primary: `GET/POST /integrations/meta/instagram/webhook`  
Cutover alias: `GET/POST /webhooks/instagram`

Ack-then-process: validate signature → insert `instagram_message_events` → HTTP 200 → background upsert contact/conversation/message. See `docs/instagram-webhook.md`.

## Environment (names only)

| Variable | Purpose |
| --- | --- |
| `META_APP_ID` / `INSTAGRAM_APP_ID` | Platform Meta app id |
| `META_APP_SECRET` / `INSTAGRAM_APP_SECRET` | App secret (signature + OAuth); may reuse `WHATSAPP_APP_SECRET` if same Meta app |
| `INSTAGRAM_VERIFY_TOKEN` | Hub verify token |
| `INSTAGRAM_OAUTH_REDIRECT_URI` | Default `baas-owner://instagram-oauth` |
| `BAAS_TOKEN_ENCRYPTION_KEY` | 32-byte base64 (or any secret hashed to 32 bytes in non-prod) |

Missing `META_APP_ID` / secret returns Spanish **503** (not opaque 500).

## App Review demo script (sketch)

1. Show Integraciones → Instagram → Conectar cuenta existente → Meta login → return to app with `@username` chip.
2. From a test IG consumer account, send a DM → appears in Owner inbox (Instagram filter).
3. Reply inside 24h → customer receives text.
4. Wait / simulate expired window → composer shows Spanish blocked copy; send API rejects.
5. Disconnect → status disabled.

## Non-goals (v1)

- Full generic `channel_connections` table
- Instagram image/audio parity
- Human Agent 7-day Copi automation
- Group chats / Facebook Messenger in the same change set

## Related docs

- `docs/instagram-webhook.md`
- `docs/environment.md`
- `docs/mobile-app.md`
- `docs/phase-3-scope.md`
- `docs/api-deployment.md`
