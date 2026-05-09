import {trailingNaturalDateRange, todayNaturalDate} from '@/lib/ledger';

export type TrendBucket = 'day' | 'month';
export type DayRangePreset = 'last30' | 'previous30' | null;
export type MonthRangePreset = 'last12' | 'last24' | null;

export function createDefaultCategoryShareRange() {
  return trailingNaturalDateRange(30);
}

export function createPrevious30DayRange() {
  const end = new Date();
  end.setDate(end.getDate() - 30);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);

  return {
    dateFrom: formatNaturalDate(start),
    dateTo: formatNaturalDate(end),
  };
}

export function createDefaultDayTrendRange() {
  return trailingNaturalDateRange(30);
}

export function createDefaultMonthTrendRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);

  return {
    dateFrom: formatNaturalMonth(start),
    dateTo: todayNaturalMonth(),
  };
}

export function todayNaturalMonth() {
  return todayNaturalDate().slice(0, 7);
}

export function countInclusiveDays(dateFrom: string, dateTo: string) {
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T00:00:00`);
  const diff = to.getTime() - from.getTime();

  if (!Number.isFinite(diff)) {
    return 0;
  }

  return Math.floor(diff / 86400000) + 1;
}

export function countInclusiveMonths(dateFrom: string, dateTo: string) {
  const [fromYear, fromMonth] = dateFrom.split('-').map(Number);
  const [toYear, toMonth] = dateTo.split('-').map(Number);

  if (
    !Number.isFinite(fromYear) ||
    !Number.isFinite(fromMonth) ||
    !Number.isFinite(toYear) ||
    !Number.isFinite(toMonth)
  ) {
    return 0;
  }

  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
}

export function createLast24MonthTrendRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 23, 1);

  return {
    dateFrom: formatNaturalMonth(start),
    dateTo: todayNaturalMonth(),
  };
}

function formatNaturalMonth(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatNaturalDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
