# Test Launch — security checklist

Controlled pilot hardening from the 2026-07-20 audit (Jira epic **KAN-333**).
Treat tester devices and the public API as untrusted.

## Shipped in this pass

| Area | Status | Notes |
| --- | --- | --- |
| Copi API auth (#1) | Done | Bearer + org membership on voice/vision/upload/reports/history; session ownership on `listMessages` |
| Invite accept (#2/#3) | Done | Phone from auth user; `accept_organization_invite` RPC |
| Nest/Multer (#4) | Done | `@nestjs/*` ≥ 11.1.28; voice upload throttled |
| Copi messages RLS (#5) | Done | `copi_messages_select_owner` (session `user_id = auth.uid()`) |
| WhatsApp shared token (#6) | Done | Env `WHATSAPP_CLOUD_ACCESS_TOKEN` only; DB field not written on register |
| OTP harden (#7) | Done | HMAC-SHA256 + pepper, resend cooldown, timing-safe compare, no OTP/phone in logs |
| ValidationPipe (#8) | Done | Global whitelist/forbid; Copi/auth/invite DTOs |
| SecureStore (#9) | Done | Supabase session via `authSecureStorage` (chunked SecureStore) |
| Expo hygiene (#14/#16/#17) | Done | Aligned native deps; block `WRITE_CONTACTS`; legacy navigator marked unreachable |
| Log redaction (#19) | Done | OTP paths redact phone; never log codes |
| Swagger (#20) | Done | `/docs` off in production unless `BAAS_ENABLE_OPENAPI_DOCS=true` |

## Known debt (deferred)

- Full Vault/KMS encryption for per-tenant WhatsApp tokens (`access_token_encrypted` remains legacy plaintext until KMS).
- Legal privacy/ToS package (#21).
- Live `rls_cross_tenant.sql` in CI against local Supabase (#10 full).
- Automated 14-day Copi **message deletion** job (#18) — retention today is a **query filter** only (`retentionCutoffIso`), not purge.
- Unrelated ESLint debt outside security-touched paths.

## Smoke tests

```bash
# Unauthenticated Copi routes must be 401
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "$API/ai/copilot/voice" \
  -H 'content-type: application/json' \
  -d '{"organizationId":"00000000-0000-0000-0000-000000000000","audioBase64":"xx","mimeType":"audio/m4a"}'

curl -s -o /dev/null -w "%{http_code}\n" \
  "$API/ai/copilot/sessions/00000000-0000-0000-0000-000000000000/messages?organizationId=00000000-0000-0000-0000-000000000000"
```

Migration: `supabase/migrations/20260721090000_test_launch_security.sql`.

## QA checklist (In QA)

Production unauth smoke is already green (voice/messages → 401, `/docs` → 404). Remaining checks are authenticated / product-path.

### Must verify (pilot blockers)

1. **Copi auth**
   - [ ] Logged-in owner: voice, vision, query, active session, and confirm still work
   - [ ] Missing/invalid token → 401
   - [ ] User in org A cannot call Copi for org B → 403
   - [ ] User B cannot read user A’s Copi session messages (empty/403, not another user’s history)

2. **Staff invite**
   - [ ] Accept with correct OTP/session phone → membership created
   - [ ] Spoofed body `verifiedPhoneE164` does **not** change outcome (server uses auth-user phone)
   - [ ] Expired / already-accepted invite fails cleanly

3. **OTP login (WhatsApp path, if used)**
   - [ ] Request + verify still works
   - [ ] Resend too soon → cooldown error
   - [ ] Codes / full phones do not appear in API logs

4. **Mobile session storage**
   - [ ] After login, session survives app restart
   - [ ] Logout clears session; login still works on a device/Expo build using SecureStore

5. **WhatsApp outbound / connect**
   - [ ] Register connection works without writing the shared token into `access_token_encrypted`
   - [ ] Sending a merchant message works with `WHATSAPP_CLOUD_ACCESS_TOKEN` on Railway

### Already verified (re-check only if needed)

- [x] Unauth `POST /ai/copilot/voice` → 401
- [x] Unauth session messages → 401
- [x] Production `/docs` → 404

### Out of scope for this epic

KMS WhatsApp encryption, legal ToS/privacy package, live RLS SQL suite in CI, automated 14-day message **deletion** (retention is query filter only).

### Pass rule

Move a child ticket to **Done** when its section above is green on a pilot org (e.g. NEX Biz / Baas Admin). Move epic **KAN-333** to **Done** when must-verify items 1–5 pass.

