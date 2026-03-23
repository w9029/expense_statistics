import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { apiClient } from "@/lib/api";
import { parseDecimalInput, todayNaturalDate } from "@/lib/ledger";

const amountPattern = /^\d+(\.\d{1,2})?$/;
const naturalDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const mergedExpenseSchema = z.object({
  parent: z.object({
    category_id: z.string().min(1, "Parent category is required"),
    name: z.string().trim().min(1, "Parent name is required").max(200, "Name is too long"),
    description: z.string().max(400, "Description is too long").optional(),
    total_original_amount: z
      .string()
      .trim()
      .regex(amountPattern, "Use a valid total amount"),
    original_currency: z
      .string()
      .trim()
      .length(3, "Use a 3-letter currency code")
      .transform((value) => value.toUpperCase()),
    spent_at: z.string().regex(naturalDatePattern, "Use YYYY-MM-DD"),
  }),
  children_amount_input_mode: z.enum(["pretax", "posttax"]),
  children: z
    .array(
      z.object({
        category_id: z.string().min(1, "Child category is required"),
        name: z.string().trim().min(1, "Child name is required").max(200, "Name is too long"),
        description: z.string().max(400, "Description is too long").optional(),
        amount_input: z
          .string()
          .trim()
          .regex(amountPattern, "Use a valid child amount"),
      }),
    )
    .min(1, "At least one child item is required"),
});

type MergedExpenseFormValues = z.input<typeof mergedExpenseSchema>;

export function MergedExpensePage() {
  const { accountBookId } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<MergedExpenseFormValues>({
    resolver: zodResolver(mergedExpenseSchema),
    defaultValues: {
      parent: {
        category_id: "",
        name: "",
        description: "",
        total_original_amount: "",
        original_currency: auth.user?.preferred_currency ?? "JPY",
        spent_at: todayNaturalDate(),
      },
      children_amount_input_mode: "pretax",
      children: [
        {
          category_id: "",
          name: "",
          description: "",
          amount_input: "",
        },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "children",
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

  const mergeCategories = (categoriesQuery.data ?? []).filter((category) => category.is_merge_category);
  const normalCategories = (categoriesQuery.data ?? []).filter(
    (category) => !category.is_merge_category,
  );

  const createMutation = useMutation({
    mutationFn: async (values: MergedExpenseFormValues) => {
      const parsed = mergedExpenseSchema.parse(values);

      return apiClient.createMergedExpense(auth.accessToken!, accountBookId!, {
        parent: {
          category_id: parsed.parent.category_id,
          name: parsed.parent.name.trim(),
          description: parsed.parent.description?.trim() || null,
          total_original_amount: parsed.parent.total_original_amount.trim(),
          original_currency: parsed.parent.original_currency,
          spent_at: parsed.parent.spent_at,
        },
        children_amount_input_mode: parsed.children_amount_input_mode,
        children: parsed.children.map((child) => ({
          category_id: child.category_id,
          name: child.name.trim(),
          description: child.description?.trim() || null,
          amount_input: child.amount_input.trim(),
        })),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["account-book-expenses", accountBookId],
      });
      navigate(`/app/account-books/${accountBookId}`, { replace: true });
    },
  });

  const childValues = form.watch("children");
  const parentTotal = parseDecimalInput(form.watch("parent.total_original_amount"));
  const childTotal = childValues.reduce(
    (sum, child) => sum + parseDecimalInput(child.amount_input),
    0,
  );
  const amountMode = form.watch("children_amount_input_mode");
  const postTaxDifference = Number((parentTotal - childTotal).toFixed(2));

  return (
    <section className="stack">
      <header className="page-header">
        <div className="split-header">
          <div>
            <h1>New Merged Expense</h1>
            <p>
              Use a merge category for the parent expense, then describe each child line
              item with a normal category.
            </p>
          </div>
          <Link className="button" to={`/app/account-books/${accountBookId}`}>
            Back To Book
          </Link>
        </div>
      </header>

      <div className="detail-grid">
        <article className="detail-card">
          <h3>Merged Expense Form</h3>
          <p>
            In pretax mode, the backend allocates the final taxed total and rounding
            remainder across children. In posttax mode, children must add up exactly to
            the parent total.
          </p>

          <form
            className="form-grid"
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
          >
            <div className="field">
              <label htmlFor="merged-parent-category">Parent Merge Category</label>
              <select id="merged-parent-category" {...form.register("parent.category_id")}>
                <option value="">Choose a merge category</option>
                {mergeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {form.formState.errors.parent?.category_id ? (
                <div className="error-banner">
                  {form.formState.errors.parent.category_id.message}
                </div>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="merged-parent-name">Parent Name</label>
              <input id="merged-parent-name" type="text" {...form.register("parent.name")} />
              {form.formState.errors.parent?.name ? (
                <div className="error-banner">{form.formState.errors.parent.name.message}</div>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="merged-parent-description">Parent Description</label>
              <textarea
                id="merged-parent-description"
                {...form.register("parent.description")}
              />
              {form.formState.errors.parent?.description ? (
                <div className="error-banner">
                  {form.formState.errors.parent.description.message}
                </div>
              ) : null}
            </div>

            <div className="inline-grid">
              <div className="field">
                <label htmlFor="merged-parent-total">Merged Total</label>
                <input
                  id="merged-parent-total"
                  type="text"
                  {...form.register("parent.total_original_amount")}
                />
                {form.formState.errors.parent?.total_original_amount ? (
                  <div className="error-banner">
                    {form.formState.errors.parent.total_original_amount.message}
                  </div>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="merged-parent-currency">Original Currency</label>
                <input
                  id="merged-parent-currency"
                  maxLength={3}
                  type="text"
                  {...form.register("parent.original_currency")}
                />
                {form.formState.errors.parent?.original_currency ? (
                  <div className="error-banner">
                    {form.formState.errors.parent.original_currency.message}
                  </div>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="merged-parent-spent-at">Spent At</label>
                <input
                  id="merged-parent-spent-at"
                  type="date"
                  {...form.register("parent.spent_at")}
                />
                {form.formState.errors.parent?.spent_at ? (
                  <div className="error-banner">{form.formState.errors.parent.spent_at.message}</div>
                ) : null}
              </div>
            </div>

            <div className="field">
              <label htmlFor="merged-mode">Children Amount Input Mode</label>
              <select id="merged-mode" {...form.register("children_amount_input_mode")}>
                <option value="pretax">Pretax</option>
                <option value="posttax">Posttax</option>
              </select>
            </div>

            <div className="stack-sm">
              <div className="split-header">
                <div>
                  <h3 style={{ marginBottom: 6 }}>Child Items</h3>
                  <p>Add one row per line item on the receipt.</p>
                </div>
                <button
                  className="button"
                  onClick={() =>
                    append({
                      category_id: "",
                      name: "",
                      description: "",
                      amount_input: "",
                    })
                  }
                  type="button"
                >
                  Add Child
                </button>
              </div>

              {fields.map((field, index) => (
                <div className="child-form-card" key={field.id}>
                  <div className="split-header">
                    <strong>Child {index + 1}</strong>
                    <button
                      className="button danger"
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="form-grid" style={{ marginTop: 14 }}>
                    <div className="field">
                      <label htmlFor={`child-category-${index}`}>Category</label>
                      <select
                        id={`child-category-${index}`}
                        {...form.register(`children.${index}.category_id`)}
                      >
                        <option value="">Choose a normal category</option>
                        {normalCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      {form.formState.errors.children?.[index]?.category_id ? (
                        <div className="error-banner">
                          {form.formState.errors.children[index]?.category_id?.message}
                        </div>
                      ) : null}
                    </div>

                    <div className="field">
                      <label htmlFor={`child-name-${index}`}>Name</label>
                      <input
                        id={`child-name-${index}`}
                        type="text"
                        {...form.register(`children.${index}.name`)}
                      />
                      {form.formState.errors.children?.[index]?.name ? (
                        <div className="error-banner">
                          {form.formState.errors.children[index]?.name?.message}
                        </div>
                      ) : null}
                    </div>

                    <div className="field">
                      <label htmlFor={`child-description-${index}`}>Description</label>
                      <textarea
                        id={`child-description-${index}`}
                        {...form.register(`children.${index}.description`)}
                      />
                      {form.formState.errors.children?.[index]?.description ? (
                        <div className="error-banner">
                          {form.formState.errors.children[index]?.description?.message}
                        </div>
                      ) : null}
                    </div>

                    <div className="field">
                      <label htmlFor={`child-amount-${index}`}>
                        {amountMode === "pretax" ? "Pretax Amount Input" : "Posttax Amount Input"}
                      </label>
                      <input
                        id={`child-amount-${index}`}
                        type="text"
                        {...form.register(`children.${index}.amount_input`)}
                      />
                      {form.formState.errors.children?.[index]?.amount_input ? (
                        <div className="error-banner">
                          {form.formState.errors.children[index]?.amount_input?.message}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {createMutation.isError ? (
              <div className="error-banner">
                {createMutation.error instanceof ApiError
                  ? createMutation.error.message
                  : "Failed to create the merged expense"}
              </div>
            ) : null}

            <div className="form-actions">
              <button
                className="button primary"
                disabled={
                  createMutation.isPending ||
                  mergeCategories.length === 0 ||
                  normalCategories.length === 0
                }
                type="submit"
              >
                {createMutation.isPending ? "Creating..." : "Create Merged Expense"}
              </button>
              <Link className="button" to={`/app/account-books/${accountBookId}`}>
                Cancel
              </Link>
            </div>
          </form>
        </article>

        <article className="detail-card">
          <h3>Calculation Preview</h3>
          <div className="stack-sm">
            <div className="info-banner">
              Parent total input: {parentTotal.toFixed(2)}{" "}
              {form.watch("parent.original_currency").trim().toUpperCase() || "JPY"}
            </div>
            <div className="info-banner">Children input sum: {childTotal.toFixed(2)}</div>
            {amountMode === "pretax" ? (
              <div className="info-banner">
                Pretax mode means the backend computes the final taxed child amounts and
                assigns any rounding remainder to the largest line item.
              </div>
            ) : (
              <div
                className={postTaxDifference === 0 ? "success-banner" : "error-banner"}
              >
                Posttax difference vs parent total: {postTaxDifference.toFixed(2)}
              </div>
            )}

            <div className="info-banner">
              Book base currency: {detailQuery.data?.base_currency ?? "Loading..."}
            </div>
            <div className="info-banner">Merge categories: {mergeCategories.length}</div>
            <div className="info-banner">Normal categories: {normalCategories.length}</div>

            {mergeCategories.length === 0 || normalCategories.length === 0 ? (
              <div className="error-banner">
                This account book needs both merge categories and normal categories
                before merged expenses can be entered.
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
