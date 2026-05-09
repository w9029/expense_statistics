import {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import type {InvitationDetail} from '@expense-statistics/domain';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ActionButton} from '@/components/action-button';
import {AppTextInput, FormField} from '@/components/form-field';
import {InlineBanner} from '@/components/inline-banner';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {useAuth} from '@/features/auth/auth-context';
import {useToast} from '@/features/feedback/toast-context';
import {normalizeInvitationToken} from '@/features/invitation/token';
import {useI18n} from '@/features/i18n/i18n-context';
import {apiClient} from '@/lib/api';
import {getApiErrorMessage} from '@/lib/api-errors';
import {navigationRef} from '@/lib/navigation';
import type {RootStackParamList} from '@/navigation/types';
import {colors} from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Invitation'>;

export function InvitationScreen({navigation, route}: Props) {
  const auth = useAuth();
  const {showToast} = useToast();
  const {t} = useI18n();
  const [tokenInput, setTokenInput] = useState(route.params?.token ?? '');
  const [invitation, setInvitation] = useState<InvitationDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  const token = useMemo(() => normalizeInvitationToken(tokenInput), [tokenInput]);

  useEffect(() => {
    if (!route.params?.token) {
      return;
    }

    setTokenInput(route.params.token);
  }, [route.params?.token]);

  useEffect(() => {
    if (!token) {
      setInvitation(null);
      setLoadError(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const detail = await apiClient.getInvitationByToken(token);
        if (!cancelled) {
          setInvitation(detail);
        }
      } catch (error) {
        if (!cancelled) {
          setInvitation(null);
          setLoadError(getApiErrorMessage(error, t('invite.loadFailed')));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t, token]);

  async function handleAccept() {
    if (!token || !auth.accessToken || !invitation?.acceptable || isAccepting) {
      return;
    }

    setIsAccepting(true);
    setAcceptError(null);
    try {
      const result = await apiClient.acceptInvitation(auth.accessToken, token);
      const currentUser = auth.user;
      if (currentUser && currentUser.default_account_book_id === null) {
        await auth.replaceUser({
          ...currentUser,
          default_account_book_id: result.account_book_id,
        });
      }
      showToast(t('invite.accepted'), 'success');
      navigation.replace('AppTabs');
      requestAnimationFrame(() => {
        if (!navigationRef.isReady()) {
          return;
        }
        navigationRef.navigate('AppTabs', {
          screen: 'ExpensesTab',
          params: {accountBookId: result.account_book_id},
        });
      });
    } catch (error) {
      const message = getApiErrorMessage(error, t('invite.acceptFailed'));
      setAcceptError(message);
      showToast(message, 'error');
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <ScreenShell title={t('invite.title')} description={t('invite.description')}>
      <PlaceholderCard
        description={t('invite.tokenHint')}
        title={t('invite.tokenTitle')}>
        <View style={styles.stack}>
          <FormField label={t('invite.tokenLabel')}>
            <AppTextInput
              autoCapitalize="none"
              onChangeText={setTokenInput}
              placeholder={t('invite.tokenPlaceholder')}
              value={tokenInput}
            />
          </FormField>
        </View>
      </PlaceholderCard>

      <PlaceholderCard title={t('invite.title')}>
        <View style={styles.stack}>
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>{t('invite.loading')}</Text>
            </View>
          ) : null}

          {loadError ? <InlineBanner message={loadError} tone="error" /> : null}

          {invitation ? (
            <>
              <View style={styles.badges}>
                <Text style={styles.badge}>{invitation.account_role}</Text>
                <Text style={styles.badge}>{invitation.status}</Text>
                <Text style={styles.badge}>
                  {invitation.used_count}/{invitation.max_usage}
                </Text>
              </View>

              <Text style={styles.bookName}>{invitation.account_book_name}</Text>
              <Text style={styles.note}>
                {t('invite.invitedBy', {name: invitation.inviter_name})}
              </Text>
              <Text style={styles.note}>
                {t('invite.expiresAt', {value: invitation.expires_at})}
              </Text>

              {!invitation.acceptable ? (
                <InlineBanner message={t('invite.notAcceptable')} tone="info" />
              ) : null}

              {acceptError ? <InlineBanner message={acceptError} tone="error" /> : null}

              {auth.isAuthenticated ? (
                <View style={styles.actions}>
                  <ActionButton
                    disabled={isAccepting || !invitation.acceptable}
                    label={isAccepting ? t('invite.accepting') : t('invite.accept')}
                    onPress={() => {
                      void handleAccept();
                    }}
                    style={styles.flexButton}
                  />
                  <ActionButton
                    label={t('invite.openApp')}
                    onPress={() => navigation.navigate('AppTabs')}
                    style={styles.flexButton}
                    tone="secondary"
                  />
                </View>
              ) : (
                <View style={styles.actions}>
                  <ActionButton
                    label={t('invite.signIn')}
                    onPress={() => {
                      navigationRef.navigate('Public', {
                        screen: 'Login',
                        params: {redirect: {type: 'invitation', token}},
                      });
                    }}
                    style={styles.flexButton}
                  />
                  <ActionButton
                    label={t('invite.createAccount')}
                    onPress={() => {
                      navigationRef.navigate('Public', {
                        screen: 'Register',
                        params: {redirect: {type: 'invitation', token}},
                      });
                    }}
                    style={styles.flexButton}
                    tone="secondary"
                  />
                </View>
              )}
            </>
          ) : null}
        </View>
      </PlaceholderCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  loadingText: {
    color: '#44515e',
    fontSize: 15,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bookName: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  note: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  flexButton: {
    flex: 1,
  },
});
