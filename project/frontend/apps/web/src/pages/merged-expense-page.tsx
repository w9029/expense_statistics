import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { useToast } from "@/features/feedback/toast-context";
import { useI18n } from "@/features/i18n/i18n-context";
import { apiClient } from "@/lib/api";
import {
  buildExpenseListNavigationState,
  readExpenseListFiltersFromState,
} from "@/lib/expense-list-navigation";
import { parseDecimalInput, todayNaturalDate } from "@/lib/ledger";

const amountPattern = /^\d+(\.\d{1,2})?$/;
const naturalDatePattern = /^\d{4}-\d{2}-\d{2}$/;

type SubmitMode = "back" | "next";

function emptyChild() {
  return {
    category_id: "",
    name: "",
    description: "",
    amount_input: "",
  };
}

export function MergedExpensePage() {
  const { accountBookId, expenseId } = useParams();
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { t } = useI18n();
  const isEditMode = Boolean(expenseId);
  const returnFilters = readExpenseListFiltersFromState(location.state);
  const backToBookState = returnFilters
    ? buildExpenseListNavigationState(returnFilters)
    : undefined;
  const submitModeRef = useRef<SubmitMode>("back");
  const formBottomRef = useRef<HTMLDivElement | null>(null);
  const [flashMessage, setFlashMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const copy = {
    titleCreate: t("mergedExpense.titleCreate"),
    titleEdit: t("mergedExpense.titleEdit"),
    subtitleCreate: t("mergedExpense.subtitleCreate"),
    subtitleEdit: t("mergedExpense.subtitleEdit"),
    formTitle: t("mergedExpense.formTitle"),
    formDescriptionCreate: t("mergedExpense.formDescriptionCreate"),
    formDescriptionEdit: t("mergedExpense.formDescriptionEdit"),
    mergeLabel: t("mergedExpense.mergeLabel"),
    normalLabel: t("mergedExpense.normalLabel"),
    baseLabel: t("mergedExpense.baseLabel"),
    editing: t("mergedExpense.editing"),
    mergeCategory: t("mergedExpense.mergeCategory"),
    chooseMergeCategory: t("mergedExpense.chooseMergeCategory"),
    parentName: t("mergedExpense.parentName"),
    total: t("mergedExpense.total"),
    currency: t("mergedExpense.currency"),
    spentAt: t("mergedExpense.spentAt"),
    mode: t("mergedExpense.mode"),
    pretax: t("mergedExpense.pretax"),
    posttax: t("mergedExpense.posttax"),
    description: t("mergedExpense.description"),
    childItems: t("mergedExpense.childItems"),
    childItemsDescription: t("mergedExpense.childItemsDescription"),
    category: t("mergedExpense.category"),
    chooseNormalCategory: t("mergedExpense.chooseNormalCategory"),
    name: t("mergedExpense.name"),
    remove: t("mergedExpense.remove"),
    loadingExpense: t("mergedExpense.loadingExpense"),
    loadExpenseFailed: t("mergedExpense.loadExpenseFailed"),
    createFailed: t("mergedExpense.createFailed"),
    updateFailed: t("mergedExpense.updateFailed"),
    created: t("mergedExpense.created"),
    updated: t("mergedExpense.updated"),
    createdNext: t("mergedExpense.createdNext"),
    cancel: t("common.cancel"),
    addChild: t("mergedExpense.addChild"),
    createAndNext: t("mergedExpense.createAndNext"),
    create: t("mergedExpense.create"),
    save: t("mergedExpense.save"),
    creating: t("mergedExpense.creating"),
    saving: t("mergedExpense.saving"),
    previewTitle: t("mergedExpense.previewTitle"),
    parentTotal: t("mergedExpense.parentTotal"),
    childrenSum: t("mergedExpense.childrenSum"),
    expectedTaxRate: t("mergedExpense.expectedTaxRate"),
    pretaxHint: t("mergedExpense.pretaxHint"),
    posttaxDifference: t("mergedExpense.posttaxDifference"),
    missingCategories: t("mergedExpense.missingCategories"),
    confirmCreate: t("mergedExpense.confirmCreate"),
    confirmSave: t("mergedExpense.confirmSave"),
    parentCategoryRequired: t("mergedExpense.parentCategoryRequired"),
    parentNameRequired: t("mergedExpense.parentNameRequired"),
    nameLong: t("mergedExpense.nameLong"),
    amountInvalid: t("mergedExpense.amountInvalid"),
    currencyInvalid: t("mergedExpense.currencyInvalid"),
    dateInvalid: t("mergedExpense.dateInvalid"),
    childCategoryRequired: t("mergedExpense.childCategoryRequired"),
    childNameRequired: t("mergedExpense.childNameRequired"),
    childAmountInvalid: t("mergedExpense.childAmountInvalid"),
    childrenRequired: t("mergedExpense.childrenRequired"),
  };

  const mergedExpenseSchema = z.object({
    parent: z.object({
      category_id: z.string().min(1, copy.parentCategoryRequired),
      name: z.string().trim().min(1, copy.parentNameRequired).max(200, copy.nameLong),
      description: z.string().max(400, t("common.error.descriptionLong")).optional(),
      total_original_amount: z.string().trim().regex(amountPattern, copy.amountInvalid),
      original_currency: z
        .string()
        .trim()
        .length(3, copy.currencyInvalid)
        .transform((value) => value.toUpperCase()),
      spent_at: z.string().regex(naturalDatePattern, copy.dateInvalid),
    }),
    children_amount_input_mode: z.enum(["pretax", "posttax"]),
    children: z
      .array(
        z.object({
          category_id: z.string().min(1, copy.childCategoryRequired),
          name: z.string().trim().min(1, copy.childNameRequired).max(200, copy.nameLong),
          description: z.string().max(400, t("common.error.descriptionLong")).optional(),
          amount_input: z.string().trim().regex(amountPattern, copy.childAmountInvalid),
        }),
      )
      .min(1, copy.childrenRequired),
  });

  type MergedExpenseFormValues = z.input<typeof mergedExpenseSchema>;

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
      children: [emptyChild()],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
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

  const expenseDetailQuery = useQuery({
    queryKey: ["expense-detail", accountBookId, expenseId],
    queryFn: () => apiClient.getExpenseDetail(auth.accessToken!, accountBookId!, expenseId!),
    enabled: Boolean(auth.accessToken && accountBookId && expenseId),
  });

  const mergeCategories = (categoriesQuery.data ?? []).filter((category) => category.is_merge_category);
  const normalCategories = (categoriesQuery.data ?? []).filter(
    (category) => !category.is_merge_category,
  );

  useEffect(() => {
    if (!expenseDetailQuery.data || !isEditMode) {
      return;
    }

    const mappedChildren =
      expenseDetailQuery.data.children?.map((child) => ({
        category_id: child.category_id,
        name: child.name,
        description: child.description ?? "",
        amount_input: child.original_amount,
      })) ?? [emptyChild()];

    form.reset({
      parent: {
        category_id: expenseDetailQuery.data.expense.category_id,
        name: expenseDetailQuery.data.expense.name,
        description: expenseDetailQuery.data.expense.description ?? "",
        total_original_amount: expenseDetailQuery.data.expense.original_amount,
        original_currency: expenseDetailQuery.data.expense.original_currency,
        spent_at: expenseDetailQuery.data.expense.spent_at,
      },
      children_amount_input_mode: "posttax",
      children: mappedChildren,
    });
    replace(mappedChildren);
  }, [expenseDetailQuery.data, form, isEditMode, replace]);

  const saveMutation = useMutation({
    mutationFn: async (values: MergedExpenseFormValues) => {
      const parsed = mergedExpenseSchema.parse(values);

      if (isEditMode) {
        return apiClient.updateMergedExpense(auth.accessToken!, accountBookId!, expenseId!, {
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
      }

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
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({
        queryKey: ["account-book-expenses", accountBookId],
      });

      if (isEditMode) {
        const mappedChildren = saved.children.map((child) => ({
          category_id: child.category_id,
          name: child.name,
          description: child.description ?? "",
          amount_input: child.original_amount,
        }));

        form.reset({
          parent: {
            category_id: saved.parent.category_id,
            name: saved.parent.name,
            description: saved.parent.description ?? "",
            total_original_amount: saved.parent.original_amount,
            original_currency: saved.parent.original_currency,
            spent_at: saved.parent.spent_at,
          },
          children_amount_input_mode: saved.children_amount_input_mode,
          children: mappedChildren,
        });
        replace(mappedChildren);
        showToast(copy.updated, "success");
        navigate(`/app/account-books/${accountBookId}`, {
          replace: true,
          state: backToBookState,
        });
        return;
      }

      if (submitModeRef.current === "next") {
        const current = form.getValues();
        form.reset({
          parent: {
            category_id: current.parent.category_id,
            name: "",
            description: "",
            total_original_amount: "",
            original_currency: current.parent.original_currency,
            spent_at: current.parent.spent_at || todayNaturalDate(),
          },
          children_amount_input_mode: current.children_amount_input_mode,
          children: [emptyChild()],
        });
        replace([emptyChild()]);
        setFlashMessage({
          tone: "success",
          text: copy.createdNext,
        });
        return;
      }

      showToast(copy.created, "success");
      navigate(`/app/account-books/${accountBookId}`, { replace: true });
    },
    onError: (error) => {
      const text =
        error instanceof ApiError
          ? error.message
          : isEditMode
            ? copy.updateFailed
            : copy.createFailed;
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

  const childValues = form.watch("children");
  const parentTotal = parseDecimalInput(form.watch("parent.total_original_amount"));
  const childTotal = childValues.reduce(
    (sum, child) => sum + parseDecimalInput(child.amount_input),
    0,
  );
  const amountMode = form.watch("children_amount_input_mode");
  const postTaxDifference = Number((parentTotal - childTotal).toFixed(2));
  const expectedTaxRate =
    childTotal > 0 ? Number((((parentTotal - childTotal) / childTotal) * 100).toFixed(2)) : null;
  const expectedTaxRateTone =
    expectedTaxRate === null
      ? "info-banner compact-banner"
      : expectedTaxRate >= 0 && expectedTaxRate <= 15
        ? "success-banner compact-banner"
        : "error-banner compact-banner";

  async function submit(mode: SubmitMode) {
    setFlashMessage(null);
    submitModeRef.current = mode;
    const confirmed = window.confirm(isEditMode ? copy.confirmSave : copy.confirmCreate);
    if (!confirmed) {
      return;
    }
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

    if (event.altKey) {
      event.preventDefault();
      appendChildAndScroll();
      return;
    }

    event.preventDefault();
    void submit(event.ctrlKey || event.metaKey ? "next" : "back");
  }

  function appendChildAndScroll() {
    append(emptyChild());
    window.setTimeout(() => {
      formBottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 0);
  }

  return (
    <section className="stack">
      <header className="page-header page-header-compact">
        <div>
          <div className="title-row">
            <h1>{isEditMode ? copy.titleEdit : copy.titleCreate}</h1>
          </div>
          <p>
            {(isEditMode ? copy.subtitleEdit : copy.subtitleCreate).replace(
              "{book}",
              detailQuery.data?.name ?? "this book",
            )}
          </p>
        </div>
      </header>

      <div className="compact-form-shell compact-form-shell-wide">
        <article className="detail-card compact-card">
          {flashMessage ? (
            <div className={`inline-toast inline-toast-${flashMessage.tone}`} role="status">
              {flashMessage.text}
            </div>
          ) : null}

          <div className="compact-header-row">
            <div>
              <h3>{copy.formTitle}</h3>
              <p>{isEditMode ? copy.formDescriptionEdit : copy.formDescriptionCreate}</p>
            </div>
            <div className="helper-row">
              <span className="badge">
                {copy.mergeLabel} {mergeCategories.length}
              </span>
              <span className="badge">
                {copy.normalLabel} {normalCategories.length}
              </span>
              <span className="badge">
                {copy.baseLabel} {detailQuery.data?.base_currency ?? "..."}
              </span>
              {isEditMode ? <span className="badge">{copy.editing}</span> : null}
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
            <div className="inline-grid inline-grid-5">
              <div className="field field-compact">
                <label htmlFor="merged-parent-category">{copy.mergeCategory}</label>
                <select id="merged-parent-category" {...form.register("parent.category_id")}>
                  <option value="">{copy.chooseMergeCategory}</option>
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

              <div className="field field-compact inline-grid-span-2">
                <label htmlFor="merged-parent-name">{copy.parentName}</label>
                <input id="merged-parent-name" type="text" {...form.register("parent.name")} />
                {form.formState.errors.parent?.name ? (
                  <div className="error-banner">{form.formState.errors.parent.name.message}</div>
                ) : null}
              </div>

              <div className="field field-compact">
                <label htmlFor="merged-parent-total">{copy.total}</label>
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

              <div className="field field-compact">
                <label htmlFor="merged-parent-currency">{copy.currency}</label>
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
            </div>

            <div className="inline-grid inline-grid-4">
              <div className="field field-compact">
                <label htmlFor="merged-parent-spent-at">{copy.spentAt}</label>
                <input
                  id="merged-parent-spent-at"
                  type="date"
                  {...form.register("parent.spent_at")}
                />
                {form.formState.errors.parent?.spent_at ? (
                  <div className="error-banner">{form.formState.errors.parent.spent_at.message}</div>
                ) : null}
              </div>

              <div className="field field-compact">
                <label htmlFor="merged-mode">{copy.mode}</label>
                <select id="merged-mode" {...form.register("children_amount_input_mode")}>
                  <option value="pretax">{copy.pretax}</option>
                  <option value="posttax">{copy.posttax}</option>
                </select>
              </div>

              <div className="field field-compact inline-grid-span-2">
                <label htmlFor="merged-parent-description">{copy.description}</label>
                <input
                  id="merged-parent-description"
                  type="text"
                  {...form.register("parent.description")}
                />
                {form.formState.errors.parent?.description ? (
                  <div className="error-banner">
                    {form.formState.errors.parent.description.message}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="child-list-shell">
              <div className="compact-header-row">
                <div>
                  <h3>{copy.childItems}</h3>
                  <p>{copy.childItemsDescription}</p>
                </div>
              </div>

              <div className="stack-sm">
                {fields.map((field, index) => (
                  <div className="child-row-card" key={field.id}>
                    <div className="inline-grid inline-grid-6">
                      <div className="field field-compact">
                        <label htmlFor={`child-category-${index}`}>{copy.category}</label>
                        <select
                          id={`child-category-${index}`}
                          {...form.register(`children.${index}.category_id`)}
                        >
                          <option value="">{copy.chooseNormalCategory}</option>
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

                      <div className="field field-compact inline-grid-span-2">
                        <label htmlFor={`child-name-${index}`}>{copy.name}</label>
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

                      <div className="field field-compact">
                        <label htmlFor={`child-amount-${index}`}>
                          {amountMode === "pretax" ? copy.pretax : copy.posttax}
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

                      <div className="field field-compact inline-grid-span-2">
                        <label htmlFor={`child-description-${index}`}>{copy.description}</label>
                        <input
                          id={`child-description-${index}`}
                          type="text"
                          {...form.register(`children.${index}.description`)}
                        />
                        {form.formState.errors.children?.[index]?.description ? (
                          <div className="error-banner">
                            {form.formState.errors.children[index]?.description?.message}
                          </div>
                        ) : null}
                      </div>

                      <div className="child-row-actions">
                        <button
                          className="button button-danger-strong button-sm"
                          disabled={fields.length === 1}
                          onClick={() => remove(index)}
                          type="button"
                        >
                          {copy.remove}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {expenseDetailQuery.isLoading && isEditMode ? (
              <div className="info-banner">{copy.loadingExpense}</div>
            ) : null}

            {expenseDetailQuery.isError && isEditMode ? (
              <div className="error-banner">
                {expenseDetailQuery.error instanceof ApiError
                  ? expenseDetailQuery.error.message
                  : copy.loadExpenseFailed}
              </div>
            ) : null}

            {saveMutation.isError ? (
              <div className="error-banner">
                {saveMutation.error instanceof ApiError
                  ? saveMutation.error.message
                  : isEditMode
                    ? copy.updateFailed
                    : copy.createFailed}
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
                  {copy.cancel}
                </Link>
                <button
                  className="button button-sm button-earth"
                  onClick={appendChildAndScroll}
                  type="button"
                >
                  {copy.addChild}
                </button>
              </div>
              <div className="form-actions-group">
                {!isEditMode ? (
                  <button
                    className="button button-sm button-accent-soft"
                    disabled={
                      saveMutation.isPending ||
                      mergeCategories.length === 0 ||
                      normalCategories.length === 0
                    }
                    onClick={() => void submit("next")}
                    type="button"
                  >
                    {saveMutation.isPending && submitModeRef.current === "next"
                      ? copy.creating
                      : copy.createAndNext}
                  </button>
                ) : null}
                <button
                  className="button primary button-sm"
                  disabled={
                    saveMutation.isPending ||
                    mergeCategories.length === 0 ||
                    normalCategories.length === 0
                  }
                  onClick={() => {
                    submitModeRef.current = "back";
                  }}
                  type="submit"
                >
                  {saveMutation.isPending && submitModeRef.current === "back"
                    ? isEditMode
                      ? copy.saving
                      : copy.creating
                    : isEditMode
                      ? copy.save
                      : copy.create}
                </button>
              </div>
            </div>
            <div ref={formBottomRef} />
          </form>
        </article>

        <article className="detail-card compact-card compact-side-card">
          <h3>{copy.previewTitle}</h3>
          <div className="stack-sm">
            <div className="info-banner compact-banner">
              {copy.parentTotal}: {parentTotal.toFixed(2)}{" "}
              {form.watch("parent.original_currency").trim().toUpperCase() || "JPY"}
            </div>
            <div className="info-banner compact-banner">
              {copy.childrenSum}: {childTotal.toFixed(2)}
            </div>
            <div className={expectedTaxRateTone}>
              {copy.expectedTaxRate}: {expectedTaxRate === null ? "-" : `${expectedTaxRate.toFixed(2)}%`}
            </div>
            {amountMode === "pretax" ? (
              <div className="info-banner compact-banner">{copy.pretaxHint}</div>
            ) : (
              <div className={postTaxDifference === 0 ? "success-banner" : "error-banner"}>
                {copy.posttaxDifference}: {postTaxDifference.toFixed(2)}
              </div>
            )}
            {mergeCategories.length === 0 || normalCategories.length === 0 ? (
              <div className="error-banner">{copy.missingCategories}</div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
