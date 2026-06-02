# Workspace and Dependency Management

This document tracks the package management cleanup for the Phase 0 audit under
`KAN-36`.

## Decision

The project now uses npm workspaces:

```text
baas-mvp/
├── apps/
│   ├── api/
│   │   └── package.json
│   └── mobile/
│       └── package.json
├── package.json
└── package-lock.json
```

This is the right level of monorepo structure for Phase 0. It separates package
ownership without adding extra tooling such as Turborepo or Nx before the codebase
needs it.

## Package Ownership

The root `package.json` is now only a workspace coordinator. It owns shared
commands and the workspace list, but it does not own runtime dependencies.

`apps/api/package.json` owns the backend stack:

- NestJS
- Express
- RxJS
- Reflect metadata
- API-specific TypeScript, tsx, Vitest, and Node/Express types

`apps/mobile/package.json` owns the mobile stack:

- Expo
- React
- React Native
- AsyncStorage
- Supabase JS
- React Native URL polyfill
- Mobile-specific TypeScript and React types

## Version Policy

Top-level package manifests must not use `latest`.

For Phase 0:

- Native/mobile runtime packages that are tightly coupled to Expo are pinned or
  constrained to the tested SDK line.
- Backend framework and utility packages use explicit semver ranges based on the
  resolved versions tested in the lockfile.
- TypeScript is pinned to the tested version because compiler behavior can affect
  both app workspaces.
- `package-lock.json` remains committed at the repo root and records exact
  workspace dependency resolution.

The resolved baseline after this cleanup is:

| Package | Workspace | Version |
| --- | --- | --- |
| `expo` | `@baas/mobile` | `^56.0.8` |
| `react` | `@baas/mobile` | `19.2.7` |
| `react-native` | `@baas/mobile` | `0.85.3` |
| `@react-native-async-storage/async-storage` | `@baas/mobile` | `3.1.1` |
| `@supabase/supabase-js` | `@baas/mobile` | `^2.106.2` |
| `@nestjs/common` | `@baas/api` | `^11.1.24` |
| `@nestjs/core` | `@baas/api` | `^11.1.24` |
| `@nestjs/platform-express` | `@baas/api` | `^11.1.24` |
| `express` | `@baas/api` | `^5.2.1` |
| `reflect-metadata` | `@baas/api` | `^0.2.2` |
| `rxjs` | `@baas/api` | `^7.8.2` |

## Commands

Install all workspaces:

```bash
npm install
```

Run all typechecks:

```bash
npm run typecheck
```

Run API tests:

```bash
npm test
```

Build the API:

```bash
npm run build
```

Start local apps:

```bash
npm run dev:api
npm run dev:mobile
```

Create a clean audit archive from tracked source files only:

```bash
npm run audit:archive
```

To write the archive to a specific path:

```bash
npm run audit:archive -- --output /tmp/baas-mvp-audit.zip
```

## Archive and Backup Policy

Do not commit, audit, or back up generated dependency and build folders:

- `node_modules/`
- `dist/`
- `build/`
- `.expo/`
- workspace-level generated output such as `apps/api/dist/`

These folders are intentionally ignored and can be regenerated with `npm install`,
`npm run build`, or Expo tooling. Audits and backups should use `npm run
audit:archive`, which builds a ZIP from `git archive` so only tracked repository
source is included.

## Verification

The cleanup was verified with:

- `npm install`
- `npm run typecheck`
- `npm test`
- `npm run build`
- Expo config validation for `apps/mobile`
- Search confirming no remaining `"latest"` dependency specs in package manifests
- `git ls-files 'node_modules/*' 'dist/*' 'apps/*/dist/*'` to confirm generated
  dependency/build folders are not tracked

`npm audit` still reports 10 moderate findings through Expo CLI transitive
`uuid`/`xcode` dependencies. The available npm fix requires `--force` and would
install a breaking Expo version, so it was not applied.
