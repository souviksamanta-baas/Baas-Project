# CI and Migration Workflow

This document tracks the Phase 0 CI setup for `KAN-10`.

## Scope

The CI pipeline validates the monorepo before changes are merged and provides a
controlled Supabase migration path for the hosted project.

## Workflow File

The GitHub Actions workflow lives at:

```text
.github/workflows/ci.yml
```

It runs on:

- Pull requests targeting `main`.
- Pushes to `main`.
- Manual `workflow_dispatch` runs.

## Quality Gates

The `quality` job runs:

```bash
npm ci
npm run ci:verify
```

`ci:verify` expands to:

- `npm run lint`
- `npm run validate:migrations`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run validate:mobile`

Any failing lint, migration validation, typecheck, test, API build, or Expo config
validation step fails CI.

## Linting

Linting is configured with ESLint flat config in:

```text
eslint.config.mjs
```

The root `lint` script checks API, mobile, shared scripts, and config files while
ignoring generated folders such as `node_modules`, `dist`, and Supabase temp
folders.

## Migration Validation

Static migration validation is implemented in:

```text
scripts/validate-migrations.mjs
```

It checks that Supabase migration files:

- Exist in `supabase/migrations`.
- Use `YYYYMMDDHHMMSS_snake_case.sql` filenames.
- Have unique timestamps.
- Are not empty.

The `supabase-migrations` job also installs Supabase CLI `2.102.0` so CI uses the
same CLI baseline as local Phase 0 verification.

## Remote Migration Behavior

Pull requests run static validation only.

Pushes to `main` run a remote migration dry-run:

```bash
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push --dry-run
```

Manual workflow runs can deploy migrations when `deploy_migrations` is set to
`true`:

```bash
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push
```

## Required GitHub Configuration

Repository variables:

| Name | Purpose |
| --- | --- |
| `SUPABASE_PROJECT_REF` | Hosted Supabase project ref, for example `efcyejbvcskbnipwdfge`. |

Repository secrets:

| Name | Purpose |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase access token used by the CLI. |
| `SUPABASE_DB_PASSWORD` | Hosted database password used by the CLI for migration dry-run/deploy. |

Do not store service-role keys, database passwords, or Supabase access tokens in
source files, Jira, Confluence page bodies, or chat logs.

## Branch Rules

Recommended `main` branch protection:

- Require pull requests before merging.
- Require the `Lint, Typecheck, Test, Build` job to pass.
- Require the `Supabase Migration Validation` job to pass.
- Require branches to be up to date before merge.
- Restrict direct pushes to `main` except for repository administrators.

## Local Troubleshooting

Run the same local checks before opening or updating a pull request:

```bash
npm ci
npm run ci:verify
```

For migration-only validation:

```bash
npm run validate:migrations
```

For mobile config validation:

```bash
npm run validate:mobile
```

For audit/package hygiene validation, generate review archives from tracked source
instead of raw project folders:

```bash
npm run audit:archive
```

This archive flow uses `git archive` and refuses to proceed if generated folders
such as `node_modules/`, `dist/`, `build/`, `.expo/`, or workspace build outputs
are tracked.

If the remote migration dry-run fails on `main`, verify that the GitHub repository
variable and secrets are present and that the Supabase project ref matches the
intended Phase 0 project.
