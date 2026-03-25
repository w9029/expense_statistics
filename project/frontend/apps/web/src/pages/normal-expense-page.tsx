import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
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
import { todayNaturalDate } from "@/lib/ledger";

const amountPattern = /^\d+(\.\d{1,2})?$/;
const naturalDatePattern = /^\d{4}-\d{2}-\d{2}$/;

type SubmitMode = "back" | "next";

export function NormalExpensePage() {
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
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [flashMessage, setFlashMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const normalExpenseSchema = z.object({
    category_id: z.string().min(1, t("normalExpense.categoryRequired")),
    name: z
      .string()
      .trim()
      .min(1, t("normalExpense.nameRequired"))
      .max(200, t("normalExpense.nameLong")),
    description: z.string().max(400, t("common.error.descriptionLong")).optional(),
    original_amount: z
      .string()
      .trim()
      .regex(amountPattern, t("normalExpense.amountInvalid")),
    original_currency: z
      .string()
      .trim()
      .length(3, t("normalExpense.currencyInvalid"))
      .transform((value) => value.toUpperCase()),
    spent_at: z.string().regex(naturalDatePattern, t("normalExpense.dateInvalid")),
  });

  type NormalExpenseFormValues = z.input<typeof normalExpenseSchema>;

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
        showToast(t("normalExpense.updated"), "success");
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
          text: t("normalExpense.createdNext"),
        });
        return;
      }

      showToast(t("normalExpense.created"), "success");
      navigate(`/app/account-books/${accountBookId}`, { replace: true });
    },
    onError: (error) => {
      const text =
        error instanceof ApiError
          ? error.message
          : isEditMode
            ? t("normalExpense.updateFailed")
            : t("normalExpense.createFailed");
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
            <h1>{isEditMode ? t("normalExpense.titleEdit") : t("normalExpense.titleCreate")}</h1>
          </div>
          <p>
            {t(isEditMode ? "normalExpense.subtitleEdit" : "normalExpense.subtitleCreate", {
              book: detailQuery.data?.name ?? "this book",
            })}
          </p>
        </div>
      </header>

      <div className="compact-form-shell">
        <article className="detail-card compact-card">
          {flashMessage ? (
            <div className={`inline-toast inline-toast-${flashMessage.tone}`} role="status">
              {flashMessage.text}
            </div>
          ) : null}

          <div className="compact-header-row">
            <div>
              <h3>{t("normalExpense.formTitle")}</h3>
              <p>
                {isEditMode
                  ? t("normalExpense.formDescriptionEdit")
                  : t("normalExpense.formDescriptionCreate")}
              </p>
            </div>
            <div className="helper-row">
              <span className="badge">
                {t("normalExpense.base", { value: detailQuery.data?.base_currency ?? "..." })}
              </span>
              <span className="badge">
                {t("normalExpense.categories", { value: normalCategories.length })}
              </span>
              {isEditMode ? <span className="badge">{t("normalExpense.editing")}</span> : null}
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
                <label htmlFor="normal-category">{t("normalExpense.category")}</label>
                <select id="normal-category" {...form.register("category_id")}>
                  <option value="">{t("normalExpense.chooseCategory")}</option>
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
                <label htmlFor="normal-name">{t("normalExpense.name")}</label>
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
                <label htmlFor="normal-amount">{t("normalExpense.amount")}</label>
                <input id="normal-amount" type="text" {...form.register("original_amount")} />
                {form.formState.errors.original_amount ? (
                  <div className="error-banner">
                    {form.formState.errors.original_amount.message}
                  </div>
                ) : null}
              </div>

              <div className="field field-compact">
                <label htmlFor="normal-currency">{t("normalExpense.currency")}</label>
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
                <label htmlFor="normal-spent-at">{t("normalExpense.spentAt")}</label>
                <input id="normal-spent-at" type="date" {...form.register("spent_at")} />
                {form.formState.errors.spent_at ? (
                  <div className="error-banner">{form.formState.errors.spent_at.message}</div>
                ) : null}
              </div>

              <div className="field field-compact inline-grid-span-2">
                <label htmlFor="normal-description">{t("normalExpense.description")}</label>
                <input id="normal-description" type="text" {...form.register("description")} />
                {form.formState.errors.description ? (
                  <div className="error-banner">{form.formState.errors.description.message}</div>
                ) : null}
              </div>
            </div>

            {expenseDetailQuery.isLoading && isEditMode ? (
              <div className="info-banner">{t("normalExpense.loadingExpense")}</div>
            ) : null}

            {expenseDetailQuery.isError && isEditMode ? (
              <div className="error-banner">
                {expenseDetailQuery.error instanceof ApiError
                  ? expenseDetailQuery.error.message
                  : t("normalExpense.loadExpenseFailed")}
              </div>
            ) : null}

            {saveMutation.isError ? (
              <div className="error-banner">
                {saveMutation.error instanceof ApiError
                  ? saveMutation.error.message
                  : isEditMode
                    ? t("normalExpense.updateFailed")
                    : t("normalExpense.createFailed")}
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
                  {t("common.cancel")}
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
                      ? t("normalExpense.creating")
                      : t("normalExpense.createAndNext")}
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
                      ? t("normalExpense.saving")
                      : t("normalExpense.creating")
                    : isEditMode
                      ? t("normalExpense.save")
                      : t("normalExpense.create")}
                </button>
              </div>
            </div>
          </form>
        </article>

        <article className="detail-card compact-card compact-side-card">
          <h3>{t("normalExpense.notesTitle")}</h3>
          <div className="stack-sm">
            <div className="info-banner compact-banner">{t("normalExpense.notesDate")}</div>
            <div className="info-banner compact-banner">
              {t("normalExpense.notesCategories", { value: normalCategories.length })}
            </div>
            {normalCategories.length === 0 ? (
              <div className="error-banner">{t("normalExpense.notesNoCategory")}</div>
            ) : null}
            {categoriesQuery.isError ? (
              <div className="error-banner">
                {categoriesQuery.error instanceof ApiError
                  ? categoriesQuery.error.message
                  : t("normalExpense.notesLoadCategoriesFailed")}
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
