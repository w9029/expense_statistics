import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { getPostAuthPath } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
        <h1>Sign in</h1>
        <p>
          This page is now wired to
          <span className="mono"> /api/v1/identity/login</span>. The session is stored
          locally so account books and profile pages can query protected endpoints.
        </p>

        <form className="form-grid" onSubmit={form.handleSubmit((values) => loginMutation.mutate(values))}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              placeholder="joshua@example.com"
              type="email"
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <div className="error-banner">{form.formState.errors.email.message}</div>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              placeholder="Enter your password"
              type="password"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <div className="error-banner">{form.formState.errors.password.message}</div>
            ) : null}
          </div>

          {loginMutation.isError ? (
            <div className="error-banner">
              {loginMutation.error instanceof ApiError
                ? loginMutation.error.message
                : "Sign in failed"}
            </div>
          ) : null}

          <button className="button primary full" disabled={loginMutation.isPending} type="submit">
            {loginMutation.isPending ? "Signing in..." : "Continue"}
          </button>
        </form>

        <p className="list-note" style={{ marginTop: 18 }}>
          Need an account?{" "}
          <Link
            state={location.state}
            to="/auth/register"
          >
            Create one
          </Link>
        </p>
      </section>
    </div>
  );
}
