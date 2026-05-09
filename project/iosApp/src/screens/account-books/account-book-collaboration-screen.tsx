import {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import type {
  AccountBookDetail,
  AccountBookMember,
  Invitation,
} from '@expense-statistics/domain';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ActionButton} from '@/components/action-button';
import {AppTextInput, FormField} from '@/components/form-field';
import {InlineBanner} from '@/components/inline-banner';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {SFSymbol} from '@/components/sf-symbol';
import {useBookSession} from '@/features/account-books/book-session-context';
import {useAuth} from '@/features/auth/auth-context';
import {useToast} from '@/features/feedback/toast-context';
import {useI18n} from '@/features/i18n/i18n-context';
import {apiClient} from '@/lib/api';
import {getApiErrorMessage} from '@/lib/api-errors';
import {copyText} from '@/lib/clipboard';
import type {RootStackParamList} from '@/navigation/types';
import {colors} from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountBookCollaboration'>;
type InvitationRole = 'viewer' | 'editor' | 'admin';

type InvitationForm = {
  account_role: InvitationRole;
  max_usage: string;
  expires_in_hours: string;
};

type InvitationFormErrors = Partial<Record<keyof InvitationForm, string>>;

const roleRank: Record<string, number> = {
  owner: 0,
  admin: 1,
  editor: 2,
  viewer: 3,
};

const DEFAULT_INVITATION_FORM: InvitationForm = {
  account_role: 'viewer',
  max_usage: '10',
  expires_in_hours: '72',
};

function resolveInvitationURL(invitation: Invitation) {
  return invitation.invite_url.startsWith('/')
    ? `https://expense.wlzy.online${invitation.invite_url}`
    : invitation.invite_url;
}

export function AccountBookCollaborationScreen({navigation, route}: Props) {
  const {accountBookId} = route.params;
  const auth = useAuth();
  const {setActiveAccountBookId} = useBookSession();
  const {showToast} = useToast();
  const {t} = useI18n();
  const [detail, setDetail] = useState<AccountBookDetail | null>(null);
  const [members, setMembers] = useState<AccountBookMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationForm, setInvitationForm] = useState<InvitationForm>(DEFAULT_INVITATION_FORM);
  const [formErrors, setFormErrors] = useState<InvitationFormErrors>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [isCreatingInvitation, setIsCreatingInvitation] = useState(false);
  const [isDeletingInvitationId, setIsDeletingInvitationId] = useState<string | null>(null);
  const [isRemovingMemberId, setIsRemovingMemberId] = useState<string | null>(null);
  const [isTransferringMemberId, setIsTransferringMemberId] = useState<string | null>(null);
  const [isLeavingBook, setIsLeavingBook] = useState(false);

  const canManageInvitations =
    detail?.my_role === 'owner' || detail?.my_role === 'admin';
  const isOwner = detail?.my_role === 'owner';
  const isAdmin = detail?.my_role === 'admin';

  const sortedMembers = useMemo(() => {
    return [...members].sort((left, right) => {
      const byRole = (roleRank[left.account_role] ?? 99) - (roleRank[right.account_role] ?? 99);
      if (byRole !== 0) {
        return byRole;
      }
      if (left.is_me !== right.is_me) {
        return left.is_me ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
  }, [members]);

  useEffect(() => {
    setActiveAccountBookId(accountBookId);
  }, [accountBookId, setActiveAccountBookId]);

  const loadInvitations = useCallback(async () => {
    if (!auth.accessToken || !canManageInvitations) {
      setInvitations([]);
      setInvitationsError(null);
      return;
    }

    setIsLoadingInvitations(true);
    setInvitationsError(null);
    try {
      const nextInvitations = await apiClient.listAccountBookInvitations(
        auth.accessToken,
        accountBookId,
      );
      setInvitations(nextInvitations);
    } catch (error) {
      setInvitationsError(getApiErrorMessage(error, t('collab.invitationsLoadFailed')));
    } finally {
      setIsLoadingInvitations(false);
    }
  }, [accountBookId, auth.accessToken, canManageInvitations, t]);

  const loadPage = useCallback(async () => {
    if (!auth.accessToken) {
      return;
    }

    setIsLoadingPage(true);
    setPageError(null);
    setMembersError(null);
    try {
      const [nextDetail, nextMembers] = await Promise.all([
        apiClient.getAccountBook(auth.accessToken, accountBookId),
        apiClient.listAccountBookMembers(auth.accessToken, accountBookId),
      ]);
      setDetail(nextDetail);
      setMembers(nextMembers);
    } catch (error) {
      const message = getApiErrorMessage(error, t('collab.loadBookFailed'));
      setPageError(message);
      setMembersError(message);
    } finally {
      setIsLoadingPage(false);
    }
  }, [accountBookId, auth.accessToken, t]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void loadPage();
    });
    return unsubscribe;
  }, [loadPage, navigation]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  function updateInvitationForm<K extends keyof InvitationForm>(
    key: K,
    value: InvitationForm[K],
  ) {
    setInvitationForm(current => ({
      ...current,
      [key]: value,
    }));
    setFormErrors(current => ({
      ...current,
      [key]: undefined,
    }));
  }

  function validateInvitationForm() {
    const nextErrors: InvitationFormErrors = {};
    const maxUsage = Number(invitationForm.max_usage.trim());
    const expiresInHours = Number(invitationForm.expires_in_hours.trim());

    if (!Number.isInteger(maxUsage) || maxUsage < 1) {
      nextErrors.max_usage = t('collab.min1');
    } else if (maxUsage > 100) {
      nextErrors.max_usage = t('collab.max100');
    }

    if (!Number.isInteger(expiresInHours) || expiresInHours < 1) {
      nextErrors.expires_in_hours = t('collab.min1');
    } else if (expiresInHours > 720) {
      nextErrors.expires_in_hours = t('collab.max720');
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleCreateInvitation() {
    if (!auth.accessToken || !canManageInvitations || isCreatingInvitation || !validateInvitationForm()) {
      return;
    }

    setIsCreatingInvitation(true);
    setInvitationsError(null);
    try {
      const invitation = await apiClient.createInvitation(auth.accessToken, {
        account_book_id: accountBookId,
        account_role: invitationForm.account_role,
        max_usage: Number(invitationForm.max_usage.trim()),
        expires_in_hours: Number(invitationForm.expires_in_hours.trim()),
      });
      showToast(t('collab.invitationCreated'), 'success');
      setInvitationForm({
        account_role:
          invitation.account_role === 'admin' || invitation.account_role === 'editor'
            ? invitation.account_role
            : 'viewer',
        max_usage: String(invitation.max_usage),
        expires_in_hours: '72',
      });
      await loadInvitations();
    } catch (error) {
      const message = getApiErrorMessage(error, t('collab.invitationCreateFailed'));
      setInvitationsError(message);
      showToast(message, 'error');
    } finally {
      setIsCreatingInvitation(false);
    }
  }

  async function copyInvitationURL(invitation: Invitation) {
    try {
      await copyText(resolveInvitationURL(invitation));
      showToast(t('collab.copySuccess'), 'success');
    } catch {
      showToast(t('collab.copyFailed'), 'error');
    }
  }

  function handleDeleteInvitation(invitation: Invitation) {
    if (!auth.accessToken || isDeletingInvitationId) {
      return;
    }
    const accessToken = auth.accessToken;

    Alert.alert(
      t('common.delete'),
      t('collab.deleteInvitationConfirm', {role: invitation.account_role}),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('common.confirmDelete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsDeletingInvitationId(invitation.id);
              try {
                await apiClient.deleteAccountBookInvitation(
                  accessToken,
                  accountBookId,
                  invitation.id,
                );
                showToast(t('collab.invitationDeleted'), 'success');
                await loadInvitations();
              } catch (error) {
                showToast(
                  getApiErrorMessage(error, t('collab.invitationDeleteFailed')),
                  'error',
                );
              } finally {
                setIsDeletingInvitationId(null);
              }
            })();
          },
        },
      ],
    );
  }

  function handleTransferOwner(member: AccountBookMember) {
    if (!auth.accessToken || isTransferringMemberId) {
      return;
    }
    const accessToken = auth.accessToken;

    Alert.alert(
      t('collab.makeOwner'),
      t('collab.transferConfirm', {name: member.name}),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('collab.makeOwner'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsTransferringMemberId(member.user_id);
              try {
                await apiClient.transferAccountBookOwner(accessToken, accountBookId, {
                  target_user_id: member.user_id,
                });
                showToast(t('collab.transferred'), 'success');
                await loadPage();
              } catch (error) {
                showToast(getApiErrorMessage(error, t('collab.transferFailed')), 'error');
              } finally {
                setIsTransferringMemberId(null);
              }
            })();
          },
        },
      ],
    );
  }

  function handleRemoveMember(member: AccountBookMember) {
    if (!auth.accessToken || isRemovingMemberId) {
      return;
    }
    const accessToken = auth.accessToken;

    Alert.alert(
      t('collab.remove'),
      t('collab.removeConfirm', {name: member.name}),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('common.confirmDelete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsRemovingMemberId(member.user_id);
              try {
                await apiClient.removeAccountBookMember(
                  accessToken,
                  accountBookId,
                  member.user_id,
                );
                showToast(t('collab.removed'), 'success');
                await loadPage();
              } catch (error) {
                showToast(getApiErrorMessage(error, t('collab.removeFailed')), 'error');
              } finally {
                setIsRemovingMemberId(null);
              }
            })();
          },
        },
      ],
    );
  }

  function handleLeaveBook() {
    if (!auth.accessToken || isLeavingBook) {
      return;
    }
    const accessToken = auth.accessToken;

    Alert.alert(t('collab.leaveBook'), t('collab.leaveConfirm'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('collab.leaveBook'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsLeavingBook(true);
            try {
              await apiClient.leaveAccountBook(accessToken, accountBookId);
              const currentUser = auth.user;
              if (currentUser?.default_account_book_id === accountBookId) {
                await auth.replaceUser({
                  ...currentUser,
                  default_account_book_id: null,
                });
              }
              setActiveAccountBookId(current =>
                current === accountBookId ? null : current,
              );
              showToast(t('collab.left'), 'success');
              navigation.goBack();
            } catch (error) {
              showToast(getApiErrorMessage(error, t('collab.leaveFailed')), 'error');
            } finally {
              setIsLeavingBook(false);
            }
          })();
        },
      },
    ]);
  }

  return (
    <ScreenShell hideHero title={detail?.name ?? t('collab.titleFallback')}>
      {isLoadingPage ? <InlineBanner message={t('collab.loadingBook')} tone="info" /> : null}
      {pageError ? <InlineBanner message={pageError} tone="error" /> : null}

      <PlaceholderCard
        title={detail?.name ?? t('collab.titleFallback')}
        description={t('collab.subtitle')}
        headerAccessory={
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <SFSymbol
              colorHex={colors.accentDeep}
              name="chevron.left"
              pointSize={16}
              style={styles.backIcon}
              weight="semibold"
            />
          </Pressable>
        }>
        <View style={styles.metaStrip}>
          <Text style={styles.metaChip}>
            {t('book.roleLabel')}: {detail?.my_role ?? '-'}
          </Text>
          <Text style={styles.metaChip}>
            {t('accountBooks.members')}: {members.length}
          </Text>
          <Text style={styles.metaChip}>
            {t('book.baseLabel')}: {detail?.base_currency ?? '-'}
          </Text>
        </View>
      </PlaceholderCard>

      <PlaceholderCard
        title={t('collab.membersTitle')}
        description={t('collab.membersDescription')}
        headerAccessory={
          detail && detail.my_role !== 'owner' ? (
            <ActionButton
              disabled={isLeavingBook}
              label={isLeavingBook ? t('collab.leavingBook') : t('collab.leaveBook')}
              onPress={handleLeaveBook}
              style={styles.shortAction}
              tone="secondary"
            />
          ) : null
        }>
        {membersError ? <InlineBanner message={membersError} tone="error" /> : null}
        <View style={styles.list}>
          {sortedMembers.map(member => {
            const canTransfer = isOwner && member.account_role !== 'owner';
            const canRemove =
              (isOwner && member.account_role !== 'owner') ||
              (isAdmin &&
                !member.is_me &&
                (member.account_role === 'editor' || member.account_role === 'viewer'));
            const isRemovingThisMember = isRemovingMemberId === member.user_id;
            const isTransferringThisMember = isTransferringMemberId === member.user_id;

            return (
              <View key={member.user_id} style={styles.surfaceCard}>
                <View style={styles.splitHeader}>
                  <View style={styles.stackSm}>
                    <Text style={styles.cardTitle}>{member.name}</Text>
                    <Text style={styles.cardSubtext}>{member.email}</Text>
                  </View>
                  <View style={styles.badgeRow}>
                    <Text style={styles.metaChip}>{member.account_role}</Text>
                    {member.is_me ? <Text style={styles.metaChip}>{t('collab.me')}</Text> : null}
                  </View>
                </View>

                <View style={styles.memberFooter}>
                  <Text style={styles.cardSubtext}>
                    {t('collab.joined', {date: member.joined_at.slice(0, 10)})}
                  </Text>
                  <View style={styles.actionRow}>
                    {canTransfer ? (
                      <ActionButton
                        disabled={Boolean(isTransferringMemberId)}
                        label={
                          isTransferringThisMember
                            ? t('collab.transferring')
                            : t('collab.makeOwner')
                        }
                        onPress={() => handleTransferOwner(member)}
                        style={styles.shortAction}
                      />
                    ) : null}
                    {canRemove ? (
                      <ActionButton
                        disabled={Boolean(isRemovingMemberId)}
                        label={
                          isRemovingThisMember
                            ? t('collab.removing')
                            : t('collab.remove')
                        }
                        onPress={() => handleRemoveMember(member)}
                        style={styles.shortAction}
                        tone="destructive"
                      />
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </PlaceholderCard>

      <PlaceholderCard
        title={t('collab.invitationsTitle')}
        description={t('collab.invitationsDescription')}>
        {!canManageInvitations ? (
          <InlineBanner message={t('collab.noPermission')} tone="info" />
        ) : (
          <View style={styles.form}>
            <FormField label={t('collab.role')}>
              <View style={styles.segmentRow}>
                {(['viewer', 'editor', 'admin'] as InvitationRole[]).map(role => (
                  <Pressable
                    key={role}
                    onPress={() => updateInvitationForm('account_role', role)}
                    style={[
                      styles.segment,
                      invitationForm.account_role === role
                        ? styles.segmentActive
                        : undefined,
                    ]}>
                    <Text
                      style={[
                        styles.segmentText,
                        invitationForm.account_role === role
                          ? styles.segmentTextActive
                          : undefined,
                      ]}>
                      {role}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </FormField>

            <View style={styles.inlineRow}>
              <View style={styles.flexField}>
                <FormField
                  error={formErrors.max_usage}
                  label={t('collab.maxUsage')}>
                  <AppTextInput
                    keyboardType="number-pad"
                    onChangeText={text => updateInvitationForm('max_usage', text)}
                    value={invitationForm.max_usage}
                  />
                </FormField>
              </View>
              <View style={styles.flexField}>
                <FormField
                  error={formErrors.expires_in_hours}
                  label={t('collab.expiresInHours')}>
                  <AppTextInput
                    keyboardType="number-pad"
                    onChangeText={text => updateInvitationForm('expires_in_hours', text)}
                    value={invitationForm.expires_in_hours}
                  />
                </FormField>
              </View>
            </View>

            <ActionButton
              disabled={isCreatingInvitation}
              label={
                isCreatingInvitation
                  ? t('collab.creatingInvitation')
                  : t('collab.createInvitation')
              }
              onPress={() => {
                void handleCreateInvitation();
              }}
            />

            {isLoadingInvitations ? (
              <InlineBanner message={t('collab.invitationsLoading')} tone="info" />
            ) : null}
            {invitationsError ? (
              <InlineBanner message={invitationsError} tone="error" />
            ) : null}

            <View style={styles.list}>
              {invitations.map(invitation => {
                const isDeletingThisInvitation = isDeletingInvitationId === invitation.id;
                return (
                  <View key={invitation.id} style={styles.surfaceCard}>
                    <View style={styles.splitHeader}>
                      <View style={styles.badgeRow}>
                        <Text style={styles.metaChip}>{invitation.account_role}</Text>
                        <Text style={styles.metaChip}>{invitation.status}</Text>
                        <Text style={styles.metaChip}>
                          {invitation.used_count}/{invitation.max_usage}
                        </Text>
                      </View>
                      <Text style={styles.cardSubtext}>
                        {invitation.expires_at.slice(0, 10)}
                      </Text>
                    </View>

                  <Text selectable style={styles.inviteLink}>
                      {resolveInvitationURL(invitation)}
                    </Text>
                    <Text style={styles.cardSubtext}>
                      {t('collab.createdBy', {name: invitation.inviter_name})}
                    </Text>

                    <View style={styles.actionRow}>
                      <ActionButton
                        label={t('collab.copyLink')}
                        onPress={() => {
                          void copyInvitationURL(invitation);
                        }}
                        style={styles.shortAction}
                        tone="secondary"
                      />
                      <ActionButton
                        disabled={Boolean(isDeletingInvitationId)}
                        label={
                          isDeletingThisInvitation
                            ? t('collab.deleting')
                            : t('common.delete')
                        }
                        onPress={() => handleDeleteInvitation(invitation)}
                        style={styles.shortAction}
                        tone="destructive"
                      />
                    </View>
                  </View>
                );
              })}

              {!isLoadingInvitations && !invitations.length ? (
                <InlineBanner message={t('collab.noInvitations')} tone="info" />
              ) : null}
            </View>
          </View>
        )}
      </PlaceholderCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.accentSoftMuted,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  backIcon: {
    height: 16,
    width: 16,
  },
  metaStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.accentDeep,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  list: {
    gap: 10,
  },
  surfaceCard: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  splitHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  stackSm: {
    flex: 1,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtext: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  memberFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  shortAction: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  form: {
    gap: 14,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.backgroundSoft,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexField: {
    flex: 1,
  },
  inviteLink: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
  },
});
