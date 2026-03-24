import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import type {
  AccountBookMember,
  AccountBookSummary,
  ExpenseCategory,
  ExpenseSummary,
} from "@expense-statistics/domain";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { useToast } from "@/features/feedback/toast-context";
import { apiClient } from "@/lib/api";
import {
  buildExpenseListNavigationState,
  createDefaultExpenseListFilters,
  readExpenseListFiltersFromState,
  type ExpenseDatePreset,
  type ExpenseListFilters,
} from "@/lib/expense-list-navigation";
import { formatMoney, shortID, trailingNaturalDateRange } from "@/lib/ledger";

const accountBookSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().max(400, "Description is too long").optional(),
});

type AccountBookFormValues = z.infer<typeof accountBookSchema>;

export function AccountBookDetailPage() {
  const { accountBookId } = useParams();
  const auth = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ExpenseListFilters>(
    () => readExpenseListFiltersFromState(location.state) ?? createDefaultExpenseListFilters(),
  );
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const form = useForm<AccountBookFormValues>({
    resolver: zodResolver(accountBookSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const detailQuery = useQuery({
    queryKey: ["account-book", accountBookId],
    queryFn: () => apiClient.getAccountBook(auth.accessToken!, accountBookId!),
    enabled: Boolean(auth.accessToken && accountBookId),
  });

  const membersQuery = useQuery({
    queryKey: ["account-book-members", accountBookId],
    queryFn: () => apiClient.listAccountBookMembers(auth.accessToken!, accountBookId!),
    enabled: Boolean(auth.accessToken && accountBookId),
  });

  const categoriesQuery = useQuery({
    queryKey: ["account-book-expense-categories", accountBookId],
    queryFn: () => apiClient.listExpenseCategories(auth.accessToken!, accountBookId!),
    enabled: Boolean(auth.accessToken && accountBookId),
  });

  const expensesQuery = useQuery({
    queryKey: ["account-book-expenses", accountBookId, filters],
    queryFn: () =>
      apiClient.listExpenses(auth.accessToken!, accountBookId!, {
        include_children: true,
        page: filters.page,
        page_size: 10,
        keyword: filters.keyword.trim() || undefined,
        category_ids: filters.categoryIDs.length > 0 ? filters.categoryIDs : undefined,
        user_id: filters.userID || undefined,
        min_amount: filters.minAmount.trim() || undefined,
        max_amount: filters.maxAmount.trim() || undefined,
        original_currency: filters.originalCurrency.trim().toUpperCase() || undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        spent_at_order: filters.spentAtOrder,
      }),
    enabled: Boolean(auth.accessToken && accountBookId),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!detailQuery.data) {
      return;
    }

    form.reset({
      name: detailQuery.data.name,
      description: detailQuery.data.description ?? "",
    });
  }, [detailQuery.data, form]);

  const canEdit =
    detailQuery.data?.my_role === "owner" || detailQuery.data?.my_role === "admin";
  const canManageExpenses =
    detailQuery.data?.my_role === "owner" ||
    detailQuery.data?.my_role === "admin" ||
    detailQuery.data?.my_role === "editor";

  const categoryMap = new Map(
    (categoriesQuery.data ?? []).map((category) => [category.id, category] as const),
  );
  const defaultFilters = createDefaultExpenseListFilters();
  const hasActiveFilters =
    filters.keyword !== defaultFilters.keyword ||
    filters.originalCurrency !== defaultFilters.originalCurrency ||
    filters.categoryIDs.length > 0 ||
    filters.userID !== defaultFilters.userID ||
    filters.minAmount !== defaultFilters.minAmount ||
    filters.maxAmount !== defaultFilters.maxAmount ||
    filters.dateFrom !== defaultFilters.dateFrom ||
    filters.dateTo !== defaultFilters.dateTo ||
    filters.datePreset !== defaultFilters.datePreset;
  const memberMap = new Map(
    (membersQuery.data ?? []).map((member) => [member.user_id, member] as const),
  );
  const ownerName =
    detailQuery.data?.owner_user_id
      ? memberMap.get(detailQuery.data.owner_user_id)?.name ?? shortID(detailQuery.data.owner_user_id)
      : "-";
  const totalPages = expensesQuery.data
    ? Math.max(1, Math.ceil(expensesQuery.data.total / expensesQuery.data.page_size))
    : 1;
  const mergeCategories = (categoriesQuery.data ?? []).filter((category) => category.is_merge_category);
  const normalCategories = (categoriesQuery.data ?? []).filter(
    (category) => !category.is_merge_category,
  );
  const hasCategoryFilter = filters.categoryIDs.length > 0;

  const updateMutation = useMutation({
    mutationFn: (values: AccountBookFormValues) =>
      apiClient.updateAccountBook(auth.accessToken!, accountBookId!, {
        name: values.name.trim(),
        description: values.description?.trim() || null,
      }),
    onSuccess: (updated) => {
      setIsEditingMetadata(false);
      queryClient.setQueryData(["account-book", accountBookId], updated);
      queryClient.setQueryData<AccountBookSummary[]>(["account-books"], (current) =>
        current?.map((book) =>
          book.id === updated.id
            ? { ...book, name: updated.name, description: updated.description }
            : book,
        ) ?? current,
      );
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseID: string) =>
      apiClient.deleteExpense(auth.accessToken!, accountBookId!, expenseID),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["account-book-expenses", accountBookId],
      });
      showToast("Expense deleted.", "success");
    },
    onError: (error) => {
      showToast(
        error instanceof ApiError ? error.message : "Failed to delete the expense",
        "error",
      );
    },
  });

  function toggleCategory(categoryID: string) {
    setFilters((current) => ({
      ...current,
      page: 1,
      categoryIDs: current.categoryIDs.includes(categoryID)
        ? current.categoryIDs.filter((id) => id !== categoryID)
        : [...current.categoryIDs, categoryID],
    }));
  }

  function updateFilter<K extends keyof ExpenseListFilters>(
    key: K,
    value: ExpenseListFilters[K],
  ) {
    setFilters((current) => ({
      ...current,
      page: 1,
      [key]: value,
    }));
  }

  function clearFilters() {
    setFilters(createDefaultExpenseListFilters());
  }

  function clearCategoryFilters() {
    setFilters((current) => ({
      ...current,
      categoryIDs: [],
      page: 1,
    }));
  }

  function applyDatePreset(preset: Exclude<ExpenseDatePreset, null>) {
    const range = trailingNaturalDateRange(preset === "last7" ? 7 : 30);
    setFilters((current) => ({
      ...current,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      datePreset: preset,
      page: 1,
    }));
  }

  function goToPreviousPage() {
    setFilters((current) => ({ ...current, page: current.page - 1 }));
  }

  function goToNextPage() {
    setFilters((current) => ({ ...current, page: current.page + 1 }));
  }

  function renderPaginationControls() {
    return (
      <div className="pagination-row">
        <button
          className="button button-sm"
          disabled={filters.page <= 1 || expensesQuery.isFetching}
          onClick={goToPreviousPage}
          type="button"
        >
          Previous
        </button>
        <span className="mono">
          {filters.page} / {totalPages}
        </span>
        <button
          className="button button-sm"
          disabled={filters.page >= totalPages || expensesQuery.isFetching}
          onClick={goToNextPage}
          type="button"
        >
          Next
        </button>
      </div>
    );
  }

  function renderMemberName(expense: ExpenseSummary) {
    if (!expense.user_id) {
      return "Deleted user";
    }
    return memberMap.get(expense.user_id)?.name ?? shortID(expense.user_id);
  }

  function isPartialMergedExpense(expense: ExpenseSummary) {
    if (!hasCategoryFilter || expense.expense_type !== "merged_parent") {
      return false;
    }
    return (expense.children?.length ?? 0) < expense.children_count;
  }

  function handleEditExpense(expense: ExpenseSummary) {
    const returnState = buildExpenseListNavigationState(filters);
    if (expense.expense_type === "merged_parent") {
      navigate(`/app/account-books/${accountBookId}/expenses/${expense.id}/edit-merged`, {
        state: returnState,
      });
      return;
    }
    navigate(`/app/account-books/${accountBookId}/expenses/${expense.id}/edit-normal`, {
      state: returnState,
    });
  }

  function handleDeleteExpense(expense: ExpenseSummary) {
    const confirmed = window.confirm(
      isPartialMergedExpense(expense)
        ? "This merged expense is partially matched by current filters. Deleting it will also delete child items currently hidden by filters. Continue?"
        : expense.expense_type === "merged_parent"
          ? "Delete this merged expense and all child items?"
          : "Delete this expense?",
    );
    if (!confirmed) {
      return;
    }
    deleteExpenseMutation.mutate(expense.id);
  }

  function renderExpenseCard(expense: ExpenseSummary) {
    const category = categoryMap.get(expense.category_id);
    const deletingThisExpense = deleteExpenseMutation.isPending && deleteExpenseMutation.variables === expense.id;

    return (
      <article className="expense-card expense-card-compact" key={expense.id}>
        <div className="expense-row">
          <div className="expense-main">
            <div className="expense-title-row">
              <span className="category-badge">
                {category ? (
                  <>
                    <span className="color-swatch color-swatch-lg" style={{ backgroundColor: category.color }} />
                    {category.name}
                  </>
                ) : (
                  "unknown category"
                )}
              </span>
              {expense.expandable ? (
                <span className="badge badge-tight">
                  {hasCategoryFilter &&
                  expense.matched_children_count > 0 &&
                  expense.matched_children_count < expense.children_count
                    ? `${expense.matched_children_count}/${expense.children_count} children`
                    : `${expense.children_count} children`}
                </span>
              ) : null}
              <span className="meta-inline">by {renderMemberName(expense)}</span>
            </div>

            <div className="expense-name-row">
              <strong>{expense.name}</strong>
              {expense.description ? (
                <span className="expense-inline-description">{expense.description}</span>
              ) : null}
            </div>
          </div>

          <div className="expense-main expense-main-right">
            <strong>{formatMoney(expense.original_amount, expense.original_currency)}</strong>
            <span className="meta-line">
              {formatMoney(expense.converted_amount, detailQuery.data?.base_currency ?? "JPY")}
            </span>
          </div>
        </div>

        <div className="expense-meta-row">
          <span>{expense.spent_at}</span>
          <span>{expense.original_currency}</span>
          <span>rate {expense.exchange_rate_used}</span>
          <span className="mono">#{shortID(expense.id)}</span>
        </div>

        {canManageExpenses ? (
          <div className="helper-row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
            <button
              className="button button-xs"
              disabled={deletingThisExpense}
              onClick={() => handleEditExpense(expense)}
              type="button"
            >
              Edit
            </button>
            <button
              className="button button-xs button-danger-strong"
              disabled={deletingThisExpense}
              onClick={() => handleDeleteExpense(expense)}
              type="button"
            >
              {deletingThisExpense ? "Deleting..." : "Delete"}
            </button>
          </div>
        ) : null}

        {expense.children?.length ? (
          <div className="expense-children">
            {expense.children.map((child) => {
              const childCategory = categoryMap.get(child.category_id);

              return (
                <div className="child-expense-row child-expense-row-compact" key={child.id}>
                  <div className="child-expense-main">
                    <span className="category-badge category-badge-compact">
                      {childCategory ? (
                        <>
                          <span
                            className="color-swatch color-swatch-lg"
                            style={{ backgroundColor: childCategory.color }}
                          />
                          {childCategory.name}
                        </>
                      ) : (
                        "unknown category"
                      )}
                    </span>
                    <strong>{child.name}</strong>
                    <span className="meta-line">{child.spent_at}</span>
                    {child.description ? <span className="meta-line">{child.description}</span> : null}
                  </div>
                  <div className="expense-amounts">
                    <strong>{formatMoney(child.original_amount, child.original_currency)}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <section className="stack stack-tight">
      <header className="page-header page-header-compact">
        <div className="split-header">
          <div className="stack-sm">
            <div className="title-row">
              <h1>{detailQuery.data?.name ?? "Account Book Workspace"}</h1>
              {canEdit ? (
                <button
                  className="button button-icon"
                  onClick={() => setIsEditingMetadata((current) => !current)}
                  type="button"
                >
                  Edit
                </button>
              ) : null}
            </div>
            <div className="meta-strip">
              <span className="inline-stat">role: {detailQuery.data?.my_role ?? "-"}</span>
              <span className="inline-stat">base: {detailQuery.data?.base_currency ?? "-"}</span>
              <span className="inline-stat">categories: {categoriesQuery.data?.length ?? 0}</span>
              <span className="inline-stat">owner: {ownerName}</span>
            </div>
            {detailQuery.data?.description ? (
              <p className="page-subtext">{detailQuery.data.description}</p>
            ) : null}
          </div>
          {accountBookId ? (
            <div className="cta-row">
              <Link className="button button-sm" to="/app/account-books">
                Books
              </Link>
              <Link
                className="button button-sm"
                to={`/app/account-books/${accountBookId}/categories`}
              >
                Categories
              </Link>
              <Link
                className="button primary button-sm"
                to={`/app/account-books/${accountBookId}/expenses/new-normal`}
              >
                Add Normal
              </Link>
              <Link
                className="button primary button-sm"
                to={`/app/account-books/${accountBookId}/expenses/new-merged`}
              >
                Add Merged
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      {isEditingMetadata ? (
        <article className="detail-card compact-card">
          <form
            className="form-grid compact-form-grid"
            onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))}
          >
            <div className="inline-grid inline-grid-3">
              <div className="field field-compact">
                <label htmlFor="account-book-name">Name</label>
                <input
                  disabled={!canEdit || updateMutation.isPending}
                  id="account-book-name"
                  type="text"
                  {...form.register("name")}
                />
              </div>
              <div className="field field-compact inline-grid-span-2">
                <label htmlFor="account-book-description">Description</label>
                <input
                  disabled={!canEdit || updateMutation.isPending}
                  id="account-book-description"
                  type="text"
                  {...form.register("description")}
                />
              </div>
            </div>

            {form.formState.errors.name ? (
              <div className="error-banner">{form.formState.errors.name.message}</div>
            ) : null}
            {form.formState.errors.description ? (
              <div className="error-banner">{form.formState.errors.description.message}</div>
            ) : null}
            {updateMutation.isError ? (
              <div className="error-banner">
                {updateMutation.error instanceof ApiError
                  ? updateMutation.error.message
                  : "Failed to update the account book"}
              </div>
            ) : null}
            {updateMutation.isSuccess ? (
              <div className="success-banner compact-banner">Account book updated.</div>
            ) : null}

            <div className="form-actions">
              <button
                className="button primary button-sm"
                disabled={!canEdit || updateMutation.isPending}
                type="submit"
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </button>
              <button className="button button-sm" onClick={() => setIsEditingMetadata(false)} type="button">
                Close
              </button>
            </div>
          </form>
        </article>
      ) : null}

      {detailQuery.isLoading ? <div className="info-banner compact-banner">Loading account book...</div> : null}
      {detailQuery.isError ? (
        <div className="error-banner">
          {detailQuery.error instanceof ApiError
            ? detailQuery.error.message
            : "Failed to load the account book"}
        </div>
      ) : null}

      <div className="detail-grid detail-grid-ledger">
        <article className="detail-card compact-card">
          <div className="compact-header-row">
            <div>
              <h3>Expense Records</h3>
            </div>
            <div className="header-actions-column">
              <div className="badge-row badge-row-tight header-actions-badges">
                <span className="badge badge-tight">total {expensesQuery.data?.total ?? 0}</span>
                <span className="badge badge-tight">page {filters.page}</span>
                <span className="badge badge-tight">
                  total amount{" "}
                  {formatMoney(
                    expensesQuery.data?.total_converted_amount ?? "0.00",
                    detailQuery.data?.base_currency ?? "JPY",
                  )}
                </span>
              </div>
              <div className="top-filter-actions-row">
                <button
                  className="button button-sm"
                  disabled={!hasActiveFilters}
                  onClick={clearFilters}
                  type="button"
                >
                  Clear All Filters
                </button>
                {renderPaginationControls()}
              </div>
            </div>
          </div>

          <div className="filter-panel filter-panel-compact">
            <div className="filter-grid filter-grid-ledger-extended">
              <div className="field field-compact">
                <label htmlFor="expense-keyword">Keyword</label>
                <input
                  id="expense-keyword"
                  onChange={(event) => updateFilter("keyword", event.target.value)}
                  placeholder="store, lunch, ticket..."
                  type="text"
                  value={filters.keyword}
                />
              </div>

              <div className="field field-compact">
                <label htmlFor="expense-user">User</label>
                <select
                  id="expense-user"
                  onChange={(event) => updateFilter("userID", event.target.value)}
                  value={filters.userID}
                >
                  <option value="">All members</option>
                  {(membersQuery.data ?? []).map((member: AccountBookMember) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field field-compact">
                <label htmlFor="expense-currency">Currency</label>
                <input
                  id="expense-currency"
                  maxLength={3}
                  onChange={(event) => updateFilter("originalCurrency", event.target.value.toUpperCase())}
                  placeholder="JPY"
                  type="text"
                  value={filters.originalCurrency}
                />
              </div>

              <div className="field field-compact">
                <label htmlFor="expense-order">Order</label>
                <select
                  id="expense-order"
                  onChange={(event) => updateFilter("spentAtOrder", event.target.value as "asc" | "desc")}
                  value={filters.spentAtOrder}
                >
                  <option value="desc">Newest first</option>
                  <option value="asc">Oldest first</option>
                </select>
              </div>
            </div>

            <div className="date-filter-row">
              <div className="field field-compact amount-filter-field">
                <label htmlFor="expense-min-amount">Min Amount</label>
                <input
                  className="amount-filter-input"
                  id="expense-min-amount"
                  onChange={(event) => updateFilter("minAmount", event.target.value)}
                  placeholder="0.00"
                  type="text"
                  value={filters.minAmount}
                />
              </div>
              <div className="field field-compact amount-filter-field">
                <label htmlFor="expense-max-amount">Max Amount</label>
                <input
                  className="amount-filter-input"
                  id="expense-max-amount"
                  onChange={(event) => updateFilter("maxAmount", event.target.value)}
                  placeholder="9999.99"
                  type="text"
                  value={filters.maxAmount}
                />
              </div>
              <div className="field field-compact">
                <label htmlFor="expense-date-from">Date From</label>
                <input
                  id="expense-date-from"
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      dateFrom: event.target.value,
                      datePreset: null,
                      page: 1,
                    }))
                  }
                  type="date"
                  value={filters.dateFrom}
                />
              </div>
              <div className="field field-compact">
                <label htmlFor="expense-date-to">Date To</label>
                <input
                  id="expense-date-to"
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      dateTo: event.target.value,
                      datePreset: null,
                      page: 1,
                    }))
                  }
                  type="date"
                  value={filters.dateTo}
                />
              </div>
              <div className="field field-compact date-preset-field">
                <label>Date Range</label>
                <div className="inline-radio-group">
                  <label className="radio-chip">
                    <input
                      checked={filters.datePreset === "last7"}
                      name="expense-date-preset"
                      onChange={() => applyDatePreset("last7")}
                      type="radio"
                    />
                    <span>Last 7 Days</span>
                  </label>
                  <label className="radio-chip">
                    <input
                      checked={filters.datePreset === "last30"}
                      name="expense-date-preset"
                      onChange={() => applyDatePreset("last30")}
                      type="radio"
                    />
                    <span>Last 30 Days</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="stack-sm">
              <div className="helper-row">
                <strong>Categories</strong>
                <button
                  className="button button-xs"
                  disabled={filters.categoryIDs.length === 0}
                  onClick={clearCategoryFilters}
                  type="button"
                >
                  Clear Categories
                </button>
              </div>

              <div className="pill-checklist">
                {(categoriesQuery.data ?? []).map((category: ExpenseCategory) => {
                  const active = filters.categoryIDs.includes(category.id);

                  return (
                    <button
                      className={`checkbox-pill checkbox-pill-compact${active ? " active" : ""}`}
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      type="button"
                    >
                      <span
                        className="color-swatch color-swatch-lg"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {expensesQuery.isLoading ? <div className="info-banner compact-banner">Loading expenses...</div> : null}
          {expensesQuery.isError ? (
            <div className="error-banner">
              {expensesQuery.error instanceof ApiError
                ? expensesQuery.error.message
                : "Failed to load expenses"}
            </div>
          ) : null}

          {expensesQuery.data?.items.length ? (
            <div className="stack stack-tight" style={{ marginTop: 10 }}>
              {expensesQuery.data.items.map(renderExpenseCard)}

              {renderPaginationControls()}
            </div>
          ) : expensesQuery.isSuccess ? (
            <div className="empty-state" style={{ marginTop: 10 }}>
              No expenses matched the current filters.
            </div>
          ) : null}
        </article>

        <article className="detail-card compact-card">
          <div className="compact-header-row">
            <div>
              <h3>Category Snapshot</h3>
              <p>Use the dedicated category page when you need CRUD operations.</p>
            </div>
            {accountBookId ? (
              <Link className="button button-sm" to={`/app/account-books/${accountBookId}/categories`}>
                Manage
              </Link>
            ) : null}
          </div>
          <div className="stack-sm">
            <div>
              <strong>Merge</strong>
              <div className="pill-checklist" style={{ marginTop: 8 }}>
                {mergeCategories.map((category) => (
                  <div className="category-chip category-chip-compact" key={category.id}>
                    <span
                      className="color-swatch color-swatch-lg"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <strong>Normal</strong>
              <div className="pill-checklist" style={{ marginTop: 8 }}>
                {normalCategories.map((category) => (
                  <div className="category-chip category-chip-compact" key={category.id}>
                    <span
                      className="color-swatch color-swatch-lg"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
