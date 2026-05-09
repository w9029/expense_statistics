import {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {AccountBookSummary} from '@expense-statistics/domain';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import {ActionButton} from '@/components/action-button';
import {AppTextInput, FormField} from '@/components/form-field';
import {InlineBanner} from '@/components/inline-banner';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {SFSymbol} from '@/components/sf-symbol';
import {useAuth} from '@/features/auth/auth-context';
import {useToast} from '@/features/feedback/toast-context';
import {useI18n} from '@/features/i18n/i18n-context';
import {apiClient} from '@/lib/api';
import {getApiErrorMessage} from '@/lib/api-errors';
import {navigationRef} from '@/lib/navigation';
import type {AppTabParamList} from '@/navigation/types';
import {colors} from '@/theme/colors';

type BookForm = {
  name: string;
  base_currency: string;
  description: string;
};

type ValidationErrors = Partial<Record<keyof BookForm, string>>;

const defaultForm: BookForm = {
  name: '',
  base_currency: 'JPY',
  description: '',
};

export function AccountBooksScreen({}: BottomTabScreenProps<AppTabParamList, 'AccountBooks'>) {
  const auth = useAuth();
  const {showToast} = useToast();
  const {t} = useI18n();
  const [accountBooks, setAccountBooks] = useState<AccountBookSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [bookForm, setBookForm] = useState<BookForm>(defaultForm);
  const [formErrors, setFormErrors] = useState<ValidationErrors>({});
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatePanelVisible, setIsCreatePanelVisible] = useState(false);
  const [actionState, setActionState] = useState<{
    kind: 'default' | 'delete' | 'leave';
    bookId: string;
  } | null>(null);
  const [isPerformingAction, setIsPerformingAction] = useState(false);

  const sortedBooks = useMemo(
    () =>
      [...accountBooks].sort((left, right) => {
        if (left.is_default === right.is_default) {
          return 0;
        }
        return left.is_default ? -1 : 1;
      }),
    [accountBooks],
  );

  useEffect(() => {
    setBookForm(current => ({
      ...current,
      base_currency: auth.user?.preferred_currency ?? current.base_currency ?? 'JPY',
    }));
  }, [auth.user?.preferred_currency]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!auth.accessToken) {
        return;
      }

      setIsLoading(true);
      setPageError(null);
      try {
        const items = await apiClient.listAccountBooks(auth.accessToken);
        if (!cancelled) {
          setAccountBooks(items);
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(getApiErrorMessage(error, t('accountBooks.loadFailed')));
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
  }, [auth.accessToken, t]);

  function validateForm() {
    const nextErrors: ValidationErrors = {};
    if (!bookForm.name.trim()) {
      nextErrors.name = t('register.error.name');
    } else if (bookForm.name.trim().length > 100) {
      nextErrors.name = t('register.error.nameLong');
    }
    if (!/^[A-Za-z]{3}$/.test(bookForm.base_currency.trim().toUpperCase())) {
      nextErrors.base_currency = t('register.error.currency');
    }
    if (bookForm.description.length > 400) {
      nextErrors.description = t('common.error.descriptionLong');
    }
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function reloadAccountBooks() {
    if (!auth.accessToken) {
      return;
    }
    const items = await apiClient.listAccountBooks(auth.accessToken);
    setAccountBooks(items);
  }

  async function handleCreateBook() {
    if (!auth.accessToken || isCreating || !validateForm()) {
      return;
    }

    setIsCreating(true);
    setPageError(null);

    try {
      const created = await apiClient.createAccountBook(auth.accessToken, {
        name: bookForm.name.trim(),
        base_currency: bookForm.base_currency.trim().toUpperCase(),
        description: bookForm.description.trim() ? bookForm.description.trim() : null,
      });

      await reloadAccountBooks();
      setBookForm({
        name: '',
        base_currency: auth.user?.preferred_currency ?? created.base_currency,
        description: '',
      });
      setFormErrors({});
      setIsCreatePanelVisible(false);
      if (!auth.user?.default_account_book_id) {
        await auth.replaceUser({
          ...auth.user!,
          default_account_book_id: created.id,
        });
      }
      showToast(t('accountBooks.create.success'), 'success');
      navigationRef.navigate('AccountBookDetail', {accountBookId: created.id});
    } catch (error) {
      setPageError(getApiErrorMessage(error, t('accountBooks.create.failed')));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSetDefault(book: AccountBookSummary) {
    if (!auth.accessToken || isPerformingAction) {
      return;
    }

    setActionState({kind: 'default', bookId: book.id});
    setIsPerformingAction(true);
    setPageError(null);
    try {
      const user = await apiClient.updateDefaultAccountBook(auth.accessToken, {
        default_account_book_id: book.id,
      });
      auth.replaceUser(user);
      setAccountBooks(current =>
        current.map(item => ({
          ...item,
          is_default: item.id === user.default_account_book_id,
        })),
      );
      showToast(t('accountBooks.default.updated'), 'success');
    } catch (error) {
      setPageError(getApiErrorMessage(error, t('accountBooks.default.failed')));
    } finally {
      setIsPerformingAction(false);
      setActionState(null);
    }
  }

  async function handleDeleteBook(book: AccountBookSummary) {
    if (!auth.accessToken || isPerformingAction) {
      return;
    }

    setActionState({kind: 'delete', bookId: book.id});
    setIsPerformingAction(true);
    setPageError(null);
    try {
      await apiClient.deleteAccountBook(auth.accessToken, book.id);
      await reloadAccountBooks();
      const currentUser = auth.user;
      if (currentUser?.default_account_book_id === book.id) {
        await auth.replaceUser({
          ...currentUser,
          default_account_book_id: null,
        });
      }
      showToast(t('accountBooks.delete.success'), 'success');
    } catch (error) {
      setPageError(getApiErrorMessage(error, t('accountBooks.delete.failed')));
    } finally {
      setIsPerformingAction(false);
      setActionState(null);
    }
  }

  async function handleLeaveBook(book: AccountBookSummary) {
    if (!auth.accessToken || isPerformingAction) {
      return;
    }

    setActionState({kind: 'leave', bookId: book.id});
    setIsPerformingAction(true);
    setPageError(null);
    try {
      await apiClient.leaveAccountBook(auth.accessToken, book.id);
      await reloadAccountBooks();
      const currentUser = auth.user;
      if (currentUser?.default_account_book_id === book.id) {
        await auth.replaceUser({
          ...currentUser,
          default_account_book_id: null,
        });
      }
      showToast(t('accountBooks.leave.success'), 'success');
    } catch (error) {
      setPageError(getApiErrorMessage(error, t('accountBooks.leave.failed')));
    } finally {
      setIsPerformingAction(false);
      setActionState(null);
    }
  }

  function confirmDeleteOrLeave(book: AccountBookSummary) {
    Alert.alert(
      book.my_role === 'owner' ? t('accountBooks.delete') : t('accountBooks.leave'),
      book.my_role === 'owner'
        ? t('accountBooks.delete.confirm', {name: book.name})
        : t('accountBooks.leave.confirm', {name: book.name}),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: book.my_role === 'owner' ? t('accountBooks.delete') : t('accountBooks.leave'),
          style: book.my_role === 'owner' ? 'destructive' : 'default',
          onPress: () => {
            void (book.my_role === 'owner'
              ? handleDeleteBook(book)
              : handleLeaveBook(book));
          },
        },
      ],
    );
  }

  return (
    <ScreenShell eyebrow={t('root.module0Done')} title={t('accountBooks.title')} description={t('accountBooks.description')}>
      {isLoading ? (
        <InlineBanner message={t('accountBooks.loading')} tone="info" />
      ) : null}

      {isCreatePanelVisible ? (
        <PlaceholderCard
          description={t('accountBooks.create.description')}
          title={t('accountBooks.create.title')}>
          <View style={styles.form}>
            <FormField error={formErrors.name} label={t('accountBooks.name')}>
              <AppTextInput
                onChangeText={text => {
                  setBookForm(current => ({...current, name: text}));
                  setFormErrors(current => ({...current, name: undefined}));
                }}
                placeholder={t('accountBooks.name')}
                value={bookForm.name}
              />
            </FormField>
            <FormField error={formErrors.base_currency} label={t('accountBooks.baseCurrency')}>
              <AppTextInput
                autoCapitalize="characters"
                maxLength={3}
                onChangeText={text => {
                  setBookForm(current => ({...current, base_currency: text}));
                  setFormErrors(current => ({...current, base_currency: undefined}));
                }}
                placeholder={auth.user?.preferred_currency ?? 'JPY'}
                value={bookForm.base_currency}
              />
            </FormField>
            <FormField error={formErrors.description} label={t('accountBooks.bookDescription')}>
              <AppTextInput
                onChangeText={text => {
                  setBookForm(current => ({...current, description: text}));
                  setFormErrors(current => ({...current, description: undefined}));
                }}
                placeholder={t('common.noDescription')}
                value={bookForm.description}
              />
            </FormField>

            {pageError ? <InlineBanner message={pageError} tone="error" /> : null}

            <View style={styles.formActions}>
              <ActionButton
                disabled={isCreating}
                label={isCreating ? t('accountBooks.create.submitting') : t('accountBooks.create.submit')}
                onPress={() => {
                  void handleCreateBook();
                }}
                style={styles.flexButton}
              />
              <ActionButton
                disabled={isCreating}
                label={t('accountBooks.create.cancel')}
                onPress={() => {
                  setIsCreatePanelVisible(false);
                  setPageError(null);
                  setFormErrors({});
                }}
                style={styles.flexButton}
                tone="secondary"
              />
            </View>
          </View>
        </PlaceholderCard>
      ) : null}

      {sortedBooks.length ? (
        <View style={styles.list}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{t('accountBooks.title')}</Text>
            <ActionButton
              label={t('accountBooks.create.open')}
              onPress={() => {
                setIsCreatePanelVisible(true);
                setPageError(null);
              }}
              style={styles.listHeaderButton}
            />
          </View>
          {sortedBooks.map(book => {
            const isPendingDefault = actionState?.kind === 'default' && actionState.bookId === book.id;
            const isPendingAction =
              actionState?.bookId === book.id &&
              (actionState.kind === 'delete' || actionState.kind === 'leave');

            return (
              <PlaceholderCard
                key={book.id}
                title={book.name}
                headerAccessory={
                  <Pressable
                    accessibilityLabel={
                      book.my_role === 'owner' ? t('accountBooks.delete') : t('accountBooks.leave')
                    }
                    disabled={isPendingAction}
                    onPress={() => confirmDeleteOrLeave(book)}
                    style={({pressed}) => [
                      styles.iconButton,
                      pressed && !isPendingAction ? styles.iconButtonPressed : undefined,
                    ]}>
                    <SFSymbol
                      colorHex={
                        book.my_role === 'owner' ? colors.danger : colors.accentDeep
                      }
                      name={book.my_role === 'owner' ? 'trash' : 'rectangle.portrait.and.arrow.right'}
                      pointSize={16}
                      scale="medium"
                      style={styles.iconSymbol}
                      weight="semibold"
                    />
                  </Pressable>
                }>
                <View style={styles.badges}>
                  <Text style={styles.badge}>{book.my_role}</Text>
                  <Text style={styles.badge}>{book.base_currency}</Text>
                  {book.is_default ? <Text style={styles.defaultBadge}>{t('accountBooks.default.badge')}</Text> : null}
                </View>

                {book.description ? <Text style={styles.bookDescription}>{book.description}</Text> : null}

                <View style={styles.actions}>
                  <ActionButton
                    label={t('accountBooks.open')}
                    onPress={() =>
                      navigationRef.navigate('AccountBookDetail', {
                        accountBookId: book.id,
                      })
                    }
                    style={styles.flexButton}
                  />
                  <ActionButton
                    disabled={book.is_default || isPendingDefault}
                    label={
                      book.is_default
                        ? t('accountBooks.currentDefault')
                        : isPendingDefault
                          ? t('accountBooks.settingDefault')
                          : t('accountBooks.setDefault')
                    }
                    onPress={() => {
                      void handleSetDefault(book);
                    }}
                    style={styles.flexButton}
                    tone="secondary"
                  />
                </View>
              </PlaceholderCard>
            );
          })}
        </View>
      ) : !isLoading ? (
        <PlaceholderCard title={t('accountBooks.title')} description={t('accountBooks.empty')}>
          <View style={styles.listHeader}>
            <ActionButton
              label={t('accountBooks.create.open')}
              onPress={() => {
                setIsCreatePanelVisible(true);
                setPageError(null);
              }}
              style={styles.listHeaderButton}
            />
          </View>
        </PlaceholderCard>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
  },
  list: {
    gap: 14,
  },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  listTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  listHeaderButton: {
    minHeight: 38,
    minWidth: 108,
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  defaultBadge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    color: colors.backgroundSoft,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  bookDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 18,
    marginTop: -2,
  },
  flexButton: {
    flex: 1,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.accentSoftMuted,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  iconButtonPressed: {
    opacity: 0.8,
    transform: [{scale: 0.97}],
  },
  iconButtonText: {
    fontSize: 16,
    lineHeight: 18,
  },
  iconSymbol: {
    height: 16,
    width: 16,
  },
});
