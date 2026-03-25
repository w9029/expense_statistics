import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { useToast } from "@/features/feedback/toast-context";
import { apiClient } from "@/lib/api";

export function InvitationPage() {
  const { token } = useParams();
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const currentPath = `${location.pathname}${location.search}`;

  const invitationQuery = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => apiClient.getInvitationByToken(token!),
    enabled: Boolean(token),
  });

  const acceptMutation = useMutation({
    mutationFn: () => apiClient.acceptInvitation(auth.accessToken!, token!),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["account-books"] });
      const currentUser = auth.user;
      if (currentUser && currentUser.default_account_book_id === null) {
        auth.replaceUser({
          ...currentUser,
          default_account_book_id: result.account_book_id,
        });
      }
      showToast("Invitation accepted.", "success");
      navigate(`/app/account-books/${result.account_book_id}`, { replace: true });
    },
    onError: (error) => {
      showToast(
        error instanceof ApiError ? error.message : "Failed to accept invitation",
        "error",
      );
    },
  });

  return (
    <section className="hero-grid">
      <div className="hero-panel">
        <h1>Invitation</h1>
        <p>
          Open a shared account book invite, review the granted role, then accept it
          after authentication.
        </p>

        {invitationQuery.isLoading ? <div className="info-banner">Loading invitation...</div> : null}
        {invitationQuery.isError ? (
          <div className="error-banner">
            {invitationQuery.error instanceof ApiError
              ? invitationQuery.error.message
              : "Failed to load invitation"}
          </div>
        ) : null}

        {invitationQuery.data ? (
          <div className="detail-card compact-card">
            <div className="badge-row badge-row-tight">
              <span className="badge">{invitationQuery.data.account_role}</span>
              <span className="badge">{invitationQuery.data.status}</span>
              <span className="badge">
                {invitationQuery.data.used_count}/{invitationQuery.data.max_usage}
              </span>
            </div>

            <h3 style={{ marginTop: 14 }}>{invitationQuery.data.account_book_name}</h3>
            <p className="list-note">Invited by {invitationQuery.data.inviter_name}</p>
            <p className="list-note">Expires at {invitationQuery.data.expires_at}</p>

            {auth.isAuthenticated ? (
              <div className="form-actions" style={{ marginTop: 18 }}>
                <button
                  className="button primary"
                  disabled={acceptMutation.isPending || !invitationQuery.data.acceptable}
                  onClick={() => acceptMutation.mutate()}
                  type="button"
                >
                  {acceptMutation.isPending ? "Accepting..." : "Accept Invitation"}
                </button>
                <Link className="button" to={auth.user?.default_account_book_id ? `/app/account-books/${auth.user.default_account_book_id}` : "/app/account-books"}>
                  Open App
                </Link>
              </div>
            ) : (
              <div className="form-actions" style={{ marginTop: 18 }}>
                <Link className="button primary" state={{ from: currentPath }} to="/auth/login">
                  Sign In To Accept
                </Link>
                <Link className="button" state={{ from: currentPath }} to="/auth/register">
                  Create Account
                </Link>
              </div>
            )}

            {!invitationQuery.data.acceptable ? (
              <div className="info-banner compact-banner" style={{ marginTop: 16 }}>
                This invitation is currently not acceptable. Status or usage limits may have changed.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
