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
- `npm run validate:rls`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run validate:mobile`

Any failing lint, migration validation, RLS coverage validation, typecheck, test,
API build, or Expo config validation step fails CI.

Additional security jobs:

- `dependency-audit` runs `npm run audit:ci` (`npm audit --omit=dev`).
- `secret-scan` runs gitleaks with `.gitleaks.toml` (allowlists `*.example`).

Third-party GitHub Actions are pinned to full commit SHAs (with version comments).

The default `npm test` run excludes E2E specs (`**/*.e2e.spec.ts`). Layer A API/webhook
E2E runs separately via `npm run test:e2e`. Full pre-release regression:

```bash
npm run test:regression
```

See [e2e-regression.md](./e2e-regression.md) for the three-layer program.

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

## RLS Coverage Validation

KAN-72 adds a CI-friendly guard for tenant isolation coverage:

```text
scripts/validate-rls-coverage.mjs
```

The root `validate:rls` script checks that:

- Every `public` table created in migrations enables **and forces** RLS.
- `supabase/tests/rls_cross_tenant.sql` references every inventoried tenant and
  service-only table (including `app_startup_samples`).
- Service-role-only tables are explicitly revoked from `anon` and
  `authenticated`.
- The RLS test includes cross-tenant Tenant A and Tenant B assertions.

The `rls-sql` GitHub Actions job starts local Supabase (Docker) and runs the SQL
against Postgres so coverage is not static-only:

```bash
supabase start --exclude studio,imgproxy,edge-runtime,logflare,vector,realtime
eval "$(supabase status -o env)"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_cross_tenant.sql
```

The SQL verification script itself remains runnable against a local or connected
Supabase database:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_cross_tenant.sql
```

It wraps test data in a transaction and rolls back at the end.

## API E2E (Layer A)

The `e2e` GitHub Actions job runs after the quality gate:

```bash
supabase start --exclude studio,imgproxy,edge-runtime,logflare,vector,realtime
npm run test:e2e
```

E2E failures fail the workflow (no `continue-on-error`). Current specs are
mock-based and do not require a live Supabase instance. Local Supabase is started for
future integration coverage. The `e2e` job runs on every pull request and push to `main`.

## Remote Migration Behavior

Pull requests run static validation only.

Pushes to `main` run a remote migration dry-run:

```bash
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push --dry-run
```

Manual workflow runs can deploy migrations when `deploy_migrations` is set to
`true`. That path runs in the dedicated `supabase-migrate-deploy` job, which
targets the GitHub Environment `supabase-production`.

### Migration drift check

Pushes to `main` also run `npm run check:migration-drift`. It reads
`supabase_migrations.schema_migrations` through the Supabase Management API
(`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`) and fails if a file in
`supabase/migrations` is not applied remotely. Files are matched by migration
name, not version, because migrations applied outside `supabase db push` get
the apply time as version. Migrations that were applied under a different name
go in `supabase/migration-drift-ignore.json` after confirming the objects exist.
Run it locally with the same two variables, or offline with
`--from-json applied.json`.

### GitHub UI required (Environment reviewers)

Create and lock down the Environment before the first real deploy:

1. Repo **Settings → Environments → New environment** named `supabase-production`.
2. Enable **Required reviewers** and add at least one trusted reviewer.
3. Optionally restrict the environment to the `main` branch.
4. Move or duplicate `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and
   `SUPABASE_PROJECT_REF` onto that Environment (or keep repository-level secrets
   if the environment is allowed to inherit them).

Until the Environment exists with reviewers, `workflow_dispatch` deploys that
request `deploy_migrations=true` will wait for approval or fail Environment
resolution.

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

For RLS coverage validation:

```bash
npm run validate:rls
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

If a raw working-directory audit is required, preview and remove generated local
folders first:

```bash
npm run audit:clean:dry-run
npm run audit:clean
```

The cleanup command removes generated folders only when they contain no tracked
files. After cleanup, dependencies and build outputs can be recreated with
`npm install`, `npm run build`, and Expo tooling.

If the remote migration dry-run fails on `main`, verify that the GitHub repository
variable and secrets are present and that the Supabase project ref matches the
intended Phase 0 project.
