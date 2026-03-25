import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import type { AccountBookMember, Invitation } from "@expense-statistics/domain";
import { ApiError } from "@expense-statistics/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { useToast } from "@/features/feedback/toast-context";
import { apiClient } from "@/lib/api";

const invitationSchema = z.object({
  account_role: z.enum(["viewer", "editor", "admin"]),
  max_usage: z.coerce.number().int().min(1, "Min 1").max(100, "Max 100"),
  expires_in_hours: z.coerce.number().int().min(1, "Min 1").max(720, "Max 720"),
});

type InvitationFormValues = z.input<typeof invitationSchema>;

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
      showToast("Invitation created.", "success");
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
      showToast(
        error instanceof ApiError ? error.message : "Failed to create invitation",
        "error",
      );
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: (invitationId: string) =>
      apiClient.deleteAccountBookInvitation(auth.accessToken!, accountBookId!, invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["account-book-invitations", accountBookId],
      });
      showToast("Invitation deleted.", "success");
    },
    onError: (error) => {
      showToast(
        error instanceof ApiError ? error.message : "Failed to delete invitation",
        "error",
      );
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
      showToast("Ownership transferred.", "success");
    },
    onError: (error) => {
      showToast(
        error instanceof ApiError ? error.message : "Failed to transfer ownership",
        "error",
      );
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.removeAccountBookMember(auth.accessToken!, accountBookId!, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account-book-members", accountBookId] });
      await queryClient.invalidateQueries({ queryKey: ["account-books"] });
      showToast("Member removed.", "success");
    },
    onError: (error) => {
      showToast(
        error instanceof ApiError ? error.message : "Failed to remove member",
        "error",
      );
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
      showToast("You left the account book.", "success");
      navigate("/app/account-books", { replace: true });
    },
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Failed to leave account book", "error");
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
      showToast("Invitation link copied.", "success");
    } catch {
      showToast("Failed to copy invitation link", "error");
    }
  }

  function handleDeleteInvitation(invitation: Invitation) {
    if (!window.confirm(`Delete invitation for ${invitation.account_role}?`)) {
      return;
    }
    deleteInvitationMutation.mutate(invitation.id);
  }

  function handleTransferOwner(member: AccountBookMember) {
    if (!window.confirm(`Transfer owner to ${member.name}? You will become admin.`)) {
      return;
    }
    transferOwnerMutation.mutate(member.user_id);
  }

  function handleRemoveMember(member: AccountBookMember) {
    if (!window.confirm(`Remove ${member.name} from this account book?`)) {
      return;
    }
    removeMemberMutation.mutate(member.user_id);
  }

  function handleLeaveBook() {
    if (!window.confirm("Leave this account book?")) {
      return;
    }
    leaveMutation.mutate();
  }

  return (
    <section className="stack stack-tight">
      <header className="page-header page-header-compact">
        <div className="split-header">
          <div className="stack-sm">
            <h1>{detailQuery.data?.name ?? "Collaboration"}</h1>
            <p className="page-subtext">
              Invitations and member management for this account book.
            </p>
          </div>
          <div className="cta-row">
            <Link className="button button-sm" to={`/app/account-books/${accountBookId}`}>
              Back To Book
            </Link>
          </div>
        </div>
      </header>

      {detailQuery.isLoading ? <div className="info-banner compact-banner">Loading account book...</div> : null}
      {detailQuery.isError ? (
        <div className="error-banner">
          {detailQuery.error instanceof ApiError
            ? detailQuery.error.message
            : "Failed to load the account book"}
        </div>
      ) : null}

      <div className="detail-grid detail-grid-ledger">
        <article className="detail-card compact-card">
          <div className="compact-header-row">
            <div>
              <h3>Members</h3>
              <p>Owner can transfer ownership or remove members. Non-owner members can leave.</p>
            </div>
            {detailQuery.data && detailQuery.data.my_role !== "owner" ? (
              <button
                className="button button-sm button-muted"
                disabled={leaveMutation.isPending}
                onClick={handleLeaveBook}
                type="button"
              >
                {leaveMutation.isPending ? "Leaving..." : "Leave Book"}
              </button>
            ) : null}
          </div>

          {membersQuery.isLoading ? <div className="info-banner compact-banner">Loading members...</div> : null}
          {membersQuery.isError ? (
            <div className="error-banner">
              {membersQuery.error instanceof ApiError
                ? membersQuery.error.message
                : "Failed to load members"}
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
                      {member.is_me ? <span className="badge">me</span> : null}
                    </div>
                  </div>

                  <div className="helper-row" style={{ marginTop: 14, justifyContent: "space-between" }}>
                    <span className="meta-line">joined {member.joined_at.slice(0, 10)}</span>
                    <div className="helper-row">
                      {canTransfer ? (
                        <button
                          className="button button-sm"
                          disabled={isTransferTarget || transferOwnerMutation.isPending}
                          onClick={() => handleTransferOwner(member)}
                          type="button"
                        >
                          {isTransferTarget ? "Transferring..." : "Make Owner"}
                        </button>
                      ) : null}
                      {canRemove ? (
                        <button
                          className="button button-sm button-danger-strong"
                          disabled={isRemovingThisMember || removeMemberMutation.isPending}
                          onClick={() => handleRemoveMember(member)}
                          type="button"
                        >
                          {isRemovingThisMember ? "Removing..." : "Remove"}
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
              <h3>Invitations</h3>
              <p>Admins and owner can create and delete invitation links.</p>
            </div>
          </div>

          {canManageInvitations ? (
            <form
              className="form-grid compact-form-grid"
              onSubmit={invitationForm.handleSubmit((values) => createInvitationMutation.mutate(values))}
            >
              <div className="inline-grid inline-grid-3">
                <div className="field field-compact">
                  <label htmlFor="invitation-role">Role</label>
                  <select id="invitation-role" {...invitationForm.register("account_role")}>
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div className="field field-compact">
                  <label htmlFor="invitation-max-usage">Max Usage</label>
                  <input
                    id="invitation-max-usage"
                    inputMode="numeric"
                    type="number"
                    {...invitationForm.register("max_usage")}
                  />
                </div>
                <div className="field field-compact">
                  <label htmlFor="invitation-expiry">Expires In Hours</label>
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
                  {createInvitationMutation.isPending ? "Creating..." : "Create Invitation"}
                </button>
              </div>
            </form>
          ) : (
            <div className="info-banner compact-banner">
              Your role cannot manage invitations for this account book.
            </div>
          )}

          {canManageInvitations && invitationsQuery.isLoading ? (
            <div className="info-banner compact-banner" style={{ marginTop: 16 }}>
              Loading invitations...
            </div>
          ) : null}
          {canManageInvitations && invitationsQuery.isError ? (
            <div className="error-banner" style={{ marginTop: 16 }}>
              {invitationsQuery.error instanceof ApiError
                ? invitationsQuery.error.message
                : "Failed to load invitations"}
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
                      <span className="meta-line">created by {invitation.inviter_name}</span>
                      <div className="helper-row">
                        <button
                          className="button button-sm"
                          onClick={() => void copyInvitationURL(invitation)}
                          type="button"
                        >
                          Copy Link
                        </button>
                        <button
                          className="button button-sm button-danger-strong"
                          disabled={isDeletingThisInvitation}
                          onClick={() => handleDeleteInvitation(invitation)}
                          type="button"
                        >
                          {isDeletingThisInvitation ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}

              {invitationsQuery.isSuccess && invitationsQuery.data?.length === 0 ? (
                <div className="empty-state">No invitations yet.</div>
              ) : null}
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}
