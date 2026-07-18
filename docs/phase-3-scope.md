# Phase 3 Scope (Planning Stub)

Confluence: [Phase 3 Planning (Stub)](https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/22904833/Phase+3+Planning+Stub) · Jira: [KAN-330](https://souviksamanta.atlassian.net/browse/KAN-330)

This document captures candidate Phase 3 work identified after the Task Portal MVP. It is not an approved roadmap; use Jira epics for execution tracking.

## Candidate themes

### Commerce and operations

- POS / checkout integration with inventory movements
- Formal presupuestos (quotes) with quantity parsing and approval workflow
- Accounting or ERP export (stock, sales, cuenta corriente)

### CRM and inbox maturity

- Lead status lifecycle (KAN-313 epic): `new` → `active`, manual picker, inbox filter alignment
- Multi-channel production polish beyond WhatsApp (Instagram, Facebook, email send/receive)
- Staff invite multi-sucursal picker (UI deferred; invites still attach the default center)

### Task portal v2

- Authenticated NestJS task CRUD endpoints (mobile today uses Supabase RLS direct access)
- Unified alert read/unread model and additional `owner_notifications` types (overdue task, Copi, sales)
- Push notification deep links into task portal routes
- Manual task creation, assignment, and due-date editing from mobile
- Scheduler runbook and monitoring for `POST /tasks/run-maintenance`

### Copi and AI

- Copi roadmap modules from business context: AFIP invoices, purchases, cash register, appointments, analytics
- WhatsApp send from Copi (currently deferred)

### Platform

- Phone OTP production provider (separate from email OTP pilot)
- Nexolia Web production launch epics (KAN-288, KAN-287)
- UI mockup parity reopen (KAN-201 inventory/POS API wiring)

## Dependencies

- Phase 2 pilot readiness remains the baseline: `docs/phase-2-quality-pilot-readiness.md`
- Task Portal implementation: `docs/mobile-app.md` (Centro de tareas section)
- Copi architecture: `docs/copi-architecture.md`

## Suggested Jira structure

| Epic | Theme |
| --- | --- |
| Task Portal v2 | Authenticated APIs, alert types, push deep links |
| CRM lifecycle | KAN-313 and children |
| Commerce / POS | KAN-201 follow-through |
| Phase 3 platform | OTP prod, web launch, ops hardening |
