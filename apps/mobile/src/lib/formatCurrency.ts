const currencyFormatters = new Map<string, Intl.NumberFormat>();
let decimalFormatter: Intl.NumberFormat | null = null;
let integerFormatter: Intl.NumberFormat | null = null;
let shortDateTimeFormatter: Intl.DateTimeFormat | null = null;

function weeklySalesFormatter(currency: string): Intl.NumberFormat {
  const cached = currencyFormatters.get(currency);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.NumberFormat('es-AR', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  });
  currencyFormatters.set(currency, formatter);
  return formatter;
}

function esArDecimalFormatter(): Intl.NumberFormat {
  decimalFormatter ??= new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  return decimalFormatter;
}

/** Grouped es-AR amount without a currency symbol, e.g. `1.250,50`. */
export function formatEsArDecimal(amount: number): string {
  return esArDecimalFormatter().format(amount);
}

/** Grouped es-AR whole number, e.g. `1.250`. */
export function formatEsArInteger(amount: number): string {
  integerFormatter ??= new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0,
  });
  return integerFormatter.format(amount);
}

/** Short stamp for agenda rows, e.g. `20/10, 09:30`. */
export function formatEsArShortDateTime(value: Date): string {
  shortDateTimeFormatter ??= new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
  return shortDateTimeFormatter.format(value);
}

export function formatWeeklySales(cents: number, currency = 'ARS'): string {
  if (cents <= 0) {
    return '$0';
  }

  return weeklySalesFormatter(currency).format(cents / 100);
}
