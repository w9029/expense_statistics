import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import type { AccountBookMember, Invitation } from "@expense-statistics/domain";
import { useAuth } from "@/features/auth/auth-context";
import { useToast } from "@/features/feedback/toast-context";
import { useI18n } from "@/features/i18n/i18n-context";
import { apiClient } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-errors";

const roleRank: Record<string, number> = {
  owner: 0,
  admin: 1,
  editor: 2,
  viewer: 3,
};

export function AccountBookCollaborationPage() {
  const { accountBookId } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { t } = useI18n();

  const invitationSchema = z.object({
    account_role: z.enum(["viewer", "editor", "admin"]),
    max_usage: z.coerce.number().int().min(1, t("collab.min1")).max(100, t("collab.max100")),
    expires_in_hours: z
      .coerce
      .number()
      .int()
      .min(1, t("collab.min1"))
      .max(720, t("collab.max720")),
  });

  type InvitationFormValues = z.input<typeof invitationSchema>;

  const invitationForm = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      account_role: "viewer",
      max_usage: 10,
      expires_in_hours: 72,
    },
  });

  const detailQuery = useQuery({
    queryKey: ["account-book", accountBookId],
    queryFn: () => apiClient.getAccountBook(auth.accessToken!, accountBookId!),
    enabled: Boolean(auth.accessToken && accountBookId),
  });

  const membersQuery = useQuery({
    queryKey: ["account-book-members", accountBookId],
    queryFn: () => apiClient.listAccountBookMembers(auth.accessToken!, accountBookId!),
    enabled: Boolean(auth.accessToken && accountBookId),
  });

  const canManageInvitations =
    detailQuery.data?.my_role === "owner" || detailQuery.data?.my_role === "admin";
  const isOwner = detailQuery.data?.my_role === "owner";
  const isAdmin = detailQuery.data?.my_role === "admin";

  const invitationsQuery = useQuery({
    queryKey: ["account-book-invitations", accountBookId],
    queryFn: () => apiClient.listAccountBookInvitations(auth.accessToken!, accountBookId!),
    enabled: Boolean(auth.accessToken && accountBookId && canManageInvitations),
  });

  const sortedMembers = useMemo(() => {
    return [...(membersQuery.data ?? [])].sort((left, right) => {
      const byRole = (roleRank[left.account_role] ?? 99) - (roleRank[right.account_role] ?? 99);
      if (byRole !== 0) {
        return byRole;
      }
      if (left.is_me !== right.is_me) {
        return left.is_me ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
  }, [membersQuery.data]);

  const createInvitationMutation = useMutation({
    mutationFn: async (values: InvitationFormValues) => {
      const parsed = invitationSchema.parse(values);
      return apiClient.createInvitation(auth.accessToken!, {
        account_book_id: accountBookId!,
        account_role: parsed.account_role,
        max_usage: parsed.max_usage,
        expires_in_hours: parsed.expires_in_hours,
      });
    },
    onSuccess: async (invitation) => {
      await queryClient.invalidateQueries({
        queryKey: ["account-book-invitations", accountBookId],
      });
      showToast(t("collab.invitationCreated"), "success");
      invitationForm.reset({
        account_role:
          invitation.account_role === "admin" || invitation.account_role === "editor"
            ? invitation.account_role
            : "viewer",
        max_usage: invitation.max_usage,
        expires_in_hours: 72,
      });
    },
    onError: (error) => {
      showToast(getApiErrorMessage(error, t("collab.invitationCreateFailed")), "error");
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: (invitationId: string) =>
      apiClient.deleteAccountBookInvitation(auth.accessToken!, accountBookId!, invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["account-book-invitations", accountBookId],
      });
      showToast(t("collab.invitationDeleted"), "success");
    },
    onError: (error) => {
      showToast(getApiErrorMessage(error, t("collab.invitationDeleteFailed")), "error");
    },
  });

  const transferOwnerMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      apiClient.transferAccountBookOwner(auth.accessToken!, accountBookId!, {
        target_user_id: targetUserId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account-book", accountBookId] });
      await queryClient.invalidateQueries({ queryKey: ["account-book-members", accountBookId] });
      await queryClient.invalidateQueries({ queryKey: ["account-books"] });
      showToast(t("collab.transferred"), "success");
    },
    onError: (error) => {
      showToast(getApiErrorMessage(error, t("collab.transferFailed")), "error");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.removeAccountBookMember(auth.accessToken!, accountBookId!, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account-book-members", accountBookId] });
      await queryClient.invalidateQueries({ queryKey: ["account-books"] });
      showToast(t("collab.removed"), "success");
    },
    onError: (error) => {
      showToast(getApiErrorMessage(error, t("collab.removeFailed")), "error");
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => apiClient.leaveAccountBook(auth.accessToken!, accountBookId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account-books"] });
      const currentUser = auth.user;
      if (currentUser && currentUser.default_account_book_id === accountBookId) {
        auth.replaceUser({
          ...currentUser,
          default_account_book_id: null,
        });
      }
      showToast(t("collab.left"), "success");
      navigate("/app/account-books", { replace: true });
    },
    onError: (error) => {
      showToast(getApiErrorMessage(error, t("collab.leaveFailed")), "error");
    },
  });

  function resolveInvitationURL(invitation: Invitation) {
    return invitation.invite_url.startsWith("/")
      ? `${window.location.origin}${invitation.invite_url}`
      : invitation.invite_url;
  }

  async function copyInvitationURL(invitation: Invitation) {
    try {
      await navigator.clipboard.writeText(resolveInvitationURL(invitation));
      showToast(t("collab.copySuccess"), "success");
    } catch {
      showToast(t("collab.copyFailed"), "error");
    }
  }

  function handleDeleteInvitation(invitation: Invitation) {
    if (!window.confirm(t("collab.deleteInvitationConfirm", { role: invitation.account_role }))) {
      return;
    }
    deleteInvitationMutation.mutate(invitation.id);
  }

  function handleTransferOwner(member: AccountBookMember) {
    if (!window.confirm(t("collab.transferConfirm", { name: member.name }))) {
      return;
    }
    transferOwnerMutation.mutate(member.user_id);
  }

  function handleRemoveMember(member: AccountBookMember) {
    if (!window.confirm(t("collab.removeConfirm", { name: member.name }))) {
      return;
    }
    removeMemberMutation.mutate(member.user_id);
  }

  function handleLeaveBook() {
    if (!window.confirm(t("collab.leaveConfirm"))) {
      return;
    }
    leaveMutation.mutate();
  }

  return (
    <section className="stack stack-tight">
      <header className="page-header page-header-compact">
        <div className="stack-sm">
          <div className="title-row">
            <h1>{detailQuery.data?.name ?? t("collab.titleFallback")}</h1>
          </div>
          <p className="page-subtext">{t("collab.subtitle")}</p>
        </div>
      </header>

      {detailQuery.isLoading ? (
        <div className="info-banner compact-banner">{t("collab.loadingBook")}</div>
      ) : null}
      {detailQuery.isError ? (
        <div className="error-banner">
          {getApiErrorMessage(detailQuery.error, t("collab.loadBookFailed"))}
        </div>
      ) : null}

      <div className="detail-grid detail-grid-ledger">
        <article className="detail-card compact-card">
          <div className="compact-header-row">
            <div>
              <h3>{t("collab.membersTitle")}</h3>
              <p>{t("collab.membersDescription")}</p>
            </div>
            {detailQuery.data && detailQuery.data.my_role !== "owner" ? (
              <button
                className="button button-sm button-muted"
                disabled={leaveMutation.isPending}
                onClick={handleLeaveBook}
                type="button"
              >
                {leaveMutation.isPending ? t("collab.leavingBook") : t("collab.leaveBook")}
              </button>
            ) : null}
          </div>

          {membersQuery.isLoading ? (
            <div className="info-banner compact-banner">{t("collab.membersLoading")}</div>
          ) : null}
          {membersQuery.isError ? (
            <div className="error-banner">
              {getApiErrorMessage(membersQuery.error, t("collab.membersLoadFailed"))}
            </div>
          ) : null}

          <div className="stack-sm">
            {sortedMembers.map((member) => {
              const isRemovingThisMember =
                removeMemberMutation.isPending && removeMemberMutation.variables === member.user_id;
              const isTransferTarget =
                transferOwnerMutation.isPending && transferOwnerMutation.variables === member.user_id;
              const canTransfer = isOwner && member.account_role !== "owner";
              const canRemove =
                (isOwner && member.account_role !== "owner") ||
                (isAdmin &&
                  !member.is_me &&
                  (member.account_role === "editor" || member.account_role === "viewer"));

              return (
                <article className="surface-card" key={member.user_id}>
                  <div className="split-header">
                    <div className="stack-sm">
                      <h3 style={{ marginTop: 0 }}>{member.name}</h3>
                      <p className="list-note">{member.email}</p>
                    </div>
                    <div className="badge-row badge-row-tight">
                      <span className="badge">{member.account_role}</span>
                      {member.is_me ? <span className="badge">{t("collab.me")}</span> : null}
                    </div>
                  </div>

                  <div className="helper-row" style={{ marginTop: 14, justifyContent: "space-between" }}>
                    <span className="meta-line">
                      {t("collab.joined", { date: member.joined_at.slice(0, 10) })}
                    </span>
                    <div className="helper-row">
                      {canTransfer ? (
                        <button
                          className="button button-sm"
                          disabled={isTransferTarget || transferOwnerMutation.isPending}
                          onClick={() => handleTransferOwner(member)}
                          type="button"
                        >
                          {isTransferTarget ? t("collab.transferring") : t("collab.makeOwner")}
                        </button>
                      ) : null}
                      {canRemove ? (
                        <button
                          className="button button-sm button-danger-strong"
                          disabled={isRemovingThisMember || removeMemberMutation.isPending}
                          onClick={() => handleRemoveMember(member)}
                          type="button"
                        >
                          {isRemovingThisMember ? t("collab.removing") : t("collab.remove")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </article>

        <article className="detail-card compact-card">
          <div className="compact-header-row">
            <div>
              <h3>{t("collab.invitationsTitle")}</h3>
              <p>{t("collab.invitationsDescription")}</p>
            </div>
          </div>

          {canManageInvitations ? (
            <form
              className="form-grid compact-form-grid"
              onSubmit={invitationForm.handleSubmit((values) => createInvitationMutation.mutate(values))}
            >
              <div className="inline-grid inline-grid-3">
                <div className="field field-compact">
                  <label htmlFor="invitation-role">{t("collab.role")}</label>
                  <select id="invitation-role" {...invitationForm.register("account_role")}>
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div className="field field-compact">
                  <label htmlFor="invitation-max-usage">{t("collab.maxUsage")}</label>
                  <input
                    id="invitation-max-usage"
                    inputMode="numeric"
                    type="number"
                    {...invitationForm.register("max_usage")}
                  />
                </div>
                <div className="field field-compact">
                  <label htmlFor="invitation-expiry">{t("collab.expiresInHours")}</label>
                  <input
                    id="invitation-expiry"
                    inputMode="numeric"
                    type="number"
                    {...invitationForm.register("expires_in_hours")}
                  />
                </div>
              </div>

              {invitationForm.formState.errors.account_role ? (
                <div className="error-banner">{invitationForm.formState.errors.account_role.message}</div>
              ) : null}
              {invitationForm.formState.errors.max_usage ? (
                <div className="error-banner">{invitationForm.formState.errors.max_usage.message}</div>
              ) : null}
              {invitationForm.formState.errors.expires_in_hours ? (
                <div className="error-banner">{invitationForm.formState.errors.expires_in_hours.message}</div>
              ) : null}

              <div className="form-actions form-actions-end">
                <button
                  className="button primary button-sm"
                  disabled={createInvitationMutation.isPending}
                  type="submit"
                >
                  {createInvitationMutation.isPending
                    ? t("collab.creatingInvitation")
                    : t("collab.createInvitation")}
                </button>
              </div>
            </form>
          ) : (
            <div className="info-banner compact-banner">{t("collab.noPermission")}</div>
          )}

          {canManageInvitations && invitationsQuery.isLoading ? (
            <div className="info-banner compact-banner" style={{ marginTop: 16 }}>
              {t("collab.invitationsLoading")}
            </div>
          ) : null}
          {canManageInvitations && invitationsQuery.isError ? (
            <div className="error-banner" style={{ marginTop: 16 }}>
              {getApiErrorMessage(invitationsQuery.error, t("collab.invitationsLoadFailed"))}
            </div>
          ) : null}

          {canManageInvitations ? (
            <div className="stack-sm" style={{ marginTop: 16 }}>
              {(invitationsQuery.data ?? []).map((invitation) => {
                const isDeletingThisInvitation =
                  deleteInvitationMutation.isPending &&
                  deleteInvitationMutation.variables === invitation.id;

                return (
                  <article className="surface-card" key={invitation.id}>
                    <div className="split-header">
                      <div className="badge-row badge-row-tight">
                        <span className="badge">{invitation.account_role}</span>
                        <span className="badge">{invitation.status}</span>
                        <span className="badge">
                          {invitation.used_count}/{invitation.max_usage}
                        </span>
                      </div>
                      <span className="meta-line">{invitation.expires_at.slice(0, 10)}</span>
                    </div>

                    <p className="mono" style={{ marginTop: 12, wordBreak: "break-all" }}>
                      {resolveInvitationURL(invitation)}
                    </p>

                    <div className="helper-row" style={{ marginTop: 14, justifyContent: "space-between" }}>
                      <span className="meta-line">
                        {t("collab.createdBy", { name: invitation.inviter_name })}
                      </span>
                      <div className="helper-row">
                        <button
                          className="button button-sm"
                          onClick={() => void copyInvitationURL(invitation)}
                          type="button"
                        >
                          {t("collab.copyLink")}
                        </button>
                        <button
                          className="button button-sm button-danger-strong"
                          disabled={isDeletingThisInvitation}
                          onClick={() => handleDeleteInvitation(invitation)}
                          type="button"
                        >
                          {isDeletingThisInvitation ? t("collab.deleting") : t("common.delete")}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}

              {invitationsQuery.isSuccess && invitationsQuery.data?.length === 0 ? (
                <div className="empty-state">{t("collab.noInvitations")}</div>
              ) : null}
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}
