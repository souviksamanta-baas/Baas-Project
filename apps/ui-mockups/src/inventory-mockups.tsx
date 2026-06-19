import { type CSSProperties, type ReactElement, type ReactNode } from 'react';
import {
  ArrowLeftIcon,
  BellIcon,
  BoxIcon,
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EditIcon,
  InboxFilterButton,
  PixelBottomNav,
  PlusIcon,
  SearchIcon,
  StoreIcon,
  type InicioStyleControls,
} from './pixel-primitives';

interface InventoryScreenProps {
  controls: InicioStyleControls;
}

export function MobileManageStockPixel(props: InventoryScreenProps): ReactElement {
  return (
    <InventoryShell controls={props.controls}>
      <InventoryPageTitle
        showBack={false}
        subtitle="Buscá, escaneá y actualizá tu inventario"
        title="Gestionar stock"
      />
      <div className="mt-[14px] flex gap-[8px]">
        <div className="flex h-[34px] min-w-0 flex-1 items-center gap-[10px] rounded-[9px] border border-[#dfe7ec] bg-white px-[12px] text-[#65708a] shadow-[0_1px_8px_rgba(16,25,53,0.02)]">
          <SearchIcon />
          <span className="truncate text-[11px] font-medium">Buscar por producto o categoría</span>
        </div>
        <button
          className="flex h-[34px] w-[38px] shrink-0 items-center justify-center rounded-[9px] border border-[#08bd66] bg-[#e9f8ef] text-[#08bd66]"
          type="button"
        >
          <CameraIcon />
        </button>
        <InboxFilterButton />
      </div>
      <section className="mt-[14px] overflow-hidden rounded-[14px] border border-[#e4ebef] bg-white shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
        <div className="flex items-center justify-between border-b border-[#edf2f4] px-[14px] py-[10px]">
          <span className="text-[11px] font-semibold">Productos en inventario</span>
          <span className="text-[10px] font-medium text-[#56627b]">10 productos</span>
        </div>
        <InventoryListRow
          actions
          category="Almacén"
          code="Código asociado"
          name="Yerba Amanda 1kg"
          status="En stock"
          stock="24 u"
        />
        <InventoryListRow
          actions
          category="Lácteos"
          code="QR asociado"
          name="Leche Entera 1L"
          status="En stock"
          stock="18 u"
        />
        <InventoryListRow
          actions
          category="Almacén"
          code="Sin código"
          codeTone="red"
          createCode
          name="Camiseta Básica"
          status="Bajo stock"
          statusTone="orange"
          stock="2 u"
        />
        <InventoryListRow
          actions
          baseProduct
          category="Almacén"
          code="Código asociado"
          name="Harina granel 100 kg"
          status="Producto base"
          statusTone="blue"
          stock="100 kg"
        />
        <InventoryListRow
          actions
          category="Almacén"
          code="Código asociado"
          indent
          name="Harina 1 kg"
          status="En stock"
          stock="26 u"
          subproduct
        />
        <InventoryListRow
          actions
          category="Almacén"
          code="Código asociado"
          indent
          name="Harina 2 kg"
          status="En stock"
          stock="14 u"
          subproduct
        />
        <div className="flex items-center justify-between border-t border-[#edf2f4] px-[14px] py-[10px] text-[10px] font-medium text-[#56627b]">
          <span>1-10 de 24 productos</span>
          <div className="flex items-center gap-[4px]">
            <PaginationButton>&lt;</PaginationButton>
            <PaginationButton active>1</PaginationButton>
            <PaginationButton>2</PaginationButton>
            <PaginationButton>3</PaginationButton>
            <PaginationButton>&gt;</PaginationButton>
          </div>
        </div>
      </section>
      <button
        className="mt-[12px] flex w-full items-center gap-[12px] rounded-[14px] border border-[#e4ebef] bg-white px-[14px] py-[12px] text-left shadow-[0_1px_10px_rgba(16,25,53,0.03)]"
        type="button"
      >
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#e9f8ef] text-[#08bd66]">
          <PlusIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-extrabold">Agregar nuevo producto</span>
          <span className="mt-[2px] block text-[10px] font-medium text-[#56627b]">
            Creá productos, subproductos y generá códigos
          </span>
        </span>
        <ChevronRightIcon />
      </button>
    </InventoryShell>
  );
}

export function MobileProductDetailPixel(props: InventoryScreenProps): ReactElement {
  return (
    <InventoryShell controls={props.controls}>
      <InventoryPageTitle subtitle="Detalle y gestión del producto" title="Producto" />
      <ProductSummaryCard showBarcode showMeta stock="100 kg" title="Harina granel 100 kg" />
      <ProductActionBar />
      <section className="mt-[14px] overflow-hidden rounded-[14px] border border-[#e4ebef] bg-white shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
        <div className="border-b border-[#edf2f4] px-[14px] py-[10px]">
          <span className="text-[11px] font-semibold">Subproductos</span>
          <p className="mt-[4px] text-[10px] font-medium text-[#56627b]">
            Presentaciones creadas a partir de este producto.
          </p>
        </div>
        <InventoryListRow
          actions
          category="Almacén"
          code="Código asociado"
          indent
          name="Harina 1 kg"
          status="En stock"
          stock="26 u"
          subproduct
        />
        <InventoryListRow
          actions
          category="Almacén"
          code="Código asociado"
          indent
          name="Harina 2 kg"
          status="En stock"
          stock="12 u"
          subproduct
        />
        <InventoryListRow
          actions
          category="Almacén"
          code="Código asociado"
          indent
          name="Harina 5 kg"
          status="Bajo stock"
          statusTone="orange"
          stock="4 u"
          subproduct
        />
      </section>
      <section className="mt-[12px] rounded-[14px] border border-[#e4ebef] bg-white p-[14px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
        <h2 className="text-[12px] font-semibold">Lotes y precios</h2>
        <p className="mt-[4px] text-[10px] font-medium text-[#56627b]">
          Seguimiento de costo y precio por ingreso.
        </p>
        <div className="mt-[12px] overflow-hidden rounded-[10px] border border-[#edf2f4]">
          <div className="grid grid-cols-[1fr_88px_64px] gap-[8px] bg-[#f8fafb] px-[10px] py-[8px] text-[8px] font-semibold text-[#56627b]">
            <span />
            <span>Costo / Precio</span>
            <span className="text-right">Estado</span>
          </div>
          <BatchRow
            cost="$1.180"
            date="20/06"
            lot="L-250620-A"
            price="$1.900"
            qty="25 kg"
            status="Actual"
            statusTone="green"
          />
          <BatchRow
            cost="$1.220"
            date="05/06"
            lot="L-250605-B"
            price="$1.850"
            qty="30 kg"
            status="Cerrado"
          />
          <BatchRow
            cost="$1.250"
            date="18/05"
            lot="L-250518-C"
            price="$1.800"
            qty="45 kg"
            status="Cerrado"
          />
        </div>
        <p className="mt-[10px] text-[9px] font-medium text-[#56627b]">
          Precio actual actualizado según el último lote.
        </p>
      </section>
      <section className="mt-[12px] rounded-[14px] border border-[#e4ebef] bg-white p-[14px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
        <h2 className="text-[12px] font-semibold">Movimientos recientes</h2>
        <MovementRow amount="+25 kg" label="Ingreso de lote" time="Hoy" tone="green" />
        <MovementRow amount="" label="Ajuste de precio" time="Hoy" tone="blue" />
        <MovementRow amount="-10 kg" label="Transformación a Harina 1 kg" time="Hoy" tone="red" />
        <MovementRow amount="-8 kg" label="Transformación a Harina 2 kg" time="Ayer" tone="red" />
      </section>
      <section className="mt-[12px] rounded-[14px] border border-[#e4ebef] bg-white p-[14px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
        <h2 className="text-[12px] font-semibold">Código asociado</h2>
        <div className="mt-[10px] flex items-center gap-[10px]">
          <BarcodeIcon />
          <div>
            <div className="text-[12px] font-extrabold">7791234567890</div>
            <div className="text-[10px] font-medium text-[#56627b]">Código de barras</div>
          </div>
        </div>
        <button className="mt-[12px] flex h-[38px] w-full items-center justify-center gap-[8px] rounded-[10px] border border-[#08bd66] text-[11px] font-extrabold text-[#08bd66]" type="button">
          Ver / regenerar código
          <ChevronRightIcon />
        </button>
      </section>
      <section className="mt-[12px] rounded-[14px] border border-[#e4ebef] bg-white p-[14px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
        <h2 className="text-[12px] font-semibold">Notas</h2>
        <p className="mt-[8px] text-[10px] font-medium leading-[15px] text-[#56627b]">
          Producto base para fraccionado en presentaciones de 1 kg, 2 kg y 5 kg.
        </p>
      </section>
    </InventoryShell>
  );
}

export function MobileEditProductPixel(props: InventoryScreenProps): ReactElement {
  return (
    <InventoryShell controls={props.controls}>
      <InventoryPageTitle subtitle="Actualizá la información del producto" title="Editar producto" />
      <ProductSummaryCard badge="Producto con subproductos" changePhoto title="Harina granel 100 kg" />
      <FormCard>
        <FormField full label="Nombre del producto" value="Harina granel 100 kg" />
        <div className="grid grid-cols-2 gap-[10px]">
          <FormField label="Categoría" select value="Almacén" />
          <FormField greenBorder label="Estado" select value="En stock" />
        </div>
        <div className="grid grid-cols-2 gap-[10px]">
          <FormField label="Código" value="7791234567890" />
          <FormField label="Tipo de código" select value="Código de barras" />
        </div>
        <div className="grid grid-cols-2 gap-[10px]">
          <FormField label="SKU" value="HAR-GRA-100KG" />
          <FormField label="Unidad base" select value="kg" />
        </div>
        <div className="grid grid-cols-3 gap-[8px]">
          <FormField label="Costo" value="$1.250 / kg" />
          <FormField label="Precio de venta" value="$1.900 / kg" />
          <FormField label="Margen (%)" value="34%" />
        </div>
        <FormField full label="Sucursal" select value="Sucursal Centro" />
        <FormField
          full
          label="Notas"
          textarea
          value="Producto base para fraccionado en presentaciones menores."
        />
      </FormCard>
      <section className="mt-[12px] rounded-[14px] border border-[#e4ebef] bg-white p-[14px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
        <div className="flex items-start justify-between gap-[10px]">
          <div>
            <h2 className="text-[12px] font-semibold">Subproductos vinculados</h2>
            <p className="mt-[4px] text-[10px] font-medium text-[#56627b]">
              Estos productos usan el stock y el costo del producto base.
            </p>
          </div>
          <button className="shrink-0 rounded-[8px] border border-[#08bd66] px-[10px] py-[6px] text-[9px] font-extrabold text-[#08bd66]" type="button">
            + Agregar subproducto
          </button>
        </div>
        <LinkedSubproductRow name="Harina 1 kg" />
        <LinkedSubproductRow name="Harina 2 kg" />
      </section>
      <ActionButtonRow deleteLabel="Eliminar producto" primaryLabel="Guardar cambios" />
    </InventoryShell>
  );
}

export function MobileEditSubproductPixel(props: InventoryScreenProps): ReactElement {
  return (
    <InventoryShell controls={props.controls}>
      <InventoryPageTitle subtitle="Actualizá la información del subproducto" title="Editar subproducto" />
      <ProductSummaryCard
        changePhoto
        linkedTo="Harina granel 100 kg"
        title="Harina 1 kg"
      />
      <FormCard>
        <FormField full label="Nombre del producto" value="Harina 1 kg" />
        <div className="grid grid-cols-2 gap-[10px]">
          <FormField label="Categoría" select value="Almacén" />
          <FormField greenBorder label="Estado" select value="En stock" />
        </div>
        <div className="grid grid-cols-2 gap-[10px]">
          <FormField label="Código" value="7791234567001" />
          <FormField label="Tipo de código" select value="Código de barras" />
        </div>
        <div className="grid grid-cols-2 gap-[10px]">
          <FormField label="SKU" value="HAR-1KG" />
          <FormField label="Unidad" select value="unidad" />
        </div>
        <div className="grid grid-cols-3 gap-[8px]">
          <FormField label="Costo" value="$1.250" />
          <FormField label="Precio de venta" value="$1.900" />
          <FormField label="Margen (%)" value="34%" />
        </div>
        <FormField full label="Sucursal" select value="Sucursal Centro" />
        <FormField
          full
          label="Notas"
          textarea
          value="Subproducto derivado de harina granel. Mantener relación con producto base."
        />
      </FormCard>
      <section className="mt-[12px] rounded-[14px] border border-[#e4ebef] bg-white p-[14px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
        <h2 className="text-[12px] font-semibold">Relación con producto base</h2>
        <div className="mt-[10px] grid grid-cols-3 gap-[8px] text-[9px]">
          <InfoBlock label="Producto base" value="Harina granel 100 kg" />
          <InfoBlock label="Conversión" value="1 kg = 1 kg del producto base" />
          <InfoBlock label="Stock disponible del base" value="100 kg" />
        </div>
      </section>
      <ActionButtonRow deleteLabel="Eliminar subproducto" primaryLabel="Guardar cambios" />
    </InventoryShell>
  );
}

export function MobileAddStockPixel(props: InventoryScreenProps): ReactElement {
  return (
    <InventoryShell controls={props.controls}>
      <InventoryPageTitle
        subtitle="Registrá ingresos para el producto base o sus subproductos"
        title="Agregar stock"
      />
      <ProductSummaryCard stock="100 kg" title="Harina granel 100 kg" />
      <section className="mt-[14px]">
        <h2 className="text-[12px] font-semibold">¿A qué producto querés agregar stock?</h2>
        <RadioProductOption
          active
          meta="Producto base • Stock actual: 100 kg"
          name="Harina granel 100 kg"
        />
        <RadioProductOption meta="Stock actual: 26 u" name="Harina 1 kg" />
        <RadioProductOption meta="Stock actual: 14 u" name="Harina 2 kg" />
        <RadioProductOption meta="Stock actual: 8 u" name="Harina 5 kg" />
      </section>
      <section className="mt-[14px]">
        <h2 className="text-[12px] font-semibold">Detalle del ingreso</h2>
        <FormCard compact>
          <div className="grid grid-cols-2 gap-[10px]">
            <FormField label="Cantidad a ingresar" value="25" />
            <FormField label="Unidad" select value="kg" />
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            <FormField label="Costo" value="$1.180 / kg" />
            <FormField label="Proveedor" value="Molino Central" />
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            <FormField icon="calendar" label="Fecha de ingreso" value="Hoy • 09:41" />
            <FormField label="Lote" value="LOTE-HAR-0626" />
          </div>
          <FormField
            full
            label="Notas"
            textarea
            value="Ingreso manual de mercadería para reposición semanal."
          />
        </FormCard>
      </section>
      <div className="mt-[12px] flex items-start gap-[10px] rounded-[12px] bg-[#eef8ff] px-[12px] py-[10px] text-[10px] font-medium leading-[15px] text-[#101935]">
        <InfoCircleIcon />
        <span>
          Si seleccionás un subproducto, el ingreso se registra directamente sobre esa presentación.
        </span>
      </div>
      <button className="mt-[10px] flex w-full items-center justify-center gap-[6px] text-[11px] font-extrabold text-[#08bd66]" type="button">
        <PlusIcon />
        Registrar otro ingreso
      </button>
      <ActionButtonRow primaryLabel="Guardar ingreso" />
    </InventoryShell>
  );
}

export function MobileDeleteProductPixel(props: InventoryScreenProps): ReactElement {
  return (
    <InventoryShell controls={props.controls}>
      <InventoryPageTitle subtitle="Confirmá si querés eliminar este producto" title="Eliminar producto" />
      <ProductSummaryCard showBarcode stock="100 kg" title="Harina granel 100 kg" />
      <div className="mt-[12px] rounded-[14px] border border-[#ffd2dc] bg-[#fff0f3] p-[14px]">
        <div className="flex items-center gap-[8px] text-[#ff315f]">
          <WarningIcon />
          <span className="text-[11px] font-extrabold">Atención</span>
        </div>
        <p className="mt-[8px] text-[10px] font-medium leading-[15px] text-[#101935]">
          Al eliminar este producto base, también se verán afectados los subproductos vinculados y sus
          códigos asociados.
        </p>
        <p className="mt-[10px] text-[10px] font-extrabold text-[#ff315f]">Subproductos vinculados</p>
        <LinkedDeleteRow name="Harina 1 kg" />
        <LinkedDeleteRow name="Harina 2 kg" />
        <LinkedDeleteRow name="Harina 5 kg" />
      </div>
      <div className="mt-[12px] flex items-center gap-[12px] rounded-[14px] border border-[#b8ebcf] bg-[#e9f8ef] p-[14px]">
        <LightbulbIcon />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-extrabold text-[#08bd66]">Alternativa recomendada</div>
          <p className="mt-[4px] text-[10px] font-medium leading-[15px] text-[#101935]">
            Podés desactivar el producto para conservar historial y movimientos.
          </p>
        </div>
        <button className="shrink-0 rounded-[8px] border border-[#08bd66] bg-white px-[10px] py-[6px] text-[9px] font-extrabold text-[#08bd66]" type="button">
          Desactivar en su lugar
        </button>
      </div>
      <section className="mt-[12px] rounded-[14px] border border-[#e4ebef] bg-white p-[14px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
        <h2 className="text-[12px] font-semibold">Confirmación</h2>
        <p className="mt-[4px] text-[10px] font-medium text-[#56627b]">Escribí ELIMINAR para confirmar</p>
        <input
          className="mt-[10px] h-[42px] w-full rounded-[10px] border-2 border-[#101935] px-[12px] text-[12px] font-extrabold text-[#101935] outline-none"
          readOnly
          value="ELIMINAR"
        />
      </section>
      <div className="mt-[14px] grid grid-cols-2 gap-[10px]">
        <button className="h-[44px] rounded-[12px] border border-[#101935] text-[11px] font-extrabold text-[#101935]" type="button">
          Cancelar
        </button>
        <button className="h-[44px] rounded-[12px] bg-[#ff315f] text-[11px] font-extrabold text-white" type="button">
          Eliminar producto
        </button>
      </div>
      <p className="mt-[10px] text-center text-[10px] font-medium text-[#56627b]">
        Esta acción no se puede deshacer.
      </p>
    </InventoryShell>
  );
}

export function MobileSellProductsPixel(props: InventoryScreenProps): ReactElement {
  return (
    <InventoryShell controls={props.controls}>
      <InventoryPageTitle
        showBack={false}
        subtitle="Busca, agregá y cobrá tus productos"
        title="Vender productos"
      />
      <div className="mt-[14px] flex gap-[8px]">
        <div className="flex h-[34px] min-w-0 flex-1 items-center gap-[10px] rounded-[9px] border border-[#dfe7ec] bg-white px-[12px] text-[#65708a] shadow-[0_1px_8px_rgba(16,25,53,0.02)]">
          <SearchIcon />
          <span className="truncate text-[11px] font-medium">Buscar por producto o categoría</span>
        </div>
        <button
          className="flex h-[34px] w-[38px] shrink-0 items-center justify-center rounded-[9px] border border-[#08bd66] bg-[#e9f8ef] text-[#08bd66]"
          type="button"
        >
          <CameraIcon />
        </button>
        <InboxFilterButton />
      </div>
      <section className="mt-[12px] overflow-hidden rounded-[14px] border border-[#e4ebef] bg-white shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
        <div className="flex justify-end border-b border-[#edf2f4] px-[14px] py-[8px] text-[10px] font-medium text-[#56627b]">
          8 productos
        </div>
        <SellProductRow name="Yerba Amanda 1kg" price="$4.800" stock="Stock 24 u" />
        <SellProductRow name="Leche Entera 1L" price="$1.200" stock="Stock 18 u" />
        <SellProductRow name="Azúcar 500g" price="$950" stock="Stock 32 u" />
        <SellProductRow addKg name="Harina granel" price="$1.900 / kg" stock="Stock 100 kg" />
        <SellProductRow name="Harina 1 kg" price="$2.500" stock="Stock 26 u" />
        <SellProductRow name="Harina 2 kg" price="$4.800" stock="Stock 14 u" />
        <SellProductRow name="Arroz Largo Fino 1kg" price="$2.100" stock="Stock 20 u" />
        <SellProductRow name="Fideos 500g" price="$1.350" stock="Stock 15 u" />
      </section>
      <section className="mt-[12px] rounded-[14px] border border-[#e4ebef] bg-white p-[14px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
        <h2 className="text-[12px] font-semibold">Cobrar y emitir factura</h2>
        <CartRow name="Yerba Amanda 1kg" price="$9.600" qty="2 u" />
        <CartRow name="Harina granel" price="$3.325" qty="1,75 kg" weight />
        <div className="mt-[10px] space-y-[6px] border-t border-[#edf2f4] pt-[10px] text-[10px] font-medium">
          <div className="flex justify-between"><span>Subtotal</span><span>$15.700</span></div>
          <div className="flex items-center justify-between gap-[8px]">
            <span>Descuento</span>
            <div className="flex items-center gap-[6px]">
              <DiscountToggle />
              <span className="rounded-[6px] border border-[#dfe7ec] px-[8px] py-[2px] text-[10px] font-extrabold">10</span>
              <span className="text-[10px] font-extrabold text-[#3978e8]">-$1.070</span>
            </div>
          </div>
          <div className="flex justify-between text-[14px] font-extrabold text-[#08bd66]">
            <span>Total</span><span>$14.630</span>
          </div>
        </div>
        <div className="mt-[12px] grid grid-cols-2 gap-[8px]">
          <FormField compact compactLabel label="Cliente" select value="Consumidor final" />
          <FormField compact compactLabel label="Comprobante" select value="Factura ARCA" />
        </div>
        <p className="mt-[10px] text-[10px] font-semibold">Forma de pago</p>
        <div className="mt-[8px] flex gap-[6px] overflow-hidden">
          <PaymentChip active label="Efectivo" small />
          <PaymentChip label="Tarjetas" small />
          <PaymentChip label="Transferencia" small />
          <PaymentChip label="QR" small />
        </div>
        <div className="mt-[12px] grid grid-cols-2 gap-[8px]">
          <button className="flex h-[40px] items-center justify-center gap-[6px] rounded-[10px] border border-[#101935] text-[11px] font-extrabold text-[#101935]" type="button">
            Guardar venta
          </button>
          <button className="flex h-[40px] items-center justify-center gap-[6px] rounded-[12px] bg-[#08bd66] text-[11px] font-extrabold text-white" type="button">
            $ Cobrar
          </button>
        </div>
      </section>
    </InventoryShell>
  );
}

export function MobileConfirmPaymentPixel(props: InventoryScreenProps): ReactElement {
  return (
    <InventoryShell controls={props.controls}>
      <InventoryPageTitle
        subtitle="Revisá los productos antes de confirmar el pago"
        title="Confirmar cobro"
      />
      <div className="mt-[12px] flex items-start gap-[10px] rounded-[12px] bg-[#fff5e9] px-[12px] py-[10px]">
        <ClockIcon />
        <div>
          <div className="text-[11px] font-extrabold text-[#ff8a2a]">Estado del cobro</div>
          <div className="text-[10px] font-medium text-[#ff8a2a]">Pendiente de confirmación manual</div>
        </div>
      </div>
      <section className="mt-[12px] overflow-hidden rounded-[14px] border border-[#e4ebef] bg-white shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
        <div className="border-b border-[#edf2f4] px-[14px] py-[10px] text-[11px] font-semibold">
          Resumen de la venta
        </div>
        <SaleLineItem name="Yerba Amanda 1kg" price="$9.600" qty="Cantidad: 2 u" />
        <SaleLineItem name="Harina granel" price="$8.325" qty="1,75 kg" />
        <SaleLineItem name="Leche Entera 1L" price="$2.400" qty="Cantidad: 2 u" />
        <SaleLineItem name="Azúcar 500g" price="$1.900" qty="Cantidad: 2 u" />
        <SaleLineItem name="Fideos 500g" price="$4.010" qty="Cantidad: 3 u" />
        <div className="space-y-[6px] border-t border-[#edf2f4] px-[14px] py-[12px] text-[10px] font-medium">
          <div className="flex justify-between"><span>Subtotal</span><span>$26.235</span></div>
          <div className="flex justify-between text-[#3978e8]"><span>Descuento 10%</span><span>-$2.624</span></div>
          <div className="flex justify-between text-[14px] font-extrabold text-[#08bd66]">
            <span>Total a cobrar</span><span>$23.611</span>
          </div>
        </div>
      </section>
      <div className="mt-[12px] grid grid-cols-2 overflow-hidden rounded-[14px] border border-[#e4ebef] bg-white shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
        <div className="border-r border-[#edf2f4] p-[14px]">
          <PersonIcon />
          <div className="mt-[8px] text-[10px] font-medium text-[#56627b]">Cliente</div>
          <div className="mt-[2px] text-[11px] font-extrabold">Consumidor final</div>
        </div>
        <div className="p-[14px]">
          <DocumentIcon />
          <div className="mt-[8px] text-[10px] font-medium text-[#56627b]">Comprobante</div>
          <div className="mt-[2px] text-[11px] font-extrabold">Factura fiscal ARCA</div>
        </div>
      </div>
      <button className="mt-[12px] flex h-[40px] w-full items-center justify-center gap-[8px] rounded-[10px] border border-[#101935] text-[11px] font-extrabold text-[#101935]" type="button">
        <EditIcon />
        Editar venta
      </button>
      <button className="mt-[10px] flex h-[44px] w-full items-center justify-center gap-[8px] rounded-[12px] bg-[#08bd66] text-[11px] font-extrabold text-white" type="button">
        <CheckIcon />
        Confirmar pago completo
      </button>
      <p className="mt-[10px] flex items-center justify-center gap-[6px] text-[10px] font-medium text-[#08bd66]">
        <ShieldIcon />
        Marcá esta venta como cobrada una vez recibido el pago.
      </p>
    </InventoryShell>
  );
}

function InventoryShell(props: {
  children: ReactNode;
  controls: InicioStyleControls;
  navActive?: 'Inicio' | 'Inbox' | 'Copi' | 'Mas';
  navMutedCenter?: boolean;
}): ReactElement {
  const cssVars = {
    '--inicio-header-icon-size': `${props.controls.headerIconSize}px`,
    '--inicio-tagline-size': `${props.controls.taglineSize}px`,
  } as CSSProperties;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#fbfcfb] font-sans text-[#101935]" style={cssVars}>
      <div className="h-full overflow-y-auto pb-[88px]">
        <InventoryHeader controls={props.controls} />
        <div className="px-[20px] pt-[8px]">{props.children}</div>
      </div>
      <PixelBottomNav active={props.navActive} mutedCenter={props.navMutedCenter} />
    </div>
  );
}

function InventoryHeader(props: { controls: InicioStyleControls }): ReactElement {
  return (
    <div className="sticky top-0 z-30 bg-[#fbfcfb]/95 px-[20px] pb-[8px] pt-[7px] backdrop-blur">
      <div className="flex h-[16px] items-center justify-between text-[13px] font-extrabold leading-none">
        <span>9:41</span>
        <div className="flex items-center gap-[6px] text-black">
          <span className="flex h-[11px] w-[17px] items-end gap-[1.5px]">
            {[4, 6, 8, 10].map((height) => (
              <span className="w-[3px] rounded-[1px] bg-black" key={height} style={{ height }} />
            ))}
          </span>
        </div>
      </div>
      <div className="mt-[10px] flex items-start justify-between">
        <div>
          <img alt="Nexolia" className="h-[23px] w-[118px] object-contain object-left" src="/nexolia-logo.svg" />
          <div className="mt-[3px] font-normal text-[#53607a]" style={{ fontSize: 'var(--inicio-tagline-size)' }}>
            Tu negocio, mas inteligente
          </div>
        </div>
        <div className="flex items-center gap-[13px] pt-[1px]">
          <div className="relative flex h-[24px] w-[24px] items-center justify-center text-[#101935]">
            <BellIcon size="var(--inicio-header-icon-size)" strokeWidth={props.controls.headerIconStroke} />
            <span className="absolute right-[1px] top-[-2px] h-[5px] w-[5px] rounded-full bg-[#0ac46a]" />
          </div>
          <div className="flex h-[24px] items-center gap-[3px] text-[#101935]">
            <StoreIcon size="var(--inicio-header-icon-size)" strokeWidth={props.controls.headerIconStroke} />
            <ChevronDownIcon size="12px" strokeWidth={2.1} />
          </div>
          <div className="h-[30px] w-[30px] overflow-hidden rounded-full bg-gradient-to-br from-[#f3c5a6] via-[#f0d4c8] to-[#d8b1a0]">
            <div className="mx-auto mt-[5px] h-[23px] w-[18px] rounded-t-full bg-[#8d4c32]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryPageTitle(props: { showBack?: boolean; subtitle: string; title: string }): ReactElement {
  return (
    <div className="flex items-start gap-[10px]">
      {props.showBack !== false ? (
        <button className="mt-[2px] flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-[#dfe7ec] bg-white text-[#101935]" type="button">
          <ArrowLeftIcon />
        </button>
      ) : null}
      <div>
        <h1 className="text-[18px] font-extrabold leading-[22px] tracking-[-0.025em]">{props.title}</h1>
        <p className="mt-[7px] text-[11px] font-medium leading-[14px] text-[#56627b]">{props.subtitle}</p>
      </div>
    </div>
  );
}

function ProductSummaryCard(props: {
  badge?: string;
  changePhoto?: boolean;
  linkedTo?: string;
  showBarcode?: boolean;
  showMeta?: boolean;
  stock?: string;
  title: string;
}): ReactElement {
  return (
    <section className="mt-[14px] rounded-[14px] border border-[#e4ebef] bg-white p-[14px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
      <div className="flex items-start gap-[12px]">
        <div className="relative shrink-0">
          <FlourThumb />
          {props.changePhoto ? (
            <span className="absolute bottom-[-2px] right-[-2px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#08bd66] text-white">
              <EditIcon className="h-[10px] w-[10px]" />
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-extrabold">{props.title}</div>
          <div className="mt-[2px] text-[10px] font-medium text-[#56627b]">Almacén</div>
          {props.linkedTo ? (
            <div className="mt-[4px] text-[9px] font-medium text-[#3978e8]">Vinculado a: {props.linkedTo}</div>
          ) : null}
          {props.badge ? (
            <span className="mt-[6px] inline-flex items-center gap-[4px] rounded-full bg-[#eef8ff] px-[8px] py-[2px] text-[9px] font-medium text-[#3978e8]">
              <BoxIcon size="12px" />
              {props.badge}
            </span>
          ) : (
            <StockBadge className="mt-[6px]" label="En stock" />
          )}
        </div>
        {props.stock ? (
          <div className="text-right">
            <div className="text-[9px] font-medium text-[#56627b]">Stock actual</div>
            <div className="text-[16px] font-extrabold">{props.stock}</div>
            {props.showBarcode ? <div className="mt-[4px] flex justify-end"><BarcodeIcon /></div> : null}
          </div>
        ) : props.changePhoto ? (
          <button className="flex h-[32px] shrink-0 items-center gap-[6px] rounded-[8px] border border-[#08bd66] px-[10px] text-[9px] font-extrabold text-[#08bd66]" type="button">
            <CameraIcon />
            Cambiar foto
          </button>
        ) : null}
      </div>
      {props.showMeta ? (
        <div className="mt-[12px] grid grid-cols-2 gap-x-[12px] gap-y-[8px] border-t border-[#edf2f4] pt-[12px] text-[9px]">
          <MetaItem label="Código" value="7791234567890" />
          <MetaItem label="Precio de venta" value="$1.900 / kg" />
          <MetaItem label="Tipo de código" value="Código de barras" />
          <MetaItem label="Costo" value="$1.250 / kg" />
          <MetaItem label="SKU" value="HAR-GRAN-100KG" />
          <MetaItem label="Margen" value="34%" />
          <MetaItem label="Unidad" value="kg" />
          <MetaItem label="Sucursal" value="Sucursal Centro" />
        </div>
      ) : null}
    </section>
  );
}

function MetaItem(props: { label: string; value: string }): ReactElement {
  return (
    <div>
      <div className="font-medium text-[#56627b]">{props.label}</div>
      <div className="mt-[2px] font-extrabold">{props.value}</div>
    </div>
  );
}

function FlourThumb(): ReactElement {
  return (
    <div className="flex h-[52px] w-[52px] flex-col items-center justify-center rounded-[10px] border border-[#e4d5bc] bg-gradient-to-b from-[#fff8ea] to-[#f2dfbf] text-center">
      <span className="text-[6px] font-extrabold leading-[7px] text-[#8a5a22]">HARINA</span>
      <span className="text-[5px] font-medium text-[#8a5a22]">DE TRIGO</span>
      <span className="mt-[2px] text-[8px] font-extrabold text-[#101935]">100 kg</span>
    </div>
  );
}

function StockBadge(props: { className?: string; label: string; tone?: 'blue' | 'green' | 'orange' }): ReactElement {
  const toneClass = {
    blue: 'bg-[#eef8ff] text-[#3978e8]',
    green: 'bg-[#e9f8ef] text-[#08bd66]',
    orange: 'bg-[#fff0e4] text-[#ff7f2e]',
  }[props.tone ?? 'green'];

  return (
    <span className={`inline-flex rounded-full px-[8px] py-[2px] text-[9px] font-medium ${toneClass} ${props.className ?? ''}`}>
      {props.label}
    </span>
  );
}

function FormCard(props: { children: ReactNode; compact?: boolean }): ReactElement {
  return (
    <section className={`${props.compact ? 'mt-[10px]' : 'mt-[14px]'} space-y-[10px] rounded-[14px] border border-[#e4ebef] bg-white p-[14px] shadow-[0_1px_10px_rgba(16,25,53,0.03)]`}>
      {props.children}
    </section>
  );
}

function FormField(props: {
  compact?: boolean;
  compactLabel?: boolean;
  full?: boolean;
  greenBorder?: boolean;
  icon?: 'calendar';
  label: string;
  select?: boolean;
  textarea?: boolean;
  value: string;
}): ReactElement {
  const className = props.textarea
    ? 'min-h-[64px] resize-none py-[8px]'
    : 'h-[36px]';

  return (
    <label className={props.full ? 'block' : undefined}>
      <span className={`mb-[4px] block font-extrabold text-[#101935] ${props.compactLabel ? 'text-[11px]' : 'text-[9px]'}`}>
        {props.label}
      </span>
      <div
        className={`flex items-center rounded-[10px] border bg-white px-[10px] font-medium text-[#101935] ${
          props.greenBorder ? 'border-[#08bd66] text-[#08bd66]' : 'border-[#dfe7ec]'
        } ${className} ${props.compact ? 'h-[30px]' : ''} ${props.compactLabel ? 'text-[9px]' : 'text-[10px]'}`}
      >
        <span className="min-w-0 flex-1">{props.value}</span>
        {props.select ? <ChevronDownIcon size="10px" strokeWidth={2} /> : null}
        {props.icon === 'calendar' ? <CalendarIcon /> : null}
      </div>
    </label>
  );
}

function ActionButtonRow(props: { deleteLabel?: string; primaryLabel: string }): ReactElement {
  return (
    <>
      <div className="mt-[14px] grid grid-cols-2 gap-[10px]">
        <button className="h-[44px] rounded-[12px] border border-[#101935] text-[11px] font-extrabold text-[#101935]" type="button">
          Cancelar
        </button>
        <button className="h-[44px] rounded-[12px] bg-[#08bd66] text-[11px] font-extrabold text-white" type="button">
          {props.primaryLabel}
        </button>
      </div>
      {props.deleteLabel ? (
        <button className="mt-[10px] flex h-[42px] w-full items-center justify-center gap-[8px] rounded-[12px] border border-[#ff315f] text-[11px] font-extrabold text-[#ff315f]" type="button">
          <TrashIcon />
          {props.deleteLabel}
        </button>
      ) : null}
    </>
  );
}

function InventoryListRow(props: {
  actions?: boolean;
  baseProduct?: boolean;
  category: string;
  code: string;
  codeTone?: 'red';
  createCode?: boolean;
  indent?: boolean;
  name: string;
  status: string;
  statusTone?: 'blue' | 'orange';
  stock: string;
  subproduct?: boolean;
}): ReactElement {
  return (
    <div className={`border-b border-[#edf2f4] px-[14px] py-[10px] last:border-b-0 ${props.indent ? 'pl-[28px]' : ''}`}>
      <div className="flex items-start gap-[10px]">
        <FlourThumb />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-extrabold">{props.name}</div>
          <div className="mt-[2px] text-[10px] font-medium text-[#56627b]">{props.category}</div>
          <div className="mt-[6px] flex flex-wrap items-center gap-[8px]">
            <span className="text-[10px] font-extrabold">{props.stock}</span>
            <StockBadge
              label={props.status}
              tone={props.statusTone ?? (props.baseProduct ? 'blue' : 'green')}
            />
          </div>
          {!props.createCode ? (
            <div className={`mt-[4px] flex items-center gap-[4px] text-[9px] font-medium ${props.codeTone === 'red' ? 'text-[#ff315f]' : 'text-[#56627b]'}`}>
              <BarcodeIcon small />
              {props.code}
            </div>
          ) : null}
        </div>
        {props.actions ? (
          <div className="flex shrink-0 flex-col items-end gap-[6px]">
            <div className="flex gap-[8px]">
              <span className="text-[#3978e8]"><EditIcon className="h-[15px] w-[15px]" /></span>
              <span className="text-[#ff315f]"><TrashIcon className="h-[15px] w-[15px]" /></span>
              <span className="text-[#08bd66]"><PlusIcon /></span>
            </div>
          </div>
        ) : null}
      </div>
      {props.createCode ? (
        <div className="mt-[6px] flex items-center justify-between gap-[8px] pl-[62px]">
          <div className="flex items-center gap-[4px] text-[9px] font-medium text-[#ff315f]">
            <BarcodeIcon small />
            {props.code}
          </div>
          <button className="shrink-0 text-[9px] font-extrabold text-[#08bd66]" type="button">
            + Crear código
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PaginationButton(props: { active?: boolean; children: ReactNode }): ReactElement {
  return (
    <span
      className={`flex h-[22px] min-w-[22px] items-center justify-center rounded-[6px] px-[6px] ${
        props.active ? 'bg-[#08bd66] text-white' : 'border border-[#dfe7ec] bg-white'
      }`}
    >
      {props.children}
    </span>
  );
}

function ProductActionBar(): ReactElement {
  return (
    <div className="mt-[12px] flex overflow-hidden rounded-[14px] border border-[#e4ebef] bg-white shadow-[0_1px_10px_rgba(16,25,53,0.03)]">
      <button className="flex flex-1 flex-col items-center justify-center gap-[6px] py-[12px] text-[9px] font-extrabold text-[#3978e8]" type="button">
        <EditIcon className="h-[15px] w-[15px]" />
        Editar producto
      </button>
      <div className="w-px bg-[#edf2f4]" />
      <button className="flex flex-1 flex-col items-center justify-center gap-[6px] py-[12px] text-[9px] font-extrabold text-[#08bd66]" type="button">
        <PlusIcon />
        Agregar stock
      </button>
      <div className="w-px bg-[#edf2f4]" />
      <button className="flex flex-1 flex-col items-center justify-center gap-[6px] py-[12px] text-[9px] font-extrabold text-[#ff315f]" type="button">
        <TrashIcon className="h-[15px] w-[15px]" />
        Eliminar
      </button>
    </div>
  );
}

function BatchRow(props: {
  cost: string;
  date: string;
  lot: string;
  price: string;
  qty: string;
  status: string;
  statusTone?: 'green';
}): ReactElement {
  return (
    <div className="grid grid-cols-[1fr_88px_64px] items-center gap-[8px] border-t border-[#edf2f4] px-[10px] py-[10px]">
      <div className="min-w-0">
        <div className="text-[10px] font-extrabold">{props.lot}</div>
        <div className="mt-[2px] text-[9px] font-medium text-[#56627b]">{props.date}</div>
        <div className="mt-[2px] text-[9px] font-extrabold">{props.qty}</div>
      </div>
      <div className="text-[9px] font-extrabold">
        {props.cost} <span className="font-medium text-[#56627b]">/</span> {props.price}
      </div>
      <div className="flex justify-end">
        {props.statusTone === 'green' ? (
          <StockBadge label={props.status} tone="green" />
        ) : (
          <BatchStatusBadge label={props.status} />
        )}
      </div>
    </div>
  );
}

function BatchStatusBadge(props: { label: string }): ReactElement {
  return (
    <span className="inline-flex rounded-full bg-[#f1f3f5] px-[8px] py-[2px] text-[9px] font-medium text-[#56627b]">
      {props.label}
    </span>
  );
}

function DiscountToggle(): ReactElement {
  return (
    <div className="flex overflow-hidden rounded-[6px] border border-[#dfe7ec] text-[9px] font-extrabold">
      <span className="bg-[#08bd66] px-[8px] py-[3px] text-white">%</span>
      <span className="bg-white px-[8px] py-[3px] text-[#56627b]">$</span>
    </div>
  );
}

function MovementRow(props: { amount: string; label: string; time: string; tone: 'blue' | 'green' | 'red' }): ReactElement {
  const toneStyles = {
    blue: 'bg-[#eef8ff] text-[#3978e8]',
    green: 'bg-[#e9f8ef] text-[#08bd66]',
    red: 'bg-[#ffeaf0] text-[#ff315f]',
  }[props.tone];

  return (
    <div className="mt-[10px] flex items-center gap-[10px] border-t border-[#edf2f4] pt-[10px] first:mt-[12px] first:border-t-0 first:pt-0">
      <span className={`flex h-[24px] w-[24px] items-center justify-center rounded-full text-[11px] font-extrabold ${toneStyles}`}>
        {props.tone === 'green' ? '↓' : props.tone === 'red' ? '↑' : '$'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-extrabold">{props.label}</div>
        <div className="text-[10px] font-medium text-[#56627b]">{props.time}</div>
      </div>
      {props.amount ? (
        <div className={`text-[11px] font-extrabold ${props.tone === 'green' ? 'text-[#08bd66]' : 'text-[#ff315f]'}`}>
          {props.amount}
        </div>
      ) : null}
    </div>
  );
}

function LinkedSubproductRow(props: { name: string }): ReactElement {
  return (
    <div className="mt-[10px] flex items-center gap-[10px] border-t border-[#edf2f4] pt-[10px]">
      <FlourThumb />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-extrabold">{props.name}</div>
        <div className="text-[10px] font-medium text-[#56627b]">Usa stock del producto base</div>
      </div>
      <span className="flex items-center gap-[4px] text-[10px] font-extrabold text-[#08bd66]">
        <EditIcon />
        Editar
        <ChevronRightIcon />
      </span>
    </div>
  );
}

function RadioProductOption(props: { active?: boolean; meta: string; name: string }): ReactElement {
  return (
    <div
      className={`mt-[8px] flex items-center gap-[10px] rounded-[12px] border px-[12px] py-[10px] ${
        props.active ? 'border-[#08bd66] bg-[#f6fffa]' : 'border-[#dfe7ec] bg-white'
      }`}
    >
      <span className={`flex h-[16px] w-[16px] items-center justify-center rounded-full border ${props.active ? 'border-[#08bd66]' : 'border-[#cfd8df]'}`}>
        {props.active ? <span className="h-[8px] w-[8px] rounded-full bg-[#08bd66]" /> : null}
      </span>
      <FlourThumb />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-extrabold">{props.name}</div>
        <div className="text-[10px] font-medium text-[#56627b]">{props.meta}</div>
      </div>
    </div>
  );
}

function InfoBlock(props: { label: string; value: string }): ReactElement {
  return (
    <div>
      <div className="font-medium text-[#56627b]">{props.label}</div>
      <div className="mt-[4px] font-extrabold leading-[13px]">{props.value}</div>
    </div>
  );
}

function LinkedDeleteRow(props: { name: string }): ReactElement {
  return (
    <div className="mt-[8px] flex items-center gap-[8px] border-t border-[#ffd2dc] pt-[8px] first:border-t-0 first:pt-0">
      <FlourThumb />
      <span className="text-[10px] font-extrabold">{props.name}</span>
    </div>
  );
}

function SellProductRow(props: { addKg?: boolean; name: string; price: string; stock: string }): ReactElement {
  return (
    <div className="flex items-center gap-[10px] border-b border-[#edf2f4] px-[14px] py-[10px] last:border-b-0">
      <FlourThumb />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-extrabold">{props.name}</div>
        <div className="text-[10px] font-medium text-[#56627b]">Almacén</div>
        <div className="mt-[4px] text-[10px] font-medium text-[#56627b]">
          {props.price} • {props.stock}
        </div>
      </div>
      <EditIcon className="h-[15px] w-[15px]" />
      <button
        className="flex h-[38px] min-w-[38px] items-center justify-center rounded-[10px] border border-[#08bd66] px-[12px] text-[14px] font-extrabold text-[#08bd66]"
        type="button"
      >
        {props.addKg ? '+ kg' : '+'}
      </button>
    </div>
  );
}

function CartRow(props: { name: string; price: string; qty: string; weight?: boolean }): ReactElement {
  return (
    <div className="mt-[10px] flex items-center gap-[8px] border-t border-[#edf2f4] pt-[10px] first:mt-[12px] first:border-t-0 first:pt-0">
      <FlourThumb />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[6px]">
          <span className="text-[10px] font-extrabold">{props.name}</span>
          {props.weight ? (
            <span className="rounded-[5px] bg-[#eef8ff] px-[5px] py-[1px] text-[8px] font-medium text-[#3978e8]">peso</span>
          ) : null}
        </div>
        <div className="mt-[6px] flex items-center gap-[6px]">
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] border border-[#dfe7ec]">-</span>
          <span className="text-[10px] font-extrabold">{props.qty}</span>
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] border border-[#dfe7ec]">+</span>
        </div>
      </div>
      <div className="text-[10px] font-extrabold">{props.price}</div>
      <TrashIcon />
    </div>
  );
}

function PaymentChip(props: { active?: boolean; label: string; small?: boolean }): ReactElement {
  return (
    <span
      className={`flex shrink-0 items-center rounded-full border px-[12px] font-extrabold ${
        props.small ? 'h-[24px] text-[8px]' : 'h-[28px] text-[9px]'
      } ${
        props.active ? 'border-[#08bd66] bg-[#e9f8ef] text-[#08bd66]' : 'border-[#dfe7ec] bg-white text-[#56627b]'
      }`}
    >
      {props.label}
    </span>
  );
}

function SaleLineItem(props: { name: string; price: string; qty: string }): ReactElement {
  return (
    <div className="flex items-center gap-[10px] border-b border-[#edf2f4] px-[14px] py-[10px] last:border-b-0">
      <FlourThumb />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-extrabold">{props.name}</div>
        <div className="text-[10px] font-medium text-[#56627b]">{props.qty}</div>
      </div>
      <div className="text-[11px] font-extrabold">{props.price}</div>
      <TrashIcon />
    </div>
  );
}

function BarcodeIcon(props: { small?: boolean } = {}): ReactElement {
  const size = props.small ? 'h-[12px] w-[16px]' : 'h-[18px] w-[24px]';
  return (
    <svg className={size} fill="none" viewBox="0 0 24 18">
      {[2, 5, 7, 10, 12, 15, 18, 20].map((x, index) => (
        <rect fill="currentColor" height="14" key={x} width={index % 2 === 0 ? 1.5 : 2.5} x={x} y="2" />
      ))}
    </svg>
  );
}

function TrashIcon(props: { className?: string } = {}): ReactElement {
  return (
    <svg className={props.className ?? 'h-[14px] w-[14px]'} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V5h6v2" />
    </svg>
  );
}

function CalendarIcon(): ReactElement {
  return (
    <svg className="h-[14px] w-[14px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <rect height="16" rx="2" width="18" x="3" y="5" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function InfoCircleIcon(): ReactElement {
  return (
    <svg className="mt-[1px] h-[16px] w-[16px] shrink-0 text-[#1688e8]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </svg>
  );
}

function WarningIcon(): ReactElement {
  return (
    <svg className="h-[16px] w-[16px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function LightbulbIcon(): ReactElement {
  return (
    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white text-[#08bd66]">
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M12 3a6 6 0 0 0-3 11v2h6v-2a6 6 0 0 0-3-11Z" />
      </svg>
    </span>
  );
}

function ClockIcon(): ReactElement {
  return (
    <svg className="mt-[1px] h-[18px] w-[18px] shrink-0 text-[#ff8a2a]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function PersonIcon(): ReactElement {
  return (
    <svg className="h-[18px] w-[18px] text-[#3978e8]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c.8-3.2 3-5 6.5-5s5.7 1.8 6.5 5" />
    </svg>
  );
}

function DocumentIcon(): ReactElement {
  return (
    <svg className="h-[18px] w-[18px] text-[#3978e8]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M8 4h8l4 4v12H8V4Z" />
      <path d="M16 4v4h4" />
      <path d="M11 13h6" />
      <path d="M11 17h6" />
    </svg>
  );
}

function ShieldIcon(): ReactElement {
  return (
    <svg className="h-[14px] w-[14px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z" />
      <path d="m9.5 12.5 1.8 1.8L16 9.5" />
    </svg>
  );
}
