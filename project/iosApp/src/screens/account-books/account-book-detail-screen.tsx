import {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
import type {
  AccountBookDetail,
  AccountBookMember,
  ExpenseCategory,
  ExpenseSummary,
} from '@expense-statistics/domain';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
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
import {normalizeSelectedIDsForQuery} from '@/lib/category-filters';
import {createDefaultExpenseListFilters, ExpenseDatePreset, ExpenseListFilters} from '@/lib/expense-list';
import {formatMoney, shortID, trailingNaturalDateRange} from '@/lib/ledger';
import {navigationRef} from '@/lib/navigation';
import type {AppTabParamList} from '@/navigation/types';
import {colors} from '@/theme/colors';

type Props = BottomTabScreenProps<AppTabParamList, 'ExpensesTab'>;

type MetadataForm = {
  name: string;
  description: string;
};

type MetadataErrors = Partial<Record<keyof MetadataForm, string>>;

export function AccountBookDetailScreen({route}: Props) {
  const accountBookId = route.params?.accountBookId ?? '';
  const auth = useAuth();
  const {setActiveAccountBookId} = useBookSession();
  const {showToast} = useToast();
  const {t} = useI18n();
  const isFocused = useIsFocused();
  const [detail, setDetail] = useState<AccountBookDetail | null>(null);
  const [members, setMembers] = useState<AccountBookMember[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<ExpenseSummary[]>([]);
  const [filters, setFilters] = useState<ExpenseListFilters>(() =>
    createDefaultExpenseListFilters(),
  );
  const [metadataForm, setMetadataForm] = useState<MetadataForm>({name: '', description: ''});
  const [metadataErrors, setMetadataErrors] = useState<MetadataErrors>({});
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isDeletingBook, setIsDeletingBook] = useState(false);
  const [isLeavingBook, setIsLeavingBook] = useState(false);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);
  const [isDeletingExpenseId, setIsDeletingExpenseId] = useState<string | null>(null);
  const [expensePageMeta, setExpensePageMeta] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalConvertedAmount: '0.00',
  });
  const lastExpenseQueryKeyRef = useRef<string>('');

  const canEdit =
    detail?.my_role === 'owner' || detail?.my_role === 'admin';
  const canDeleteBook = detail?.my_role === 'owner';
  const canManageExpenses =
    detail?.my_role === 'owner' ||
    detail?.my_role === 'admin' ||
    detail?.my_role === 'editor';

  const categoryMap = useMemo(
    () => new Map(categories.map(category => [category.id, category] as const)),
    [categories],
  );
  const memberMap = useMemo(
    () => new Map(members.map(member => [member.user_id, member] as const)),
    [members],
  );
  const availableCategoryIDs = useMemo(
    () => categories.map(category => category.id),
    [categories],
  );
  const effectiveCategoryIDs = normalizeSelectedIDsForQuery(
    filters.categoryIDs,
    availableCategoryIDs,
  );
  const categoryQueryKey = effectiveCategoryIDs?.join(',') ?? '';
  const expenseQueryKey = useMemo(
    () =>
      JSON.stringify({
        accountBookId,
        page: filters.page,
        keyword: filters.keyword.trim(),
        categoryIDs: effectiveCategoryIDs ?? [],
        userID: filters.userID,
        minAmount: filters.minAmount.trim(),
        maxAmount: filters.maxAmount.trim(),
        originalCurrency: filters.originalCurrency.trim().toUpperCase(),
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        spentAtOrder: filters.spentAtOrder,
      }),
    [
      accountBookId,
      filters.page,
      filters.keyword,
      effectiveCategoryIDs,
      filters.userID,
      filters.minAmount,
      filters.maxAmount,
      filters.originalCurrency,
      filters.dateFrom,
      filters.dateTo,
      filters.spentAtOrder,
    ],
  );
  const defaultFilters = useMemo(() => createDefaultExpenseListFilters(), []);

  const hasActiveFilters =
    filters.keyword !== defaultFilters.keyword ||
    filters.originalCurrency !== defaultFilters.originalCurrency ||
    Boolean(effectiveCategoryIDs?.length) ||
    filters.userID !== defaultFilters.userID ||
    filters.minAmount !== defaultFilters.minAmount ||
    filters.maxAmount !== defaultFilters.maxAmount ||
    filters.dateFrom !== defaultFilters.dateFrom ||
    filters.dateTo !== defaultFilters.dateTo ||
    filters.datePreset !== defaultFilters.datePreset ||
    filters.spentAtOrder !== defaultFilters.spentAtOrder;

  const ownerName = detail?.owner_user_id
    ? memberMap.get(detail.owner_user_id)?.name ?? shortID(detail.owner_user_id)
    : '-';
  const totalPages = Math.max(
    1,
    Math.ceil(expensePageMeta.total / expensePageMeta.pageSize || 1),
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
        const [nextDetail, nextMembers, nextCategories] = await Promise.all([
          apiClient.getAccountBook(auth.accessToken, accountBookId),
          apiClient.listAccountBookMembers(auth.accessToken, accountBookId),
          apiClient.listExpenseCategories(auth.accessToken, accountBookId),
        ]);

        if (cancelled) {
          return;
        }

        setDetail(nextDetail);
        setMembers(nextMembers);
        setCategories(nextCategories);
        setMetadataForm({
          name: nextDetail.name,
          description: nextDetail.description ?? '',
        });
      } catch (error) {
        if (!cancelled) {
          setPageError(getApiErrorMessage(error, t('book.loadBookFailed')));
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
  }, [accountBookId, auth.accessToken, t]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!auth.accessToken || !isFocused) {
        return;
      }

      try {
        const nextCategories = await apiClient.listExpenseCategories(
          auth.accessToken,
          accountBookId,
        );
        if (!cancelled) {
          setCategories(nextCategories);
        }
      } catch {
        // Ignore silent refresh errors when returning from child screens.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountBookId, auth.accessToken, isFocused]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!auth.accessToken) {
        return;
      }

      const shouldShowLoading = lastExpenseQueryKeyRef.current !== expenseQueryKey;
      if (shouldShowLoading) {
        setIsLoadingExpenses(true);
      }
      setExpenseError(null);
      try {
        const response = await apiClient.listExpenses(auth.accessToken, accountBookId, {
          include_children: true,
          page: filters.page,
          page_size: 10,
          keyword: filters.keyword.trim() || undefined,
          category_ids: effectiveCategoryIDs,
          user_id: filters.userID || undefined,
          min_amount: filters.minAmount.trim() || undefined,
          max_amount: filters.maxAmount.trim() || undefined,
          original_currency: filters.originalCurrency.trim().toUpperCase() || undefined,
          date_from: filters.dateFrom || undefined,
          date_to: filters.dateTo || undefined,
          spent_at_order: filters.spentAtOrder,
        });

        if (cancelled) {
          return;
        }

        setExpenses(response.items);
        setExpensePageMeta({
          page: response.page,
          pageSize: response.page_size,
          total: response.total,
          totalConvertedAmount: response.total_converted_amount,
        });
        lastExpenseQueryKeyRef.current = expenseQueryKey;
      } catch (error) {
        if (!cancelled) {
          setExpenseError(getApiErrorMessage(error, t('book.loadExpensesFailed')));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingExpenses(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    accountBookId,
    auth.accessToken,
    categoryQueryKey,
    effectiveCategoryIDs,
    expenseQueryKey,
    filters,
    t,
  ]);

  function updateFilter<K extends keyof ExpenseListFilters>(
    key: K,
    value: ExpenseListFilters[K],
  ) {
    setFilters(current => ({
      ...current,
      page: 1,
      [key]: value,
    }));
  }

  function toggleCategory(categoryID: string) {
    setFilters(current => ({
      ...current,
      page: 1,
      categoryIDs: current.categoryIDs.includes(categoryID)
        ? current.categoryIDs.filter(id => id !== categoryID)
        : [...current.categoryIDs, categoryID],
    }));
  }

  function clearFilters() {
    setFilters(createDefaultExpenseListFilters());
  }

  function clearCategoryFilters() {
    setFilters(current => ({
      ...current,
      categoryIDs: [],
      page: 1,
    }));
  }

  function applyDatePreset(preset: Exclude<ExpenseDatePreset, null>) {
    const range = trailingNaturalDateRange(preset === 'last7' ? 7 : 30);
    setFilters(current => ({
      ...current,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      datePreset: preset,
      page: 1,
    }));
  }

  function validateMetadata() {
    const nextErrors: MetadataErrors = {};
    if (!metadataForm.name.trim()) {
      nextErrors.name = t('book.nameRequired');
    } else if (metadataForm.name.trim().length > 100) {
      nextErrors.name = t('book.nameLong');
    }
    if (metadataForm.description.length > 400) {
      nextErrors.description = t('common.error.descriptionLong');
    }
    setMetadataErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function refreshExpenses() {
    if (!auth.accessToken) {
      return;
    }

    setIsLoadingExpenses(true);
    setExpenseError(null);
    try {
      const response = await apiClient.listExpenses(auth.accessToken, accountBookId, {
        include_children: true,
        page: filters.page,
        page_size: 10,
        keyword: filters.keyword.trim() || undefined,
        category_ids: effectiveCategoryIDs,
        user_id: filters.userID || undefined,
        min_amount: filters.minAmount.trim() || undefined,
        max_amount: filters.maxAmount.trim() || undefined,
        original_currency: filters.originalCurrency.trim().toUpperCase() || undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        spent_at_order: filters.spentAtOrder,
      });
      setExpenses(response.items);
      setExpensePageMeta({
        page: response.page,
        pageSize: response.page_size,
        total: response.total,
        totalConvertedAmount: response.total_converted_amount,
      });
    } catch (error) {
      setExpenseError(getApiErrorMessage(error, t('book.loadExpensesFailed')));
    } finally {
      setIsLoadingExpenses(false);
    }
  }

  async function handleSaveMetadata() {
    if (!auth.accessToken || !detail || isSavingMetadata || !validateMetadata()) {
      return;
    }

    setIsSavingMetadata(true);
    setPageError(null);
    try {
      const updated = await apiClient.updateAccountBook(auth.accessToken, accountBookId, {
        name: metadataForm.name.trim(),
        description: metadataForm.description.trim()
          ? metadataForm.description.trim()
          : null,
      });
      setDetail(updated);
      setMetadataForm({
        name: updated.name,
        description: updated.description ?? '',
      });
      setIsEditingMetadata(false);
      showToast(t('book.updated'), 'success');
    } catch (error) {
      setPageError(getApiErrorMessage(error, t('book.updateFailed')));
    } finally {
      setIsSavingMetadata(false);
    }
  }

  async function handleDeleteBook() {
    if (!auth.accessToken || !detail || isDeletingBook) {
      return;
    }

    Alert.prompt(
      t('book.deleteBook'),
      t('book.bookDeleteConfirm', {name: detail.name}),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('book.deleteBook'),
          style: 'destructive',
          onPress: (typedName?: string) => {
            if (typedName !== detail.name) {
              if (typedName !== undefined) {
                showToast(t('book.nameMismatch'), 'error');
              }
              return;
            }

            void (async () => {
              setIsDeletingBook(true);
              try {
                await apiClient.deleteAccountBook(auth.accessToken!, accountBookId);
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
                showToast(t('book.bookDeleted'), 'success');
                navigationRef.navigate('AppTabs');
              } catch (error) {
                showToast(getApiErrorMessage(error, t('book.bookDeleteFailed')), 'error');
              } finally {
                setIsDeletingBook(false);
              }
            })();
          },
        },
      ],
      'plain-text',
    );
  }

  async function handleLeaveBook() {
    if (!auth.accessToken || isLeavingBook) {
      return;
    }

    Alert.alert(t('book.leave'), t('book.leaveConfirm'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('book.leave'),
        onPress: () => {
          void (async () => {
            setIsLeavingBook(true);
            try {
              await apiClient.leaveAccountBook(auth.accessToken!, accountBookId);
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
              showToast(t('book.left'), 'success');
              navigationRef.navigate('AppTabs');
            } catch (error) {
              showToast(getApiErrorMessage(error, t('book.leaveFailed')), 'error');
            } finally {
              setIsLeavingBook(false);
            }
          })();
        },
      },
    ]);
  }

  function isPartialMergedExpense(expense: ExpenseSummary) {
    if (!effectiveCategoryIDs?.length || expense.expense_type !== 'merged_parent') {
      return false;
    }
    return (expense.children?.length ?? 0) < expense.children_count;
  }

  function handleEditExpense(expense: ExpenseSummary) {
    if (expense.expense_type === 'merged_parent') {
      navigationRef.navigate('MergedExpenseEditor', {
        accountBookId,
        expenseId: expense.id,
      });
      return;
    }

    navigationRef.navigate('NormalExpenseEditor', {
      accountBookId,
      expenseId: expense.id,
    });
  }

  function handleDeleteExpense(expense: ExpenseSummary) {
    const message = isPartialMergedExpense(expense)
      ? t('book.deletePartialConfirm')
      : expense.expense_type === 'merged_parent'
        ? t('book.deleteMergedConfirm')
        : t('book.deleteExpenseConfirm');

    Alert.alert(t('common.delete'), message, [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('common.confirmDelete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            if (!auth.accessToken) {
              return;
            }
            setIsDeletingExpenseId(expense.id);
            try {
              await apiClient.deleteExpense(auth.accessToken, accountBookId, expense.id);
              showToast(t('book.expenseDeleted'), 'success');
              await refreshExpenses();
            } catch (error) {
              showToast(
                getApiErrorMessage(error, t('book.expenseDeleteFailed')),
                'error',
              );
            } finally {
              setIsDeletingExpenseId(null);
            }
          })();
        },
      },
    ]);
  }

  function renderMemberName(expense: ExpenseSummary) {
    if (!expense.user_id) {
      return t('book.deletedUser');
    }
    return memberMap.get(expense.user_id)?.name ?? shortID(expense.user_id);
  }

  function renderExchangeRate(expense: ExpenseSummary) {
    const baseCurrency = detail?.base_currency;
    if (!baseCurrency || expense.original_currency === baseCurrency) {
      return null;
    }

    const numericRate = Number(expense.exchange_rate_used);
    const rate = Number.isFinite(numericRate)
      ? numericRate.toFixed(2)
      : expense.exchange_rate_used;
    return `${t('book.rate')} ${rate}`;
  }

  function renderExpenseCard(expense: ExpenseSummary) {
    const category = categoryMap.get(expense.category_id);
    const deletingThisExpense = isDeletingExpenseId === expense.id;
    const exchangeRateLabel = renderExchangeRate(expense);
    const showConvertedAmount =
      !!detail?.base_currency && expense.original_currency !== detail.base_currency;

    return (
      <PlaceholderCard
        hideHeader
        key={expense.id}
        title=""
        >
        <View style={styles.expenseTitleRow}>
          <View style={styles.expenseTitleMain}>
            <Text numberOfLines={1} style={styles.expenseCardTitle}>
              {expense.name}
            </Text>
            <Text style={styles.expenseCurrencyChip}>{expense.original_currency}</Text>
          </View>
          {canManageExpenses ? (
            <View style={styles.headerActionRow}>
              <Pressable
                onPress={() => handleEditExpense(expense)}
                style={styles.iconHeaderButton}>
                <SFSymbol
                  colorHex={colors.accentDeep}
                  name="pencil"
                  pointSize={15}
                  style={styles.headerIcon}
                  weight="semibold"
                />
              </Pressable>
              <Pressable
                disabled={deletingThisExpense}
                onPress={() => handleDeleteExpense(expense)}
                style={styles.iconHeaderButton}>
                <SFSymbol
                  colorHex={colors.danger}
                  name="trash"
                  pointSize={15}
                  style={styles.headerIcon}
                  weight="semibold"
                />
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.expenseTopRow}>
          <View style={styles.expenseMetaWrap}>
            <View
              style={[
                styles.categoryChip,
                {borderColor: category?.color ?? colors.line},
              ]}>
              <View
                style={[
                  styles.colorDot,
                  {backgroundColor: category?.color ?? colors.accentSoft},
                ]}
              />
              <Text style={styles.categoryChipText}>
                {category?.name ?? t('book.unknownCategory')}
              </Text>
            </View>
            {expense.expandable ? (
              <Text style={styles.expenseBadge}>
                {effectiveCategoryIDs?.length &&
                expense.matched_children_count > 0 &&
                expense.matched_children_count < expense.children_count
                  ? t('book.matchedRecords', {
                      matched: expense.matched_children_count,
                      total: expense.children_count,
                    })
                  : t('book.records', {count: expense.children_count})}
              </Text>
            ) : null}
          </View>
          <View style={styles.expenseAmountBlock}>
            <Text style={styles.expenseAmount}>
              {formatMoney(expense.original_amount, expense.original_currency)}
            </Text>
            {showConvertedAmount ? (
              <Text style={styles.expenseConvertedAmount}>
                {formatMoney(expense.converted_amount, detail?.base_currency ?? 'JPY')}
              </Text>
            ) : null}
          </View>
        </View>

        {expense.description ? (
          <Text style={styles.expenseDescription}>{expense.description}</Text>
        ) : null}

        <View style={styles.expenseInfoRow}>
          <Text style={styles.expenseInfoText}>
            {t('book.by')} {renderMemberName(expense)}
          </Text>
          <Text style={styles.expenseInfoText}>{expense.spent_at}</Text>
        </View>

        {exchangeRateLabel ? (
          <View style={styles.expenseInfoRow}>
            <Text style={styles.expenseInfoText}>{exchangeRateLabel}</Text>
          </View>
        ) : null}

        {expense.children?.length ? (
          <View style={styles.childList}>
            {expense.children.map(child => {
              const childCategory = categoryMap.get(child.category_id);

              return (
                <View key={child.id} style={styles.childRow}>
                  <View style={styles.childMain}>
                    <View style={styles.childTitleRow}>
                      <View style={styles.childCategoryRow}>
                        <View
                          style={[
                            styles.colorDot,
                            {backgroundColor: childCategory?.color ?? colors.accentSoft},
                          ]}
                        />
                        <Text style={styles.childCategoryText}>
                          {childCategory?.name ?? t('book.unknownCategory')}
                        </Text>
                      </View>
                      <Text numberOfLines={1} style={styles.childName}>
                        {child.name}
                      </Text>
                    </View>
                    {child.description ? (
                      <Text style={styles.childDescription}>{child.description}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.childAmount}>
                    {formatMoney(child.original_amount, child.original_currency)}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </PlaceholderCard>
    );
  }

  if (!accountBookId) {
    return (
      <ScreenShell title={t('nav.expenses')} description={t('accountBooks.description')}>
        <PlaceholderCard title={t('nav.expenses')}>
          <InlineBanner message={t('accountBooks.empty')} tone="info" />
        </PlaceholderCard>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      hideHero
      title={detail?.name ?? t('book.titleFallback')}
      description={detail?.description ?? undefined}>
      {isLoadingPage ? <InlineBanner message={t('book.loadingBook')} tone="info" /> : null}
      {pageError ? <InlineBanner message={pageError} tone="error" /> : null}

      <PlaceholderCard
        hideHeader
        title=""
        >
        <View style={styles.topSummaryRow}>
          <View style={styles.topSummaryMain}>
            <Text numberOfLines={1} style={styles.topBookName}>
              {detail?.name ?? t('book.titleFallback')}
            </Text>
            <Text style={styles.topCurrencyChip}>{detail?.base_currency ?? '-'}</Text>
          </View>
          <View style={styles.headerActionRow}>
            {canEdit ? (
              <Pressable
                onPress={() => setIsEditingMetadata(current => !current)}
                style={styles.iconHeaderButton}>
                <SFSymbol
                  colorHex={colors.accentDeep}
                  name="pencil"
                  pointSize={16}
                  style={styles.headerIcon}
                  weight="semibold"
                />
              </Pressable>
            ) : null}
            {canDeleteBook ? (
              <Pressable
                disabled={isDeletingBook}
                onPress={() => {
                  void handleDeleteBook();
                }}
                style={styles.dangerIconHeaderButton}>
                <SFSymbol
                  colorHex={colors.danger}
                  name="trash"
                  pointSize={16}
                  style={styles.headerIcon}
                  weight="semibold"
                />
              </Pressable>
            ) : detail ? (
              <Pressable
                disabled={isLeavingBook}
                onPress={() => {
                  void handleLeaveBook();
                }}
                style={styles.iconHeaderButton}>
                <SFSymbol
                  colorHex={colors.accentDeep}
                  name="rectangle.portrait.and.arrow.right"
                  pointSize={16}
                  style={styles.headerIcon}
                  weight="semibold"
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.metaStrip}>
          <Text style={styles.metaChip}>
            {t('book.roleLabel')}: {detail?.my_role ?? '-'}
          </Text>
          <Text style={styles.metaChip}>
            {t('book.categoriesLabel')}: {categories.length}
          </Text>
          <Text style={styles.metaChip}>
            {t('book.ownerLabel')}: {ownerName}
          </Text>
        </View>

        {isEditingMetadata ? (
          <View style={styles.form}>
            <FormField error={metadataErrors.name} label={t('book.name')}>
              <AppTextInput
                onChangeText={text => {
                  setMetadataForm(current => ({...current, name: text}));
                  setMetadataErrors(current => ({...current, name: undefined}));
                }}
                value={metadataForm.name}
              />
            </FormField>
            <FormField error={metadataErrors.description} label={t('book.description')}>
              <AppTextInput
                onChangeText={text => {
                  setMetadataForm(current => ({...current, description: text}));
                  setMetadataErrors(current => ({
                    ...current,
                    description: undefined,
                  }));
                }}
                value={metadataForm.description}
              />
            </FormField>
            <View style={styles.formActions}>
              <ActionButton
                disabled={isSavingMetadata}
                label={isSavingMetadata ? t('book.saving') : t('book.save')}
                onPress={() => {
                  void handleSaveMetadata();
                }}
                style={styles.flexButton}
              />
              <ActionButton
                label={t('book.close')}
                onPress={() => setIsEditingMetadata(false)}
                style={styles.flexButton}
                tone="secondary"
              />
            </View>
          </View>
        ) : null}
        <View style={styles.summaryRow}>
          <Text style={styles.expenseBadge}>
            {t('book.total')} {expensePageMeta.total}
          </Text>
          <Text style={styles.expenseBadge}>
            {t('book.totalAmount')}{' '}
            {formatMoney(
              expensePageMeta.totalConvertedAmount,
              detail?.base_currency ?? 'JPY',
            )}
          </Text>
        </View>

        <View style={styles.filterToolbar}>
          {canManageExpenses ? (
            <ActionButton
              label={t('book.addExpense')}
              onPress={() =>
                navigationRef.navigate('ExpenseTypePicker', {accountBookId})
              }
              style={styles.addExpenseButton}
            />
          ) : null}

          <Pressable
            onPress={() => setIsFilterPanelVisible(current => !current)}
            style={styles.filterToggle}>
            <View style={styles.filterToggleTextRow}>
              <Text style={styles.filterToggleText}>{t('book.filters')}</Text>
              <SFSymbol
                colorHex={colors.accentDeep}
                name={isFilterPanelVisible ? 'chevron.up' : 'chevron.down'}
                pointSize={14}
                style={styles.filterToggleIcon}
                weight="semibold"
              />
            </View>
          </Pressable>
        </View>

        {isFilterPanelVisible ? (
          <View style={styles.filterGroup}>
            <FormField label={t('book.keyword')}>
              <AppTextInput
                onChangeText={text => updateFilter('keyword', text)}
                placeholder={t('book.keywordPlaceholder')}
                value={filters.keyword}
              />
            </FormField>

            <View style={styles.filterRow}>
              <View style={styles.flexField}>
                <FormField label={t('book.user')}>
                  <View style={styles.selectRow}>
                    <Pressable
                      onPress={() => updateFilter('userID', '')}
                      style={[
                        styles.selectChip,
                        !filters.userID ? styles.selectChipActive : undefined,
                      ]}>
                      <Text
                        style={[
                          styles.selectChipText,
                          !filters.userID ? styles.selectChipTextActive : undefined,
                        ]}>
                        {t('book.allUsers')}
                      </Text>
                    </Pressable>
                    {members.map(member => (
                      <Pressable
                        key={member.user_id}
                        onPress={() => updateFilter('userID', member.user_id)}
                        style={[
                          styles.selectChip,
                          filters.userID === member.user_id
                            ? styles.selectChipActive
                            : undefined,
                        ]}>
                        <Text
                          style={[
                            styles.selectChipText,
                            filters.userID === member.user_id
                              ? styles.selectChipTextActive
                              : undefined,
                          ]}>
                          {member.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </FormField>
              </View>
            </View>

            <View style={styles.filterRow}>
              <View style={styles.flexButton}>
                <FormField label={t('book.currency')}>
                  <AppTextInput
                    autoCapitalize="characters"
                    maxLength={3}
                    onChangeText={text => updateFilter('originalCurrency', text.toUpperCase())}
                    placeholder="JPY"
                    value={filters.originalCurrency}
                  />
                </FormField>
              </View>
              <View style={styles.flexButton}>
                <FormField label={t('book.order')}>
                  <View style={styles.segmentRow}>
                    <Pressable
                      onPress={() => updateFilter('spentAtOrder', 'desc')}
                      style={[
                        styles.segment,
                        filters.spentAtOrder === 'desc' ? styles.segmentActive : undefined,
                      ]}>
                      <Text
                        style={[
                          styles.segmentText,
                          filters.spentAtOrder === 'desc'
                            ? styles.segmentTextActive
                            : undefined,
                        ]}>
                        {t('book.orderDesc')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => updateFilter('spentAtOrder', 'asc')}
                      style={[
                        styles.segment,
                        filters.spentAtOrder === 'asc' ? styles.segmentActive : undefined,
                      ]}>
                      <Text
                        style={[
                          styles.segmentText,
                          filters.spentAtOrder === 'asc'
                            ? styles.segmentTextActive
                            : undefined,
                        ]}>
                        {t('book.orderAsc')}
                      </Text>
                    </Pressable>
                  </View>
                </FormField>
              </View>
            </View>

            <View style={styles.filterRow}>
              <View style={styles.flexButton}>
                <FormField label={t('book.minAmount')}>
                  <AppTextInput
                    keyboardType="decimal-pad"
                    onChangeText={text => updateFilter('minAmount', text)}
                    placeholder="0.00"
                    value={filters.minAmount}
                  />
                </FormField>
              </View>
              <View style={styles.flexButton}>
                <FormField label={t('book.maxAmount')}>
                  <AppTextInput
                    keyboardType="decimal-pad"
                    onChangeText={text => updateFilter('maxAmount', text)}
                    value={filters.maxAmount}
                  />
                </FormField>
              </View>
            </View>

            <View style={styles.filterRow}>
              <View style={styles.flexButton}>
                <FormField label={t('book.dateFrom')}>
                  <AppTextInput
                    onChangeText={text =>
                      setFilters(current => ({
                        ...current,
                        dateFrom: text,
                        datePreset: null,
                        page: 1,
                      }))
                    }
                    placeholder="2026-01-01"
                    value={filters.dateFrom}
                  />
                </FormField>
              </View>
              <View style={styles.flexButton}>
                <FormField label={t('book.dateTo')}>
                  <AppTextInput
                    onChangeText={text =>
                      setFilters(current => ({
                        ...current,
                        dateTo: text,
                        datePreset: null,
                        page: 1,
                      }))
                    }
                    placeholder="2026-01-31"
                    value={filters.dateTo}
                  />
                </FormField>
              </View>
            </View>

            <FormField label={t('book.dateRange')}>
              <View style={styles.segmentRow}>
                <Pressable
                  onPress={() => applyDatePreset('last7')}
                  style={[
                    styles.segment,
                    filters.datePreset === 'last7' ? styles.segmentActive : undefined,
                  ]}>
                  <Text
                    style={[
                      styles.segmentText,
                      filters.datePreset === 'last7'
                        ? styles.segmentTextActive
                        : undefined,
                    ]}>
                    {t('book.last7Days')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => applyDatePreset('last30')}
                  style={[
                    styles.segment,
                    filters.datePreset === 'last30' ? styles.segmentActive : undefined,
                  ]}>
                  <Text
                    style={[
                      styles.segmentText,
                      filters.datePreset === 'last30'
                        ? styles.segmentTextActive
                        : undefined,
                    ]}>
                    {t('book.last30Days')}
                  </Text>
                </Pressable>
              </View>
            </FormField>

            <View style={styles.helperRow}>
              <Text style={styles.sectionLabel}>{t('book.categories')}</Text>
              <Pressable
                disabled={!filters.categoryIDs.length}
                onPress={clearCategoryFilters}>
                <Text style={styles.clearLink}>{t('book.clearCategories')}</Text>
              </Pressable>
            </View>
            <View style={styles.pillWrap}>
              {categories.map(category => {
                const active = filters.categoryIDs.includes(category.id);

                return (
                  <Pressable
                    key={category.id}
                    onPress={() => toggleCategory(category.id)}
                    style={[
                      styles.categoryPill,
                      active ? styles.categoryPillActive : undefined,
                    ]}>
                    <View
                      style={[
                        styles.colorDot,
                        {backgroundColor: category.color},
                      ]}
                    />
                    <Text
                      style={[
                        styles.categoryPillText,
                        active ? styles.categoryPillTextActive : undefined,
                      ]}>
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.helperRow}>
              <ActionButton
                disabled={!hasActiveFilters}
                label={t('book.clearAll')}
                onPress={clearFilters}
                tone="secondary"
              />
            </View>
          </View>
        ) : null}

        {isLoadingExpenses ? (
          <InlineBanner message={t('book.loadExpenses')} tone="info" />
        ) : null}
        {expenseError ? <InlineBanner message={expenseError} tone="error" /> : null}

        {expenses.length ? (
          <View style={styles.expenseList}>{expenses.map(renderExpenseCard)}</View>
        ) : !isLoadingExpenses ? (
          <InlineBanner message={t('book.emptyExpenses')} tone="info" />
        ) : null}

        <View style={styles.paginationRow}>
          <ActionButton
            disabled={filters.page <= 1 || isLoadingExpenses}
            label={t('book.previous')}
            onPress={() => updateFilter('page', Math.max(1, filters.page - 1))}
            tone="secondary"
          />
          <Text style={styles.paginationText}>
            {filters.page} / {totalPages}
          </Text>
          <ActionButton
            disabled={filters.page >= totalPages || isLoadingExpenses}
            label={t('book.next')}
            onPress={() =>
              updateFilter('page', Math.min(totalPages, filters.page + 1))
            }
            tone="secondary"
          />
        </View>
      </PlaceholderCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  topSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  topSummaryMain: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
    minWidth: 0,
  },
  topCurrencyChip: {
    backgroundColor: colors.accentSoftMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  topBookName: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
    flexShrink: 1,
  },
  metaStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    backgroundColor: colors.accentSoftMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
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
  formActions: {
    flexDirection: 'row',
    gap: 12,
  },
  flexButton: {
    flex: 1,
  },
  headerActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  iconHeaderButton: {
    alignItems: 'center',
    backgroundColor: colors.accentSoftMuted,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  dangerIconHeaderButton: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderRadius: 12,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  headerIcon: {
    height: 16,
    width: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  expenseBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    color: colors.accentDeep,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  filterGroup: {
    gap: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexField: {
    flex: 1,
  },
  selectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectChipActive: {
    backgroundColor: colors.accent,
  },
  selectChipText: {
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  selectChipTextActive: {
    color: colors.backgroundSoft,
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
    minHeight: 46,
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
  helperRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  inlineActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterToolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  addExpenseButton: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterToggle: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterToggleTextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  filterToggleIcon: {
    height: 14,
    width: 14,
  },
  filterToggleText: {
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  clearLink: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  categoryPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryPillText: {
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  categoryPillTextActive: {
    color: colors.backgroundSoft,
  },
  categorySummaryChip: {
    alignItems: 'center',
    backgroundColor: colors.accentSoftMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  categorySummaryText: {
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  colorDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  expenseList: {
    gap: 10,
  },
  expenseTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  expenseTitleMain: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 6,
    minWidth: 0,
  },
  expenseCardTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    flexShrink: 1,
  },
  expenseCurrencyChip: {
    backgroundColor: colors.accentSoftMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.accentDeep,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  expenseTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  expenseMetaWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  categoryChipText: {
    color: colors.accentDeep,
    fontSize: 11,
    fontWeight: '700',
  },
  expenseAmountBlock: {
    alignItems: 'flex-end',
    minWidth: 110,
  },
  expenseAmount: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  expenseConvertedAmount: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  expenseDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 18,
  },
  expenseInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expenseInfoText: {
    color: colors.muted,
    fontSize: 11,
  },
  childList: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: 8,
    marginTop: 4,
    paddingTop: 10,
  },
  childRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  childMain: {
    flex: 1,
    gap: 4,
  },
  childTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  childCategoryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  childCategoryText: {
    color: colors.accentDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  childName: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    minWidth: 0,
  },
  childDescription: {
    color: colors.muted,
    fontSize: 12,
  },
  childAmount: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  paginationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  paginationText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
});
