import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { apiClient } from "@/lib/api";

const purpose = "register";

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});

const verifySchema = z.object({
  code: z.string().trim().length(6, "Verification code must be 6 digits"),
});

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  preferred_currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code")
    .transform((value) => value.toUpperCase()),
});

type EmailFormValues = z.infer<typeof emailSchema>;
type VerifyFormValues = z.infer<typeof verifySchema>;
type RegisterFormValues = z.input<typeof registerSchema>;

export function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verificationExpiry, setVerificationExpiry] = useState<string | null>(null);

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
    },
  });
  const verifyForm = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      code: "",
    },
  });
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      password: "",
      preferred_currency: "JPY",
    },
  });

  const sendCodeMutation = useMutation({
    mutationFn: async (values: EmailFormValues) => {
      const parsed = emailSchema.parse(values);
      await apiClient.sendVerificationCode({
        email: parsed.email.trim().toLowerCase(),
        purpose,
      });
      return parsed.email.trim().toLowerCase();
    },
    onSuccess: (email) => {
      setVerifiedEmail(email);
      setVerificationToken(null);
      setVerificationExpiry(null);
      verifyForm.reset({ code: "" });
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async (values: VerifyFormValues) => {
      const parsed = verifySchema.parse(values);
      const email = verifiedEmail ?? emailForm.getValues("email").trim().toLowerCase();

      return apiClient.verifyCode({
        email,
        purpose,
        code: parsed.code,
      });
    },
    onSuccess: (result) => {
      setVerificationToken(result.verification_token);
      setVerificationExpiry(result.expires_at);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (values: RegisterFormValues) => {
      const parsed = registerSchema.parse(values);
      if (!verifiedEmail || !verificationToken) {
        throw new Error("Email verification has not been completed");
      }

      return auth.register({
        email: verifiedEmail,
        name: parsed.name.trim(),
        password: parsed.password,
        preferred_currency: parsed.preferred_currency,
        verification_token: verificationToken,
      });
    },
    onSuccess: () => {
      navigate("/app/account-books", { replace: true });
    },
  });

  function resetEmailStep() {
    setVerifiedEmail(null);
    setVerificationToken(null);
    setVerificationExpiry(null);
    verifyForm.reset({ code: "" });
  }

  const currentEmail = verifiedEmail ?? emailForm.watch("email");
  const isVerified = Boolean(verificationToken);

  return (
    <div className="auth-shell">
      <section className="auth-card auth-card-wide">
        <h1>Create your account</h1>
        <p>
          Registration now follows the real backend flow: send email code, verify it,
          then finish profile and password setup.
        </p>

        <div className="step-stack">
          <div className="step-card">
            <div className="split-header">
              <div>
                <h3 style={{ marginTop: 0 }}>Step 1: Email</h3>
                <p className="list-note">Enter your email to receive a registration code.</p>
              </div>
              {verifiedEmail ? (
                <button className="button" onClick={resetEmailStep} type="button">
                  Change Email
                </button>
              ) : null}
            </div>

            <form
              className="form-grid"
              onSubmit={emailForm.handleSubmit((values) => sendCodeMutation.mutate(values))}
            >
              <div className="field">
                <label htmlFor="register-email">Email</label>
                <input
                  disabled={sendCodeMutation.isPending || Boolean(verifiedEmail)}
                  id="register-email"
                  placeholder="joshua@example.com"
                  type="email"
                  {...emailForm.register("email")}
                />
                {emailForm.formState.errors.email ? (
                  <div className="error-banner">{emailForm.formState.errors.email.message}</div>
                ) : null}
              </div>

              {sendCodeMutation.isError ? (
                <div className="error-banner">
                  {sendCodeMutation.error instanceof ApiError
                    ? sendCodeMutation.error.message
                    : "Failed to send verification code"}
                </div>
              ) : null}

              {verifiedEmail ? (
                <div className="success-banner">
                  Verification code sent to <span className="mono">{verifiedEmail}</span>.
                </div>
              ) : null}

              <button
                className="button primary"
                disabled={sendCodeMutation.isPending || Boolean(verifiedEmail)}
                type="submit"
              >
                {sendCodeMutation.isPending ? "Sending..." : "Send Verification Code"}
              </button>
            </form>
          </div>

          {verifiedEmail ? (
            <div className="step-card">
              <h3 style={{ marginTop: 0 }}>Step 2: Verify Code</h3>
              <p className="list-note">
                Enter the 6-digit code from your email. Only after verification do the
                remaining registration fields appear.
              </p>

              <form
                className="form-grid"
                onSubmit={verifyForm.handleSubmit((values) => verifyCodeMutation.mutate(values))}
              >
                <div className="field">
                  <label htmlFor="register-code">Verification Code</label>
                  <input
                    disabled={verifyCodeMutation.isPending || isVerified}
                    id="register-code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    type="text"
                    {...verifyForm.register("code")}
                  />
                  {verifyForm.formState.errors.code ? (
                    <div className="error-banner">{verifyForm.formState.errors.code.message}</div>
                  ) : null}
                </div>

                {verifyCodeMutation.isError ? (
                  <div className="error-banner">
                    {verifyCodeMutation.error instanceof ApiError
                      ? verifyCodeMutation.error.message
                      : "Failed to verify the code"}
                  </div>
                ) : null}

                {isVerified ? (
                  <div className="success-banner">
                    Email verified. Token expires at <span className="mono">{verificationExpiry}</span>.
                  </div>
                ) : null}

                <div className="form-actions">
                  <button
                    className="button primary"
                    disabled={verifyCodeMutation.isPending || isVerified}
                    type="submit"
                  >
                    {verifyCodeMutation.isPending ? "Verifying..." : "Verify Code"}
                  </button>
                  <button
                    className="button"
                    disabled={sendCodeMutation.isPending}
                    onClick={() =>
                      sendCodeMutation.mutate({
                        email: verifiedEmail,
                      })
                    }
                    type="button"
                  >
                    Resend Code
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {isVerified ? (
            <div className="step-card">
              <h3 style={{ marginTop: 0 }}>Step 3: Account Details</h3>
              <p className="list-note">
                Finish the profile fields. Successful registration will create the user
                and enter a logged-in session immediately.
              </p>

              <form
                className="form-grid"
                onSubmit={registerForm.handleSubmit((values) => registerMutation.mutate(values))}
              >
                <div className="field">
                  <label htmlFor="register-name">Name</label>
                  <input id="register-name" placeholder="Joshua" type="text" {...registerForm.register("name")} />
                  {registerForm.formState.errors.name ? (
                    <div className="error-banner">{registerForm.formState.errors.name.message}</div>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="register-currency">Preferred Currency</label>
                  <input
                    id="register-currency"
                    maxLength={3}
                    placeholder="JPY"
                    type="text"
                    {...registerForm.register("preferred_currency")}
                  />
                  {registerForm.formState.errors.preferred_currency ? (
                    <div className="error-banner">
                      {registerForm.formState.errors.preferred_currency.message}
                    </div>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="register-password">Password</label>
                  <input
                    id="register-password"
                    placeholder="Create a strong password"
                    type="password"
                    {...registerForm.register("password")}
                  />
                  {registerForm.formState.errors.password ? (
                    <div className="error-banner">{registerForm.formState.errors.password.message}</div>
                  ) : null}
                </div>

                {registerMutation.isError ? (
                  <div className="error-banner">
                    {registerMutation.error instanceof ApiError
                      ? registerMutation.error.message
                      : registerMutation.error instanceof Error
                        ? registerMutation.error.message
                        : "Failed to register"}
                  </div>
                ) : null}

                <button
                  className="button primary"
                  disabled={registerMutation.isPending}
                  type="submit"
                >
                  {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                </button>
              </form>
            </div>
          ) : null}
        </div>

        <p className="list-note" style={{ marginTop: 18 }}>
          Already registered? <Link to="/auth/login">Sign in</Link>
        </p>

        <p className="list-note" style={{ marginTop: 10 }}>
          Current email: <span className="mono">{currentEmail || "not entered yet"}</span>
        </p>
      </section>
    </div>
  );
}
