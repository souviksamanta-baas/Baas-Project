# Inventory stock import (KAN-306)

Plantilla en español para cargar catálogo y stock real en Nexolia antes de revisar **Gestionar stock**, **Ventas** y **Lotes**.

## Plantilla

Descargá o copiá:

- `docs/templates/nexolia-stock-import-template.csv`

Abrila en Excel o Google Sheets. **No cambies los nombres de las columnas** (primera fila).

### Columnas

| Columna | Obligatoria | Descripción | Campo en base de datos |
| --- | --- | --- | --- |
| `nombre_producto` | Sí | Nombre visible del producto | `products.name` |
| `categoria` | No | Rubro (ej. `Almacén`) | `products.metadata.categoria` |
| `tipo_producto` | No | `producto` (default) o `subproducto` | `products.metadata.tipo_producto` + `parent_product_id` |
| `producto_base` | Condicional | Nombre del producto base | `products.parent_product_id` |
| `proveedor` | No | Proveedor o marca | `products.metadata.proveedor`, `inventory_lots.supplier_reference` |
| `notas` | No | Observaciones internas del comercio | `products.description` |
| `sucursal` | Sí* | Nombre de la sucursal en Nexolia | `inventory_items.business_center_id`, `inventory_lots.business_center_id` |
| `unidad` | Sí | Unidad de stock (ej. `kg`, `paquete`) | `products.base_unit_code`, `inventory_items.unit_code` |
| `cantidad_stock` | Sí | Stock actual en esa sucursal | `inventory_items.quantity_on_hand` |
| `umbral_reorden` | Sí | Alerta de bajo stock | `inventory_items.reorder_threshold` |
| `equivalente_unidad_base` | Condicional | Cuántas unidades del **producto base** consume **cada unidad** de este subproducto | `products.metadata.equivalente_unidad_base` |
| `precio_costo` | Sí | Costo de compra en pesos enteros | `products.metadata.precio_costo_cents`, `inventory_lots.unit_cost_cents` (con lote) |
| `precio_venta` | Sí | Precio de venta en pesos enteros | `products.unit_price_cents` |
| `lote_fecha` | No | Fecha del lote `dd/mm/aaaa` | `inventory_lots.received_at` + código generado |
| `fecha_vencimiento` | No | Vencimiento `dd/mm/aaaa` | `inventory_lots.expires_at` |

\* `sucursal` puede omitirse solo si pasás `--business-center-id` al comando (usa esa sucursal para todas las filas).

### SKU (código interno)

No va en la plantilla. El sistema genera un SKU único por organización a partir del nombre.

### Sucursal

El valor debe coincidir con el **nombre** (o `code`) de una sucursal activa en Nexolia, por ejemplo `Centro` para la sucursal principal. Una misma planilla puede cargar stock en varias sucursales usando filas con distinto valor en `sucursal`.

### Precio de venta vs costo

- **`precio_venta`** → precio al cliente (`products.unit_price_cents`).
- **`precio_costo`** → costo de compra. Se guarda en `products.metadata.precio_costo_cents` para el cálculo de margen en la UI, y también en `inventory_lots.unit_cost_cents` cuando cargás `lote_fecha`.

El margen no va en la plantilla: la app lo calcula en la ficha del producto a partir de costo y precio de venta. En subproductos sin costo propio, usa el costo del `producto_base × equivalente_unidad_base`.

Ejemplo mockup: costo `$1.250 / kg`, venta `$1.900 / kg` → `precio_costo=1250`, `precio_venta=1900` (margen mostrado en app: 52%).

### Lotes

Cada fila del CSV puede representar **un lote distinto**, incluso si `nombre_producto` se repite (ej. dos ingresos de leche con fechas distintas).

- **`lote_fecha`** en la fila → crea un lote con código `LOT-AAAAMMDD` (sufijo `-02`, `-03` si se repite producto + fecha).
- **`cantidad_stock`** en filas repetidas **se suma** en el stock de la sucursal (30 + 30 = 60).
- **`subproducto` sin `lote_fecha`** → hereda fecha, vencimiento y costo del lote más reciente del `producto_base` en la misma sucursal.
- **`precio_venta` vacío** en productos granel → se importa en $0; podés editarlo después en la app.

### Producto vs subproducto

| `tipo_producto` | Cuándo | `producto_base` |
| --- | --- | --- |
| `producto` | Ítem principal o vendible | Vacío |
| `subproducto` | Presentación derivada | Nombre exacto del producto base |

Importá productos base antes que subproductos. El script ordena automáticamente.

### Relación de stock base ↔ subproducto

Los subproductos pueden venderse en otra unidad que el producto base (ej. granel en **kg**, paquete en **paquete**). La columna **`equivalente_unidad_base`** define cuánto stock del producto base se descuenta por cada unidad del subproducto.

| Ejemplo | `unidad` subproducto | `equivalente_unidad_base` | Efecto |
| --- | --- | --- | --- |
| Harina granel | `kg` | *(vacío — es producto base)* | Stock propio en kg |
| Harina 1 kg | `kg` | `1` | 1 unidad subproducto = 1 kg del granel |
| Harina paquete 250 g | `paquete` | `0.25` | 1 paquete = 0,25 kg del granel |

- Obligatoria para filas con `tipo_producto=subproducto` (número decimal > 0, coma o punto).
- Dejala vacía en productos base.
- La unidad del producto base viene de su columna `unidad` (ej. `kg`).
- Al agregar stock a un subproducto, la app descuenta `cantidad × equivalente_unidad_base` del stock del producto base y registra un movimiento `conversion_out` en el producto base.

## Columnas extra (no en la plantilla)

El importador acepta columnas adicionales si las necesitás más adelante:

| Columna | Campo destino |
| --- | --- |
| `codigo_barras` | `products.metadata.codigo_barras` |

## Comando de importación

Desde la raíz del repo:

```bash
node scripts/import-stock-csv.mjs \
  --organization-id <ORG_UUID> \
  --file docs/templates/nexolia-stock-import-template.csv
```

Opcional: sucursal por defecto para filas sin `sucursal`:

```bash
node scripts/import-stock-csv.mjs \
  --organization-id <ORG_UUID> \
  --business-center-id <CENTER_UUID> \
  --file docs/templates/nexolia-stock-import-template.csv
```

Variables requeridas:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Después de importar

1. Refrescá la app y revisá **Productos con bajo stock** en Inicio.
2. Abrí **Gestionar stock** por sucursal y confirmá cantidades y precios.
3. Probá **Ventas** y **Lotes** con los productos importados.
