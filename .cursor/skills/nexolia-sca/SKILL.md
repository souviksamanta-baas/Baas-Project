---
name: nexolia-sca
description: Run a read-only software composition analysis of Nexolia. Inventories manifests and lockfiles and checks resolved direct and transitive versions against published advisories with the repository's existing dependency audit tooling. Use when the user asks for SCA, a dependency audit, npm audit, advisory review, vulnerable packages, or an upgrade path for a security advisory.
---

# Nexolia SCA

Run a read-only dependency audit and write an evidence-based report. Discover the repository as it is. Do not assume a package, workflow, or integration is in scope until it is found.

## Before acting

1. Record the target: commit SHA, branch, and whether the review is of the working tree or a named environment. If the working tree differs from the commit, say so.
2. Discover the project structure, package manager, workspace layout, CI workflows, deployed components, and existing tools. Read the root manifest, workspace manifests, lockfiles, `.github/workflows`, Supabase config and `supabase/migrations`, and environment examples. Report missing environment variables by name only.
3. Use this stack only as a starting point, and include a component only after verifying it is present: NestJS API, Expo/React Native app, web app, Supabase, Railway, GitHub, Meta, Twilio, ARCA. A sibling checkout (for example the web app) is in scope only when it is in the workspace or the user points at it.
4. Prefer existing repository tooling. Look for the current dependency audit script, `npm audit` or the package manager's equivalent, and any committed dependency-review or advisory config. Do not install new scanners unless the user asks.
5. The review is read-only. Do not change production code, configuration, dependencies, schemas, migrations, secrets, or deployment settings unless the user explicitly asks for a fix. Keep lockfiles unchanged during the audit.

## Runtime checks

Use local or approved staging environments and synthetic fixtures. Do not run checks against production.

Stub paid or externally visible operations. Do not send messages, issue invoices, or trigger OTPs.

Keep credential values, customer data, and tokens out of reports and logs. Redact secrets, phone numbers, message bodies, and document identifiers. Advisory output may name package versions; it must not include registry tokens.

## Method

Inventory supported manifests and lockfiles across the backend, web, mobile, and shared workspaces that are actually present. Record each manifest, its lockfile, and the package manager that resolves it. A manifest without a lockfile is a coverage gap, not a clean result.

Use the existing dependency audit tooling to check resolved direct and transitive versions against published advisories. Audit the lockfile resolution, not the declared range alone.

For each finding, record:

- advisory ID
- resolved version
- dependency chain from the workspace dependency to the affected package
- affected workspace
- whether the package ships to production or runs in development or CI, based on the dependency group and where that workspace is deployed
- reachability, only when the evidence supports a conclusion; otherwise leave reachability unknown
- the fixed version and the smallest compatible upgrade path
- Expo and React Native compatibility when the upgrade touches the mobile workspace

Flag packages with no available fix. Do not invent a fix version.

Deduplicate findings that share the same advisory, resolved version, and workspace. Keep distinct chains when the same advisory arrives through different direct dependencies.

## Finding status

Assign one status:

- **Confirmed.** The lockfile resolves to an affected version and the advisory applies to that version.
- **Review candidate.** The advisory matches a declared range or an unresolved tree, and the lockfile does not yet prove the resolved version.
- **Could not run.** The audit needed a tool, registry, or lockfile that was not available. Name what was missing. Do not describe the check as passed.

## Reporting

Write `test-results/sca/<YYYY-MM-DD>-<short-sha>/REPORT.md` and give the same report in the reply. Include:

- the commit or environment reviewed, and whether the working tree differed;
- the manifests and lockfiles inventoried, and the workspaces looked for but not found;
- the checks actually run, with the command and the result;
- findings, each with severity, confidence, status, the fields in Method, redacted evidence, file and line references where applicable, the recommended fix, and a verification step;
- coverage gaps, including checks that could not run.

Severity is `critical`, `high`, `medium`, or `low`, using the advisory severity unless reachability evidence lowers the practical impact. Confidence is `high`, `medium`, or `low`. A clean review is acceptable. State what was audited from lockfiles and what was not reviewed.
