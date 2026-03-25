import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { useToast } from "@/features/feedback/toast-context";
import { apiClient } from "@/lib/api";
import {
  buildExpenseListNavigationState,
  readExpenseListFiltersFromState,
} from "@/lib/expense-list-navigation";
import { todayNaturalDate } from "@/lib/ledger";

const amountPattern = /^\d+(\.\d{1,2})?$/;
const naturalDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const normalExpenseSchema = z.object({
  category_id: z.string().min(1, "Category is required"),
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().max(400, "Description is too long").optional(),
  original_amount: z
    .string()
    .trim()
    .regex(amountPattern, "Use a valid amount with up to 2 decimals"),
  original_currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code")
    .transform((value) => value.toUpperCase()),
  spent_at: z.string().regex(naturalDatePattern, "Use YYYY-MM-DD"),
});

type NormalExpenseFormValues = z.input<typeof normalExpenseSchema>;
type SubmitMode = "back" | "next";

export function NormalExpensePage() {
  const { accountBookId, expenseId } = useParams();
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const isEditMode = Boolean(expenseId);
  const returnFilters = readExpenseListFiltersFromState(location.state);
  const backToBookState = returnFilters
    ? buildExpenseListNavigationState(returnFilters)
    : undefined;
  const submitModeRef = useRef<SubmitMode>("back");
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [flashMessage, setFlashMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const form = useForm<NormalExpenseFormValues>({
    resolver: zodResolver(normalExpenseSchema),
    defaultValues: {
      category_id: "",
      name: "",
      description: "",
      original_amount: "",
      original_currency: auth.user?.preferred_currency ?? "JPY",
      spent_at: todayNaturalDate(),
    },
  });
  const { ref: nameFieldRef, ...nameFieldProps } = form.register("name");

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

  const expenseDetailQuery = useQuery({
    queryKey: ["expense-detail", accountBookId, expenseId],
    queryFn: () => apiClient.getExpenseDetail(auth.accessToken!, accountBookId!, expenseId!),
    enabled: Boolean(auth.accessToken && accountBookId && expenseId),
  });

  const normalCategories = (categoriesQuery.data ?? []).filter(
    (category) => !category.is_merge_category,
  );

  useEffect(() => {
    if (!expenseDetailQuery.data || !isEditMode) {
      return;
    }

    form.reset({
      category_id: expenseDetailQuery.data.expense.category_id,
      name: expenseDetailQuery.data.expense.name,
      description: expenseDetailQuery.data.expense.description ?? "",
      original_amount: expenseDetailQuery.data.expense.original_amount,
      original_currency: expenseDetailQuery.data.expense.original_currency,
      spent_at: expenseDetailQuery.data.expense.spent_at,
    });
  }, [expenseDetailQuery.data, form, isEditMode]);

  const saveMutation = useMutation({
    mutationFn: async (values: NormalExpenseFormValues) => {
      const parsed = normalExpenseSchema.parse(values);

      if (isEditMode) {
        return apiClient.updateNormalExpense(auth.accessToken!, accountBookId!, expenseId!, {
          category_id: parsed.category_id,
          name: parsed.name.trim(),
          description: parsed.description?.trim() || null,
          original_amount: parsed.original_amount.trim(),
          original_currency: parsed.original_currency,
          spent_at: parsed.spent_at,
        });
      }

      return apiClient.createNormalExpense(auth.accessToken!, accountBookId!, {
        category_id: parsed.category_id,
        name: parsed.name.trim(),
        description: parsed.description?.trim() || null,
        original_amount: parsed.original_amount.trim(),
        original_currency: parsed.original_currency,
        spent_at: parsed.spent_at,
      });
    },
    onSuccess: async (savedExpense) => {
      await queryClient.invalidateQueries({
        queryKey: ["account-book-expenses", accountBookId],
      });

      if (isEditMode) {
        form.reset({
          category_id: savedExpense.category_id,
          name: savedExpense.name,
          description: savedExpense.description ?? "",
          original_amount: savedExpense.original_amount,
          original_currency: savedExpense.original_currency,
          spent_at: savedExpense.spent_at,
        });
        showToast("Expense updated.", "success");
        navigate(`/app/account-books/${accountBookId}`, {
          replace: true,
          state: backToBookState,
        });
        return;
      }

      if (submitModeRef.current === "next") {
        const current = form.getValues();
        form.reset({
          category_id: current.category_id,
          name: "",
          description: "",
          original_amount: "",
          original_currency: current.original_currency,
          spent_at: current.spent_at || todayNaturalDate(),
        });
        window.setTimeout(() => {
          nameInputRef.current?.focus();
        }, 0);
        setFlashMessage({
          tone: "success",
          text: "Expense created. Ready for the next one.",
        });
        return;
      }

      showToast("Expense created.", "success");
      navigate(`/app/account-books/${accountBookId}`, { replace: true });
    },
    onError: (error) => {
      const text =
        error instanceof ApiError
          ? error.message
          : isEditMode
            ? "Failed to update the expense"
            : "Failed to create the expense";
      setFlashMessage({ tone: "error", text });
      showToast(text, "error");
    },
  });

  useEffect(() => {
    if (!flashMessage) {
      return;
    }

    const timeoutID = window.setTimeout(() => {
      setFlashMessage(null);
    }, 2400);

    return () => window.clearTimeout(timeoutID);
  }, [flashMessage]);

  async function submit(mode: SubmitMode) {
    setFlashMessage(null);
    submitModeRef.current = mode;
    await form.handleSubmit(async (values) => {
      await saveMutation.mutateAsync(values);
    })();
  }

  function handleFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    const target = event.target as HTMLElement;
    if (target.tagName === "TEXTAREA") {
      return;
    }
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    void submit(event.ctrlKey || event.metaKey ? "next" : "back");
  }

  return (
    <section className="stack">
      <header className="page-header page-header-compact">
        <div>
          <div className="title-row">
            <h1>{isEditMode ? "Edit Normal Expense" : "New Normal Expense"}</h1>
          </div>
          <p>
            {isEditMode ? "Update mode for " : "Fast entry mode for "}
            <span className="mono">{detailQuery.data?.name ?? "this book"}</span>.
          </p>
        </div>
      </header>

      <div className="compact-form-shell">
        <article className="detail-card compact-card">
          {flashMessage ? (
            <div
              className={`inline-toast inline-toast-${flashMessage.tone}`}
              role="status"
            >
              {flashMessage.text}
            </div>
          ) : null}

          <div className="compact-header-row">
            <div>
              <h3>Expense Form</h3>
              <p>
                {isEditMode
                  ? "Enter submits the update."
                  : "Enter submits. Ctrl+Enter creates and keeps you on the form."}
              </p>
            </div>
            <div className="helper-row">
              <span className="badge">base {detailQuery.data?.base_currency ?? "..."}</span>
              <span className="badge">{normalCategories.length} categories</span>
              {isEditMode ? <span className="badge">editing</span> : null}
            </div>
          </div>

          <form
            className="form-grid compact-form-grid"
            onKeyDown={handleFormKeyDown}
            onSubmit={(event) => {
              event.preventDefault();
              void submit(submitModeRef.current);
            }}
          >
            <div className="inline-grid inline-grid-4">
              <div className="field field-compact">
                <label htmlFor="normal-category">Category</label>
                <select id="normal-category" {...form.register("category_id")}>
                  <option value="">Choose a category</option>
                  {normalCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {form.formState.errors.category_id ? (
                  <div className="error-banner">{form.formState.errors.category_id.message}</div>
                ) : null}
              </div>

              <div className="field field-compact">
                <label htmlFor="normal-name">Name</label>
                <input
                  id="normal-name"
                  ref={(element) => {
                    nameFieldRef(element);
                    nameInputRef.current = element;
                  }}
                  type="text"
                  {...nameFieldProps}
                />
                {form.formState.errors.name ? (
                  <div className="error-banner">{form.formState.errors.name.message}</div>
                ) : null}
              </div>

              <div className="field field-compact">
                <label htmlFor="normal-amount">Original Amount</label>
                <input id="normal-amount" type="text" {...form.register("original_amount")} />
                {form.formState.errors.original_amount ? (
                  <div className="error-banner">
                    {form.formState.errors.original_amount.message}
                  </div>
                ) : null}
              </div>

              <div className="field field-compact">
                <label htmlFor="normal-currency">Currency</label>
                <input
                  id="normal-currency"
                  maxLength={3}
                  type="text"
                  {...form.register("original_currency")}
                />
                {form.formState.errors.original_currency ? (
                  <div className="error-banner">
                    {form.formState.errors.original_currency.message}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="inline-grid inline-grid-3">
              <div className="field field-compact">
                <label htmlFor="normal-spent-at">Spent At</label>
                <input id="normal-spent-at" type="date" {...form.register("spent_at")} />
                {form.formState.errors.spent_at ? (
                  <div className="error-banner">{form.formState.errors.spent_at.message}</div>
                ) : null}
              </div>

              <div className="field field-compact inline-grid-span-2">
                <label htmlFor="normal-description">Description</label>
                <input id="normal-description" type="text" {...form.register("description")} />
                {form.formState.errors.description ? (
                  <div className="error-banner">{form.formState.errors.description.message}</div>
                ) : null}
              </div>
            </div>

            {expenseDetailQuery.isLoading && isEditMode ? (
              <div className="info-banner">Loading expense...</div>
            ) : null}

            {expenseDetailQuery.isError && isEditMode ? (
              <div className="error-banner">
                {expenseDetailQuery.error instanceof ApiError
                  ? expenseDetailQuery.error.message
                  : "Failed to load the expense"}
              </div>
            ) : null}

            {saveMutation.isError ? (
              <div className="error-banner">
                {saveMutation.error instanceof ApiError
                  ? saveMutation.error.message
                  : isEditMode
                    ? "Failed to update the expense"
                    : "Failed to create the expense"}
              </div>
            ) : null}

            <div className="form-actions form-actions-split">
              <div className="form-actions-group">
                <Link
                  className="button button-sm button-muted"
                  replace={isEditMode}
                  state={backToBookState}
                  to={`/app/account-books/${accountBookId}`}
                >
                  Cancel
                </Link>
              </div>
              <div className="form-actions-group">
                {!isEditMode ? (
                  <button
                    className="button button-sm button-accent-soft"
                    disabled={saveMutation.isPending || normalCategories.length === 0}
                    onClick={() => void submit("next")}
                    type="button"
                  >
                    {saveMutation.isPending && submitModeRef.current === "next"
                      ? "Creating..."
                      : "Create Expense And Next"}
                  </button>
                ) : null}
                <button
                  className="button primary button-sm"
                  disabled={saveMutation.isPending || normalCategories.length === 0}
                  onClick={() => {
                    submitModeRef.current = "back";
                  }}
                  type="submit"
                >
                  {saveMutation.isPending && submitModeRef.current === "back"
                    ? isEditMode
                      ? "Saving..."
                      : "Creating..."
                    : isEditMode
                      ? "Save Expense"
                      : "Create Expense"}
                </button>
              </div>
            </div>
          </form>
        </article>

        <article className="detail-card compact-card compact-side-card">
          <h3>Write Notes</h3>
          <div className="stack-sm">
            <div className="info-banner compact-banner">
              Default date uses the current local system date.
            </div>
            <div className="info-banner compact-banner">
              Normal categories: {normalCategories.length}
            </div>
            {normalCategories.length === 0 ? (
              <div className="error-banner">
                This account book currently has no usable normal category for direct
                expense entry.
              </div>
            ) : null}
            {categoriesQuery.isError ? (
              <div className="error-banner">
                {categoriesQuery.error instanceof ApiError
                  ? categoriesQuery.error.message
                  : "Failed to load categories"}
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
