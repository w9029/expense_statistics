import {useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {
  AccountBookDetail,
  ExpenseCategory,
  ExpenseDetail,
} from '@expense-statistics/domain';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {ActionButton} from '@/components/action-button';
import {DateField} from '@/components/date-field';
import {AppTextInput, FormField} from '@/components/form-field';
import {InlineBanner} from '@/components/inline-banner';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {SelectField} from '@/components/select-field';
import {useBookSession} from '@/features/account-books/book-session-context';
import {useAuth} from '@/features/auth/auth-context';
import {useToast} from '@/features/feedback/toast-context';
import {useI18n} from '@/features/i18n/i18n-context';
import {apiClient} from '@/lib/api';
import {getApiErrorMessage} from '@/lib/api-errors';
import type {RootStackParamList} from '@/navigation/types';
import {colors} from '@/theme/colors';

type EditorNavigation = Pick<
  NativeStackNavigationProp<RootStackParamList>,
  'goBack'
>;

type Props = Omit<
  NativeStackScreenProps<RootStackParamList, 'NormalExpenseEditor'>,
  'navigation'
> & {
  embedded?: boolean;
  navigation: EditorNavigation;
};
type SubmitMode = 'back' | 'next';

type NormalExpenseForm = {
  category_id: string;
  name: string;
  description: string;
  original_amount: string;
  original_currency: string;
  spent_at: string;
};

type NormalExpenseFormErrors = Partial<Record<keyof NormalExpenseForm, string>>;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function todayNaturalDate() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildDefaultForm(preferredCurrency?: string | null): NormalExpenseForm {
  return {
    category_id: '',
    name: '',
    description: '',
    original_amount: '',
    original_currency: preferredCurrency ?? 'JPY',
    spent_at: todayNaturalDate(),
  };
}

function buildFormFromExpense(expenseDetail: ExpenseDetail): NormalExpenseForm {
  return {
    category_id: expenseDetail.expense.category_id,
    name: expenseDetail.expense.name,
    description: expenseDetail.expense.description ?? '',
    original_amount: expenseDetail.expense.original_amount,
    original_currency: expenseDetail.expense.original_currency,
    spent_at: expenseDetail.expense.spent_at,
  };
}

export function NormalExpenseEditorScreen({embedded = false, navigation, route}: Props) {
  const {accountBookId, expenseId} = route.params;
  const auth = useAuth();
  const {requestExpenseRefresh, setActiveAccountBookId} = useBookSession();
  const {showToast} = useToast();
  const {t} = useI18n();
  const isEditMode = Boolean(expenseId);
  const submitModeRef = useRef<SubmitMode>('back');
  const [detail, setDetail] = useState<AccountBookDetail | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [form, setForm] = useState<NormalExpenseForm>(() =>
    buildDefaultForm(auth.user?.preferred_currency),
  );
  const [formErrors, setFormErrors] = useState<NormalExpenseFormErrors>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const normalCategories = useMemo(
    () => categories.filter(category => !category.is_merge_category),
    [categories],
  );

  useEffect(() => {
    setActiveAccountBookId(accountBookId);
  }, [accountBookId, setActiveAccountBookId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!auth.accessToken) {
        return;
      }

      setIsLoadingPage(true);
      setPageError(null);
      try {
        const requests: [
          Promise<AccountBookDetail>,
          Promise<ExpenseCategory[]>,
          Promise<ExpenseDetail | null>,
        ] = [
          apiClient.getAccountBook(auth.accessToken, accountBookId),
          apiClient.listExpenseCategories(auth.accessToken, accountBookId),
          expenseId
            ? apiClient.getExpenseDetail(auth.accessToken, accountBookId, expenseId)
            : Promise.resolve(null),
        ];

        const [nextDetail, nextCategories, expenseDetail] = await Promise.all(requests);

        if (cancelled) {
          return;
        }

        setDetail(nextDetail);
        setCategories(nextCategories);
        setForm(
          expenseDetail
            ? buildFormFromExpense(expenseDetail)
            : buildDefaultForm(auth.user?.preferred_currency),
        );
      } catch (error) {
        if (!cancelled) {
          setPageError(
            getApiErrorMessage(
              error,
              isEditMode ? t('normalExpense.loadExpenseFailed') : t('book.loadBookFailed'),
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPage(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountBookId, auth.accessToken, auth.user?.preferred_currency, expenseId, isEditMode, t]);

  useEffect(() => {
    if (!flashMessage) {
      return;
    }

    const timeoutID = setTimeout(() => {
      setFlashMessage(null);
    }, 2400);

    return () => clearTimeout(timeoutID);
  }, [flashMessage]);

  function updateForm<K extends keyof NormalExpenseForm>(key: K, value: NormalExpenseForm[K]) {
    setForm(current => ({
      ...current,
      [key]: value,
    }));
    setFormErrors(current => ({
      ...current,
      [key]: undefined,
    }));
  }

  function validateForm() {
    const nextErrors: NormalExpenseFormErrors = {};
    const amountPattern = /^\d+(\.\d{1,2})?$/;
    const naturalDatePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (!form.category_id) {
      nextErrors.category_id = t('normalExpense.categoryRequired');
    }
    if (!form.name.trim()) {
      nextErrors.name = t('normalExpense.nameRequired');
    } else if (form.name.trim().length > 200) {
      nextErrors.name = t('normalExpense.nameLong');
    }
    if (form.description.trim().length > 400) {
      nextErrors.description = t('common.error.descriptionLong');
    }
    if (!amountPattern.test(form.original_amount.trim())) {
      nextErrors.original_amount = t('normalExpense.amountInvalid');
    }
    if (!/^[A-Za-z]{3}$/.test(form.original_currency.trim())) {
      nextErrors.original_currency = t('normalExpense.currencyInvalid');
    }
    if (!naturalDatePattern.test(form.spent_at.trim())) {
      nextErrors.spent_at = t('normalExpense.dateInvalid');
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function resetForNextExpense() {
    setForm(current => ({
      category_id: current.category_id,
      name: '',
      description: '',
      original_amount: '',
      original_currency: current.original_currency,
      spent_at: current.spent_at || todayNaturalDate(),
    }));
    setFormErrors({});
  }

  async function handleSubmit(mode: SubmitMode) {
    if (!auth.accessToken || isSaving || !validateForm()) {
      return;
    }

    if (!normalCategories.length) {
      setFlashMessage({
        tone: 'error',
        text: t('normalExpense.notesNoCategory'),
      });
      return;
    }

    submitModeRef.current = mode;
    setIsSaving(true);
    setPageError(null);
    setFlashMessage(null);

    try {
      const payload = {
        category_id: form.category_id,
        name: form.name.trim(),
        description: form.description.trim() ? form.description.trim() : null,
        original_amount: form.original_amount.trim(),
        original_currency: form.original_currency.trim().toUpperCase(),
        spent_at: form.spent_at.trim(),
      };

      if (isEditMode && expenseId) {
        await apiClient.updateNormalExpense(auth.accessToken, accountBookId, expenseId, payload);
        requestExpenseRefresh();
        showToast(t('normalExpense.updated'), 'success');
        navigation.goBack();
        return;
      }

      await apiClient.createNormalExpense(auth.accessToken, accountBookId, payload);
      requestExpenseRefresh();

      if (submitModeRef.current === 'next') {
        resetForNextExpense();
        setFlashMessage({
          tone: 'success',
          text: t('normalExpense.createdNext'),
        });
      } else {
        showToast(t('normalExpense.created'), 'success');
        navigation.goBack();
      }
    } catch (error) {
      const text = getApiErrorMessage(
        error,
        isEditMode ? t('normalExpense.updateFailed') : t('normalExpense.createFailed'),
      );
      setFlashMessage({tone: 'error', text});
      showToast(text, 'error');
    } finally {
      setIsSaving(false);
    }
  }

  const content = (
    <>
      {flashMessage ? <InlineBanner message={flashMessage.text} tone={flashMessage.tone} /> : null}
      {pageError ? <InlineBanner message={pageError} tone="error" /> : null}
      {isLoadingPage ? <InlineBanner message={t('book.loadingBook')} tone="info" /> : null}

      <PlaceholderCard
        title={t('normalExpense.formTitle')}
        description={
          isEditMode
            ? t('normalExpense.formDescriptionEdit')
            : t('normalExpense.formDescriptionCreate')
        }>
        <View style={styles.helperRow}>
          <Text style={styles.helperBadge}>
            {t('normalExpense.base', {value: detail?.base_currency ?? '...'})}
          </Text>
          <Text style={styles.helperBadge}>
            {t('normalExpense.categories', {value: normalCategories.length})}
          </Text>
          {isEditMode ? <Text style={styles.helperBadge}>{t('normalExpense.editing')}</Text> : null}
        </View>

        <View style={styles.form}>
          <FormField
            error={formErrors.category_id}
            errorTextStyle={styles.alertErrorText}
            label={t('normalExpense.category')}>
            {normalCategories.length ? (
              <SelectField
                onSelect={value => updateForm('category_id', value)}
                options={normalCategories.map(category => ({
                  color: category.color,
                  label: category.name,
                  value: category.id,
                }))}
                placeholder={t('normalExpense.chooseCategory')}
                value={form.category_id}
              />
            ) : (
              <InlineBanner message={t('normalExpense.notesNoCategory')} tone="error" />
            )}
          </FormField>

          <FormField
            error={formErrors.name}
            errorTextStyle={styles.alertErrorText}
            label={t('normalExpense.name')}>
            <AppTextInput
              onChangeText={text => updateForm('name', text)}
              value={form.name}
            />
          </FormField>

          <View style={styles.inlineRow}>
            <View style={styles.flexField}>
              <FormField
                error={formErrors.original_amount}
                errorTextStyle={styles.alertErrorText}
                label={t('normalExpense.amount')}>
                <AppTextInput
                  keyboardType="decimal-pad"
                  onChangeText={text => updateForm('original_amount', text)}
                  value={form.original_amount}
                />
              </FormField>
            </View>
            <View style={styles.currencyField}>
              <FormField
                error={formErrors.original_currency}
                errorTextStyle={styles.alertErrorText}
                label={t('normalExpense.currency')}>
                <AppTextInput
                  autoCapitalize="characters"
                  maxLength={3}
                  onChangeText={text => updateForm('original_currency', text.toUpperCase())}
                  value={form.original_currency}
                />
              </FormField>
            </View>
          </View>

          <FormField
            error={formErrors.spent_at}
            errorTextStyle={styles.alertErrorText}
            label={t('normalExpense.spentAt')}>
            <DateField
              onDateChange={event => updateForm('spent_at', event.nativeEvent.value)}
              placeholder="2026-05-10"
              style={styles.dateField}
              value={form.spent_at}
            />
          </FormField>

          <FormField
            error={formErrors.description}
            errorTextStyle={styles.alertErrorText}
            label={t('normalExpense.description')}>
            <AppTextInput
              multiline
              onChangeText={text => updateForm('description', text)}
              style={styles.multilineInput}
              textAlignVertical="top"
              value={form.description}
            />
          </FormField>

          <View style={styles.actions}>
            <ActionButton
              label={t('common.cancel')}
              onPress={() => navigation.goBack()}
              tone="secondary"
            />
            {!isEditMode ? (
              <ActionButton
                disabled={isSaving || !normalCategories.length}
                label={
                  isSaving && submitModeRef.current === 'next'
                    ? t('normalExpense.creating')
                    : t('normalExpense.createAndNext')
                }
                onPress={() => {
                  void handleSubmit('next');
                }}
                tone="secondary"
              />
            ) : null}
            <ActionButton
              disabled={isSaving || !normalCategories.length}
              label={
                isSaving
                  ? isEditMode
                    ? t('normalExpense.saving')
                    : t('normalExpense.creating')
                  : isEditMode
                    ? t('normalExpense.save')
                    : t('normalExpense.create')
              }
              onPress={() => {
                void handleSubmit('back');
              }}
            />
          </View>
        </View>
      </PlaceholderCard>

      <PlaceholderCard title={t('normalExpense.notesTitle')}>
        <View style={styles.notes}>
          <InlineBanner message={t('normalExpense.notesDate')} tone="info" />
          <InlineBanner
            message={t('normalExpense.notesCategories', {value: normalCategories.length})}
            tone="info"
          />
          {!normalCategories.length ? (
            <InlineBanner message={t('normalExpense.notesNoCategory')} tone="error" />
          ) : null}
        </View>
      </PlaceholderCard>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <ScreenShell
      title={isEditMode ? t('normalExpense.titleEdit') : t('normalExpense.titleCreate')}
      description={t(
        isEditMode ? 'normalExpense.subtitleEdit' : 'normalExpense.subtitleCreate',
        {book: detail?.name ?? t('book.titleFallback')},
      )}>
      {content}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  helperRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  helperBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  form: {
    gap: 14,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexField: {
    flex: 1,
  },
  currencyField: {
    width: 112,
  },
  dateField: {
    minHeight: 52,
  },
  multilineInput: {
    minHeight: 108,
    paddingTop: 14,
  },
  actions: {
    gap: 10,
  },
  notes: {
    gap: 10,
  },
  alertErrorText: {
    color: '#D60000',
  },
});
