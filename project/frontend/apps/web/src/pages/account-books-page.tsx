import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { AccountBookSummary } from "@expense-statistics/domain";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { apiClient } from "@/lib/api";

export function AccountBooksPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();

  const accountBooksQuery = useQuery({
    queryKey: ["account-books"],
    queryFn: () => apiClient.listAccountBooks(auth.accessToken!),
    enabled: Boolean(auth.accessToken),
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
          This page now reads the real protected account book list and lets the user
          change their default book directly from the list.
        </p>
      </header>

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
