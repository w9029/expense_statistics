import {useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
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
import {formatMoney} from '@/lib/ledger';
import type {RootStackParamList} from '@/navigation/types';
import {colors} from '@/theme/colors';

type EditorNavigation = Pick<
  NativeStackNavigationProp<RootStackParamList>,
  'goBack'
>;

type Props = Omit<
  NativeStackScreenProps<RootStackParamList, 'MergedExpenseEditor'>,
  'navigation'
> & {
  navigation: EditorNavigation;
};
type EmbeddedProps = Props & {
  embedded?: boolean;
};
type SubmitMode = 'back' | 'next';
type AmountInputMode = 'pretax' | 'posttax';

type MergedExpenseChildForm = {
  id: string;
  category_id: string;
  name: string;
  description: string;
  amount_input: string;
};

type MergedExpenseForm = {
  parent: {
    category_id: string;
    name: string;
    description: string;
    total_original_amount: string;
    original_currency: string;
    spent_at: string;
  };
  children_amount_input_mode: AmountInputMode;
  children: MergedExpenseChildForm[];
};

type ParentField =
  | 'category_id'
  | 'name'
  | 'description'
  | 'total_original_amount'
  | 'original_currency'
  | 'spent_at';

type ParentFormErrors = Partial<Record<ParentField, string>>;
type ChildFormErrors = Partial<
  Record<'category_id' | 'name' | 'description' | 'amount_input', string>
>;
type MergedExpenseFormErrors = {
  parent: ParentFormErrors;
  children: ChildFormErrors[];
  childrenRoot?: string;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function todayNaturalDate() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function createChild(): MergedExpenseChildForm {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category_id: '',
    name: '',
    description: '',
    amount_input: '',
  };
}

function buildDefaultForm(preferredCurrency?: string | null): MergedExpenseForm {
  return {
    parent: {
      category_id: '',
      name: '',
      description: '',
      total_original_amount: '',
      original_currency: preferredCurrency ?? 'JPY',
      spent_at: todayNaturalDate(),
    },
    children_amount_input_mode: 'pretax',
    children: [createChild()],
  };
}

function buildFormFromExpense(expenseDetail: ExpenseDetail): MergedExpenseForm {
  return {
    parent: {
      category_id: expenseDetail.expense.category_id,
      name: expenseDetail.expense.name,
      description: expenseDetail.expense.description ?? '',
      total_original_amount: expenseDetail.expense.original_amount,
      original_currency: expenseDetail.expense.original_currency,
      spent_at: expenseDetail.expense.spent_at,
    },
    children_amount_input_mode: 'posttax',
    children:
      expenseDetail.children?.map(child => ({
        id: child.id,
        category_id: child.category_id,
        name: child.name,
        description: child.description ?? '',
        amount_input: child.original_amount,
      })) ?? [createChild()],
  };
}

function parseDecimalInput(value: string) {
  const numeric = Number(value.trim());
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatPercentage(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return '--';
  }
  return `${value.toFixed(2)}%`;
}

function buildEmptyErrors(childrenCount: number): MergedExpenseFormErrors {
  return {
    parent: {},
    children: Array.from({length: childrenCount}, () => ({})),
  };
}

export function MergedExpenseEditorScreen({
  embedded = false,
  navigation,
  route,
}: EmbeddedProps) {
  const {accountBookId, expenseId} = route.params;
  const auth = useAuth();
  const {requestExpenseRefresh, setActiveAccountBookId} = useBookSession();
  const {showToast} = useToast();
  const {t} = useI18n();
  const isEditMode = Boolean(expenseId);
  const submitModeRef = useRef<SubmitMode>('back');
  const [detail, setDetail] = useState<AccountBookDetail | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [form, setForm] = useState<MergedExpenseForm>(() =>
    buildDefaultForm(auth.user?.preferred_currency),
  );
  const [formErrors, setFormErrors] = useState<MergedExpenseFormErrors>(() =>
    buildEmptyErrors(1),
  );
  const [pageError, setPageError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const mergeCategories = useMemo(
    () => categories.filter(category => category.is_merge_category),
    [categories],
  );
  const normalCategories = useMemo(
    () => categories.filter(category => !category.is_merge_category),
    [categories],
  );

  const parentTotal = parseDecimalInput(form.parent.total_original_amount);
  const childTotal = form.children.reduce(
    (sum, child) => sum + parseDecimalInput(child.amount_input),
    0,
  );
  const postTaxDifference = Number((parentTotal - childTotal).toFixed(2));
  const expectedTaxRate =
    childTotal > 0
      ? Number((((parentTotal - childTotal) / childTotal) * 100).toFixed(2))
      : null;

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
        const nextForm = expenseDetail
          ? buildFormFromExpense(expenseDetail)
          : buildDefaultForm(auth.user?.preferred_currency);
        setForm(nextForm);
        setFormErrors(buildEmptyErrors(nextForm.children.length));
      } catch (error) {
        if (!cancelled) {
          setPageError(
            getApiErrorMessage(
              error,
              isEditMode ? t('mergedExpense.loadExpenseFailed') : t('book.loadBookFailed'),
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
    setFormErrors(current => {
      if (current.children.length === form.children.length) {
        return current;
      }
      return {
        ...current,
        children: Array.from({length: form.children.length}, (_, index) => current.children[index] ?? {}),
      };
    });
  }, [form.children.length]);

  useEffect(() => {
    if (!flashMessage) {
      return;
    }

    const timeoutID = setTimeout(() => {
      setFlashMessage(null);
    }, 2400);

    return () => clearTimeout(timeoutID);
  }, [flashMessage]);

  function updateParentField<K extends ParentField>(
    key: K,
    value: MergedExpenseForm['parent'][K],
  ) {
    setForm(current => ({
      ...current,
      parent: {
        ...current.parent,
        [key]: value,
      },
    }));
    setFormErrors(current => ({
      ...current,
      parent: {
        ...current.parent,
        [key]: undefined,
      },
    }));
  }

  function updateChildField(
    index: number,
    key: keyof MergedExpenseChildForm,
    value: string,
  ) {
    setForm(current => ({
      ...current,
      children: current.children.map((child, childIndex) =>
        childIndex === index ? {...child, [key]: value} : child,
      ),
    }));
    setFormErrors(current => ({
      ...current,
      children: current.children.map((childErrors, childIndex) =>
        childIndex === index ? {...childErrors, [key]: undefined} : childErrors,
      ),
      childrenRoot: undefined,
    }));
  }

  function updateAmountMode(mode: AmountInputMode) {
    setForm(current => ({
      ...current,
      children_amount_input_mode: mode,
    }));
  }

  function addChild() {
    setForm(current => ({
      ...current,
      children: [...current.children, createChild()],
    }));
    setFormErrors(current => ({
      ...current,
      children: [...current.children, {}],
      childrenRoot: undefined,
    }));
  }

  function removeChild(index: number) {
    if (form.children.length === 1) {
      return;
    }
    setForm(current => ({
      ...current,
      children: current.children.filter((_, childIndex) => childIndex !== index),
    }));
    setFormErrors(current => ({
      ...current,
      children: current.children.filter((_, childIndex) => childIndex !== index),
    }));
  }

  function validateForm() {
    const amountPattern = /^\d+(\.\d{1,2})?$/;
    const naturalDatePattern = /^\d{4}-\d{2}-\d{2}$/;
    const nextErrors = buildEmptyErrors(form.children.length);

    if (!form.parent.category_id) {
      nextErrors.parent.category_id = t('mergedExpense.parentCategoryRequired');
    }
    if (!form.parent.name.trim()) {
      nextErrors.parent.name = t('mergedExpense.parentNameRequired');
    } else if (form.parent.name.trim().length > 200) {
      nextErrors.parent.name = t('mergedExpense.nameLong');
    }
    if (form.parent.description.trim().length > 400) {
      nextErrors.parent.description = t('common.error.descriptionLong');
    }
    if (!amountPattern.test(form.parent.total_original_amount.trim())) {
      nextErrors.parent.total_original_amount = t('mergedExpense.amountInvalid');
    }
    if (!/^[A-Za-z]{3}$/.test(form.parent.original_currency.trim())) {
      nextErrors.parent.original_currency = t('mergedExpense.currencyInvalid');
    }
    if (!naturalDatePattern.test(form.parent.spent_at.trim())) {
      nextErrors.parent.spent_at = t('mergedExpense.dateInvalid');
    }

    if (!form.children.length) {
      nextErrors.childrenRoot = t('mergedExpense.childrenRequired');
    }

    form.children.forEach((child, index) => {
      if (!child.category_id) {
        nextErrors.children[index].category_id = t('mergedExpense.childCategoryRequired');
      }
      if (!child.name.trim()) {
        nextErrors.children[index].name = t('mergedExpense.childNameRequired');
      } else if (child.name.trim().length > 200) {
        nextErrors.children[index].name = t('mergedExpense.nameLong');
      }
      if (child.description.trim().length > 400) {
        nextErrors.children[index].description = t('common.error.descriptionLong');
      }
      if (!amountPattern.test(child.amount_input.trim())) {
        nextErrors.children[index].amount_input = t('mergedExpense.childAmountInvalid');
      }
    });

    setFormErrors(nextErrors);
    const hasParentErrors = Object.keys(nextErrors.parent).length > 0;
    const hasChildErrors = nextErrors.children.some(errors => Object.keys(errors).length > 0);
    return !hasParentErrors && !hasChildErrors && !nextErrors.childrenRoot;
  }

  function resetForNextExpense() {
    setForm(current => ({
      parent: {
        category_id: current.parent.category_id,
        name: '',
        description: '',
        total_original_amount: '',
        original_currency: current.parent.original_currency,
        spent_at: current.parent.spent_at || todayNaturalDate(),
      },
      children_amount_input_mode: current.children_amount_input_mode,
      children: [createChild()],
    }));
    setFormErrors(buildEmptyErrors(1));
  }

  async function handleSubmit(mode: SubmitMode) {
    if (!auth.accessToken || isSaving || !validateForm()) {
      return;
    }

    if (!mergeCategories.length || !normalCategories.length) {
      setFlashMessage({
        tone: 'error',
        text: t('mergedExpense.missingCategories'),
      });
      return;
    }

    submitModeRef.current = mode;
    setIsSaving(true);
    setPageError(null);
    setFlashMessage(null);

    try {
      const payload = {
        parent: {
          category_id: form.parent.category_id,
          name: form.parent.name.trim(),
          description: form.parent.description.trim() ? form.parent.description.trim() : null,
          total_original_amount: form.parent.total_original_amount.trim(),
          original_currency: form.parent.original_currency.trim().toUpperCase(),
          spent_at: form.parent.spent_at.trim(),
        },
        children_amount_input_mode: form.children_amount_input_mode,
        children: form.children.map(child => ({
          category_id: child.category_id,
          name: child.name.trim(),
          description: child.description.trim() ? child.description.trim() : null,
          amount_input: child.amount_input.trim(),
        })),
      };

      if (isEditMode && expenseId) {
        await apiClient.updateMergedExpense(auth.accessToken, accountBookId, expenseId, payload);
        requestExpenseRefresh();
        showToast(t('mergedExpense.updated'), 'success');
        navigation.goBack();
        return;
      }

      await apiClient.createMergedExpense(auth.accessToken, accountBookId, payload);
      requestExpenseRefresh();

      if (submitModeRef.current === 'next') {
        resetForNextExpense();
        setFlashMessage({
          tone: 'success',
          text: t('mergedExpense.createdNext'),
        });
      } else {
        showToast(t('mergedExpense.created'), 'success');
        navigation.goBack();
      }
    } catch (error) {
      const text = getApiErrorMessage(
        error,
        isEditMode ? t('mergedExpense.updateFailed') : t('mergedExpense.createFailed'),
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
        title={t('mergedExpense.formTitle')}
        description={
          isEditMode
            ? t('mergedExpense.formDescriptionEdit')
            : t('mergedExpense.formDescriptionCreate')
        }>
        <View style={styles.helperRow}>
          <Text style={styles.helperBadge}>
            {t('mergedExpense.mergeLabel')} {mergeCategories.length}
          </Text>
          <Text style={styles.helperBadge}>
            {t('mergedExpense.normalLabel')} {normalCategories.length}
          </Text>
          <Text style={styles.helperBadge}>
            {t('mergedExpense.baseLabel')} {detail?.base_currency ?? '...'}
          </Text>
          {isEditMode ? <Text style={styles.helperBadge}>{t('mergedExpense.editing')}</Text> : null}
        </View>

        <View style={styles.form}>
          <FormField
            error={formErrors.parent.category_id}
            errorTextStyle={styles.alertErrorText}
            label={t('mergedExpense.mergeCategory')}>
            {mergeCategories.length ? (
              <SelectField
                onSelect={value => updateParentField('category_id', value)}
                options={mergeCategories.map(category => ({
                  color: category.color,
                  label: category.name,
                  value: category.id,
                }))}
                placeholder={t('mergedExpense.mergeCategory')}
                value={form.parent.category_id}
              />
            ) : (
              <InlineBanner message={t('mergedExpense.missingCategories')} tone="error" />
            )}
          </FormField>

          <FormField
            error={formErrors.parent.name}
            errorTextStyle={styles.alertErrorText}
            label={t('mergedExpense.parentName')}>
            <AppTextInput
              onChangeText={text => updateParentField('name', text)}
              value={form.parent.name}
            />
          </FormField>

          <View style={styles.inlineRow}>
            <View style={styles.flexField}>
              <FormField
                error={formErrors.parent.total_original_amount}
                errorTextStyle={styles.alertErrorText}
                label={t('mergedExpense.total')}>
                <AppTextInput
                  keyboardType="decimal-pad"
                  onChangeText={text => updateParentField('total_original_amount', text)}
                  value={form.parent.total_original_amount}
                />
              </FormField>
            </View>
            <View style={styles.currencyField}>
              <FormField
                error={formErrors.parent.original_currency}
                errorTextStyle={styles.alertErrorText}
                label={t('mergedExpense.currency')}>
                <AppTextInput
                  autoCapitalize="characters"
                  maxLength={3}
                  onChangeText={text =>
                    updateParentField('original_currency', text.toUpperCase())
                  }
                  value={form.parent.original_currency}
                />
              </FormField>
            </View>
          </View>

          <View style={styles.inlineRow}>
            <View style={styles.flexField}>
              <FormField
                error={formErrors.parent.spent_at}
                errorTextStyle={styles.alertErrorText}
                label={t('mergedExpense.spentAt')}>
                <DateField
                  onDateChange={event =>
                    updateParentField('spent_at', event.nativeEvent.value)
                  }
                  placeholder="2026-05-10"
                  style={styles.dateField}
                  value={form.parent.spent_at}
                />
              </FormField>
            </View>
            <View style={styles.flexField}>
              <FormField label={t('mergedExpense.mode')}>
                <View style={styles.modeRow}>
                  <Pressable
                    onPress={() => updateAmountMode('pretax')}
                    style={[
                      styles.modeChip,
                      form.children_amount_input_mode === 'pretax'
                        ? styles.modeChipActive
                        : undefined,
                    ]}>
                    <Text
                      style={[
                        styles.modeChipText,
                        form.children_amount_input_mode === 'pretax'
                          ? styles.modeChipTextActive
                          : undefined,
                      ]}>
                      {t('mergedExpense.pretax')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => updateAmountMode('posttax')}
                    style={[
                      styles.modeChip,
                      form.children_amount_input_mode === 'posttax'
                        ? styles.modeChipActive
                        : undefined,
                    ]}>
                    <Text
                      style={[
                        styles.modeChipText,
                        form.children_amount_input_mode === 'posttax'
                          ? styles.modeChipTextActive
                          : undefined,
                      ]}>
                      {t('mergedExpense.posttax')}
                    </Text>
                  </Pressable>
                </View>
              </FormField>
            </View>
          </View>

          <FormField
            error={formErrors.parent.description}
            errorTextStyle={styles.alertErrorText}
            label={t('mergedExpense.description')}>
            <AppTextInput
              multiline
              onChangeText={text => updateParentField('description', text)}
              style={styles.multilineInput}
              textAlignVertical="top"
              value={form.parent.description}
            />
          </FormField>
        </View>
      </PlaceholderCard>

      <PlaceholderCard
        headerAccessory={
          <ActionButton
            label={t('mergedExpense.addChild')}
            onPress={addChild}
            style={styles.addChildButton}
            tone="secondary"
          />
        }
        title={t('mergedExpense.childItems')}
        description={t('mergedExpense.childItemsDescription')}>
        <View style={styles.childList}>
          {formErrors.childrenRoot ? (
            <InlineBanner message={formErrors.childrenRoot} tone="error" />
          ) : null}

          {form.children.map((child, index) => (
            <View key={child.id} style={styles.childCard}>
              <View style={styles.childHeader}>
                <Text style={styles.childTitle}>
                  {t('mergedExpense.childLabel', {index: index + 1})}
                </Text>
                <ActionButton
                  disabled={form.children.length === 1}
                  label={t('mergedExpense.remove')}
                  onPress={() => removeChild(index)}
                  style={styles.removeButton}
                  tone="destructive"
                />
              </View>

              <FormField
                error={formErrors.children[index]?.category_id}
                errorTextStyle={styles.alertErrorText}
                label={t('mergedExpense.category')}>
                {normalCategories.length ? (
                  <SelectField
                    onSelect={value => updateChildField(index, 'category_id', value)}
                    options={normalCategories.map(category => ({
                      color: category.color,
                      label: category.name,
                      value: category.id,
                    }))}
                    placeholder={t('mergedExpense.category')}
                    value={child.category_id}
                  />
                ) : (
                  <InlineBanner message={t('mergedExpense.missingCategories')} tone="error" />
                )}
              </FormField>

              <View style={styles.inlineRow}>
                <View style={styles.flexField}>
                  <FormField
                    error={formErrors.children[index]?.name}
                    errorTextStyle={styles.alertErrorText}
                    label={t('mergedExpense.name')}>
                    <AppTextInput
                      onChangeText={text => updateChildField(index, 'name', text)}
                      value={child.name}
                    />
                  </FormField>
                </View>
                <View style={styles.currencyField}>
                  <FormField
                    error={formErrors.children[index]?.amount_input}
                    errorTextStyle={styles.alertErrorText}
                    label={
                      form.children_amount_input_mode === 'pretax'
                        ? t('mergedExpense.pretax')
                        : t('mergedExpense.posttax')
                    }>
                    <AppTextInput
                      keyboardType="decimal-pad"
                      onChangeText={text => updateChildField(index, 'amount_input', text)}
                      value={child.amount_input}
                    />
                  </FormField>
                </View>
              </View>

              <FormField
                error={formErrors.children[index]?.description}
                errorTextStyle={styles.alertErrorText}
                label={t('mergedExpense.description')}>
                <AppTextInput
                  multiline
                  onChangeText={text => updateChildField(index, 'description', text)}
                  style={styles.childDescriptionInput}
                  textAlignVertical="top"
                  value={child.description}
                />
              </FormField>
            </View>
          ))}
        </View>
      </PlaceholderCard>

      <PlaceholderCard title={t('mergedExpense.previewTitle')}>
        <View style={styles.previewGrid}>
          <View style={styles.previewMetric}>
            <Text style={styles.previewLabel}>{t('mergedExpense.parentTotal')}</Text>
            <Text style={styles.previewValue}>
              {formatMoney(
                form.parent.total_original_amount || '0',
                form.parent.original_currency || detail?.base_currency || 'JPY',
              )}
            </Text>
          </View>
          <View style={styles.previewMetric}>
            <Text style={styles.previewLabel}>{t('mergedExpense.childrenSum')}</Text>
            <Text style={styles.previewValue}>
              {formatMoney(
                childTotal.toFixed(2),
                form.parent.original_currency || detail?.base_currency || 'JPY',
              )}
            </Text>
          </View>
          <View style={styles.previewMetric}>
            <Text style={styles.previewLabel}>{t('mergedExpense.expectedTaxRate')}</Text>
            <Text
              style={[
                styles.previewValue,
                expectedTaxRate !== null &&
                expectedTaxRate >= 0 &&
                expectedTaxRate <= 15
                  ? styles.previewValueSuccess
                  : expectedTaxRate !== null
                    ? styles.previewValueDanger
                    : undefined,
              ]}>
              {formatPercentage(expectedTaxRate)}
            </Text>
          </View>
        </View>

        {form.children_amount_input_mode === 'pretax' ? (
          <InlineBanner message={t('mergedExpense.pretaxHint')} tone="info" />
        ) : (
          <InlineBanner
            message={t('mergedExpense.posttaxDifference', {
              value: formatMoney(
                postTaxDifference.toFixed(2),
                form.parent.original_currency || detail?.base_currency || 'JPY',
              ),
            })}
            tone={
              postTaxDifference === 0
                ? 'success'
                : Math.abs(postTaxDifference) <= 1
                  ? 'info'
                  : 'error'
            }
          />
        )}
      </PlaceholderCard>

      <PlaceholderCard title={t('normalExpense.notesTitle')}>
        <View style={styles.notes}>
          <InlineBanner message={t('mergedExpense.notesDate')} tone="info" />
          <InlineBanner
            message={t('mergedExpense.notesCategories', {
              merge: mergeCategories.length,
              normal: normalCategories.length,
            })}
            tone="info"
          />
          {!mergeCategories.length || !normalCategories.length ? (
            <InlineBanner message={t('mergedExpense.missingCategories')} tone="error" />
          ) : null}
        </View>
      </PlaceholderCard>

      <View style={styles.actions}>
        <ActionButton
          label={t('common.cancel')}
          onPress={() => navigation.goBack()}
          tone="secondary"
        />
        {!isEditMode ? (
          <ActionButton
            disabled={isSaving || !mergeCategories.length || !normalCategories.length}
            label={
              isSaving && submitModeRef.current === 'next'
                ? t('mergedExpense.creating')
                : t('mergedExpense.createAndNext')
            }
            onPress={() => {
              void handleSubmit('next');
            }}
            tone="secondary"
          />
        ) : null}
        <ActionButton
          disabled={isSaving || !mergeCategories.length || !normalCategories.length}
          label={
            isSaving
              ? isEditMode
                ? t('mergedExpense.saving')
                : t('mergedExpense.creating')
              : isEditMode
                ? t('mergedExpense.save')
                : t('mergedExpense.create')
          }
          onPress={() => {
            void handleSubmit('back');
          }}
        />
      </View>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <ScreenShell
      title={isEditMode ? t('mergedExpense.titleEdit') : t('mergedExpense.titleCreate')}
      description={t(
        isEditMode ? 'mergedExpense.subtitleEdit' : 'mergedExpense.subtitleCreate',
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
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modeChipActive: {
    backgroundColor: colors.accent,
  },
  modeChipText: {
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: colors.backgroundSoft,
  },
  multilineInput: {
    minHeight: 96,
    paddingTop: 14,
  },
  childList: {
    gap: 12,
  },
  childCard: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  childHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  childTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  addChildButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  removeButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  childDescriptionInput: {
    minHeight: 88,
    paddingTop: 14,
  },
  previewGrid: {
    gap: 10,
  },
  previewMetric: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  previewLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  previewValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  previewValueSuccess: {
    color: colors.success,
  },
  previewValueDanger: {
    color: colors.danger,
  },
  notes: {
    gap: 10,
  },
  actions: {
    gap: 10,
    marginBottom: 16,
  },
  alertErrorText: {
    color: '#D60000',
  },
});
