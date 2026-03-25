import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { useToast } from "@/features/feedback/toast-context";
import { useI18n } from "@/features/i18n/i18n-context";
import { apiClient } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-errors";

export function InvitationPage() {
  const { token } = useParams();
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { t } = useI18n();
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
      showToast(t("invite.accepted"), "success");
      navigate(`/app/account-books/${result.account_book_id}`, { replace: true });
    },
    onError: (error) => {
      showToast(getApiErrorMessage(error, t("invite.acceptFailed")), "error");
    },
  });

  return (
    <section className="hero-grid">
      <div className="hero-panel">
        <h1>{t("invite.title")}</h1>
        <p>{t("invite.description")}</p>

        {invitationQuery.isLoading ? <div className="info-banner">{t("invite.loading")}</div> : null}
        {invitationQuery.isError ? (
          <div className="error-banner">
            {getApiErrorMessage(invitationQuery.error, t("invite.loadFailed"))}
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
            <p className="list-note">
              {t("invite.invitedBy", { name: invitationQuery.data.inviter_name })}
            </p>
            <p className="list-note">
              {t("invite.expiresAt", { value: invitationQuery.data.expires_at })}
            </p>

            {auth.isAuthenticated ? (
              <div className="form-actions" style={{ marginTop: 18 }}>
                <button
                  className="button primary"
                  disabled={acceptMutation.isPending || !invitationQuery.data.acceptable}
                  onClick={() => acceptMutation.mutate()}
                  type="button"
                >
                  {acceptMutation.isPending ? t("invite.accepting") : t("invite.accept")}
                </button>
                <Link
                  className="button"
                  to={
                    auth.user?.default_account_book_id
                      ? `/app/account-books/${auth.user.default_account_book_id}`
                      : "/app/account-books"
                  }
                >
                  {t("invite.openApp")}
                </Link>
              </div>
            ) : (
              <div className="form-actions" style={{ marginTop: 18 }}>
                <Link className="button primary" state={{ from: currentPath }} to="/auth/login">
                  {t("invite.signIn")}
                </Link>
                <Link className="button" state={{ from: currentPath }} to="/auth/register">
                  {t("invite.createAccount")}
                </Link>
              </div>
            )}

            {!invitationQuery.data.acceptable ? (
              <div className="info-banner compact-banner" style={{ marginTop: 16 }}>
                {t("invite.notAcceptable")}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
