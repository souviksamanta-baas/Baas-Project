---
name: nexolia-api-security
description: Run a read-only API security review of Nexolia. Inventories NestJS routes, guards, and permissions, then checks tenant isolation, object ownership, role enforcement, webhook signatures, cron authentication, and Copi confirmation with two synthetic organizations. Use when the user asks for an API security review, tenant isolation, IDOR, authorization, webhook signature, or rate-limit checks.
---

# Nexolia API security

Run a read-only review of the API's authorization boundaries and write an evidence-based report. Discover the repository as it is. Do not assume a package, workflow, or integration is in scope until it is found.

## Before acting

1. Record the target: commit SHA, branch, and whether the review is of the working tree or a named environment. If the working tree differs from the commit, say so.
2. Discover the project structure, package manager, workspace layout, CI workflows, deployed components, and existing tools. Read the root manifest, workspace manifests, `.github/workflows`, Supabase config and `supabase/migrations`, and environment examples. Report missing environment variables by name only.
3. Use this stack only as a starting point, and include a component only after verifying it is present: NestJS API, Expo/React Native app, web app, Supabase, Railway, GitHub, Meta, Twilio, ARCA. A sibling checkout is in scope only when it is in the workspace or the user points at it.
4. Prefer existing repository tooling. Look for the current API test runner, E2E project, webhook fixtures, and any committed auth or rate-limit tests. If the Copi product contract is in the repo, read it before judging confirmation behavior. Do not install new scanners unless the user asks.
5. The review is read-only. Do not change production code, configuration, dependencies, schemas, migrations, secrets, or deployment settings unless the user explicitly asks for a fix.

## Runtime checks

Use a local or approved staging environment and synthetic fixtures. Do not run checks against production.

Create two synthetic organizations and use the application's actual roles. Define an allowed case and a denied case for each sensitive operation. Generate a unique run ID. Clean up only rows for that run ID.

Stub paid or externally visible operations. Do not send messages, issue invoices, or trigger OTPs. Use integration fixtures and mocks for Meta and Twilio webhook signature validation, duplicate-event handling, cron authentication, and ARCA access boundaries.

Keep credential values, customer data, and tokens out of reports and logs. Redact secrets, session tokens, phone numbers, message bodies, and document identifiers.

## Method

Derive an endpoint and permission inventory from NestJS routes, guards, and available API specifications. Record the method, path, guard, required role, and organization source for each sensitive operation. A route with no guard is part of the inventory, not a skipped route.

Prioritize tenant isolation and object ownership in lists, detail views, writes, exports, and file access. For each of those operations, call it as a member of organization A with an identifier that belongs to organization B.

Also cover:

- Sensitive response fields. A denied caller must not receive another tenant's data inside an error or a list.
- Server-side role enforcement. A client check or a hidden control is not authorization.
- Validation of writable fields. A caller must not set a field the role is not allowed to write, including organization, role, and ownership fields.
- Copi actions. A model-proposed action must honor the current user's permissions and require owner confirmation where the product specifies it. Do not trust identifiers, amounts, or recipients produced by the model.
- Configured rate limits. Verify enforcement with bounded, deterministic tests against isolated test fixtures. Do not generate open-ended traffic.

For every denied write, read the stored row afterward and assert that it did not change.

Deduplicate findings that share the same route, the same missing guard, and the same cross-tenant or cross-role result.

## Finding status

Assign one status:

- **Confirmed.** The denied caller received another tenant's data, changed stored state, or reached an operation the role does not allow.
- **Review candidate.** The inventory shows a sensitive route whose guard or ownership check is unclear, and the runtime check did not settle it. Name what is still unknown.
- **Could not run.** The check needed a local API, two synthetic organizations, a fixture, or a mock that was not available. Name what was missing. Do not describe the check as passed.

## Reporting

Write `test-results/api-security/<YYYY-MM-DD>-<short-sha>/REPORT.md` and give the same report in the reply. Include:

- the commit or environment reviewed, and whether the working tree differed;
- the endpoint and permission inventory, and the components verified in scope;
- the checks actually run, with the command and the result;
- findings, each with severity, confidence, status, redacted evidence, file and line references where applicable, the recommended fix, and a verification step;
- for each denied write, whether stored state changed;
- coverage gaps, including checks that could not run.

Severity is `critical`, `high`, `medium`, or `low`, based on what a member of another organization or a lower role can do. Confidence is `high`, `medium`, or `low`. A clean review is acceptable. State which routes were called and which were only inventoried.
