import { trailingNaturalDateRange } from "@/lib/ledger";

export type ExpenseDatePreset = "last7" | "last30" | null;

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
  spentAtOrder: "asc" | "desc";
  page: number;
};

export type ExpenseListNavigationState = {
  expense_list_filters?: ExpenseListFilters;
};

export function createDefaultExpenseListFilters(): ExpenseListFilters {
  const range = trailingNaturalDateRange(30);
  return {
    keyword: "",
    originalCurrency: "",
    categoryIDs: [],
    userID: "",
    minAmount: "",
    maxAmount: "",
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    datePreset: "last30",
    spentAtOrder: "desc",
    page: 1,
  };
}

export function buildExpenseListNavigationState(
  filters: ExpenseListFilters,
): ExpenseListNavigationState {
  return {
    expense_list_filters: {
      ...filters,
      categoryIDs: [...filters.categoryIDs],
    },
  };
}

export function readExpenseListFiltersFromState(
  state: unknown,
): ExpenseListFilters | null {
  if (!state || typeof state !== "object") {
    return null;
  }

  const candidate = (state as ExpenseListNavigationState).expense_list_filters;
  if (!candidate) {
    return null;
  }

  if (
    typeof candidate.keyword !== "string" ||
    typeof candidate.originalCurrency !== "string" ||
    !Array.isArray(candidate.categoryIDs) ||
    typeof candidate.userID !== "string" ||
    typeof candidate.minAmount !== "string" ||
    typeof candidate.maxAmount !== "string" ||
    typeof candidate.dateFrom !== "string" ||
    typeof candidate.dateTo !== "string" ||
    (candidate.datePreset !== "last7" &&
      candidate.datePreset !== "last30" &&
      candidate.datePreset !== null) ||
    (candidate.spentAtOrder !== "asc" && candidate.spentAtOrder !== "desc") ||
    typeof candidate.page !== "number"
  ) {
    return null;
  }

  return {
    ...candidate,
    categoryIDs: [...candidate.categoryIDs],
  };
}
