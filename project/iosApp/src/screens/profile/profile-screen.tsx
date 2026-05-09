import {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {AccountBookSummary} from '@expense-statistics/domain';
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
import type {AppLanguage} from '@/features/i18n/messages';

type ProfileForm = {
  name: string;
  preferred_currency: string;
  language: AppLanguage;
  avatar_path: string;
};

type ValidationErrors = Partial<Record<keyof ProfileForm, string>>;

const emptyProfileForm: ProfileForm = {
  name: '',
  preferred_currency: 'JPY',
  language: 'zh-CN',
  avatar_path: '',
};

function normalizeProfileForm(userName?: string | null, preferredCurrency?: string | null, language?: AppLanguage | null, avatarPath?: string | null): ProfileForm {
  return {
    name: userName ?? '',
    preferred_currency: preferredCurrency ?? 'JPY',
    language: language ?? 'zh-CN',
    avatar_path: avatarPath ?? '',
  };
}

export function ProfileScreen() {
  const auth = useAuth();
  const {showToast} = useToast();
  const {language, setLanguage, supportedLanguages, t} = useI18n();
  const [form, setForm] = useState<ProfileForm>(emptyProfileForm);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingDefaultBook, setIsSavingDefaultBook] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [accountBooks, setAccountBooks] = useState<AccountBookSummary[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(false);

  useEffect(() => {
    setForm(
      normalizeProfileForm(
        auth.user?.name,
        auth.user?.preferred_currency,
        auth.user?.language,
        auth.user?.avatar_path,
      ),
    );
  }, [auth.user]);

  const defaultAccountBook = useMemo(() => {
    return accountBooks.find(book => book.id === auth.user?.default_account_book_id) ?? null;
  }, [accountBooks, auth.user?.default_account_book_id]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!auth.accessToken) {
        return;
      }

      setIsLoadingBooks(true);
      setPageError(null);
      try {
        const books = await apiClient.listAccountBooks(auth.accessToken);
        if (!cancelled) {
          setAccountBooks(books);
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(getApiErrorMessage(error, t('profile.defaultBook.loadFailed')));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingBooks(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.accessToken, t]);

  function validateForm() {
    const nextErrors: ValidationErrors = {};
    if (!form.name.trim()) {
      nextErrors.name = t('register.error.name');
    } else if (form.name.trim().length > 100) {
      nextErrors.name = t('register.error.nameLong');
    }
    if (!/^[A-Za-z]{3}$/.test(form.preferred_currency.trim())) {
      nextErrors.preferred_currency = t('register.error.currency');
    }
    if (form.avatar_path.trim().length > 400) {
      nextErrors.avatar_path = t('profile.avatarPathLong');
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSaveProfile() {
    if (!auth.accessToken || isSavingProfile || !validateForm()) {
      return;
    }

    setIsSavingProfile(true);
    setPageError(null);
    try {
      const updatedUser = await apiClient.updateProfile(auth.accessToken, {
        name: form.name.trim(),
        preferred_currency: form.preferred_currency.trim().toUpperCase(),
        language: form.language,
        avatar_path: form.avatar_path.trim() ? form.avatar_path.trim() : null,
      });

      await auth.replaceUser(updatedUser);
      if (updatedUser.language !== language) {
        await setLanguage(updatedUser.language);
      }
      showToast(t('profile.updated'), 'success');
    } catch (error) {
      setPageError(getApiErrorMessage(error, t('profile.updateFailed')));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleSaveDefaultAccountBook(accountBookId: string | null) {
    if (!auth.accessToken || isSavingDefaultBook) {
      return;
    }

    setIsSavingDefaultBook(true);
    setPageError(null);
    try {
      const updatedUser = await apiClient.updateDefaultAccountBook(auth.accessToken, {
        default_account_book_id: accountBookId,
      });
      await auth.replaceUser(updatedUser);
      showToast(t('profile.defaultBook.updated'), 'success');
    } catch (error) {
      setPageError(getApiErrorMessage(error, t('profile.defaultBook.updateFailed')));
    } finally {
      setIsSavingDefaultBook(false);
    }
  }

  return (
    <ScreenShell eyebrow={t('nav.profile')} title={t('profile.title')} description={t('profile.description')}>
      <View style={styles.stack}>
        <PlaceholderCard title={t('profile.editableFields')} description={t('profile.editableFieldsDescription')}>
          <View style={styles.form}>
            <FormField error={errors.name} label={t('profile.name')}>
              <AppTextInput
                onChangeText={text => {
                  setForm(current => ({...current, name: text}));
                  setErrors(current => ({...current, name: undefined}));
                }}
                placeholder={t('register.placeholder.name')}
                value={form.name}
              />
            </FormField>

            <FormField error={errors.preferred_currency} label={t('profile.preferredCurrency')}>
              <AppTextInput
                autoCapitalize="characters"
                maxLength={3}
                onChangeText={text => {
                  setForm(current => ({...current, preferred_currency: text}));
                  setErrors(current => ({...current, preferred_currency: undefined}));
                }}
                placeholder={t('register.placeholder.currency')}
                value={form.preferred_currency}
              />
            </FormField>

            <FormField label={t('profile.language')}>
              <View style={styles.chipRow}>
                {supportedLanguages.map(item => (
                  <Pressable
                    key={item}
                    onPress={() => {
                      setForm(current => ({...current, language: item}));
                    }}
                    style={[styles.chip, form.language === item ? styles.chipActive : undefined]}>
                    <Text style={[styles.chipText, form.language === item ? styles.chipTextActive : undefined]}>
                      {t(`lang.${item}` as const)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </FormField>

            <FormField error={errors.avatar_path} label={t('profile.avatarPath')}>
              <AppTextInput
                onChangeText={text => {
                  setForm(current => ({...current, avatar_path: text}));
                  setErrors(current => ({...current, avatar_path: undefined}));
                }}
                placeholder={t('profile.avatarPathPlaceholder')}
                value={form.avatar_path}
              />
            </FormField>

            {pageError ? <InlineBanner message={pageError} tone="error" /> : null}

            <ActionButton
              disabled={isSavingProfile}
              label={isSavingProfile ? t('profile.saving') : t('profile.save')}
              onPress={() => {
                void handleSaveProfile();
              }}
            />
          </View>
        </PlaceholderCard>

        <PlaceholderCard title={t('profile.defaultBook.title')} description={t('profile.defaultBook.description')}>
          {isLoadingBooks ? <InlineBanner message={t('profile.defaultBook.loading')} tone="info" /> : null}
          {defaultAccountBook ? (
            <InlineBanner
              message={t('profile.defaultBook.current', {name: defaultAccountBook.name})}
              tone="success"
            />
          ) : (
            <InlineBanner message={t('profile.defaultBook.none')} tone="info" />
          )}

          <View style={styles.bookRow}>
            <Pressable
              onPress={() => {
                void handleSaveDefaultAccountBook(null);
              }}
              style={[
                styles.bookChip,
                auth.user?.default_account_book_id === null ? styles.bookChipActive : undefined,
              ]}>
              <Text
                style={[
                  styles.bookChipText,
                  auth.user?.default_account_book_id === null ? styles.bookChipTextActive : undefined,
                ]}>
                {t('profile.defaultBook.none')}
              </Text>
            </Pressable>

            {accountBooks.map(book => (
              <Pressable
                key={book.id}
                onPress={() => {
                  void handleSaveDefaultAccountBook(book.id);
                }}
                style={[
                  styles.bookChip,
                  auth.user?.default_account_book_id === book.id ? styles.bookChipActive : undefined,
                ]}>
                <Text
                  style={[
                    styles.bookChipText,
                    auth.user?.default_account_book_id === book.id ? styles.bookChipTextActive : undefined,
                  ]}>
                  {book.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {isSavingDefaultBook ? <InlineBanner message={t('profile.defaultBook.saving')} tone="info" /> : null}
          {pageError ? <InlineBanner message={pageError} tone="error" /> : null}
        </PlaceholderCard>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  form: {
    gap: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: '#f0e8dc',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: '#17324d',
  },
  chipText: {
    color: '#30465d',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  bookRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 4,
  },
  bookChip: {
    alignItems: 'center',
    backgroundColor: '#efe6d8',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bookChipActive: {
    backgroundColor: '#17324d',
  },
  bookChipText: {
    color: '#17324d',
    fontSize: 13,
    fontWeight: '700',
  },
  bookChipTextActive: {
    color: '#ffffff',
  },
});
