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
import { useAuth } from "@/features/auth/auth-context";
import { useToast } from "@/features/feedback/toast-context";
import { useI18n } from "@/features/i18n/i18n-context";
import { apiClient } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
  buildExpenseListNavigationState,
  createDefaultExpenseListFilters,
  readExpenseListFiltersFromState,
  type ExpenseDatePreset,
  type ExpenseListFilters,
} from "@/lib/expense-list-navigation";
import { formatMoney, shortID, trailingNaturalDateRange } from "@/lib/ledger";

type AccountBookFormValues = {
  name: string;
  description?: string;
};

export function AccountBookDetailPage() {
  const { accountBookId } = useParams();
  const auth = useAuth();
  const { showToast } = useToast();
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ExpenseListFilters>(
    () => readExpenseListFiltersFromState(location.state) ?? createDefaultExpenseListFilters(),
  );
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const accountBookSchema = z.object({
    name: z.string().trim().min(1, t("book.nameRequired")).max(100, t("book.nameLong")),
    description: z.string().max(400, t("common.error.descriptionLong")).optional(),
  });
  const form = useForm<AccountBookFormValues>({
    resolver: zodResolver(accountBookSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });
  const copy = {
    titleFallback: t("book.titleFallback"),
    edit: t("book.edit"),
    deleteBook: t("book.deleteBook"),
    deleting: t("book.deleting"),
    leave: t("book.leave"),
    leaving: t("book.leaving"),
    loadingBook: t("book.loadingBook"),
    loadBookFailed: t("book.loadBookFailed"),
    updated: t("book.updated"),
    updateFailed: t("book.updateFailed"),
    expensesTitle: t("book.expensesTitle"),
    clearAll: t("book.clearAll"),
    previous: t("book.previous"),
    next: t("book.next"),
    deletedUser: t("book.deletedUser"),
    unknownCategory: t("book.unknownCategory"),
    by: t("book.by"),
    rate: t("book.rate"),
    delete: t("common.delete"),
    expenseDeleted: t("book.expenseDeleted"),
    expenseDeleteFailed: t("book.expenseDeleteFailed"),
    deleteExpenseConfirm: t("book.deleteExpenseConfirm"),
    deleteMergedConfirm: t("book.deleteMergedConfirm"),
    deletePartialConfirm: t("book.deletePartialConfirm"),
    loadExpenses: t("book.loadExpenses"),
    loadExpensesFailed: t("book.loadExpensesFailed"),
    emptyExpenses: t("book.emptyExpenses"),
    snapshotTitle: t("book.snapshotTitle"),
    snapshotDescription: t("book.snapshotDescription"),
    manage: t("book.manage"),
    merge: t("book.merge"),
    normal: t("book.normal"),
    bookDeleted: t("book.bookDeleted"),
    bookDeleteFailed: t("book.bookDeleteFailed"),
    nameMismatch: t("book.nameMismatch"),
    leaveConfirm: t("book.leaveConfirm"),
    left: t("book.left"),
    leaveFailed: t("book.leaveFailed"),
    name: t("book.name"),
    description: t("book.description"),
    save: t("book.save"),
    saving: t("book.saving"),
    close: t("book.close"),
    total: t("book.total"),
    page: t("book.page"),
    totalAmount: t("book.totalAmount"),
    keyword: t("book.keyword"),
    keywordPlaceholder: t("book.keywordPlaceholder"),
    user: t("book.user"),
    allUsers: t("book.allUsers"),
    currency: t("book.currency"),
    order: t("book.order"),
    orderDesc: t("book.orderDesc"),
    orderAsc: t("book.orderAsc"),
    minAmount: t("book.minAmount"),
    maxAmount: t("book.maxAmount"),
    dateFrom: t("book.dateFrom"),
    dateTo: t("book.dateTo"),
    dateRange: t("book.dateRange"),
    last7Days: t("book.last7Days"),
    last30Days: t("book.last30Days"),
    categories: t("book.categories"),
    clearCategories: t("book.clearCategories"),
    addNormal: t("book.addNormal"),
    addMerged: t("book.addMerged"),
    roleLabel: t("book.roleLabel"),
    baseLabel: t("book.baseLabel"),
    categoriesLabel: t("book.categoriesLabel"),
    ownerLabel: t("book.ownerLabel"),
    records: (count: number) => t("book.records", { count }),
    matchedRecords: (matched: number, total: number) =>
      t("book.matchedRecords", { matched, total }),
  };

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
  const canDeleteBook = detailQuery.data?.my_role === "owner";
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
    filters.datePreset !== defaultFilters.datePreset ||
    filters.spentAtOrder !== defaultFilters.spentAtOrder;
  const memberMap = new Map(
    (membersQuery.data ?? []).map((member) => [member.user_id, member] as const),
  );
  const ownerName = detailQuery.data?.owner_user_id
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

  const deleteBookMutation = useMutation({
    mutationFn: () => apiClient.deleteAccountBook(auth.accessToken!, accountBookId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account-books"] });
      const currentUser = auth.user;
      if (currentUser && currentUser.default_account_book_id === accountBookId) {
        auth.replaceUser({
          ...currentUser,
          default_account_book_id: null,
        });
      }
      showToast(copy.bookDeleted, "success");
      navigate("/app/account-books");
    },
    onError: (error) => {
      showToast(getApiErrorMessage(error, copy.bookDeleteFailed), "error");
    },
  });

  const leaveBookMutation = useMutation({
    mutationFn: () => apiClient.leaveAccountBook(auth.accessToken!, accountBookId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account-books"] });
      const currentUser = auth.user;
      if (currentUser && currentUser.default_account_book_id === accountBookId) {
        auth.replaceUser({
          ...currentUser,
          default_account_book_id: null,
        });
      }
      showToast(copy.left, "success");
      navigate("/app/account-books", { replace: true });
    },
    onError: (error) => {
      showToast(getApiErrorMessage(error, copy.leaveFailed), "error");
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseID: string) =>
      apiClient.deleteExpense(auth.accessToken!, accountBookId!, expenseID),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["account-book-expenses", accountBookId],
      });
      showToast(copy.expenseDeleted, "success");
    },
    onError: (error) => {
      showToast(getApiErrorMessage(error, copy.expenseDeleteFailed), "error");
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
          {copy.previous}
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
          {copy.next}
        </button>
      </div>
    );
  }

  function renderMemberName(expense: ExpenseSummary) {
    if (!expense.user_id) {
      return copy.deletedUser;
    }
    return memberMap.get(expense.user_id)?.name ?? shortID(expense.user_id);
  }

  function renderExchangeRate(expense: ExpenseSummary) {
    const baseCurrency = detailQuery.data?.base_currency;
    if (!baseCurrency || expense.original_currency === baseCurrency) {
      return null;
    }

    const numericRate = Number(expense.exchange_rate_used);
    return `${copy.rate} ${Number.isFinite(numericRate) ? numericRate.toFixed(2) : expense.exchange_rate_used}`;
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
        ? copy.deletePartialConfirm
        : expense.expense_type === "merged_parent"
          ? copy.deleteMergedConfirm
          : copy.deleteExpenseConfirm,
    );
    if (!confirmed) {
      return;
    }
    deleteExpenseMutation.mutate(expense.id);
  }

  function handleDeleteBook() {
    if (!detailQuery.data) {
      return;
    }

    const typedName = window.prompt(
      t("book.bookDeleteConfirm", { name: detailQuery.data.name }),
      "",
    );
    if (typedName !== detailQuery.data.name) {
      if (typedName !== null) {
        showToast(copy.nameMismatch, "error");
      }
      return;
    }

    deleteBookMutation.mutate();
  }

  function handleLeaveBook() {
    if (!window.confirm(copy.leaveConfirm)) {
      return;
    }
    leaveBookMutation.mutate();
  }

  function renderExpenseCard(expense: ExpenseSummary) {
    const category = categoryMap.get(expense.category_id);
    const deletingThisExpense =
      deleteExpenseMutation.isPending && deleteExpenseMutation.variables === expense.id;
    const exchangeRateLabel = renderExchangeRate(expense);
    const showConvertedAmount =
      !!detailQuery.data?.base_currency && expense.original_currency !== detailQuery.data.base_currency;

    return (
      <article className="expense-card expense-card-compact" key={expense.id}>
        <div className="expense-row">
          <div className="expense-main">
            <div className="expense-title-row">
              <span className="category-badge">
                {category ? (
                  <>
                    <span
                      className="color-swatch color-swatch-lg"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name}
                  </>
                ) : (
                  copy.unknownCategory
                )}
              </span>
              {expense.expandable ? (
                <span className="badge badge-tight">
                  {hasCategoryFilter &&
                  expense.matched_children_count > 0 &&
                  expense.matched_children_count < expense.children_count
                    ? copy.matchedRecords(expense.matched_children_count, expense.children_count)
                    : copy.records(expense.children_count)}
                </span>
              ) : null}
              <span className="meta-inline">
                {copy.by} {renderMemberName(expense)}
              </span>
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
            {showConvertedAmount ? (
              <span className="meta-line">
                {formatMoney(expense.converted_amount, detailQuery.data?.base_currency ?? "JPY")}
              </span>
            ) : null}
          </div>
        </div>

        <div className="expense-meta-row">
          <span>{expense.spent_at}</span>
          <span>{expense.original_currency}</span>
          {exchangeRateLabel ? <span>{exchangeRateLabel}</span> : null}
          {canManageExpenses ? (
            <div className="expense-meta-actions">
              <button
                className="button button-xs"
                disabled={deletingThisExpense}
                onClick={() => handleEditExpense(expense)}
                type="button"
              >
                {copy.edit}
              </button>
              <button
                className="button button-xs button-danger-strong"
                disabled={deletingThisExpense}
                onClick={() => handleDeleteExpense(expense)}
                type="button"
              >
                {deletingThisExpense ? copy.deleting : copy.delete}
              </button>
            </div>
          ) : null}
        </div>

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
                        copy.unknownCategory
                      )}
                    </span>
                    <strong>{child.name}</strong>
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
        <div className="stack-sm">
          <div className="title-row">
            <h1>{detailQuery.data?.name ?? copy.titleFallback}</h1>
            {canEdit ? (
              <button
                className="button button-sm"
                onClick={() => setIsEditingMetadata((current) => !current)}
                type="button"
              >
                {copy.edit}
              </button>
            ) : null}
            {canDeleteBook ? (
              <button
                className="button button-sm button-muted"
                disabled={deleteBookMutation.isPending}
                onClick={handleDeleteBook}
                type="button"
              >
                {deleteBookMutation.isPending ? copy.deleting : copy.deleteBook}
              </button>
            ) : null}
            {detailQuery.data && detailQuery.data.my_role !== "owner" ? (
              <button
                className="button button-sm button-muted"
                disabled={leaveBookMutation.isPending}
                onClick={handleLeaveBook}
                type="button"
              >
                {leaveBookMutation.isPending ? copy.leaving : copy.leave}
              </button>
            ) : null}
          </div>
          <div className="meta-strip">
            <span className="inline-stat">
              {copy.roleLabel}: {detailQuery.data?.my_role ?? "-"}
            </span>
            <span className="inline-stat">
              {copy.baseLabel}: {detailQuery.data?.base_currency ?? "-"}
            </span>
            <span className="inline-stat">
              {copy.categoriesLabel}: {categoriesQuery.data?.length ?? 0}
            </span>
            <span className="inline-stat">
              {copy.ownerLabel}: {ownerName}
            </span>
          </div>
          {detailQuery.data?.description ? (
            <p className="page-subtext">{detailQuery.data.description}</p>
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
                <label htmlFor="account-book-name">{copy.name}</label>
                <input
                  disabled={!canEdit || updateMutation.isPending}
                  id="account-book-name"
                  type="text"
                  {...form.register("name")}
                />
              </div>
              <div className="field field-compact inline-grid-span-2">
                <label htmlFor="account-book-description">{copy.description}</label>
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
                {getApiErrorMessage(updateMutation.error, copy.updateFailed)}
              </div>
            ) : null}
            {updateMutation.isSuccess ? (
              <div className="success-banner compact-banner">{copy.updated}</div>
            ) : null}

            <div className="form-actions">
              <button
                className="button primary button-sm"
                disabled={!canEdit || updateMutation.isPending}
                type="submit"
              >
                {updateMutation.isPending ? copy.saving : copy.save}
              </button>
              <button
                className="button button-sm"
                onClick={() => setIsEditingMetadata(false)}
                type="button"
              >
                {copy.close}
              </button>
            </div>
          </form>
        </article>
      ) : null}

      {detailQuery.isLoading ? <div className="info-banner compact-banner">{copy.loadingBook}</div> : null}
      {detailQuery.isError ? (
        <div className="error-banner">
          {getApiErrorMessage(detailQuery.error, copy.loadBookFailed)}
        </div>
      ) : null}

      <div className="detail-grid detail-grid-ledger">
        <article className="detail-card compact-card">
          <div className="compact-header-row">
            <div>
              <h3>{copy.expensesTitle}</h3>
            </div>
            <div className="header-actions-column">
              <div className="badge-row badge-row-tight header-actions-badges">
                <span className="badge badge-tight">
                  {copy.total} {expensesQuery.data?.total ?? 0}
                </span>
                <span className="badge badge-tight">
                  {copy.totalAmount}{" "}
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
                  {copy.clearAll}
                </button>
                {renderPaginationControls()}
              </div>
            </div>
          </div>

          <div className="filter-panel filter-panel-compact">
            <div className="filter-grid filter-grid-ledger-extended">
              <div className="field field-compact">
                <label htmlFor="expense-keyword">{copy.keyword}</label>
                <input
                  id="expense-keyword"
                  onChange={(event) => updateFilter("keyword", event.target.value)}
                  placeholder={copy.keywordPlaceholder}
                  type="text"
                  value={filters.keyword}
                />
              </div>

              <div className="field field-compact">
                <label htmlFor="expense-user">{copy.user}</label>
                <select
                  id="expense-user"
                  onChange={(event) => updateFilter("userID", event.target.value)}
                  value={filters.userID}
                >
                  <option value="">{copy.allUsers}</option>
                  {(membersQuery.data ?? []).map((member: AccountBookMember) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field field-compact">
                <label htmlFor="expense-currency">{copy.currency}</label>
                <input
                  id="expense-currency"
                  maxLength={3}
                  onChange={(event) =>
                    updateFilter("originalCurrency", event.target.value.toUpperCase())
                  }
                  placeholder="JPY"
                  type="text"
                  value={filters.originalCurrency}
                />
              </div>

              <div className="field field-compact">
                <label htmlFor="expense-order">{copy.order}</label>
                <select
                  id="expense-order"
                  onChange={(event) =>
                    updateFilter("spentAtOrder", event.target.value as "asc" | "desc")
                  }
                  value={filters.spentAtOrder}
                >
                  <option value="desc">{copy.orderDesc}</option>
                  <option value="asc">{copy.orderAsc}</option>
                </select>
              </div>
            </div>

            <div className="date-filter-row">
              <div className="field field-compact amount-filter-field">
                <label htmlFor="expense-min-amount">{copy.minAmount}</label>
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
                <label htmlFor="expense-max-amount">{copy.maxAmount}</label>
                <input
                  className="amount-filter-input"
                  id="expense-max-amount"
                  onChange={(event) => updateFilter("maxAmount", event.target.value)}
                  placeholder=""
                  type="text"
                  value={filters.maxAmount}
                />
              </div>
              <div className="field field-compact">
                <label htmlFor="expense-date-from">{copy.dateFrom}</label>
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
                <label htmlFor="expense-date-to">{copy.dateTo}</label>
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
                <label>{copy.dateRange}</label>
                <div className="inline-radio-group">
                  <label className="radio-chip">
                    <input
                      checked={filters.datePreset === "last7"}
                      name="expense-date-preset"
                      onChange={() => applyDatePreset("last7")}
                      type="radio"
                    />
                    <span>{copy.last7Days}</span>
                  </label>
                  <label className="radio-chip">
                    <input
                      checked={filters.datePreset === "last30"}
                      name="expense-date-preset"
                      onChange={() => applyDatePreset("last30")}
                      type="radio"
                    />
                    <span>{copy.last30Days}</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="stack-sm">
              <div className="helper-row">
                <strong>{copy.categories}</strong>
                <button
                  className="button button-xs"
                  disabled={filters.categoryIDs.length === 0}
                  onClick={clearCategoryFilters}
                  type="button"
                >
                  {copy.clearCategories}
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

              {accountBookId && canManageExpenses ? (
                <div className="helper-row" style={{ justifyContent: "flex-end" }}>
                  <Link
                    className="button primary button-sm"
                    to={`/app/account-books/${accountBookId}/expenses/new-normal`}
                  >
                    {copy.addNormal}
                  </Link>
                  <Link
                    className="button primary button-sm"
                    to={`/app/account-books/${accountBookId}/expenses/new-merged`}
                  >
                    {copy.addMerged}
                  </Link>
                </div>
              ) : null}
            </div>
          </div>

          {expensesQuery.isLoading ? <div className="info-banner compact-banner">{copy.loadExpenses}</div> : null}
          {expensesQuery.isError ? (
            <div className="error-banner">
              {getApiErrorMessage(expensesQuery.error, copy.loadExpensesFailed)}
            </div>
          ) : null}

          {expensesQuery.data?.items.length ? (
            <div className="stack stack-tight" style={{ marginTop: 10 }}>
              {expensesQuery.data.items.map(renderExpenseCard)}
              {renderPaginationControls()}
            </div>
          ) : expensesQuery.isSuccess ? (
            <div className="empty-state" style={{ marginTop: 10 }}>
              {copy.emptyExpenses}
            </div>
          ) : null}
        </article>

        <article className="detail-card compact-card">
          <div className="compact-header-row">
            <div>
              <h3>{copy.snapshotTitle}</h3>
              <p>{copy.snapshotDescription}</p>
            </div>
            {accountBookId ? (
              <Link className="button button-sm" to={`/app/account-books/${accountBookId}/categories`}>
                {copy.manage}
              </Link>
            ) : null}
          </div>
          <div className="stack-sm">
            <div>
              <strong>{copy.merge}</strong>
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
              <strong>{copy.normal}</strong>
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
