---
name: nexolia-dast
description: Run a read-only defensive runtime check of Nexolia's running web app in local or approved staging. Uses passive inspection and predefined smoke checks with normal requests and benign test data. Use when the user asks for DAST, a runtime security smoke test, security headers, CORS, cookie attributes, logout, cache controls, or error redaction on the web app.
---

# Nexolia DAST

Run a read-only defensive check of the running web app and write an evidence-based report. Discover the repository as it is. Do not assume a package, workflow, or integration is in scope until it is found.

## Before acting

1. Record the target: commit SHA, branch, the base URL, and whether the review is of the working tree or a named environment. If the working tree differs from the commit, say so.
2. Discover the project structure, package manager, workspace layout, CI workflows, deployed components, and existing tools. Read the root manifest, workspace manifests, `.github/workflows`, Supabase config and `supabase/migrations`, and environment examples. Report missing environment variables by name only.
3. Use this stack only as a starting point, and include a component only after verifying it is present: NestJS API, Expo/React Native app, web app, Supabase, Railway, GitHub, Meta, Twilio, ARCA. This skill checks the running web app. A sibling checkout is in scope only when it is in the workspace or the user points at it. The API is in scope only for the responses the web app receives during these smoke checks.
4. Prefer existing repository tooling. Look for a committed smoke, header, or browser check and run that before adding a manual request. Do not install new scanners unless the user asks.
5. The review is read-only. Do not change production code, configuration, dependencies, schemas, migrations, secrets, or deployment settings unless the user explicitly asks for a fix.

## Runtime checks

Use a local or approved staging environment and synthetic fixtures. Do not run checks against production.

Use passive inspection and predefined smoke checks. Send normal requests with benign test data. Use ordinary signed-in and signed-out application flows. Do not perform an active security assessment. Coverage that needs attack payloads, fuzzing, or exploit attempts is a coverage gap, not a check to run.

Stub paid or externally visible operations. Do not send messages, issue invoices, or trigger OTPs.

Keep credential values, customer data, and tokens out of reports and logs. Redact secrets, session cookies, phone numbers, message bodies, and document identifiers. A header name and a redacted value are enough.

## Method

Confirm the web app is the local or approved staging instance before sending any request. Then run the smoke checks that apply to the routes that exist:

- HTTPS and redirect behavior, including an HTTP request that should land on HTTPS.
- Security headers on document and authenticated responses.
- CORS policy for the web app's own origin and for an unrelated origin.
- Cookie attributes where the app sets a cookie, including a session cookie after sign-in.
- Logout behavior: the session cookie is cleared or expired, and a later authenticated request is refused.
- Cache controls for authenticated content.
- Redaction of error responses: a benign bad request does not return a stack trace, a query, or a credential.
- Benign markup fixtures display as text where the UI expects plain text. Use a fixture that is clearly data, and record whether the screen shows the characters rather than treating them as markup.

For each check record the expected behavior, the observed behavior, the route, and redacted response evidence.

Deduplicate findings that share the same route, the same missing control, and the same observed behavior.

## Finding status

Assign one status:

- **Confirmed.** The smoke check ran, and the observed behavior differs from the expected behavior.
- **Review candidate.** The response is ambiguous, or the check could not tell a signed-in session from a signed-out one. Name what is still unknown.
- **Could not run.** The check needed a running app, a test account, or a tool that was not available. Name what was missing. Do not describe the check as passed.

Mark coverage that requires an active security assessment as its own coverage gap. Do not fill that gap with exploit attempts.

## Reporting

Write `test-results/dast/<YYYY-MM-DD>-<short-sha>/REPORT.md` and give the same report in the reply. Include:

- the commit or environment reviewed, the base URL, and whether the working tree differed;
- the components verified in scope, and the components looked for but not found;
- the checks actually run, with the command and the result;
- findings, each with severity, confidence, status, expected and observed behavior, route, redacted response evidence, file and line references where applicable, the recommended fix, and a verification step;
- coverage gaps, including checks that could not run and any coverage that requires an active security assessment.

Severity is `critical`, `high`, `medium`, or `low`, based on what a signed-out or signed-in user receives. Confidence is `high`, `medium`, or `low`. A clean review is acceptable. State which flows were signed in, which were signed out, and which checks were not run.
