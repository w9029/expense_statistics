import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import type { AccountBookSummary } from "@expense-statistics/domain";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { useToast } from "@/features/feedback/toast-context";
import { apiClient } from "@/lib/api";

const accountBookCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  base_currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code")
    .transform((value) => value.toUpperCase()),
  description: z.string().max(400, "Description is too long").optional(),
});

type AccountBookCreateFormValues = z.input<typeof accountBookCreateSchema>;

export function AccountBooksPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
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
      showToast("Account book created.", "success");
      navigate(`/app/account-books/${created.id}`);
    },
    onError: (error) => {
      showToast(
        error instanceof ApiError ? error.message : "Failed to create the account book",
        "error",
      );
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

  return (
    <section>
      <header className="page-header">
        <h1>Account Books</h1>
        <p>
          Create account books here, open them directly, and manage the user's default
          book from the list.
        </p>
      </header>

      <article className="detail-card compact-card" style={{ marginBottom: 18 }}>
        <div className="compact-header-row">
          <div>
            <h3>Create Account Book</h3>
            <p>Base currency is fixed at creation time. Name and description can be edited later.</p>
          </div>
        </div>

        <form
          className="form-grid compact-form-grid"
          onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}
        >
          <div className="inline-grid inline-grid-4">
            <div className="field field-compact inline-grid-span-2">
              <label htmlFor="account-book-create-name">Name</label>
              <input
                disabled={createMutation.isPending}
                id="account-book-create-name"
                type="text"
                {...createForm.register("name")}
              />
            </div>
            <div className="field field-compact">
              <label htmlFor="account-book-create-base-currency">Base Currency</label>
              <input
                disabled={createMutation.isPending}
                id="account-book-create-base-currency"
                maxLength={3}
                type="text"
                {...createForm.register("base_currency")}
              />
            </div>
            <div className="field field-compact">
              <label htmlFor="account-book-create-description">Description</label>
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
              {createMutation.error instanceof ApiError
                ? createMutation.error.message
                : "Failed to create the account book"}
            </div>
          ) : null}

          <div className="form-actions form-actions-end">
            <button className="button primary button-sm" disabled={createMutation.isPending} type="submit">
              {createMutation.isPending ? "Creating..." : "Create Book"}
            </button>
          </div>
        </form>
      </article>

      {accountBooksQuery.isLoading ? <div className="info-banner">Loading account books...</div> : null}
      {accountBooksQuery.isError ? (
        <div className="error-banner">
          {accountBooksQuery.error instanceof ApiError
            ? accountBooksQuery.error.message
            : "Failed to load account books"}
        </div>
      ) : null}

      {defaultMutation.isError ? (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          {defaultMutation.error instanceof ApiError
            ? defaultMutation.error.message
            : "Failed to update the default account book"}
        </div>
      ) : null}

      {accountBooksQuery.data?.length ? (
        <div className="card-grid">
          {accountBooksQuery.data.map((book) => {
            const isCurrentMutation = defaultMutation.variables === book.id;

            return (
              <article className="surface-card" key={book.id}>
                <div className="split-header">
                  <div className="badge-row">
                    <span className="badge">{book.my_role}</span>
                    <span className="badge">{book.base_currency}</span>
                    {book.is_default ? <span className="badge">default</span> : null}
                  </div>
                  <span className="mono">{book.id.slice(0, 8)}</span>
                </div>

                <h3 style={{ marginTop: 16 }}>{book.name}</h3>
                <p>{book.description ?? "No description yet."}</p>

                <div className="cta-row" style={{ marginTop: 18 }}>
                  <Link className="button primary" to={`/app/account-books/${book.id}`}>
                    Open Book
                  </Link>
                  <button
                    className="button"
                    disabled={defaultMutation.isPending || book.is_default}
                    onClick={() => defaultMutation.mutate(book.id)}
                    type="button"
                  >
                    {book.is_default
                      ? "Current Default"
                      : isCurrentMutation && defaultMutation.isPending
                        ? "Setting..."
                        : "Set Default"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : accountBooksQuery.isSuccess ? (
        <div className="empty-state">
          No account books yet. The next step is to connect create-book and invitation
          flows so this page becomes the real post-login landing surface.
        </div>
      ) : null}
    </section>
  );
}
