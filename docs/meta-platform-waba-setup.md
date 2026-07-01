# Meta Developer + Platform WABA Setup

Use this checklist to complete Nexolia WhatsApp development (KAN-275).

## 1. Create accounts

1. [Meta Developer account](https://developers.facebook.com/)
2. Meta Business Portfolio (Business Manager) for Nexolia
3. Business app with **WhatsApp → Cloud API** product enabled

## 2. Test WABA (development)

Meta gives you **two different roles** — do not confuse them:

| Role | What Meta provides | Purpose |
| --- | --- | --- |
| **Business / WABA number** | Auto test number (e.g. `+54 3546…`, Phone Number ID `1251908627996729`) | Your merchant line — **receives** customer chats |
| **Test recipient (“To”)** | You add **your personal WhatsApp** (up to 5) | Phones allowed to **message** the business number in dev |

The fake `+1 555…` number in the API console is only for **outbound API tests** (business → customer). It does **not** replace adding your real phone as a recipient.

1. In the app dashboard, open **WhatsApp → API Setup**
2. Under **To** → **Manage phone number list** → add your personal number in E.164 (`+54911…`, no spaces)
3. Confirm the OTP WhatsApp sends to that phone
4. Copy the **access token** and **Phone Number ID** from the same page

**Argentina tip:** use international format without an extra `9` if Meta rejects the number (e.g. `+543546517096` vs `+5493546517096` — try both if verification fails).

### If you cannot add your personal number

Some accounts block recipient verification until business portfolio steps complete. Workarounds:

1. **Reply after outbound** — Use API Setup **Send message** (business → your phone). When it arrives on your phone, **reply** to that chat. That reply is **inbound** and should hit the webhook (24-hour customer service window).
2. **Webhook Test button** — WhatsApp → Configuration → Webhook fields → `messages` → **Test**. Confirms Railway accepts signed payloads (does not prove real WhatsApp delivery).
3. **Production path** — Business verification + live number; any customer can message without the 5-number cap.

Also create an **AUTHENTICATION** template in Spanish (copy-code OTP) for login when WhatsApp auth ships.

## 3. API environment variables

| Variable | Purpose |
| --- | --- |
| `WHATSAPP_CLOUD_ACCESS_TOKEN` | Merchant messaging + fallback for platform auth |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification |
| `WHATSAPP_APP_SECRET` | Webhook signature validation |
| `NEXOLIA_AUTH_WABA_PHONE_NUMBER_ID` | Platform WABA number for login OTP |
| `NEXOLIA_AUTH_WABA_ACCESS_TOKEN` | Optional dedicated token for platform auth |
| `NEXOLIA_AUTH_OTP_TEMPLATE_NAME` | Auth template name (default `nexolia_auth_otp`) |
| `NEXOLIA_AUTH_OTP_TEMPLATE_LANGUAGE` | Template locale (default `es`) |

## 4. Webhook

Register `https://<api-host>/webhooks/whatsapp` with the verify token from env.

Production callback URL:

```text
https://baas-project-production.up.railway.app/webhooks/whatsapp
```

After saving the callback URL:

1. Open **Webhook fields** → subscribe to **`messages`** (required for inbox).
2. Optionally subscribe to **`message_template_status_update`** for template ops.
3. Use **Test** in the Meta console and confirm Railway logs show `whatsapp.webhook.message.received` or at least HTTP `200`.

Railway env must match the Meta app:

| Railway variable | Meta source |
| --- | --- |
| `WHATSAPP_VERIFY_TOKEN` | Same string you enter in Meta webhook setup |
| `WHATSAPP_APP_SECRET` | App → Settings → Basic → **App secret** |
| `WHATSAPP_CLOUD_ACCESS_TOKEN` | System user or temporary token with `whatsapp_business_messaging` |

If `WHATSAPP_APP_SECRET` is wrong, Meta POSTs return **401** and nothing is stored.

## 5. Inbound message test (merchant inbox)

**Important:** The Meta console **Send message** button (API Setup / testing panel) sends **from your business number to** the test recipient (e.g. `+1 555 …`). That is **outbound**. Nexolia Inbox only ingests **inbound** customer messages (someone texts **your** WABA number).

To populate Inbox:

1. Connect the merchant number in Nexolia (`phone_number_id` must match Meta).
2. Add your personal handset as a **test recipient** (WhatsApp → API Setup).
3. **Customer-initiated test** — either:
   - Scan the **QR code** on the Meta API Setup page from your phone and send a message to the business number, **or**
   - From that registered phone, open WhatsApp and send a text **to** the business WABA number (e.g. `+54 9 3546 51-7096`).
4. Confirm rows appear:

```sql
select * from whatsapp_message_events order by created_at desc limit 5;
select * from conversation_messages order by created_at desc limit 5;
```

If WhatsApp shows **delivered** but both tables are empty, the webhook never reached the API — check Meta **Webhooks → Recent deliveries** for failed POSTs.

## 6. Test limits and mitigations

| Limit | Mitigation |
| --- | --- |
| Test WABA only messages registered numbers | Add team phones as test recipients |
| Template approval delay | Submit AUTHENTICATION template early (24–48h) |
| Test WABA not for merchant inbox | Merchants connect their own WABA post-login |
| Token expiry | Use system user + long-lived token; document rotation |

## 7. Production (before pilot)

1. Provision Nexolia **platform production WABA** for auth OTP
2. Keep **merchant WABAs** separate for customer inbox (`whatsapp_config`)
3. Bill Meta in ARS where available
