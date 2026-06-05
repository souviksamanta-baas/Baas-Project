# Auth and Organization Onboarding

This document tracks the Phase 0 auth and onboarding work for `KAN-7`.

## Scope

Phase 0 planned Supabase Auth with phone OTP as the primary owner login method.
During Phase 2 simulator verification, the mobile app uses Supabase email OTP so
Realtime behavior can be tested before Twilio/SMS provider setup is complete.
After login, the mobile app resolves whether the user already belongs to an
organization. If not, it prompts for business creation and creates the user as
the organization owner.

Production phone OTP remains the target owner login path and is tracked under
KAN-129.

## Email OTP for Simulator Verification

The current Expo simulator flow calls:

```typescript
await supabase.auth.signInWithOtp({
  email: normalizedEmail,
});

await supabase.auth.verifyOtp({
  email: normalizedEmail,
  token: otpCode,
  type: 'email',
});
```

This avoids blocking Realtime verification on SMS provider setup. Email OTP must
still use public Supabase client variables only.

## Phone OTP

The local Supabase config enables SMS signup and defines the OTP message
template in `supabase/config.toml`.

Hosted Supabase phone OTP also requires an SMS provider in the Supabase
dashboard. Store provider credentials only in Supabase or deployment secret
storage. Do not commit SMS provider credentials or paste them into Jira,
Confluence, or chat.

Mobile client flow:

```typescript
await supabase.auth.signInWithOtp({
  phone: e164PhoneNumber,
});

await supabase.auth.verifyOtp({
  phone: e164PhoneNumber,
  token: otpCode,
  type: 'sms',
});
```

Recommended client error handling:

- Validate E.164 phone format before requesting an OTP.
- Show rate-limit and invalid-code errors as user-readable messages.
- Allow resend only after the configured cooldown.
- Never log OTP codes or full phone numbers.

## Onboarding RPCs

`20260601190000_create_owner_onboarding_rpc.sql` adds these authenticated RPCs:

| Function | Purpose |
| --- | --- |
| `create_organization_with_owner(org_name, org_timezone, org_business_hours)` | Creates the organization and inserts the authenticated user as `owner`. |
| `get_my_organizations()` | Resolves organizations visible to the authenticated user through RLS. |
| `get_owner_dashboard()` | Returns the dashboard bootstrap payload and empty-state metrics. |

`create_organization_with_owner` is intentionally exposed only to the
`authenticated` role and validates `auth.uid()` before writing. It uses a
security definer transaction boundary so organization and owner membership are
created together.

## First Login Flow

1. Owner enters email address for the current simulator flow, or phone number
   after KAN-129 provider setup.
2. App calls `signInWithOtp`.
3. Owner enters OTP code.
4. App calls `verifyOtp`.
5. App calls `get_owner_dashboard`.
6. If `shouldOnboard` is `true`, app shows the business creation form.
7. App calls `create_organization_with_owner`.
8. App calls `get_owner_dashboard` again and renders the empty dashboard.

## Empty Dashboard Contract

The dashboard bootstrap response includes:

- `shouldOnboard`: whether business creation is still required.
- `organization`: active organization ID, name, role, and timezone.
- `metrics`: zero-count Phase 0 dashboard metrics.
- `emptyStates`: setup prompts for WhatsApp, products, and follow-up rules.

Phase 1 feature tables will replace the placeholder zero counts with real
queries as inbox, CRM, catalog, and follow-up modules are added.

## Verification

The scripted verification lives at:

```text
supabase/tests/onboarding_flow.sql
```

It simulates a phone-authenticated user and verifies:

- First login returns `shouldOnboard = true`.
- Organization creation inserts the user as `owner`.
- The active organization resolves through `get_my_organizations`.
- The dashboard no longer prompts onboarding after organization creation.
- Empty dashboard metrics start at zero.

The transaction rolls back at the end, so no test organization remains.
