import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { AccountBookSummary } from "@expense-statistics/domain";
import { useAuth } from "@/features/auth/auth-context";
import { useI18n } from "@/features/i18n/i18n-context";
import { apiClient } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-errors";

type ProfileFormValues = {
  name: string;
  preferred_currency: string;
  language: "zh-CN" | "en" | "ja";
  avatar_path?: string;
};

export function ProfilePage() {
  const auth = useAuth();
  const { t } = useI18n();

  const profileSchema = z.object({
    name: z
      .string()
      .trim()
      .min(1, t("register.error.name"))
      .max(100, t("register.error.nameLong")),
    preferred_currency: z
      .string()
      .trim()
      .length(3, t("register.error.currency"))
      .transform((value) => value.toUpperCase()),
    language: z.enum(["zh-CN", "en", "ja"]),
    avatar_path: z.string().optional(),
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: auth.user?.name ?? "",
      preferred_currency: auth.user?.preferred_currency ?? "JPY",
      language: auth.user?.language ?? "zh-CN",
      avatar_path: auth.user?.avatar_path ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name: auth.user?.name ?? "",
      preferred_currency: auth.user?.preferred_currency ?? "JPY",
      language: auth.user?.language ?? "zh-CN",
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
        language: parsed.language,
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
        <h1>{t("profile.title")}</h1>
        <p>{t("profile.description")}</p>
      </header>

      <div className="detail-grid">
        <article className="detail-card">
          <h3>{t("profile.editableFields")}</h3>
          <form className="form-grid" onSubmit={form.handleSubmit((values) => profileMutation.mutate(values))}>
            <div className="field">
              <label htmlFor="profile-name">{t("profile.name")}</label>
              <input id="profile-name" type="text" {...form.register("name")} />
              {form.formState.errors.name ? (
                <div className="error-banner">{form.formState.errors.name.message}</div>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="profile-currency">{t("profile.preferredCurrency")}</label>
              <input id="profile-currency" type="text" {...form.register("preferred_currency")} />
              {form.formState.errors.preferred_currency ? (
                <div className="error-banner">
                  {form.formState.errors.preferred_currency.message}
                </div>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="profile-language">{t("profile.language")}</label>
              <select id="profile-language" {...form.register("language")}>
                <option value="zh-CN">{t("common.language.zh-CN")}</option>
                <option value="en">{t("common.language.en")}</option>
                <option value="ja">{t("common.language.ja")}</option>
              </select>
              {form.formState.errors.language ? (
                <div className="error-banner">{form.formState.errors.language.message}</div>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="profile-avatar">{t("profile.avatarPath")}</label>
              <input id="profile-avatar" type="text" {...form.register("avatar_path")} />
            </div>

            {profileMutation.isError ? (
              <div className="error-banner">
                {getApiErrorMessage(profileMutation.error, t("profile.updateFailed"))}
              </div>
            ) : null}

            {profileMutation.isSuccess ? (
              <div className="success-banner">{t("profile.updated")}</div>
            ) : null}

            <button className="button primary" disabled={profileMutation.isPending} type="submit">
              {profileMutation.isPending ? t("profile.saving") : t("profile.save")}
            </button>
          </form>
        </article>

        <article className="detail-card">
          <h3>{t("profile.defaultBook.title")}</h3>
          <p>{t("profile.defaultBook.description")}</p>

          {accountBooksQuery.isLoading ? <div className="info-banner">{t("profile.defaultBook.loading")}</div> : null}
          {accountBooksQuery.isError ? (
            <div className="error-banner">
              {getApiErrorMessage(accountBooksQuery.error, t("profile.defaultBook.loadFailed"))}
            </div>
          ) : null}

          <div className="form-grid" style={{ marginTop: 18 }}>
            <div className="field">
              <label htmlFor="default-account-book">{t("profile.defaultBook.label")}</label>
              <select
                value={auth.user?.default_account_book_id ?? ""}
                id="default-account-book"
                onChange={(event) =>
                  defaultMutation.mutate(event.target.value === "" ? null : event.target.value)
                }
              >
                <option value="">{t("profile.defaultBook.none")}</option>
                {(accountBooksQuery.data ?? []).map((book: AccountBookSummary) => (
                  <option key={book.id} value={book.id}>
                    {book.name} ({book.my_role})
                  </option>
                ))}
              </select>
            </div>

            {defaultMutation.isError ? (
              <div className="error-banner">
                {getApiErrorMessage(defaultMutation.error, t("profile.defaultBook.updateFailed"))}
              </div>
            ) : null}

            {defaultMutation.isSuccess ? (
              <div className="success-banner">{t("profile.defaultBook.updated")}</div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
