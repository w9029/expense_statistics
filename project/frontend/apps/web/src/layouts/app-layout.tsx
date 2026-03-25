import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, matchPath, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";
import { useI18n } from "@/features/i18n/i18n-context";
import { apiClient } from "@/lib/api";

export function AppLayout() {
  const auth = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const accountBookMatch =
    matchPath("/app/account-books/:accountBookId/*", location.pathname) ??
    matchPath("/app/account-books/:accountBookId", location.pathname);
  const accountBookId = accountBookMatch?.params.accountBookId ?? null;
  const [currentBookId, setCurrentBookId] = useState<string | null>(accountBookId);

  useEffect(() => {
    if (accountBookId) {
      setCurrentBookId(accountBookId);
      return;
    }
    if (location.pathname === "/app/account-books") {
      setCurrentBookId(null);
    }
  }, [accountBookId, location.pathname]);

  const accountBookQuery = useQuery({
    queryKey: ["account-book", currentBookId],
    queryFn: () => apiClient.getAccountBook(auth.accessToken!, currentBookId!),
    enabled: Boolean(auth.accessToken && currentBookId),
  });

  const navItems = [
    { to: "/app/account-books", label: t("app.nav.accountBooks"), end: true },
    { to: "/app/profile", label: t("app.nav.profile") },
  ];

  const currentBookItems = currentBookId
    ? [
        { to: `/app/account-books/${currentBookId}`, label: t("app.nav.overview"), end: true },
        { to: `/app/account-books/${currentBookId}/categories`, label: t("app.nav.categories") },
        { to: `/app/account-books/${currentBookId}/collaboration`, label: t("app.nav.members") },
      ]
    : [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">EA</div>
          <div>
            <div>Expense Atlas</div>
            <div className="meta-line">{t("public.tagline")}</div>
          </div>
        </div>

        <div className="surface-card" style={{ marginTop: 18, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>{auth.user?.name ?? t("app.sidebar.signedInUser")}</h3>
          <p className="list-note">{auth.user?.email}</p>
          <div className="badge-row">
            <span className="badge">{auth.user?.preferred_currency ?? "N/A"}</span>
            <span className="badge">{auth.user?.user_role ?? "user"}</span>
          </div>
          <button className="button" onClick={auth.logout} style={{ marginTop: 16 }} type="button">
            {t("app.signOut")}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              end={item.end}
              key={item.to}
              className={({ isActive }) =>
                `sidebar-link${isActive ? " active" : ""}`
              }
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {currentBookId ? (
          <section className="sidebar-section">
            <div className="sidebar-section-label">
              {accountBookQuery.data?.name ?? t("app.currentBook")}
            </div>
            <nav className="sidebar-nav sidebar-nav-section">
              {currentBookItems.map((item) => (
                <NavLink
                  end={item.end}
                  key={item.to}
                  className={({ isActive }) =>
                    `sidebar-link${isActive ? " active" : ""}`
                  }
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </section>
        ) : null}
      </aside>

      <div className="content-shell">
        <div className="content-toolbar">
          <LanguageSwitcher />
        </div>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
