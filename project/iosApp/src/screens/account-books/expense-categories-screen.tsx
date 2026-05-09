import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  AccountBookDetail,
  ExpenseCategory,
} from '@expense-statistics/domain';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
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
import type {RootStackParamList} from '@/navigation/types';
import {colors} from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseCategories'>;

type CategoryForm = {
  name: string;
  description: string;
  isMergeCategory: boolean;
  color: string;
};

type CategoryFormErrors = Partial<Record<keyof CategoryForm, string>>;

const EMPTY_FORM: CategoryForm = {
  name: '',
  description: '',
  isMergeCategory: false,
  color: '#CA5D2B',
};

const PRESET_COLORS = [
  '#CA5D2B',
  '#D97706',
  '#C2410C',
  '#B45309',
  '#4D7C0F',
  '#0F766E',
  '#0369A1',
  '#7C3AED',
  '#BE185D',
  '#DC2626',
];

function toFormValues(category: ExpenseCategory): CategoryForm {
  return {
    name: category.name,
    description: category.description ?? '',
    isMergeCategory: category.is_merge_category,
    color: category.color,
  };
}

function isHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value.trim());
}

export function ExpenseCategoriesScreen({navigation, route}: Props) {
  const {accountBookId} = route.params;
  const auth = useAuth();
  const {showToast} = useToast();
  const {t} = useI18n();
  const [detail, setDetail] = useState<AccountBookDetail | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<CategoryFormErrors>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find(category => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );
  const canEdit =
    detail?.my_role === 'owner' ||
    detail?.my_role === 'admin' ||
    detail?.my_role === 'editor';
  const normalCategories = categories.filter(category => !category.is_merge_category);
  const mergeCategories = categories.filter(category => category.is_merge_category);
  const previewColor = isHexColor(form.color) ? form.color.trim().toUpperCase() : EMPTY_FORM.color;
  const formChanged = selectedCategory
    ? JSON.stringify(toFormValues(selectedCategory)) !==
      JSON.stringify({
        ...form,
        color: previewColor,
      })
    : JSON.stringify({...EMPTY_FORM, isMergeCategory: form.isMergeCategory}) !==
      JSON.stringify({
        ...form,
        color: previewColor,
      });

  const loadPage = useCallback(async () => {
    if (!auth.accessToken) {
      return;
    }

    setIsLoading(true);
    setPageError(null);
    try {
      const [nextDetail, nextCategories] = await Promise.all([
        apiClient.getAccountBook(auth.accessToken, accountBookId),
        apiClient.listExpenseCategories(auth.accessToken, accountBookId),
      ]);
      setDetail(nextDetail);
      setCategories(nextCategories);
    } catch (error) {
      setPageError(
        getApiErrorMessage(
          error,
          t('categories.loadCategoriesFailed'),
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [accountBookId, auth.accessToken, t]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (selectedCategory) {
      setForm(toFormValues(selectedCategory));
      setFormErrors({});
      return;
    }

    setForm(current => ({
      ...EMPTY_FORM,
      isMergeCategory: current.isMergeCategory,
    }));
    setFormErrors({});
  }, [selectedCategory]);

  function startCreate(isMergeCategory: boolean) {
    setSelectedCategoryId(null);
    setForm({
      ...EMPTY_FORM,
      isMergeCategory,
    });
    setFormErrors({});
  }

  function startEdit(categoryID: string) {
    setSelectedCategoryId(categoryID);
  }

  function updateForm<K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) {
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
    const nextErrors: CategoryFormErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = t('categories.nameRequired');
    } else if (form.name.trim().length > 100) {
      nextErrors.name = t('categories.nameLong');
    }

    if (form.description.length > 400) {
      nextErrors.description = t('common.error.descriptionLong');
    }

    if (!isHexColor(form.color)) {
      nextErrors.color = t('categories.colorInvalid');
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function refreshCategories(options?: {nextSelectedCategoryId?: string | null}) {
    if (!auth.accessToken) {
      return;
    }

    const nextCategories = await apiClient.listExpenseCategories(
      auth.accessToken,
      accountBookId,
    );
    setCategories(nextCategories);

    if (options && 'nextSelectedCategoryId' in options) {
      setSelectedCategoryId(options.nextSelectedCategoryId ?? null);
    }
  }

  async function handleSubmit() {
    if (!auth.accessToken || !canEdit || isSaving || !validateForm()) {
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() ? form.description.trim() : null,
      is_merge_category: form.isMergeCategory,
      color: previewColor,
    };

    setIsSaving(true);
    setPageError(null);
    try {
      if (selectedCategoryId) {
        const updated = await apiClient.updateExpenseCategory(
          auth.accessToken,
          accountBookId,
          selectedCategoryId,
          payload,
        );
        await refreshCategories({nextSelectedCategoryId: updated.id});
        showToast(t('categories.updated'), 'success');
      } else {
        await apiClient.createExpenseCategory(auth.accessToken, accountBookId, payload);
        await refreshCategories({nextSelectedCategoryId: null});
        startCreate(form.isMergeCategory);
        showToast(t('categories.created'), 'success');
      }
    } catch (error) {
      setPageError(getApiErrorMessage(error, t('categories.actionFailed')));
    } finally {
      setIsSaving(false);
    }
  }

  function handleDelete() {
    const accessToken = auth.accessToken;

    if (!accessToken || !selectedCategory || isDeleting) {
      return;
    }

    const deletingCategory = selectedCategory;

    Alert.alert(t('common.delete'), t('categories.deleteConfirm'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsDeleting(true);
            setPageError(null);
            try {
              await apiClient.deleteExpenseCategory(
                accessToken,
                accountBookId,
                deletingCategory.id,
              );
              await refreshCategories({nextSelectedCategoryId: null});
              startCreate(deletingCategory.is_merge_category);
              showToast(t('categories.deleted'), 'success');
            } catch (error) {
              setPageError(getApiErrorMessage(error, t('categories.actionFailed')));
            } finally {
              setIsDeleting(false);
            }
          })();
        },
      },
    ]);
  }

  function handleReset() {
    if (selectedCategory) {
      setForm(toFormValues(selectedCategory));
      setFormErrors({});
      return;
    }
    startCreate(form.isMergeCategory);
  }

  function renderCategoryGroup(
    title: string,
    items: ExpenseCategory[],
    emptyText: string,
  ) {
    return (
      <View style={styles.groupSection}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupTitle}>{title}</Text>
          <Text style={styles.groupCount}>{items.length}</Text>
        </View>

        {items.length ? (
          <View style={styles.categoryList}>
            {items.map(category => {
              const active = category.id === selectedCategoryId;

              return (
                <Pressable
                  key={category.id}
                  onPress={() => startEdit(category.id)}
                  style={[
                    styles.categoryRow,
                    active ? styles.categoryRowActive : undefined,
                  ]}>
                  <View style={styles.categoryRowMain}>
                    <View style={styles.categoryRowHeader}>
                      <View style={styles.categoryNameWrap}>
                        <View
                          style={[
                            styles.colorDot,
                            {backgroundColor: category.color},
                          ]}
                        />
                        <Text style={styles.categoryName}>{category.name}</Text>
                      </View>
                      <View style={styles.categoryBadgeRow}>
                        {category.is_system_seed ? (
                          <Text style={styles.seedBadge}>{t('categories.seed')}</Text>
                        ) : null}
                        {active ? (
                          <Text style={styles.activeBadge}>{t('categories.editing')}</Text>
                        ) : null}
                      </View>
                    </View>
                    <Text style={styles.categoryDescription}>
                      {category.description ?? t('common.noDescription')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <InlineBanner message={emptyText} tone="info" />
        )}
      </View>
    );
  }

  return (
    <ScreenShell hideHero title={t('categories.title')}>
      <PlaceholderCard
        title={t('categories.title')}
        description={t('categories.subtitle')}
        headerAccessory={
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.iconButton}>
            <SFSymbol
              colorHex={colors.accentDeep}
              name="chevron.left"
              pointSize={16}
              style={styles.headerIcon}
              weight="semibold"
            />
          </Pressable>
        }>
        <View style={styles.metaStrip}>
          <Text style={styles.metaChip}>
            {t('book.titleFallback')}: {detail?.name ?? '-'}
          </Text>
          <Text style={styles.metaChip}>
            {t('book.roleLabel')}: {detail?.my_role ?? '-'}
          </Text>
          <Text style={styles.metaChip}>
            {t('book.baseLabel')}: {detail?.base_currency ?? '-'}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryBadge}>
            {t('categories.total')} {categories.length}
          </Text>
          <Text style={styles.summaryBadge}>
            {t('categories.normal')} {normalCategories.length}
          </Text>
          <Text style={styles.summaryBadge}>
            {t('categories.merge')} {mergeCategories.length}
          </Text>
        </View>
      </PlaceholderCard>

      {isLoading ? <InlineBanner message={t('categories.loading')} tone="info" /> : null}
      {pageError ? <InlineBanner message={pageError} tone="error" /> : null}

      <PlaceholderCard
        title={t('categories.listTitle')}
        description={t('categories.listDescription')}
        headerAccessory={
          canEdit ? (
            <View style={styles.headerActionRow}>
              <ActionButton
                label={t('categories.createNormal')}
                onPress={() => startCreate(false)}
                style={styles.shortAction}
                tone="secondary"
              />
              <ActionButton
                label={t('categories.createMerge')}
                onPress={() => startCreate(true)}
                style={styles.shortAction}
                tone="secondary"
              />
            </View>
          ) : null
        }>
        {renderCategoryGroup(
          t('categories.normalCategories'),
          normalCategories,
          t('categories.noNormal'),
        )}
        {renderCategoryGroup(
          t('categories.mergeCategories'),
          mergeCategories,
          t('categories.noMerge'),
        )}
      </PlaceholderCard>

      <PlaceholderCard
        title={selectedCategory ? t('categories.editTitle') : t('categories.createTitle')}
        description={
          selectedCategory
            ? t('categories.editDescription')
            : t('categories.createDescription')
        }>
        {!canEdit ? (
          <InlineBanner message={t('categories.readonly')} tone="info" />
        ) : (
          <View style={styles.form}>
            <View style={styles.segmentRow}>
              <Pressable
                onPress={() => updateForm('isMergeCategory', false)}
                style={[
                  styles.segment,
                  !form.isMergeCategory ? styles.segmentActive : undefined,
                ]}>
                <Text
                  style={[
                    styles.segmentText,
                    !form.isMergeCategory ? styles.segmentTextActive : undefined,
                  ]}>
                  {t('categories.normal')}
                </Text>
              </Pressable>
              <Pressable
                disabled={Boolean(selectedCategory)}
                onPress={() => updateForm('isMergeCategory', true)}
                style={[
                  styles.segment,
                  form.isMergeCategory ? styles.segmentActive : undefined,
                  selectedCategory ? styles.segmentDisabled : undefined,
                ]}>
                <Text
                  style={[
                    styles.segmentText,
                    form.isMergeCategory ? styles.segmentTextActive : undefined,
                  ]}>
                  {t('categories.merge')}
                </Text>
              </Pressable>
            </View>

            <FormField error={formErrors.name} label={t('categories.name')}>
              <AppTextInput
                onChangeText={text => updateForm('name', text)}
                value={form.name}
              />
            </FormField>

            <FormField
              error={formErrors.description}
              label={t('categories.description')}>
              <AppTextInput
                multiline
                onChangeText={text => updateForm('description', text)}
                style={styles.multilineInput}
                textAlignVertical="top"
                value={form.description}
              />
            </FormField>

            <FormField error={formErrors.color} label={t('categories.color')}>
              <View style={styles.colorField}>
                <View style={styles.swatchWrap}>
                  {PRESET_COLORS.map(color => {
                    const active = previewColor === color;

                    return (
                      <Pressable
                        key={color}
                        onPress={() => updateForm('color', color)}
                        style={[
                          styles.swatch,
                          {backgroundColor: color},
                          active ? styles.swatchActive : undefined,
                        ]}
                      />
                    );
                  })}
                </View>
                <AppTextInput
                  autoCapitalize="characters"
                  maxLength={7}
                  onChangeText={text => updateForm('color', text.toUpperCase())}
                  value={form.color}
                />
                <Text style={styles.colorHint}>{t('categories.colorHint')}</Text>
              </View>
            </FormField>

            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>{t('categories.liveBadge')}</Text>
              <View style={styles.previewChip}>
                <View
                  style={[
                    styles.colorDot,
                    {backgroundColor: previewColor},
                  ]}
                />
                <Text style={styles.previewText}>
                  {form.name.trim() || t('categories.previewName')}
                </Text>
              </View>
            </View>

            <View style={styles.formActions}>
              <View style={styles.inlineActionRow}>
                {formChanged ? (
                  <ActionButton
                    label={t('categories.reset')}
                    onPress={handleReset}
                    tone="secondary"
                  />
                ) : null}
                {selectedCategory ? (
                  <ActionButton
                    disabled={isDeleting || isSaving}
                    label={isDeleting ? t('book.deleting') : t('common.delete')}
                    onPress={handleDelete}
                    tone="destructive"
                  />
                ) : null}
              </View>
              <ActionButton
                disabled={isSaving || isDeleting}
                label={
                  selectedCategory
                    ? isSaving
                      ? t('categories.saving')
                      : t('categories.save')
                    : isSaving
                      ? t('categories.creating')
                      : t('categories.create')
                }
                onPress={() => {
                  void handleSubmit();
                }}
              />
            </View>
          </View>
        )}
      </PlaceholderCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
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
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  headerIcon: {
    height: 16,
    width: 16,
  },
  headerActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shortAction: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  groupSection: {
    gap: 10,
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  groupCount: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  categoryList: {
    gap: 10,
  },
  categoryRow: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  categoryRowActive: {
    backgroundColor: colors.accentSoftMuted,
    borderColor: colors.accent,
  },
  categoryRowMain: {
    gap: 6,
  },
  categoryRowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryNameWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  colorDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  categoryName: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8,
  },
  seedBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    color: colors.accentDeep,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeBadge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    color: colors.backgroundSoft,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
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
  segmentDisabled: {
    opacity: 0.65,
  },
  segmentText: {
    color: colors.accentDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.backgroundSoft,
  },
  multilineInput: {
    minHeight: 108,
    paddingTop: 14,
  },
  colorField: {
    gap: 10,
  },
  swatchWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 2,
    height: 34,
    width: 34,
  },
  swatchActive: {
    borderColor: colors.ink,
    transform: [{scale: 1.04}],
  },
  colorHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  previewBox: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  previewLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  previewChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoftMuted,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewText: {
    color: colors.accentDeep,
    fontSize: 14,
    fontWeight: '700',
  },
  formActions: {
    gap: 12,
  },
  inlineActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
