import {trailingNaturalDateRange} from '@/lib/ledger';

export type ExpenseDatePreset = 'last7' | 'last30' | null;

export type ExpenseListFilters = {
  keyword: string;
  originalCurrency: string;
  categoryIDs: string[];
  userID: string;
  minAmount: string;
  maxAmount: string;
  dateFrom: string;
  dateTo: string;
  datePreset: ExpenseDatePreset;
  spentAtOrder: 'asc' | 'desc';
  page: number;
};

export function createDefaultExpenseListFilters(): ExpenseListFilters {
  const range = trailingNaturalDateRange(30);
  return {
    keyword: '',
    originalCurrency: '',
    categoryIDs: [],
    userID: '',
    minAmount: '',
    maxAmount: '',
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    datePreset: 'last30',
    spentAtOrder: 'desc',
    page: 1,
  };
}
