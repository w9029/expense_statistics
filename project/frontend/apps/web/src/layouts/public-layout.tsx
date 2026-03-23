import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";

export function PublicLayout() {
  const auth = useAuth();

  return (
    <div className="shell public-shell">
      <div className="public-frame">
        <header className="public-nav">
          <div className="brand">
            <div className="brand-mark">EA</div>
            <div>
              <div>Expense Atlas</div>
              <div className="meta-line">Web foundation for your shared ledger product</div>
            </div>
          </div>
          <nav className="nav-links">
            {auth.isAuthenticated ? (
              <NavLink className="solid-link" to="/app/account-books">
                Open App
              </NavLink>
            ) : (
              <>
                <NavLink className="ghost-link" to="/auth/login">
                  Sign In
                </NavLink>
                <NavLink className="solid-link" to="/auth/register">
                  Create Account
                </NavLink>
              </>
            )}
          </nav>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
