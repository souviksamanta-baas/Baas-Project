export function formatWeeklySales(cents: number, currency = 'ARS'): string {
  if (cents <= 0) {
    return '$0';
  }

  return new Intl.NumberFormat('es-AR', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(cents / 100);
}
