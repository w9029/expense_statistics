import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import type { AccountBookSummary } from "@expense-statistics/domain";
import { useAuth } from "@/features/auth/auth-context";
import { useToast } from "@/features/feedback/toast-context";
import { useI18n } from "@/features/i18n/i18n-context";
import { apiClient } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-errors";

type AccountBookCreateFormValues = {
  name: string;
  base_currency: string;
  description?: string;
};

export function AccountBooksPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const accountBookCreateSchema = z.object({
    name: z
      .string()
      .trim()
      .min(1, t("register.error.name"))
      .max(100, t("register.error.nameLong")),
    base_currency: z
      .string()
      .trim()
      .length(3, t("register.error.currency"))
      .transform((value) => value.toUpperCase()),
    description: z.string().max(400, t("common.error.descriptionLong")).optional(),
  });

  const createForm = useForm<AccountBookCreateFormValues>({
    resolver: zodResolver(accountBookCreateSchema),
    defaultValues: {
      name: "",
      base_currency: auth.user?.preferred_currency ?? "JPY",
      description: "",
    },
  });

  const accountBooksQuery = useQuery({
    queryKey: ["account-books"],
    queryFn: () => apiClient.listAccountBooks(auth.accessToken!),
    enabled: Boolean(auth.accessToken),
  });

  useEffect(() => {
    createForm.setValue("base_currency", auth.user?.preferred_currency ?? "JPY");
  }, [auth.user?.preferred_currency, createForm]);

  const createMutation = useMutation({
    mutationFn: async (values: AccountBookCreateFormValues) => {
      const parsed = accountBookCreateSchema.parse(values);
      return apiClient.createAccountBook(auth.accessToken!, {
        name: parsed.name.trim(),
        base_currency: parsed.base_currency,
        description: parsed.description?.trim() || null,
      });
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["account-books"] });
      createForm.reset({
        name: "",
        base_currency: auth.user?.preferred_currency ?? created.base_currency,
        description: "",
      });
      if (!auth.user?.default_account_book_id) {
        auth.replaceUser({
          ...auth.user!,
          default_account_book_id: created.id,
        });
      }
      showToast(t("accountBooks.create.success"), "success");
      navigate(`/app/account-books/${created.id}`);
    },
    onError: (error) => {
      showToast(getApiErrorMessage(error, t("accountBooks.create.failed")), "error");
    },
  });

  const defaultMutation = useMutation({
    mutationFn: (accountBookId: string | null) =>
      apiClient.updateDefaultAccountBook(auth.accessToken!, {
        default_account_book_id: accountBookId,
      }),
    onSuccess: (user) => {
      auth.replaceUser(user);
      queryClient.setQueryData<AccountBookSummary[]>(["account-books"], (current) =>
        current?.map((book) => ({
          ...book,
          is_default: book.id === user.default_account_book_id,
        })) ?? current,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (accountBookId: string) =>
      apiClient.deleteAccountBook(auth.accessToken!, accountBookId),
    onSuccess: async (_, accountBookId) => {
      await queryClient.invalidateQueries({ queryKey: ["account-books"] });
      const currentUser = auth.user;
      if (currentUser && currentUser.default_account_book_id === accountBookId) {
        auth.replaceUser({
          ...currentUser,
          default_account_book_id: null,
        });
      }
      showToast(t("accountBooks.delete.success"), "success");
    },
    onError: (error) => {
      showToast(getApiErrorMessage(error, t("accountBooks.delete.failed")), "error");
    },
  });

  const leaveMutation = useMutation({
    mutationFn: (accountBookId: string) =>
      apiClient.leaveAccountBook(auth.accessToken!, accountBookId),
    onSuccess: async (_, accountBookId) => {
      await queryClient.invalidateQueries({ queryKey: ["account-books"] });
      const currentUser = auth.user;
      if (currentUser && currentUser.default_account_book_id === accountBookId) {
        auth.replaceUser({
          ...currentUser,
          default_account_book_id: null,
        });
      }
      showToast(t("accountBooks.leave.success"), "success");
    },
    onError: (error) => {
      showToast(getApiErrorMessage(error, t("accountBooks.leave.failed")), "error");
    },
  });

  const sortedAccountBooks = accountBooksQuery.data
    ? [...accountBooksQuery.data].sort((left, right) => {
        if (left.is_default === right.is_default) {
          return 0;
        }
        return left.is_default ? -1 : 1;
      })
    : [];

  function handleDeleteBook(accountBookId: string, name: string) {
    const typedName = window.prompt(t("accountBooks.delete.confirm", { name }), "");
    if (typedName !== name) {
      if (typedName !== null) {
        showToast(t("accountBooks.delete.nameMismatch"), "error");
      }
      return;
    }
    deleteMutation.mutate(accountBookId);
  }

  function handleLeaveBook(accountBookId: string, name: string) {
    if (!window.confirm(t("accountBooks.leave.confirm", { name }))) {
      return;
    }
    leaveMutation.mutate(accountBookId);
  }

  return (
    <section>
      <header className="page-header">
        <h1>{t("accountBooks.title")}</h1>
        <p>{t("accountBooks.description")}</p>
      </header>

      <article className="detail-card compact-card" style={{ marginBottom: 18 }}>
        <div className="compact-header-row">
          <div>
            <h3>{t("accountBooks.create.title")}</h3>
            <p>{t("accountBooks.create.description")}</p>
          </div>
        </div>

        <form
          className="form-grid compact-form-grid"
          onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}
        >
          <div className="inline-grid inline-grid-4">
            <div className="field field-compact inline-grid-span-2">
              <label htmlFor="account-book-create-name">{t("accountBooks.name")}</label>
              <input
                disabled={createMutation.isPending}
                id="account-book-create-name"
                type="text"
                {...createForm.register("name")}
              />
            </div>
            <div className="field field-compact">
              <label htmlFor="account-book-create-base-currency">{t("accountBooks.baseCurrency")}</label>
              <input
                disabled={createMutation.isPending}
                id="account-book-create-base-currency"
                maxLength={3}
                type="text"
                {...createForm.register("base_currency")}
              />
            </div>
            <div className="field field-compact">
              <label htmlFor="account-book-create-description">{t("accountBooks.bookDescription")}</label>
              <input
                disabled={createMutation.isPending}
                id="account-book-create-description"
                type="text"
                {...createForm.register("description")}
              />
            </div>
          </div>

          {createForm.formState.errors.name ? (
            <div className="error-banner">{createForm.formState.errors.name.message}</div>
          ) : null}
          {createForm.formState.errors.base_currency ? (
            <div className="error-banner">{createForm.formState.errors.base_currency.message}</div>
          ) : null}
          {createForm.formState.errors.description ? (
            <div className="error-banner">{createForm.formState.errors.description.message}</div>
          ) : null}
          {createMutation.isError ? (
            <div className="error-banner">
              {getApiErrorMessage(createMutation.error, t("accountBooks.create.failed"))}
            </div>
          ) : null}

          <div className="form-actions form-actions-end">
            <button className="button primary button-sm" disabled={createMutation.isPending} type="submit">
              {createMutation.isPending
                ? t("accountBooks.create.submitting")
                : t("accountBooks.create.submit")}
            </button>
          </div>
        </form>
      </article>

      {accountBooksQuery.isLoading ? <div className="info-banner">{t("accountBooks.loading")}</div> : null}
      {accountBooksQuery.isError ? (
        <div className="error-banner">
          {getApiErrorMessage(accountBooksQuery.error, t("accountBooks.loadFailed"))}
        </div>
      ) : null}

      {defaultMutation.isError ? (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          {getApiErrorMessage(defaultMutation.error, t("accountBooks.default.failed"))}
        </div>
      ) : null}

      {sortedAccountBooks.length ? (
        <div className="card-grid">
          {sortedAccountBooks.map((book) => {
            const isCurrentMutation = defaultMutation.variables === book.id;
            const isDeletingThisBook =
              deleteMutation.isPending && deleteMutation.variables === book.id;
            const isLeavingThisBook =
              leaveMutation.isPending && leaveMutation.variables === book.id;

            return (
              <article
                className={`surface-card${book.is_default ? " surface-card-default" : ""}`}
                key={book.id}
              >
                <div className="split-header">
                  <div className="badge-row">
                    <span className="badge">{book.my_role}</span>
                    <span className="badge">{book.base_currency}</span>
                    {book.is_default ? <span className="badge badge-default-book">{t("accountBooks.default.badge")}</span> : null}
                  </div>
                  <div className="helper-row" style={{ justifyContent: "flex-end" }}>
                    <Link className="button button-sm" to={`/app/account-books/${book.id}/collaboration`}>
                      {t("accountBooks.members")}
                    </Link>
                    {book.my_role === "owner" ? (
                      <button
                        className="button button-sm button-muted"
                        disabled={isDeletingThisBook}
                        onClick={() => handleDeleteBook(book.id, book.name)}
                        type="button"
                      >
                        {isDeletingThisBook ? t("accountBooks.deleting") : t("accountBooks.delete")}
                      </button>
                    ) : (
                      <button
                        className="button button-sm button-muted"
                        disabled={isLeavingThisBook}
                        onClick={() => handleLeaveBook(book.id, book.name)}
                        type="button"
                      >
                        {isLeavingThisBook ? t("accountBooks.leaving") : t("accountBooks.leave")}
                      </button>
                    )}
                  </div>
                </div>

                <h3 style={{ marginTop: 16 }}>{book.name}</h3>
                <p>{book.description ?? t("common.noDescription")}</p>

                <div className="cta-row" style={{ marginTop: 18 }}>
                  <Link className="button primary" to={`/app/account-books/${book.id}`}>
                    {t("accountBooks.open")}
                  </Link>
                  <button
                    className="button"
                    disabled={defaultMutation.isPending || book.is_default}
                    onClick={() => defaultMutation.mutate(book.id)}
                    type="button"
                  >
                    {book.is_default
                      ? t("accountBooks.currentDefault")
                      : isCurrentMutation && defaultMutation.isPending
                        ? t("accountBooks.settingDefault")
                        : t("accountBooks.setDefault")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : accountBooksQuery.isSuccess ? (
        <div className="empty-state">{t("accountBooks.empty")}</div>
      ) : null}
    </section>
  );
}
