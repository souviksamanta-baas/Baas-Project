# ARCA Facturación electrónica

Backend-only ARCA (ex-AFIP) electronic invoicing for Nexolia Owner. Mobile never calls SOAP/XML.

**Epic:** [KAN-377](https://souviksamanta.atlassian.net/browse/KAN-377)  
**Confluence:** [ARCA Facturación electrónica — Nexolia](https://souviksamanta.atlassian.net/wiki/spaces/BaaS/pages/31490049/ARCA+Facturaci+n+electr+nica+Nexolia)

## Architecture

```text
Expo (settings / emit / facturas)
        │ Bearer JWT
        ▼
Nest  /arca/*  +  /billing/*
        │
   domains/arca  (WSAA · WSFEv1 · QR · PDF)
   domains/billing (issue / list / get)
        │ SOAP
        ▼
      ARCA
```

Merchants authorize **Nexolia** in Administrador de Relaciones. Platform cert/key live in API env (`ARCA_PLATFORM_*`); org rows hold CUIT, tax condition, PV, and connection status — not Clave Fiscal.

## Nest modules

| Path | Role |
| --- | --- |
| `apps/api/src/domains/arca/` | WSAA ticket cache, WSFEv1 adapter, connection CRUD, QR + AFIP-style PDF (`pdfTemplate: afip_v1`) |
| `apps/api/src/domains/billing/` | `InvoiceService` orchestration, issuance lock, FECompConsultar recovery |

Env vars: see `docs/environment.md` (ARCA section).

## REST API (owner-authenticated)

All routes require `Authorization: Bearer <supabase_jwt>` and org membership.

### Connection

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/arca/connection?organizationId=` | Connection summary |
| `POST` | `/arca/connection` | Upsert CUIT, tax condition, PV, environment, optional merchant cert |
| `POST` | `/arca/connection/confirm-delegation` | Mark connected after Administrador de Relaciones |

### Invoices

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/billing/invoices` | Issue Factura/NC/ND (CAE); optional `sellQuoteId` |
| `GET` | `/billing/invoices?organizationId=` | List |
| `GET` | `/billing/invoices/:invoiceId?organizationId=` | Detail + PDF (regenerates if template outdated) |

OpenAPI DTOs: `IssueInvoiceDto`, `IssuedInvoiceResponseDto`, `ArcaConnectionSummaryDto` in `apps/api/src/docs/openapi.dtos.ts`.

## Mobile surfaces

- **Configuración del negocio → Facturación ARCA** — connect / confirm delegation
- **Presupuesto cobrado** — Emitir factura → invoice detail (no success modals)
- **Facturas** — list + detail (CAE, PV-número, share PDF)

Presupuestos (`sell_quotes`) stay non-fiscal; authorized invoices link back via `sell_quote_id`.

## Status

| Story | Status |
| --- | --- |
| Schema (378) | Done |
| Nest adapter (379) | Done |
| Issue + lock (380) | Done |
| PDF + QR (381) | Done |
| Mobile UX (382) | Done |
| Homologación E2E + production representation (383) | In progress — remaining E2E / production onboarding validation |
