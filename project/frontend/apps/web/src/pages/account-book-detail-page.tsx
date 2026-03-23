import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";
import type { AccountBookSummary, ExpenseCategory, ExpenseSummary } from "@expense-statistics/domain";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { apiClient } from "@/lib/api";
import { formatMoney, shortID } from "@/lib/ledger";

const accountBookSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().max(400, "Description is too long").optional(),
});

type AccountBookFormValues = z.infer<typeof accountBookSchema>;

type ExpenseFilters = {
  keyword: string;
  originalCurrency: string;
  categoryIDs: string[];
  spentAtOrder: "asc" | "desc";
  page: number;
};

const initialFilters: ExpenseFilters = {
  keyword: "",
  originalCurrency: "",
  categoryIDs: [],
  spentAtOrder: "desc",
  page: 1,
};

export function AccountBookDetailPage() {
  const { accountBookId } = useParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ExpenseFilters>(initialFilters);
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
        page_size: 20,
        keyword: filters.keyword.trim() || undefined,
        category_ids: filters.categoryIDs.length > 0 ? filters.categoryIDs : undefined,
        original_currency: filters.originalCurrency.trim().toUpperCase() || undefined,
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

  const categoryMap = new Map(
    (categoriesQuery.data ?? []).map((category) => [category.id, category] as const),
  );
  const totalPages = expensesQuery.data
    ? Math.max(1, Math.ceil(expensesQuery.data.total / expensesQuery.data.page_size))
    : 1;
  const mergeCategories = (categoriesQuery.data ?? []).filter((category) => category.is_merge_category);
  const normalCategories = (categoriesQuery.data ?? []).filter(
    (category) => !category.is_merge_category,
  );

  const updateMutation = useMutation({
    mutationFn: (values: AccountBookFormValues) =>
      apiClient.updateAccountBook(auth.accessToken!, accountBookId!, {
        name: values.name.trim(),
        description: values.description?.trim() || null,
      }),
    onSuccess: (updated) => {
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

  function toggleCategory(categoryID: string) {
    setFilters((current) => ({
      ...current,
      page: 1,
      categoryIDs: current.categoryIDs.includes(categoryID)
        ? current.categoryIDs.filter((id) => id !== categoryID)
        : [...current.categoryIDs, categoryID],
    }));
  }

  function renderExpenseCard(expense: ExpenseSummary) {
    const category = categoryMap.get(expense.category_id);

    return (
      <article className="expense-card" key={expense.id}>
        <div className="split-header">
          <div className="stack-sm">
            <div className="badge-row" style={{ marginTop: 0 }}>
              <span className="badge">{expense.expense_type}</span>
              <span className="badge">
                {category ? (
                  <>
                    <span
                      className="color-swatch"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name}
                  </>
                ) : (
                  "unknown category"
                )}
              </span>
              {expense.expandable ? (
                <span className="badge">{expense.children_count} children</span>
              ) : null}
            </div>
            <h3>{expense.name}</h3>
            <p>{expense.description ?? "No description."}</p>
          </div>

          <div className="stack-sm expense-amounts">
            <strong>{formatMoney(expense.original_amount, expense.original_currency)}</strong>
            <span className="meta-line">
              converted: {formatMoney(expense.converted_amount, detailQuery.data?.base_currency ?? "JPY")}
            </span>
          </div>
        </div>

        <div className="expense-meta-grid">
          <div>
            <span className="meta-label">Spent at</span>
            <div>{expense.spent_at}</div>
          </div>
          <div>
            <span className="meta-label">Rate used</span>
            <div>{expense.exchange_rate_used}</div>
          </div>
          <div>
            <span className="meta-label">Expense ID</span>
            <div className="mono">{shortID(expense.id)}</div>
          </div>
        </div>

        {expense.children?.length ? (
          <div className="expense-children">
            <div className="divider" />
            <div className="stack-sm">
              {expense.children.map((child) => {
                const childCategory = categoryMap.get(child.category_id);

                return (
                  <div className="child-expense-row" key={child.id}>
                    <div>
                      <strong>{child.name}</strong>
                      <div className="meta-line">
                        {childCategory?.name ?? "unknown category"} | {child.spent_at}
                      </div>
                    </div>
                    <div className="expense-amounts">
                      <strong>{formatMoney(child.original_amount, child.original_currency)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <section className="stack">
      <header className="page-header">
        <div className="split-header">
          <div>
            <h1>{detailQuery.data?.name ?? "Account Book Workspace"}</h1>
            <p>
              This view is now the first usable ledger workspace: category snapshot,
              expense list, filters, and entry actions all sit on the same page.
            </p>
          </div>
          {accountBookId ? (
            <div className="cta-row">
              <Link className="button" to="/app/account-books">
                Back To Books
              </Link>
              <Link
                className="button primary"
                to={`/app/account-books/${accountBookId}/expenses/new-normal`}
              >
                Add Normal Expense
              </Link>
              <Link
                className="button primary"
                to={`/app/account-books/${accountBookId}/expenses/new-merged`}
              >
                Add Merged Expense
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      {detailQuery.isLoading ? <div className="info-banner">Loading account book...</div> : null}
      {detailQuery.isError ? (
        <div className="error-banner">
          {detailQuery.error instanceof ApiError
            ? detailQuery.error.message
            : "Failed to load the account book"}
        </div>
      ) : null}

      {detailQuery.data ? (
        <div className="summary-grid">
          <article className="surface-card summary-card">
            <span className="meta-label">Role</span>
            <strong>{detailQuery.data.my_role}</strong>
            <p>{detailQuery.data.description ?? "No description yet."}</p>
          </article>
          <article className="surface-card summary-card">
            <span className="meta-label">Base Currency</span>
            <strong>{detailQuery.data.base_currency}</strong>
            <p>Expense conversion targets this base currency on write.</p>
          </article>
          <article className="surface-card summary-card">
            <span className="meta-label">Categories</span>
            <strong>{categoriesQuery.data?.length ?? 0}</strong>
            <p>
              {normalCategories.length} normal / {mergeCategories.length} merge
            </p>
          </article>
        </div>
      ) : null}

      <div className="detail-grid">
        <article className="detail-card">
          <div className="split-header">
            <div>
              <h3>Expense Feed</h3>
              <p>
                Root expenses are paginated. Merged children only appear beneath their
                parent, so the page never shows partial merged groups.
              </p>
            </div>
            <div className="badge-row">
              <span className="badge">total {expensesQuery.data?.total ?? 0}</span>
              <span className="badge">page {filters.page}</span>
            </div>
          </div>

          <div className="filter-panel">
            <div className="filter-grid">
              <div className="field">
                <label htmlFor="expense-keyword">Keyword</label>
                <input
                  id="expense-keyword"
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      keyword: event.target.value,
                      page: 1,
                    }))
                  }
                  placeholder="store, lunch, ticket..."
                  type="text"
                  value={filters.keyword}
                />
              </div>

              <div className="field">
                <label htmlFor="expense-currency">Original Currency</label>
                <input
                  id="expense-currency"
                  maxLength={3}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      originalCurrency: event.target.value.toUpperCase(),
                      page: 1,
                    }))
                  }
                  placeholder="JPY"
                  type="text"
                  value={filters.originalCurrency}
                />
              </div>

              <div className="field">
                <label htmlFor="expense-order">Spent At Order</label>
                <select
                  id="expense-order"
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      spentAtOrder: event.target.value as "asc" | "desc",
                      page: 1,
                    }))
                  }
                  value={filters.spentAtOrder}
                >
                  <option value="desc">Newest first</option>
                  <option value="asc">Oldest first</option>
                </select>
              </div>
            </div>

            <div className="stack-sm">
              <div className="helper-row">
                <strong>Category filter</strong>
                {filters.categoryIDs.length > 0 ? (
                  <button
                    className="button"
                    onClick={() => setFilters((current) => ({ ...current, categoryIDs: [], page: 1 }))}
                    type="button"
                  >
                    Clear Categories
                  </button>
                ) : null}
              </div>

              <div className="pill-checklist">
                {(categoriesQuery.data ?? []).map((category: ExpenseCategory) => {
                  const active = filters.categoryIDs.includes(category.id);

                  return (
                    <button
                      className={`checkbox-pill${active ? " active" : ""}`}
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      type="button"
                    >
                      <span
                        className="color-swatch"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {expensesQuery.isLoading ? <div className="info-banner">Loading expenses...</div> : null}
          {expensesQuery.isError ? (
            <div className="error-banner">
              {expensesQuery.error instanceof ApiError
                ? expensesQuery.error.message
                : "Failed to load expenses"}
            </div>
          ) : null}

          {expensesQuery.data?.items.length ? (
            <div className="stack" style={{ marginTop: 18 }}>
              {expensesQuery.data.items.map(renderExpenseCard)}

              <div className="pagination-row">
                <button
                  className="button"
                  disabled={filters.page <= 1 || expensesQuery.isFetching}
                  onClick={() =>
                    setFilters((current) => ({ ...current, page: current.page - 1 }))
                  }
                  type="button"
                >
                  Previous
                </button>
                <span className="mono">
                  {filters.page} / {totalPages}
                </span>
                <button
                  className="button"
                  disabled={filters.page >= totalPages || expensesQuery.isFetching}
                  onClick={() =>
                    setFilters((current) => ({ ...current, page: current.page + 1 }))
                  }
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          ) : expensesQuery.isSuccess ? (
            <div className="empty-state" style={{ marginTop: 18 }}>
              No expenses matched the current filters.
            </div>
          ) : null}
        </article>

        <div className="stack">
          <article className="detail-card">
            <h3>Category Snapshot</h3>
            <p>
              Merge categories can be used only as merged parents. Normal categories are
              used for ordinary expenses and merged children.
            </p>

            {categoriesQuery.isLoading ? <div className="info-banner">Loading categories...</div> : null}
            {categoriesQuery.isError ? (
              <div className="error-banner">
                {categoriesQuery.error instanceof ApiError
                  ? categoriesQuery.error.message
                  : "Failed to load categories"}
              </div>
            ) : null}

            <div className="stack-sm" style={{ marginTop: 18 }}>
              <div>
                <strong>Merge Categories</strong>
                <div className="pill-checklist" style={{ marginTop: 10 }}>
                  {mergeCategories.map((category) => (
                    <div className="category-chip" key={category.id}>
                      <span
                        className="color-swatch"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <strong>Normal Categories</strong>
                <div className="pill-checklist" style={{ marginTop: 10 }}>
                  {normalCategories.map((category) => (
                    <div className="category-chip" key={category.id}>
                      <span
                        className="color-swatch"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="detail-card">
            <h3>Edit Metadata</h3>
            <p>
              Base currency stays immutable. Only the book name and description can be
              updated here.
            </p>

            <form
              className="form-grid"
              onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))}
            >
              <div className="field">
                <label htmlFor="account-book-name">Name</label>
                <input
                  disabled={!canEdit || updateMutation.isPending}
                  id="account-book-name"
                  type="text"
                  {...form.register("name")}
                />
                {form.formState.errors.name ? (
                  <div className="error-banner">{form.formState.errors.name.message}</div>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="account-book-description">Description</label>
                <textarea
                  disabled={!canEdit || updateMutation.isPending}
                  id="account-book-description"
                  {...form.register("description")}
                />
                {form.formState.errors.description ? (
                  <div className="error-banner">
                    {form.formState.errors.description.message}
                  </div>
                ) : null}
              </div>

              <div className="info-banner">
                Base currency: {detailQuery.data?.base_currency ?? "N/A"} | owner:{" "}
                <span className="mono">{shortID(detailQuery.data?.owner_user_id)}</span>
              </div>

              {updateMutation.isError ? (
                <div className="error-banner">
                  {updateMutation.error instanceof ApiError
                    ? updateMutation.error.message
                    : "Failed to update the account book"}
                </div>
              ) : null}

              {updateMutation.isSuccess ? (
                <div className="success-banner">Account book updated.</div>
              ) : null}

              <button
                className="button primary"
                disabled={!canEdit || updateMutation.isPending}
                type="submit"
              >
                {!canEdit
                  ? "Admin Or Owner Required"
                  : updateMutation.isPending
                    ? "Saving..."
                    : "Save Changes"}
              </button>
            </form>
          </article>
        </div>
      </div>
    </section>
  );
}
