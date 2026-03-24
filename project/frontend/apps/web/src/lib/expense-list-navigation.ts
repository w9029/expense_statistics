export type ExpenseListFilters = {
  keyword: string;
  originalCurrency: string;
  categoryIDs: string[];
  userID: string;
  minAmount: string;
  maxAmount: string;
  dateFrom: string;
  dateTo: string;
  spentAtOrder: "asc" | "desc";
  page: number;
};

export type ExpenseListNavigationState = {
  expense_list_filters?: ExpenseListFilters;
};

export const initialExpenseListFilters: ExpenseListFilters = {
  keyword: "",
  originalCurrency: "",
  categoryIDs: [],
  userID: "",
  minAmount: "",
  maxAmount: "",
  dateFrom: "",
  dateTo: "",
  spentAtOrder: "desc",
  page: 1,
};

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
