export function todayNaturalDate() {
  return formatNaturalDate(new Date());
}

export function trailingNaturalDateRange(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(days - 1, 0));

  return {
    dateFrom: formatNaturalDate(start),
    dateTo: formatNaturalDate(end),
  };
}

export function parseDecimalInput(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatMoney(value: string, currency: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return `${currency} ${value}`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${currency} ${numeric.toFixed(2)}`;
  }
}

export function shortID(value: string | null | undefined) {
  return value ? value.slice(0, 8) : "unknown";
}

function formatNaturalDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
