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
import {useAuth} from '@/features/auth/auth-context';
import {useToast} from '@/features/feedback/toast-context';
import {useI18n} from '@/features/i18n/i18n-context';
import {apiClient} from '@/lib/api';
import {getApiErrorMessage} from '@/lib/api-errors';
import {navigationRef} from '@/lib/navigation';
import type {AppTabParamList} from '@/navigation/types';

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

          <ActionButton
            disabled={isCreating}
            label={isCreating ? t('accountBooks.create.submitting') : t('accountBooks.create.submit')}
            onPress={() => {
              void handleCreateBook();
            }}
          />
        </View>
      </PlaceholderCard>

      {isLoading ? (
        <InlineBanner message={t('accountBooks.loading')} tone="info" />
      ) : null}

      {sortedBooks.length ? (
        <View style={styles.list}>
          {sortedBooks.map(book => {
            const isPendingDefault = actionState?.kind === 'default' && actionState.bookId === book.id;
            const isPendingAction =
              actionState?.bookId === book.id &&
              (actionState.kind === 'delete' || actionState.kind === 'leave');

            return (
              <PlaceholderCard
                key={book.id}
                description={book.description ?? t('common.noDescription')}
                title={book.name}>
                <View style={styles.badges}>
                  <Text style={styles.badge}>{book.my_role}</Text>
                  <Text style={styles.badge}>{book.base_currency}</Text>
                  {book.is_default ? <Text style={styles.defaultBadge}>{t('accountBooks.default.badge')}</Text> : null}
                </View>

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

                <View style={styles.inlineLinks}>
                  <Pressable
                    onPress={() => confirmDeleteOrLeave(book)}
                    disabled={isPendingAction}>
                    <Text
                      style={[
                        styles.link,
                        book.my_role === 'owner' ? styles.destructiveLink : undefined,
                      ]}>
                      {isPendingAction
                        ? book.my_role === 'owner'
                          ? t('accountBooks.deleting')
                          : t('accountBooks.leaving')
                        : book.my_role === 'owner'
                          ? t('accountBooks.delete')
                          : t('accountBooks.leave')}
                    </Text>
                  </Pressable>
                </View>
              </PlaceholderCard>
            );
          })}
        </View>
      ) : !isLoading ? (
        <InlineBanner message={t('accountBooks.empty')} tone="info" />
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  list: {
    gap: 14,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: '#efe6d8',
    borderRadius: 999,
    color: '#17324d',
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  defaultBadge: {
    backgroundColor: '#17324d',
    borderRadius: 999,
    color: '#ffffff',
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
  flexButton: {
    flex: 1,
  },
  inlineLinks: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  link: {
    color: '#17324d',
    fontSize: 13,
    fontWeight: '700',
  },
  destructiveLink: {
    color: '#8a2e24',
  },
});
