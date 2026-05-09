function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toNaturalDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function trailingNaturalDateRange(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));

  return {
    dateFrom: toNaturalDate(start),
    dateTo: toNaturalDate(end),
  };
}

export function formatMoney(value: string, currency: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return `${currency} ${value}`;
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${currency} ${numeric.toFixed(2)}`;
  }
}

export function shortID(value: string | null | undefined) {
  if (!value) {
    return '-';
  }
  return value.slice(0, 8);
}
