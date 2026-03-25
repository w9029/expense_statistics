import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { useI18n } from "@/features/i18n/i18n-context";
import { apiClient } from "@/lib/api";
import { getPostAuthPath } from "@/lib/auth";

const purpose = "register";

type EmailFormValues = {
  email: string;
};

type VerifyFormValues = {
  code: string;
};

type RegisterFormValues = {
  name: string;
  password: string;
  preferred_currency: string;
  language: "zh-CN" | "en" | "ja";
};

export function RegisterPage() {
  const auth = useAuth();
  const { language, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verificationExpiry, setVerificationExpiry] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const emailSchema = z.object({
    email: z.string().trim().email(t("register.error.email")),
  });

  const verifySchema = z.object({
    code: z.string().trim().length(6, t("register.error.code")),
  });

  const registerSchema = z.object({
    name: z
      .string()
      .trim()
      .min(1, t("register.error.name"))
      .max(100, t("register.error.nameLong")),
    password: z.string().min(8, t("register.error.password")).max(72),
    preferred_currency: z
      .string()
      .trim()
      .length(3, t("register.error.currency"))
      .transform((value) => value.toUpperCase()),
    language: z.enum(["zh-CN", "en", "ja"]),
  });

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
      language,
    },
  });

  useEffect(() => {
    if (!registerForm.formState.isDirty) {
      registerForm.setValue("language", language);
    }
  }, [language, registerForm]);

  useEffect(() => {
    if (!verificationToken || !verificationExpiry) {
      return;
    }

    const intervalID = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalID);
  }, [verificationToken, verificationExpiry]);

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
        throw new Error(t("register.error.verificationMissing"));
      }

      return auth.register({
        email: verifiedEmail,
        name: parsed.name.trim(),
        password: parsed.password,
        preferred_currency: parsed.preferred_currency,
        language: parsed.language,
        verification_token: verificationToken,
      });
    },
    onSuccess: (session) => {
      const redirectPath =
        (location.state as { from?: string } | null)?.from ?? getPostAuthPath(session.user);
      navigate(redirectPath, { replace: true });
    },
  });

  function resetEmailStep() {
    setVerifiedEmail(null);
    setVerificationToken(null);
    setVerificationExpiry(null);
    verifyForm.reset({ code: "" });
  }

  const currentEmail = verifiedEmail ?? emailForm.watch("email");
  const verificationExpiryTime = useMemo(
    () => (verificationExpiry ? new Date(verificationExpiry).getTime() : null),
    [verificationExpiry],
  );
  const isVerified = Boolean(
    verificationToken &&
      verificationExpiryTime &&
      Number.isFinite(verificationExpiryTime) &&
      verificationExpiryTime > now,
  );
  const isVerificationExpired = Boolean(
    verificationToken &&
      verificationExpiryTime &&
      Number.isFinite(verificationExpiryTime) &&
      verificationExpiryTime <= now,
  );

  return (
    <div className="auth-shell">
      <section className="auth-card auth-card-wide">
        <h1>{t("register.title")}</h1>
        <p>{t("register.description")}</p>

        <div className="step-stack">
          <div className="step-card">
            <div className="split-header">
              <div>
                <h3 style={{ marginTop: 0 }}>{t("register.step1.title")}</h3>
                <p className="list-note">{t("register.step1.description")}</p>
              </div>
              {verifiedEmail ? (
                <button className="button" onClick={resetEmailStep} type="button">
                  {t("register.changeEmail")}
                </button>
              ) : null}
            </div>

            <form
              className="form-grid"
              onSubmit={emailForm.handleSubmit((values) => sendCodeMutation.mutate(values))}
            >
              <div className="field">
                <label htmlFor="register-email">{t("register.email")}</label>
                <input
                  disabled={sendCodeMutation.isPending || Boolean(verifiedEmail)}
                  id="register-email"
                  placeholder={t("login.placeholder.email")}
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
                    : t("register.error.sendCode")}
                </div>
              ) : null}

              {verifiedEmail ? (
                <div className="success-banner">
                  {t("register.codeSent", { email: verifiedEmail })}
                </div>
              ) : null}

              <button
                className="button primary"
                disabled={sendCodeMutation.isPending || Boolean(verifiedEmail)}
                type="submit"
              >
                {sendCodeMutation.isPending ? t("register.sendingCode") : t("register.sendCode")}
              </button>
            </form>
          </div>

          {verifiedEmail ? (
            <div className="step-card">
              <h3 style={{ marginTop: 0 }}>{t("register.step2.title")}</h3>
              <p className="list-note">{t("register.step2.description")}</p>

              <form
                className="form-grid"
                onSubmit={verifyForm.handleSubmit((values) => verifyCodeMutation.mutate(values))}
              >
                <div className="field">
                  <label htmlFor="register-code">{t("register.code")}</label>
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
                      : t("register.error.verifyCode")}
                  </div>
                ) : null}

                {isVerified ? (
                  <div className="success-banner">
                    {t("register.verified", { expiresAt: verificationExpiry ?? "" })}
                  </div>
                ) : null}

                {isVerificationExpired ? (
                  <div className="info-banner">{t("register.verifiedExpired")}</div>
                ) : null}

                <div className="form-actions">
                  <button
                    className="button primary"
                    disabled={verifyCodeMutation.isPending || isVerified}
                    type="submit"
                  >
                    {verifyCodeMutation.isPending
                      ? t("register.verifyingCode")
                      : t("register.verifyCode")}
                  </button>
                  <button
                    className="button"
                    disabled={sendCodeMutation.isPending || isVerified}
                    onClick={() =>
                      sendCodeMutation.mutate({
                        email: verifiedEmail,
                      })
                    }
                    type="button"
                  >
                    {t("register.resendCode")}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {isVerified ? (
            <div className="step-card">
              <h3 style={{ marginTop: 0 }}>{t("register.step3.title")}</h3>
              <p className="list-note">{t("register.step3.description")}</p>

              <form
                className="form-grid"
                onSubmit={registerForm.handleSubmit((values) => registerMutation.mutate(values))}
              >
                <div className="field">
                  <label htmlFor="register-name">{t("register.name")}</label>
                  <input
                    id="register-name"
                    placeholder={t("register.placeholder.name")}
                    type="text"
                    {...registerForm.register("name")}
                  />
                  {registerForm.formState.errors.name ? (
                    <div className="error-banner">{registerForm.formState.errors.name.message}</div>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="register-currency">{t("register.preferredCurrency")}</label>
                  <input
                    id="register-currency"
                    maxLength={3}
                    placeholder={t("register.placeholder.currency")}
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
                  <label htmlFor="register-password">{t("register.password")}</label>
                  <input
                    id="register-password"
                    placeholder={t("register.placeholder.password")}
                    type="password"
                    {...registerForm.register("password")}
                  />
                  {registerForm.formState.errors.password ? (
                    <div className="error-banner">{registerForm.formState.errors.password.message}</div>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="register-language">{t("register.language")}</label>
                  <select id="register-language" {...registerForm.register("language")}>
                    <option value="zh-CN">{t("common.language.zh-CN")}</option>
                    <option value="en">{t("common.language.en")}</option>
                    <option value="ja">{t("common.language.ja")}</option>
                  </select>
                  {registerForm.formState.errors.language ? (
                    <div className="error-banner">{registerForm.formState.errors.language.message}</div>
                  ) : null}
                </div>

                {registerMutation.isError ? (
                  <div className="error-banner">
                    {registerMutation.error instanceof ApiError
                      ? registerMutation.error.message
                      : registerMutation.error instanceof Error
                        ? registerMutation.error.message
                        : t("register.error.register")}
                  </div>
                ) : null}

                <button
                  className="button primary"
                  disabled={registerMutation.isPending}
                  type="submit"
                >
                  {registerMutation.isPending ? t("register.submitting") : t("register.submit")}
                </button>
              </form>
            </div>
          ) : null}
        </div>

        <p className="list-note" style={{ marginTop: 18 }}>
          
          <Link state={location.state} to="/auth/login">
            {t("register.alreadyRegistered")}{" "}
            {t("register.signIn")}
          </Link>
        </p>

        <p className="list-note" style={{ marginTop: 10 }}>
          {t("register.currentEmail", {
            email: currentEmail || t("register.currentEmail.empty"),
          })}
        </p>
      </section>
    </div>
  );
}
