export function todayNaturalDate() {
  return new Date().toISOString().slice(0, 10);
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
