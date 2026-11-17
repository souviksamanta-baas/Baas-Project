---
name: nexolia-infrastructure-security
description: Run a read-only infrastructure security review of Nexolia. Inventories the services Nexolia operates and the settings it controls on Supabase, Railway, and GitHub, including RLS, exposure, workflow tokens, and image advisories. Use when the user asks for an infrastructure security review, RLS and grants review, Railway exposure, GitHub workflow permissions, or image and host patch status.
---

# Nexolia infrastructure security

Run a read-only review of the infrastructure Nexolia operates and write an evidence-based report. Discover the repository as it is. Do not assume a package, workflow, or integration is in scope until it is found.

## Before acting

1. Record the target: commit SHA, branch, and whether the review is of the working tree or a named environment. If the working tree differs from the commit, say so.
2. Discover the project structure, package manager, workspace layout, CI workflows, deployed components, and existing tools. Read the root manifest, workspace manifests, `.github/workflows`, Supabase config and `supabase/migrations`, and environment examples. Report missing environment variables by name only.
3. Use this stack only as a starting point, and include a component only after verifying it is present: NestJS API, Expo/React Native app, web app, Supabase, Railway, GitHub, Meta, Twilio, ARCA. A sibling checkout is in scope only when it is in the workspace or the user points at it.
4. Prefer existing repository tooling. Look for the current migration and RLS checks, Dockerfile or image build, and any committed provider config. Do not install new scanners unless the user asks.
5. The review is read-only. Do not change production code, configuration, dependencies, schemas, migrations, secrets, deployment settings, or provider resources unless the user explicitly asks for a fix. Use repository configuration and authorized read-only provider exports. Do not create, update, or delete provider resources.

## Runtime checks

Use a local or approved staging environment and synthetic fixtures. Do not run checks against production data.

Stub paid or externally visible operations. Do not send messages, issue invoices, or trigger OTPs.

Keep credential values, customer data, and tokens out of reports and logs. Redact secrets, service-role keys, deployment tokens, phone numbers, and document identifiers. A variable name and a redacted prefix are enough.

## Method

Inventory the infrastructure Nexolia operates and the settings it controls on managed services. Separate settings Nexolia commits or can change from settings the provider manages.

Review repository configuration first. Add an authorized read-only provider export only when the user has already authorized that account. If the export is unavailable, record the limit on visibility. Do not request new credentials.

When the component is in scope:

- **Supabase.** Review RLS policies, grants, storage visibility, and service-role key handling. A table in an exposed schema with RLS disabled, or a service-role key reachable from a client bundle, is a finding. A publishable client key is not a service-role key.
- **Railway.** Review public service exposure, environment separation, runtime versions, and secret scoping. A secret shared across environments, or a service that is public without a recorded reason, is a finding.
- **GitHub.** Review workflow token permissions, deployment credentials, and repository protection settings where those settings are available. A workflow token with broader permissions than the job uses is a finding.

Use existing tooling to check built images, base images, and OS packages against published vulnerability advisories where Nexolia controls those artifacts. Record the image identity and the advisory ID. If Nexolia operates hosts, include host patch status from the existing inventory. For provider-managed hosts, record the division of responsibility and any limit on visibility. Do not treat a provider-managed host as unpatched when its patch status is not visible.

For each finding, record the affected resource, its exposure, the configuration or version observed, and a remediation verification step.

Deduplicate findings that share the same resource, the same setting, and the same observed value.

## Finding status

Assign one status:

- **Confirmed.** The repository or an authorized read-only export shows the unsafe setting or the vulnerable version Nexolia controls.
- **Review candidate.** The setting is implied by the repo but the live value was not exported. Name what is still unknown.
- **Could not run.** The check needed a config file, a tool, or a provider export that was not available. Name what was missing, including a provider-managed host whose patch status is not visible. Do not describe the check as passed.

## Reporting

Write `test-results/infrastructure-security/<YYYY-MM-DD>-<short-sha>/REPORT.md` and give the same report in the reply. Include:

- the commit or environment reviewed, and whether the working tree differed;
- the infrastructure inventory, the settings Nexolia controls, and the components looked for but not found;
- the division of responsibility for provider-managed hosts, and any limit on visibility;
- the checks actually run, with the command and the result;
- findings, each with severity, confidence, status, affected resource, exposure, configuration or version observed, redacted evidence, file and line references where applicable, the recommended fix, and a verification step;
- coverage gaps, including checks that could not run.

Severity is `critical`, `high`, `medium`, or `low`, based on who can reach the resource and what it authorizes. Confidence is `high`, `medium`, or `low`. A clean review is acceptable. State what was read from the repo and what was read from a provider export.
