import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";
import { useI18n } from "@/features/i18n/i18n-context";

export function PublicLayout() {
  const auth = useAuth();
  const { t } = useI18n();

  return (
    <div className="shell public-shell">
      <div className="public-frame">
        <header className="public-nav">
          <div className="brand">
            <div className="brand-mark">EA</div>
            <div>
              <div>Expense Atlas</div>
              <div className="meta-line">{t("public.tagline")}</div>
            </div>
          </div>
          <nav className="nav-links">
            <LanguageSwitcher />
            {auth.isAuthenticated ? (
              <NavLink className="solid-link" to="/app/account-books">
                {t("public.openApp")}
              </NavLink>
            ) : (
              <>
                <NavLink className="ghost-link" to="/auth/login">
                  {t("public.signIn")}
                </NavLink>
                <NavLink className="solid-link" to="/auth/register">
                  {t("public.createAccount")}
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
