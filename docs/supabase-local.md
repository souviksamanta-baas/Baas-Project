# Supabase Local Workflow

This document covers the Phase 0 Supabase CLI workflow for the BaaS MVP.

## Project

- Hosted project URL: `https://efcyejbvcskbnipwdfge.supabase.co`
- Hosted project ref: `efcyejbvcskbnipwdfge`
- Local config: `supabase/config.toml`
- Migrations directory: `supabase/migrations/`

## Prerequisites

Install the Supabase CLI and authenticate locally:

```bash
supabase login
```

Link this repo to the hosted development project:

```bash
supabase link --project-ref efcyejbvcskbnipwdfge
```

Do not commit generated secrets or local env files.

## Local Stack

Start the local Supabase stack:

```bash
supabase start
```

Stop the local Supabase stack:

```bash
supabase stop
```

Reset the local database and replay migrations:

```bash
supabase db reset
```

## Migration Workflow

Create a new migration:

```bash
supabase migration new <migration_name>
```

Apply pending migrations to the linked development project:

```bash
supabase db push
```

Pull remote schema changes only when intentionally reconciling dashboard edits:

```bash
supabase db pull
```

## Key Handling

- Use `.env.local` for local secrets.
- Never commit `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, database passwords, or generated local credentials.
- Client code may use `EXPO_PUBLIC_SUPABASE_URL` and a publishable key.
- Server code and CI may use service-role credentials only from secret storage.
- See [Environment Variables](environment.md) for the full local, CI, and deployed variable inventory.

## Verification

For KAN-13, this work is complete when:

- `supabase/config.toml` exists.
- `supabase/migrations/` exists and is tracked.
- Local reset/apply commands are documented in this file.

## Related Guides

- [Environment Variables](environment.md)
- [Tenant Isolation and RLS](tenant-rls.md)
- [Auth and Organization Onboarding](auth-onboarding.md)
- [WhatsApp Webhook](whatsapp-webhook.md)
- [Mobile Owner App](mobile-app.md)
- [Workspace and Dependency Management](workspace-dependencies.md)
- [CI and Migration Workflow](ci.md)
