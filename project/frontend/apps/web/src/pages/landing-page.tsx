import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { useI18n } from "@/features/i18n/i18n-context";
import { apiClient } from "@/lib/api";

export function LandingPage() {
  const auth = useAuth();
  const { t } = useI18n();
  const healthQuery = useQuery({
    queryKey: ["system", "health"],
    queryFn: () => apiClient.health(),
  });

  const surfaceCards = [
    {
      title: t("landing.card.books.title"),
      body: t("landing.card.books.body"),
    },
    {
      title: t("landing.card.merged.title"),
      body: t("landing.card.merged.body"),
    },
    {
      title: t("landing.card.filters.title"),
      body: t("landing.card.filters.body"),
    },
  ];

  const apiStatus = healthQuery.isSuccess
    ? t("landing.apiStatus.reachable")
    : healthQuery.isError
      ? t("landing.apiStatus.unreachable")
      : t("landing.apiStatus.checking");

  return (
    <section className="page-section">
      <div className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow">{t("landing.eyebrow")}</div>
          <h1>{t("landing.title")}</h1>
          <p>{t("landing.description")}</p>
          <div className="hero-actions">
            <Link className="button primary" to={auth.isAuthenticated ? "/app/account-books" : "/auth/login"}>
              {auth.isAuthenticated ? t("landing.primary.openApp") : t("landing.primary.signIn")}
            </Link>
            <Link className="button" to="/auth/login">
              {t("landing.secondary")}
            </Link>
          </div>
        </div>

        <div className="hero-panel">
          <div className="status-chip">
            {t("landing.apiStatus.label", { status: apiStatus })}
          </div>
          <div className="metric-strip">
            <div className="metric-card">
              <strong>1</strong>
              <span>{t("landing.metric.appTarget")}</span>
            </div>
            <div className="metric-card">
              <strong>2</strong>
              <span>{t("landing.metric.sharedPackages")}</span>
            </div>
            <div className="metric-card">
              <strong>8</strong>
              <span>{t("landing.metric.routes")}</span>
            </div>
          </div>
          <div className="surface-card">
            <h3>{t("landing.whyStart.title")}</h3>
            <p>{t("landing.whyStart.body")}</p>
          </div>
          <div className="surface-card">
            <h3>{t("landing.backend.title")}</h3>
            <p className="mono">{import.meta.env.VITE_API_BASE_URL ?? "/api/v1"}</p>
            <p className="list-note">{t("landing.backend.body")}</p>
          </div>
        </div>
      </div>

      <div className="surface-grid">
        {surfaceCards.map((card) => (
          <article className="surface-card" key={card.title}>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
