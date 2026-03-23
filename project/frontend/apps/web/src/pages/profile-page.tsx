import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { AccountBookSummary } from "@expense-statistics/domain";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { apiClient } from "@/lib/api";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  preferred_currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code")
    .transform((value) => value.toUpperCase()),
  avatar_path: z.string().optional(),
});

type ProfileFormValues = z.input<typeof profileSchema>;

export function ProfilePage() {
  const auth = useAuth();
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: auth.user?.name ?? "",
      preferred_currency: auth.user?.preferred_currency ?? "JPY",
      avatar_path: auth.user?.avatar_path ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name: auth.user?.name ?? "",
      preferred_currency: auth.user?.preferred_currency ?? "JPY",
      avatar_path: auth.user?.avatar_path ?? "",
    });
  }, [auth.user, form]);

  const accountBooksQuery = useQuery({
    queryKey: ["account-books"],
    queryFn: () => apiClient.listAccountBooks(auth.accessToken!),
    enabled: Boolean(auth.accessToken),
  });

  const profileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const parsed = profileSchema.parse(values);
      return apiClient.updateProfile(auth.accessToken!, {
        name: parsed.name.trim(),
        preferred_currency: parsed.preferred_currency,
        avatar_path: parsed.avatar_path?.trim() || null,
      });
    },
    onSuccess: (user) => {
      auth.replaceUser(user);
    },
  });

  const defaultMutation = useMutation({
    mutationFn: (accountBookId: string | null) =>
      apiClient.updateDefaultAccountBook(auth.accessToken!, {
        default_account_book_id: accountBookId,
      }),
    onSuccess: (user) => {
      auth.replaceUser(user);
    },
  });

  return (
    <section>
      <header className="page-header">
        <h1>Profile</h1>
        <p>
          This page now writes to the real profile and default account book endpoints.
        </p>
      </header>

      <div className="detail-grid">
        <article className="detail-card">
          <h3>Editable profile fields</h3>
          <form className="form-grid" onSubmit={form.handleSubmit((values) => profileMutation.mutate(values))}>
            <div className="field">
              <label htmlFor="profile-name">Name</label>
              <input id="profile-name" type="text" {...form.register("name")} />
              {form.formState.errors.name ? (
                <div className="error-banner">{form.formState.errors.name.message}</div>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="profile-currency">Preferred Currency</label>
              <input id="profile-currency" type="text" {...form.register("preferred_currency")} />
              {form.formState.errors.preferred_currency ? (
                <div className="error-banner">
                  {form.formState.errors.preferred_currency.message}
                </div>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="profile-avatar">Avatar Path</label>
              <input id="profile-avatar" type="text" {...form.register("avatar_path")} />
            </div>

            {profileMutation.isError ? (
              <div className="error-banner">
                {profileMutation.error instanceof ApiError
                  ? profileMutation.error.message
                  : "Failed to update profile"}
              </div>
            ) : null}

            {profileMutation.isSuccess ? (
              <div className="success-banner">Profile updated.</div>
            ) : null}

            <button className="button primary" disabled={profileMutation.isPending} type="submit">
              {profileMutation.isPending ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </article>

        <article className="detail-card">
          <h3>Default account book</h3>
          <p>
            Keep this distinct from general profile editing. The action has its own
            permission rule and can also be triggered from the account book list.
          </p>

          {accountBooksQuery.isLoading ? <div className="info-banner">Loading account books...</div> : null}
          {accountBooksQuery.isError ? (
            <div className="error-banner">
              {accountBooksQuery.error instanceof ApiError
                ? accountBooksQuery.error.message
                : "Failed to load account books"}
            </div>
          ) : null}

          <div className="form-grid" style={{ marginTop: 18 }}>
            <div className="field">
              <label htmlFor="default-account-book">Current default</label>
              <select
                value={auth.user?.default_account_book_id ?? ""}
                id="default-account-book"
                onChange={(event) =>
                  defaultMutation.mutate(event.target.value === "" ? null : event.target.value)
                }
              >
                <option value="">No default account book</option>
                {(accountBooksQuery.data ?? []).map((book: AccountBookSummary) => (
                  <option key={book.id} value={book.id}>
                    {book.name} ({book.my_role})
                  </option>
                ))}
              </select>
            </div>

            {defaultMutation.isError ? (
              <div className="error-banner">
                {defaultMutation.error instanceof ApiError
                  ? defaultMutation.error.message
                  : "Failed to update default account book"}
              </div>
            ) : null}

            {defaultMutation.isSuccess ? (
              <div className="success-banner">Default account book updated.</div>
            ) : null}

            <div className="helper-row">
              <button
                className="button"
                disabled={defaultMutation.isPending}
                onClick={() => defaultMutation.mutate(null)}
                type="button"
              >
                Clear Default
              </button>
              <span className="list-note mono">
                current: {auth.user?.default_account_book_id ?? "null"}
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
