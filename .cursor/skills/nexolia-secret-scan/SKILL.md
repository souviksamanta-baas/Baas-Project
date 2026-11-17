---
name: nexolia-secret-scan
description: Run a read-only secret scan of Nexolia. Checks changed commits, the current tree, or locally available Git history for privileged credentials, using the repository's existing secret scanner. Use when the user asks for a secret scan, leaked credentials, a gitleaks or trufflehog run, or a review of exposed Supabase, Railway, Meta, Twilio, ARCA, JWT, or cron secrets.
---

# Nexolia secret scan

Run a read-only secret scan and write an evidence-based report. Discover the repository as it is. Do not assume a package, workflow, or integration is in scope until it is found.

## Before acting

1. Record the target: commit SHA, branch, and whether the review is of the working tree or a named environment. If the working tree differs from the commit, say so.
2. Discover the project structure, package manager, workspace layout, CI workflows, deployed components, and existing tools. Read the root manifest, workspace manifests, `.github/workflows`, Supabase config and `supabase/migrations`, and environment examples. Report missing environment variables by name only.
3. Use this stack only as a starting point, and include a component only after verifying it is present: NestJS API, Expo/React Native app, web app, Supabase, Railway, GitHub, Meta, Twilio, ARCA. A sibling checkout (for example the web app) is in scope only when it is in the workspace or the user points at it.
4. Prefer existing repository tooling. Look for a committed secret scanner, its config, and any CI step that already runs it. Do not install a new scanner unless the user asks.
5. The review is read-only. Do not change production code, configuration, dependencies, schemas, migrations, secrets, or deployment settings unless the user explicitly asks for a fix.

## Modes

Pick one mode. Name it in the report.

- **Changed commits.** Scan the commits in the pull request or the range the user names. This is the default for a PR.
- **Current tree.** Scan the tracked files at the target commit. Use this for a baseline.
- **History.** Scan locally available Git history and refs. State which refs were available. If the clone is shallow, say so and name the history that was not present. Do not deepen the clone unless the user asks.

## Runtime checks

Use local or approved staging environments and synthetic fixtures. Do not run checks against production.

Stub paid or externally visible operations. Do not send messages, issue invoices, or trigger OTPs.

Keep credential values, customer data, and tokens out of reports and logs. Never print a credential. Never attempt to authenticate with a found credential. Redact phone numbers, message bodies, and document identifiers. A scanner fingerprint and the credential type are enough.

## Method

Use the existing secret scanner where available. If none is configured, record that as a coverage gap and review only the paths the scanner would have been aimed at, without pasting secret-shaped values into the report.

Check for exposures relevant to the components that are in scope:

- Supabase service-role keys and database URLs with credentials
- Railway tokens and deployment credentials
- Meta app secrets and long-lived access tokens
- Twilio auth tokens and API keys
- ARCA signing keys and private certificates
- JWT signing secrets
- Cron and job credentials

Distinguish intentionally public client configuration from privileged credentials. Publishable Supabase keys, Expo public environment names, and other values that the client bundle is designed to contain are not privileged. A service-role key, a private signing key, or a token that authorizes server actions is privileged.

For each finding, record the credential type, path, commit, and a scanner fingerprint when the scanner provides one. Do not include the secret material.

Deduplicate findings that share the same fingerprint, path, and credential type. Note when the same credential appears in more than one commit.

## Finding status

Assign one status:

- **Confirmed.** A privileged credential is present in the scanned content, and it is not intentional public client configuration.
- **Review candidate.** The match looks like a secret, but the value may be a placeholder, a fixture, or public client configuration. Name what is still unknown.
- **Could not run.** The scan needed a scanner, ref, or history that was not available. Name what was missing, including a shallow clone. Do not describe the check as passed.

## Remediation

For a confirmed exposure, give an owner-facing sequence:

1. Revoke or rotate the credential at the issuer.
2. Update the dependent configuration that uses it, by name and location, without printing the new value.
3. Remove the credential from the tree and, when history mode found it in a past commit, state what repository cleanup still has to happen. Do not rewrite history unless the user asks.

## Reporting

Write `test-results/secret-scan/<YYYY-MM-DD>-<short-sha>/REPORT.md` and give the same report in the reply. Include:

- the commit or environment reviewed, the mode, the refs available, and any shallow-clone limitation;
- the components verified in scope, and the components looked for but not found;
- the checks actually run, with the command and the result;
- findings, each with severity, confidence, status, credential type, path, commit, scanner fingerprint when available, redacted evidence, file and line references where applicable, the recommended fix, and a verification step;
- the remediation sequence for each confirmed exposure;
- coverage gaps, including checks that could not run.

Severity is `critical`, `high`, `medium`, or `low`, based on what the credential authorizes. Confidence is `high`, `medium`, or `low`. A clean review is acceptable. State what was scanned and what history was not available.
