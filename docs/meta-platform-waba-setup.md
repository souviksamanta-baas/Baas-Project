# Meta Developer + Platform WABA Setup

Use this checklist to complete Nexolia WhatsApp development (KAN-275).

## 1. Create accounts

1. [Meta Developer account](https://developers.facebook.com/)
2. Meta Business Portfolio (Business Manager) for Nexolia
3. Business app with **WhatsApp → Cloud API** product enabled

## 2. Test WABA (development)

1. In the app dashboard, open **WhatsApp → API Setup**
2. Copy the temporary **access token** and **test phone number ID**
3. Add developer handsets as **test recipients** in the Meta console
4. Create an **AUTHENTICATION** template in Spanish (copy-code OTP)

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

## 5. Test limits and mitigations

| Limit | Mitigation |
| --- | --- |
| Test WABA only messages registered numbers | Add team phones as test recipients |
| Template approval delay | Submit AUTHENTICATION template early (24–48h) |
| Test WABA not for merchant inbox | Merchants connect their own WABA post-login |
| Token expiry | Use system user + long-lived token; document rotation |

## 6. Production (before pilot)

1. Provision Nexolia **platform production WABA** for auth OTP
2. Keep **merchant WABAs** separate for customer inbox (`whatsapp_config`)
3. Bill Meta in ARS where available
