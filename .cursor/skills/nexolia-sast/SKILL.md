---
name: nexolia-sast
description: Run a read-only static application security review of Nexolia. Combines the repository's existing scanners with a targeted review of security-critical code in the NestJS API, web app, Expo app, Supabase SQL, and shared packages. Use when the user asks for SAST, a static security review, a security scan, or a review of injection, authorization, unsafe rendering, uploads, cryptography, sensitive logging, or Copi actions that cross from model output into server operations.
---

# Nexolia SAST

Run a read-only static security review and write an evidence-based report. Discover the repository as it is. Do not assume a package, workflow, or integration is in scope until it is found.

## Before acting

1. Record the target: commit SHA, branch, and whether the review is of the working tree or a named environment. If the working tree differs from the commit, say so.
2. Discover the project structure, package manager, workspace layout, CI workflows, deployed components, and existing tools. Read the root manifest, workspace manifests, `.github/workflows`, Supabase config and `supabase/migrations`, and environment examples. Report missing environment variables by name only.
3. Use this stack only as a starting point, and include a component only after verifying it is present: NestJS API, Expo/React Native app, web app, Supabase, Railway, GitHub, Meta, Twilio, ARCA. A sibling checkout (for example the web app) is in scope only when it is in the workspace or the user points at it.
4. Prefer existing repository tooling. Look for the current lint, typecheck, migration, and RLS scripts, plus any committed Semgrep, CodeQL, `npm audit`, or dependency-review config. Do not install new scanners unless the user asks.
5. The review is read-only. Do not change production code, configuration, dependencies, schemas, migrations, secrets, or deployment settings unless the user explicitly asks for a fix.

## Runtime checks

Use local or approved staging environments and synthetic fixtures. Do not run checks against production.

Stub paid or externally visible operations. Do not send messages, issue invoices, or trigger OTPs. Assert the request that would have been sent, through the existing fake or sandbox adapter.

Keep credential values, customer data, and tokens out of reports and logs. Redact secrets, phone numbers, message bodies, and document identifiers. A redacted prefix or suffix is enough to identify the kind of value.

## Method

Run existing static analysis first, then review security-critical code. Cover the NestJS API, the web app, the Expo app, Supabase SQL migrations and functions, and shared packages that are actually in the repo. Skip a layer that is not present and record it as a coverage gap.

Scanner alerts are leads. For each alert, record the affected code path and identify any guard or validation that applies before confirming a finding. An alert with a guard that rejects the input is not a confirmed finding.

Trace relevant data flows to the operation that uses the data. Follow the value from the entry point (request body, query, header, webhook, file, model output, SQL argument) through validation and authorization to the sink.

Review these areas when the code exists:

- Input validation at HTTP, webhook, and RPC boundaries.
- Database query construction, including string-built filters, dynamic SQL, and `security definer` functions.
- Server-side authorization guards. A client check, a hidden route, or a model decision is not authorization.
- Unsafe rendering of stored or request-controlled text.
- Outbound URL handling, including redirects and server-side fetches of a caller-supplied URL.
- File uploads: type, size, storage path, and who can read the object.
- Cryptography: homemade encryption, weak hashing of secrets, and comparison of tokens that is not constant-time where the code compares secrets.
- Sensitive logging of tokens, credentials, message bodies, or customer identifiers.

Review code where Copi actions cross from model output into server-side business operations. Check that the server authorizes the action for the signed-in owner and organization, and that owner confirmation is enforced where the operation requires it. Do not trust identifiers, amounts, or recipients produced by the model.

## Finding status

Assign one status:

- **Confirmed.** The code path reaches the sink, and no guard or validation stops the unsafe use.
- **Review candidate.** A scanner alert or a suspicious path is not yet confirmed. Name the guard that might apply and what is still unknown.
- **Could not run.** The check needed a tool, environment, or credential that was not available. Name what was missing. Do not describe the check as passed.

Deduplicate findings that share the same sink and the same missing guard. Keep the scanner alert as evidence on the surviving finding.

## Reporting

Write `test-results/sast/<YYYY-MM-DD>-<short-sha>/REPORT.md` and give the same report in the reply. Include:

- the commit or environment reviewed, and whether the working tree differed;
- the components verified in scope, and the components looked for but not found;
- the checks actually run, with the command and the result;
- findings, each with severity, confidence, status, redacted evidence, file and line references where applicable, the recommended fix, and a verification step;
- coverage gaps, including checks that could not run.

Severity is `critical`, `high`, `medium`, or `low`, based on what an unauthorized caller can reach. Confidence is `high`, `medium`, or `low`. A clean review is acceptable. State what was scanned, what was traced by hand, and what was not reviewed.
