import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
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

export function NormalExpensePage() {
  const { accountBookId } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
      navigate(`/app/account-books/${accountBookId}`, { replace: true });
    },
  });

  return (
    <section className="stack">
      <header className="page-header">
        <div className="split-header">
          <div>
            <h1>New Normal Expense</h1>
            <p>
              Record a single expense item directly into
              <span className="mono"> {detailQuery.data?.name ?? "this book"}</span>.
            </p>
          </div>
          <Link className="button" to={`/app/account-books/${accountBookId}`}>
            Back To Book
          </Link>
        </div>
      </header>

      <div className="detail-grid">
        <article className="detail-card">
          <h3>Expense Form</h3>
          <p>
            Only non-merge categories are listed here. The backend still resolves the
            exchange rate and converted amount during write.
          </p>

          <form
            className="form-grid"
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
          >
            <div className="field">
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
                <div className="error-banner">
                  {form.formState.errors.category_id.message}
                </div>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="normal-name">Name</label>
              <input id="normal-name" type="text" {...form.register("name")} />
              {form.formState.errors.name ? (
                <div className="error-banner">{form.formState.errors.name.message}</div>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="normal-description">Description</label>
              <textarea id="normal-description" {...form.register("description")} />
              {form.formState.errors.description ? (
                <div className="error-banner">{form.formState.errors.description.message}</div>
              ) : null}
            </div>

            <div className="inline-grid">
              <div className="field">
                <label htmlFor="normal-amount">Original Amount</label>
                <input id="normal-amount" type="text" {...form.register("original_amount")} />
                {form.formState.errors.original_amount ? (
                  <div className="error-banner">
                    {form.formState.errors.original_amount.message}
                  </div>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="normal-currency">Original Currency</label>
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

              <div className="field">
                <label htmlFor="normal-spent-at">Spent At</label>
                <input id="normal-spent-at" type="date" {...form.register("spent_at")} />
                {form.formState.errors.spent_at ? (
                  <div className="error-banner">{form.formState.errors.spent_at.message}</div>
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

            <div className="form-actions">
              <button
                className="button primary"
                disabled={createMutation.isPending || normalCategories.length === 0}
                type="submit"
              >
                {createMutation.isPending ? "Creating..." : "Create Expense"}
              </button>
              <Link className="button" to={`/app/account-books/${accountBookId}`}>
                Cancel
              </Link>
            </div>
          </form>
        </article>

        <article className="detail-card">
          <h3>Write Notes</h3>
          <div className="stack-sm">
            <div className="info-banner">
              Book base currency: {detailQuery.data?.base_currency ?? "Loading..."}
            </div>
            <div className="info-banner">
              Available normal categories: {normalCategories.length}
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
