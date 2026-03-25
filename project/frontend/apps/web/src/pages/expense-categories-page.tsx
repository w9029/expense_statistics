import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { z } from "zod";
import type { ExpenseCategory } from "@expense-statistics/domain";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { apiClient } from "@/lib/api";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().max(400, "Description is too long").optional(),
  is_merge_category: z.boolean(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a hex value like #AABBCC"),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

const emptyCategoryValues: CategoryFormValues = {
  name: "",
  description: "",
  is_merge_category: false,
  color: "#CA5D2B",
};

function toFormValues(category: ExpenseCategory): CategoryFormValues {
  return {
    name: category.name,
    description: category.description ?? "",
    is_merge_category: category.is_merge_category,
    color: category.color,
  };
}

export function ExpenseCategoriesPage() {
  const { accountBookId } = useParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: emptyCategoryValues,
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

  const selectedCategory =
    categoriesQuery.data?.find((category) => category.id === selectedCategoryId) ?? null;

  useEffect(() => {
    if (selectedCategory) {
      form.reset(toFormValues(selectedCategory));
      return;
    }
    setSelectedCategoryId(null);
    form.reset(emptyCategoryValues);
  }, [selectedCategory, form]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }
    const timeoutID = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 2000);
    return () => window.clearTimeout(timeoutID);
  }, [successMessage]);

  const canEdit =
    detailQuery.data?.my_role === "owner" ||
    detailQuery.data?.my_role === "admin" ||
    detailQuery.data?.my_role === "editor";

  async function refreshCategoryQueries() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["account-book-expense-categories", accountBookId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["account-book-expenses", accountBookId],
      }),
    ]);
  }

  function resetToCreateMode(isMergeCategory = false) {
    setSelectedCategoryId(null);
    form.reset({
      ...emptyCategoryValues,
      is_merge_category: isMergeCategory,
    });
  }

  const createMutation = useMutation({
    mutationFn: (values: CategoryFormValues) =>
      apiClient.createExpenseCategory(auth.accessToken!, accountBookId!, {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        is_merge_category: values.is_merge_category,
        color: values.color.trim().toUpperCase(),
      }),
    onSuccess: async (_, values) => {
      resetToCreateMode(values.is_merge_category);
      setSuccessMessage("Category created.");
      await refreshCategoryQueries();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: CategoryFormValues) =>
      apiClient.updateExpenseCategory(auth.accessToken!, accountBookId!, selectedCategoryId!, {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        is_merge_category: values.is_merge_category,
        color: values.color.trim().toUpperCase(),
      }),
    onSuccess: async (updated) => {
      form.reset(toFormValues(updated));
      setSuccessMessage("Category updated.");
      await refreshCategoryQueries();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deleteExpenseCategory(auth.accessToken!, accountBookId!, selectedCategoryId!),
    onSuccess: async () => {
      setSelectedCategoryId(null);
      setSuccessMessage("Category deleted.");
      await refreshCategoryQueries();
    },
  });

  const currentError = createMutation.error ?? updateMutation.error ?? deleteMutation.error ?? null;
  const watchedColor = form.watch("color");
  const watchedName = form.watch("name");
  const previewColor = /^#[0-9A-Fa-f]{6}$/.test(watchedColor.trim())
    ? watchedColor.trim().toUpperCase()
    : emptyCategoryValues.color;

  function startCreate(isMergeCategory: boolean) {
    setSuccessMessage(null);
    resetToCreateMode(isMergeCategory);
  }

  function startEdit(categoryID: string) {
    setSuccessMessage(null);
    setSelectedCategoryId(categoryID);
  }

  function handleSubmit(values: CategoryFormValues) {
    setSuccessMessage(null);
    if (selectedCategoryId) {
      updateMutation.mutate(values);
      return;
    }
    createMutation.mutate(values);
  }

  function handleDelete() {
    if (!selectedCategoryId || deleteMutation.isPending) {
      return;
    }
    if (!window.confirm("Delete this category? This only works when no expense uses it.")) {
      return;
    }
    setSuccessMessage(null);
    deleteMutation.mutate();
  }

  function handleResetForm() {
    setSuccessMessage(null);
    if (selectedCategory) {
      form.reset(toFormValues(selectedCategory));
      return;
    }
    resetToCreateMode(form.getValues("is_merge_category"));
  }

  function renderCategoryGroup(
    title: string,
    categories: ExpenseCategory[],
    emptyText: string,
  ) {
    return (
      <section className="category-list-section">
        <div className="helper-row">
          <strong>{title}</strong>
          <span className="badge badge-tight">{categories.length}</span>
        </div>

        {categories.length ? (
          <div className="category-list">
            {categories.map((category) => {
              const active = category.id === selectedCategoryId;

              return (
                <button
                  className={`category-item${active ? " active" : ""}`}
                  key={category.id}
                  onClick={() => startEdit(category.id)}
                  type="button"
                >
                  <div className="category-item-main">
                    <div className="category-item-header">
                      <span className="category-badge">
                        <span className="color-swatch color-swatch-lg" style={{ backgroundColor: category.color }} />
                        {category.name}
                      </span>
                      <div className="helper-row">
                        {category.is_system_seed ? <span className="badge badge-tight">seed</span> : null}
                        {active ? <span className="badge badge-tight">editing</span> : null}
                      </div>
                    </div>
                    <p>{category.description ?? "No description."}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">{emptyText}</div>
        )}
      </section>
    );
  }

  const normalCategories = (categoriesQuery.data ?? []).filter((category) => !category.is_merge_category);
  const mergeCategories = (categoriesQuery.data ?? []).filter((category) => category.is_merge_category);
  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <section className="stack stack-tight">
      <header className="page-header page-header-compact">
        <div className="stack-sm">
          <div className="title-row">
            <h1>Expense Categories</h1>
          </div>
          <p>
            Manage normal categories and merge parent categories for this account book.
          </p>
          <div className="meta-strip">
            <span className="inline-stat">book: {detailQuery.data?.name ?? "-"}</span>
            <span className="inline-stat">role: {detailQuery.data?.my_role ?? "-"}</span>
            <span className="inline-stat">base: {detailQuery.data?.base_currency ?? "-"}</span>
          </div>
        </div>
      </header>

      {detailQuery.isLoading || categoriesQuery.isLoading ? (
        <div className="info-banner compact-banner">Loading categories...</div>
      ) : null}
      {detailQuery.isError ? (
        <div className="error-banner">
          {detailQuery.error instanceof ApiError ? detailQuery.error.message : "Failed to load account book"}
        </div>
      ) : null}
      {categoriesQuery.isError ? (
        <div className="error-banner">
          {categoriesQuery.error instanceof ApiError ? categoriesQuery.error.message : "Failed to load categories"}
        </div>
      ) : null}

      <div className="category-page-grid">
        <article className="detail-card compact-card">
          <div className="compact-header-row">
            <div>
              <h3>Category List</h3>
              <p>Normal categories are used by direct expenses and merged children.</p>
            </div>
            <div className="badge-row badge-row-tight">
              <span className="badge badge-tight">total {categoriesQuery.data?.length ?? 0}</span>
              <span className="badge badge-tight">normal {normalCategories.length}</span>
              <span className="badge badge-tight">merge {mergeCategories.length}</span>
            </div>
          </div>

          <div className="stack">
            {renderCategoryGroup("Normal Categories", normalCategories, "No normal category yet.")}
            {renderCategoryGroup("Merge Categories", mergeCategories, "No merge category yet.")}
          </div>
        </article>

        <article className="detail-card compact-card">
          <div className="compact-header-row">
            <div>
              <h3>{selectedCategory ? "Edit Category" : "Create Category"}</h3>
              <p>
                {selectedCategory
                  ? "Update the selected category. Delete only works if no expense uses it."
                  : "Choose normal or merge, then save the new category."}
              </p>
            </div>
            {selectedCategory ? (
              <div className="form-actions-group">
                <span className="badge badge-tight">{selectedCategory.is_merge_category ? "merge" : "normal"}</span>
                <button className="button button-sm" onClick={() => startCreate(false)} type="button">
                  Cancel
                </button>
              </div>
            ) : null}
          </div>

          {!canEdit ? (
            <div className="info-banner">Your role can view categories but cannot modify them.</div>
          ) : (
            <form className="form-grid compact-form-grid" onSubmit={form.handleSubmit(handleSubmit)}>
              {successMessage ? <div className="success-banner compact-banner">{successMessage}</div> : null}
              {currentError ? (
                <div className="error-banner compact-banner">
                  {currentError instanceof ApiError ? currentError.message : "Category action failed"}
                </div>
              ) : null}

              <div className="inline-grid inline-grid-3">
                <div className="field field-compact inline-grid-span-2">
                  <label htmlFor="category-name">Name</label>
                  <input
                    disabled={isMutating}
                    id="category-name"
                    type="text"
                    {...form.register("name")}
                  />
                </div>
                {!selectedCategory ? (
                  <div className="field field-compact">
                    <label htmlFor="category-type">Type</label>
                    <select
                      disabled={isMutating}
                      id="category-type"
                      {...form.register("is_merge_category", {
                        setValueAs: (value) => value === "true",
                      })}
                    >
                      <option value="false">Normal</option>
                      <option value="true">Merge</option>
                    </select>
                  </div>
                ) : null}
              </div>

              <div className="field field-compact">
                <label htmlFor="category-description">Description</label>
                <textarea
                  disabled={isMutating}
                  id="category-description"
                  rows={4}
                  {...form.register("description")}
                />
              </div>

              <div className="category-appearance-row">
                <div className="field field-compact category-appearance-field">
                  <label htmlFor="category-color">Color</label>
                  <input
                    className="color-picker-input"
                    disabled={isMutating}
                    id="category-color"
                    type="color"
                    value={previewColor}
                    onChange={(event) =>
                      form.setValue("color", event.target.value.toUpperCase(), {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                </div>
                <div className="field field-compact category-appearance-field">
                  <label>Live Badge</label>
                  <div className="category-preview-row category-preview-row-left category-preview-row-centered">
                    <span className="category-badge">
                      <span
                        className="color-swatch color-swatch-lg"
                        style={{ backgroundColor: previewColor }}
                      />
                      {watchedName.trim() || "Category"}
                    </span>
                  </div>
                </div>
              </div>

              {form.formState.errors.name ? (
                <div className="error-banner compact-banner">{form.formState.errors.name.message}</div>
              ) : null}
              {form.formState.errors.description ? (
                <div className="error-banner compact-banner">{form.formState.errors.description.message}</div>
              ) : null}
              {form.formState.errors.color ? (
                <div className="error-banner compact-banner">{form.formState.errors.color.message}</div>
              ) : null}

              <div className="form-actions form-actions-split">
                <div className="form-actions-group">
                  {form.formState.isDirty ? (
                    <button className="button button-sm" onClick={handleResetForm} type="button">
                      Reset
                    </button>
                  ) : null}
                  {selectedCategory ? (
                    <button
                      className="button button-danger-strong button-sm"
                      disabled={isMutating}
                      onClick={handleDelete}
                      type="button"
                    >
                      {deleteMutation.isPending ? "Deleting..." : "Delete"}
                    </button>
                  ) : null}
                </div>

                <div className="form-actions-group">
                  <button className="button primary button-sm" disabled={isMutating} type="submit">
                    {selectedCategory
                      ? updateMutation.isPending
                        ? "Saving..."
                        : "Save Category"
                      : createMutation.isPending
                        ? "Creating..."
                        : "Create Category"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </article>
      </div>
    </section>
  );
}
