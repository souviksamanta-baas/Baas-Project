# Inventory stock import (KAN-306)

Use this template to load real test catalog + stock into Nexolia before reviewing **Gestionar stock**, **Ventas**, and **Lotes**.

## Template

Download/copy:

- `docs/templates/nexolia-stock-import-template.csv`

Open in Excel or Google Sheets and save as `.xlsx` if you prefer. Column headers must stay unchanged.

| Column | Required | Description |
| --- | --- | --- |
| `sku` | Yes | Unique SKU per organization |
| `product_name` | Yes | Display name |
| `description` | No | Product description |
| `unit_code` | Yes | e.g. `kg`, `unit`, `botella` |
| `unit_price_ars` | Yes | Price in whole pesos (no cents column) |
| `quantity_on_hand` | Yes | Current stock for the active business center |
| `reorder_threshold` | Yes | Low-stock alert threshold |
| `lot_code` | No | Optional lot identifier |
| `expires_at` | No | `YYYY-MM-DD` expiry for optional lot row |

## Import command

From repo root, with Supabase service role env vars set:

```bash
node scripts/import-stock-csv.mjs \
  --organization-id <ORG_UUID> \
  --business-center-id <CENTER_UUID> \
  --file docs/templates/nexolia-stock-import-template.csv
```

Required env:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The script upserts `products` by `(organization_id, sku)` and upserts `inventory_items` for the given business center. Optional lot rows create `inventory_lots` when `lot_code` is present.

## After import

1. Refresh the mobile app home metrics (**Productos con bajo stock**).
2. Open **Gestionar stock** and confirm quantities.
3. Exercise **Ventas** and **Lotes** flows with the imported SKUs.
