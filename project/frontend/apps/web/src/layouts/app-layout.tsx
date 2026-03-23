import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";

const navItems = [
  { to: "/app/account-books", label: "Account Books" },
  { to: "/app/profile", label: "Profile" },
];

export function AppLayout() {
  const auth = useAuth();

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

        <div className="sidebar-note">
          <strong>Current focus</strong>
          <p className="list-note">
            Keep the first web build thin: auth, account book switching, expense entry,
            expense list, profile.
          </p>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
