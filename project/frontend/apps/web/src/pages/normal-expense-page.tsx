import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { useToast } from "@/features/feedback/toast-context";
import { apiClient } from "@/lib/api";
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
  const { accountBookId } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
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

  const normalCategories = (categoriesQuery.data ?? []).filter(
    (category) => !category.is_merge_category,
  );

  const createMutation = useMutation({
    mutationFn: async (values: NormalExpenseFormValues) => {
      const parsed = normalExpenseSchema.parse(values);

      return apiClient.createNormalExpense(auth.accessToken!, accountBookId!, {
        category_id: parsed.category_id,
        name: parsed.name.trim(),
        description: parsed.description?.trim() || null,
        original_amount: parsed.original_amount.trim(),
        original_currency: parsed.original_currency,
        spent_at: parsed.spent_at,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["account-book-expenses", accountBookId],
      });

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
        error instanceof ApiError ? error.message : "Failed to create the expense";
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
      await createMutation.mutateAsync(values);
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
        <div className="split-header">
          <div>
            <h1>New Normal Expense</h1>
            <p>
              Fast entry mode for <span className="mono">{detailQuery.data?.name ?? "this book"}</span>.
            </p>
          </div>
          <Link className="button button-sm" to={`/app/account-books/${accountBookId}`}>
            Back To Book
          </Link>
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
              <p>Enter submits. Ctrl+Enter creates and keeps you on the form.</p>
            </div>
            <div className="helper-row">
              <span className="badge">base {detailQuery.data?.base_currency ?? "..."}</span>
              <span className="badge">{normalCategories.length} categories</span>
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

            {createMutation.isError ? (
              <div className="error-banner">
                {createMutation.error instanceof ApiError
                  ? createMutation.error.message
                  : "Failed to create the expense"}
              </div>
            ) : null}

            <div className="form-actions form-actions-split">
              <div className="form-actions-group">
                <Link className="button button-sm button-muted" to={`/app/account-books/${accountBookId}`}>
                  Cancel
                </Link>
              </div>
              <div className="form-actions-group">
                <button
                  className="button button-sm button-accent-soft"
                  disabled={createMutation.isPending || normalCategories.length === 0}
                  onClick={() => void submit("next")}
                  type="button"
                >
                  {createMutation.isPending && submitModeRef.current === "next"
                    ? "Creating..."
                    : "Create Expense And Next"}
                </button>
                <button
                  className="button primary button-sm"
                  disabled={createMutation.isPending || normalCategories.length === 0}
                  onClick={() => {
                    submitModeRef.current = "back";
                  }}
                  type="submit"
                >
                  {createMutation.isPending && submitModeRef.current === "back"
                    ? "Creating..."
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
