import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { apiClient } from "@/lib/api";

const surfaceCards = [
  {
    title: "Shared Account Books",
    body: "Owners, admins, editors and viewers already exist in the backend. The web shell can now shape the real flows around them.",
  },
  {
    title: "Merged Expenses",
    body: "The structure already supports parent and child expenses, which makes receipt entry and later category analysis practical.",
  },
  {
    title: "Filtered Ledger Views",
    body: "Member, amount, currency, date and multi-category filters are in place. That gives the first reporting pages a strong base.",
  },
];

export function LandingPage() {
  const auth = useAuth();
  const healthQuery = useQuery({
    queryKey: ["system", "health"],
    queryFn: () => apiClient.health(),
  });

  return (
    <section className="page-section">
      <div className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow">React Web Foundation</div>
          <h1>Build the product where the ledger actually lives.</h1>
          <p>
            This first web shell is intentionally narrow: stable routing, query
            infrastructure, a shared API layer, and page surfaces for auth, account
            books, expenses, and profile management.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to={auth.isAuthenticated ? "/app/account-books" : "/auth/login"}>
              {auth.isAuthenticated ? "Open App Shell" : "Sign In To Continue"}
            </Link>
            <Link className="button" to="/auth/login">
              Review Auth Screens
            </Link>
          </div>
        </div>

        <div className="hero-panel">
          <div className="status-chip">
            API Status: {healthQuery.isSuccess ? "reachable" : healthQuery.isError ? "unreachable" : "checking"}
          </div>
          <div className="metric-strip">
            <div className="metric-card">
              <strong>1</strong>
              <span>web app target</span>
            </div>
            <div className="metric-card">
              <strong>2</strong>
              <span>shared packages</span>
            </div>
            <div className="metric-card">
              <strong>8</strong>
              <span>routes scaffolded</span>
            </div>
          </div>
          <div className="surface-card">
            <h3>Why start here</h3>
            <p>
              You already have enough backend capability to let a user sign in,
              choose a book, enter expenses and review them. The frontend can now
              expose the weak spots before analytics work gets heavy.
            </p>
          </div>
          <div className="surface-card">
            <h3>Connected backend</h3>
            <p className="mono">{import.meta.env.VITE_API_BASE_URL ?? "/api/v1"}</p>
            <p className="list-note">
              This shell pings <span className="mono">/healthz</span> on load so the
              environment issue shows up early.
            </p>
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
