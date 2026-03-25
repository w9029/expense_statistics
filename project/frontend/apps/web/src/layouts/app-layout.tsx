import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, matchPath, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { apiClient } from "@/lib/api";

const navItems = [
  { to: "/app/account-books", label: "Account Books" },
  { to: "/app/profile", label: "Profile" },
];

export function AppLayout() {
  const auth = useAuth();
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

  const currentBookItems = currentBookId
    ? [
        { to: `/app/account-books/${currentBookId}`, label: "Overview", end: true },
        { to: `/app/account-books/${currentBookId}/categories`, label: "Categories" },
        { to: `/app/account-books/${currentBookId}/collaboration`, label: "Members" },
      ]
    : [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">EA</div>
          <div>
            <div>Expense Atlas</div>
            <div className="meta-line">frontend_base shell</div>
          </div>
        </div>

        <div className="surface-card" style={{ marginTop: 18, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>{auth.user?.name ?? "Signed-in user"}</h3>
          <p className="list-note">{auth.user?.email}</p>
          <div className="badge-row">
            <span className="badge">{auth.user?.preferred_currency ?? "N/A"}</span>
            <span className="badge">{auth.user?.user_role ?? "user"}</span>
          </div>
          <button className="button" onClick={auth.logout} style={{ marginTop: 16 }} type="button">
            Sign Out
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
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
              {accountBookQuery.data?.name ?? "Current Book"}
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

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
