export type StockTone = 'blue' | 'green' | 'orange' | 'red';

export interface InventoryProductMock {
  category: string;
  code: string;
  codeTone?: 'red';
  createCode?: boolean;
  id: string;
  indent?: boolean;
  isBase?: boolean;
  name: string;
  price?: string;
  status: string;
  statusTone?: StockTone;
  stock: string;
}

export interface SubproductMock {
  id: string;
  name: string;
  price: string;
  status: string;
  statusTone?: StockTone;
  stock: string;
}

export interface BatchMock {
  cost: string;
  date: string;
  id: string;
  lot: string;
  price: string;
  qty: string;
  status: string;
  statusTone?: 'green';
}

export interface MovementMock {
  amount?: string;
  id: string;
  label: string;
  time: string;
  tone: 'blue' | 'green' | 'red';
}

export interface SellProductMock {
  category?: string;
  id: string;
  indent?: boolean;
  linkedTo?: string;
  name: string;
  price: string;
  soldByWeight?: boolean;
  stock: string;
  unitPriceCents: number;
}

export interface CartItemMock {
  id: string;
  name: string;
  price: string;
  qty: string;
  weight?: boolean;
}

export const baseProduct = {
  category: 'Almacen',
  code: '7791234567890',
  cost: '$1.250 / kg',
  margin: '34%',
  name: 'Harina granel 100 kg',
  notes: 'Producto base para fraccionado en presentaciones de 1 kg, 2 kg y 5 kg.',
  price: '$1.900 / kg',
  sku: 'HAR-GRAN-100KG',
  stock: '100 kg',
  unit: 'kg',
};

export const inventoryProducts: InventoryProductMock[] = [
  { category: 'Almacen', code: 'Codigo asociado', id: 'p1', name: 'Yerba Amanda 1kg', status: 'En stock', stock: '24 u' },
  { category: 'Lacteos', code: 'QR asociado', id: 'p2', name: 'Leche Entera 1L', status: 'En stock', stock: '18 u' },
  { category: 'Almacen', code: 'Sin codigo', codeTone: 'red', createCode: true, id: 'p3', name: 'Camiseta Basica', status: 'Bajo stock', statusTone: 'orange', stock: '2 u' },
  { category: 'Almacen', code: 'Codigo asociado', id: 'p4', isBase: true, name: 'Harina granel 100 kg', status: 'Producto base', statusTone: 'blue', stock: '100 kg' },
  { category: 'Almacen', code: 'Codigo asociado', id: 'p5', indent: true, name: 'Harina 1 kg', status: 'En stock', stock: '26 u' },
  { category: 'Almacen', code: 'Codigo asociado', id: 'p6', indent: true, name: 'Harina 2 kg', status: 'En stock', stock: '14 u' },
];

export const subproducts: SubproductMock[] = [
  { id: 's1', name: 'Harina 1 kg', price: '$2.500', status: 'En stock', stock: '26 u' },
  { id: 's2', name: 'Harina 2 kg', price: '$4.800', status: 'En stock', stock: '12 u' },
  { id: 's3', name: 'Harina 5 kg', price: '$11.500', status: 'Bajo stock', statusTone: 'orange', stock: '4 u' },
];

export const batches: BatchMock[] = [
  { cost: '$1.180', date: '20/06', id: 'b1', lot: 'L-250620-A', price: '$1.900', qty: '25 kg', status: 'Actual', statusTone: 'green' },
  { cost: '$1.220', date: '05/06', id: 'b2', lot: 'L-250605-B', price: '$1.850', qty: '30 kg', status: 'Cerrado' },
  { cost: '$1.250', date: '18/05', id: 'b3', lot: 'L-250518-C', price: '$1.800', qty: '45 kg', status: 'Cerrado' },
];

export const movements: MovementMock[] = [
  { amount: '+25 kg', id: 'm1', label: 'Ingreso de lote', time: 'Hoy', tone: 'green' },
  { id: 'm2', label: 'Ajuste de precio', time: 'Hoy', tone: 'blue' },
  { amount: '-10 kg', id: 'm3', label: 'Transformacion a Harina 1 kg', time: 'Hoy', tone: 'red' },
  { amount: '-8 kg', id: 'm4', label: 'Transformacion a Harina 2 kg', time: 'Ayer', tone: 'red' },
];

export const sellProducts: SellProductMock[] = [
  { id: 'sp1', name: 'Yerba Amanda 1kg', price: '$4.800', stock: 'Stock 24 u', unitPriceCents: 480000 },
  { id: 'sp2', name: 'Leche Entera 1L', price: '$1.200', stock: 'Stock 18 u', unitPriceCents: 120000 },
  { id: 'sp3', name: 'Azucar 500g', price: '$950', stock: 'Stock 32 u', unitPriceCents: 95000 },
  {
    id: 'sp4',
    name: 'Harina granel',
    price: '$1.900 / kg',
    soldByWeight: true,
    stock: 'Stock 100 kg',
    unitPriceCents: 190000,
  },
  {
    category: 'Almacen',
    id: 'sp5',
    indent: true,
    linkedTo: 'Harina granel',
    name: 'Harina 1 kg',
    price: '$2.500',
    stock: 'Stock 26 u',
    unitPriceCents: 250000,
  },
  {
    category: 'Almacen',
    id: 'sp6',
    indent: true,
    linkedTo: 'Harina granel',
    name: 'Harina 2 kg',
    price: '$4.800',
    stock: 'Stock 14 u',
    unitPriceCents: 480000,
  },
  { id: 'sp7', name: 'Arroz Largo Fino 1kg', price: '$2.100', stock: 'Stock 20 u', unitPriceCents: 210000 },
  { id: 'sp8', name: 'Fideos 500g', price: '$1.350', stock: 'Stock 15 u', unitPriceCents: 135000 },
];

export const cartItems: CartItemMock[] = [
  { id: 'c1', name: 'Yerba Amanda 1kg', price: '$9.600', qty: '2 u' },
  { id: 'c2', name: 'Harina granel', price: '$3.325', qty: '1,75 kg', weight: true },
];

export const confirmSaleItems: CartItemMock[] = [
  { id: 'cs1', name: 'Yerba Amanda 1kg', price: '$9.600', qty: '2 u' },
  { id: 'cs2', name: 'Harina granel', price: '$8.325', qty: '1,75 kg', weight: true },
  { id: 'cs3', name: 'Leche Entera 1L', price: '$2.400', qty: '2 u' },
  { id: 'cs4', name: 'Azucar 500g', price: '$1.900', qty: '2 u' },
  { id: 'cs5', name: 'Fideos 500g', price: '$4.010', qty: '3 u' },
];
