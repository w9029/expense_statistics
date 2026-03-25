import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/features/auth/auth-context";
import { useI18n } from "@/features/i18n/i18n-context";
import { getPostAuthPath } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-errors";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const loginSchema = z.object({
    email: z.string().email(t("login.error.email")),
    password: z.string().min(1, t("login.error.password")),
  });
  type LoginFormValues = z.infer<typeof loginSchema>;
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: (values: LoginFormValues) => auth.login(values.email, values.password),
    onSuccess: (session) => {
      const redirectPath =
        (location.state as { from?: string } | null)?.from ?? getPostAuthPath(session.user);
      navigate(redirectPath, { replace: true });
    },
  });

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <h1>{t("login.title")}</h1>
        <p>{t("login.description")}</p>

        <form className="form-grid" onSubmit={form.handleSubmit((values) => loginMutation.mutate(values))}>
          <div className="field">
            <label htmlFor="login-email">{t("login.email")}</label>
            <input
              id="login-email"
              placeholder={t("login.placeholder.email")}
              type="email"
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <div className="error-banner">{form.formState.errors.email.message}</div>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="login-password">{t("login.password")}</label>
            <input
              id="login-password"
              placeholder={t("login.placeholder.password")}
              type="password"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <div className="error-banner">{form.formState.errors.password.message}</div>
            ) : null}
          </div>

          {loginMutation.isError ? (
            <div className="error-banner">
              {getApiErrorMessage(loginMutation.error, t("login.failed"))}
            </div>
          ) : null}

          <button className="button primary full" disabled={loginMutation.isPending} type="submit">
            {loginMutation.isPending ? t("login.submitting") : t("login.submit")}
          </button>
        </form>

        <p className="list-note" style={{ marginTop: 18 }}>
          
          <Link
            state={location.state}
            to="/auth/register"
          >
            {t("login.needAccount")}{" "}
            {t("login.createOne")}
          </Link>
        </p>
      </section>
    </div>
  );
}
