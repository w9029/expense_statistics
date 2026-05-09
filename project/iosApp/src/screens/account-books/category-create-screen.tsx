import {useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import type {AccountBookDetail, ExpenseCategory} from '@expense-statistics/domain';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ActionButton} from '@/components/action-button';
import {AppTextInput, FormField} from '@/components/form-field';
import {InlineBanner} from '@/components/inline-banner';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {SFSymbol} from '@/components/sf-symbol';
import {ColorWell} from '@/components/color-well';
import {useBookSession} from '@/features/account-books/book-session-context';
import {useAuth} from '@/features/auth/auth-context';
import {useToast} from '@/features/feedback/toast-context';
import {useI18n} from '@/features/i18n/i18n-context';
import {apiClient} from '@/lib/api';
import {getApiErrorMessage} from '@/lib/api-errors';
import type {CategoriesStackParamList} from '@/navigation/types';
import {colors} from '@/theme/colors';

type Props = NativeStackScreenProps<CategoriesStackParamList, 'CategoryCreate'>;

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

export function CategoryCreateScreen({navigation, route}: Props) {
  const {accountBookId, categoryId} = route.params;
  const auth = useAuth();
  const {setActiveAccountBookId} = useBookSession();
  const {showToast} = useToast();
  const {t} = useI18n();
  const [detail, setDetail] = useState<AccountBookDetail | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<CategoryFormErrors>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find(category => category.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const canEdit =
    detail?.my_role === 'owner' ||
    detail?.my_role === 'admin' ||
    detail?.my_role === 'editor';
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

  useEffect(() => {
    setActiveAccountBookId(accountBookId);
  }, [accountBookId, setActiveAccountBookId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
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

        if (cancelled) {
          return;
        }

        setDetail(nextDetail);
        setCategories(nextCategories);
      } catch (error) {
        if (!cancelled) {
          setPageError(getApiErrorMessage(error, t('categories.loadCategoriesFailed')));
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
  }, [accountBookId, auth.accessToken, t]);

  useEffect(() => {
    if (selectedCategory) {
      setForm(toFormValues(selectedCategory));
      setFormErrors({});
      return;
    }

    setForm(EMPTY_FORM);
    setFormErrors({});
  }, [selectedCategory]);

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

  function handleReset() {
    if (selectedCategory) {
      setForm(toFormValues(selectedCategory));
      setFormErrors({});
      return;
    }

    setForm(EMPTY_FORM);
    setFormErrors({});
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
      if (selectedCategory) {
        await apiClient.updateExpenseCategory(
          auth.accessToken,
          accountBookId,
          selectedCategory.id,
          payload,
        );
        showToast(t('categories.updated'), 'success');
      } else {
        await apiClient.createExpenseCategory(auth.accessToken, accountBookId, payload);
        showToast(t('categories.created'), 'success');
      }
      navigation.goBack();
    } catch (error) {
      setPageError(getApiErrorMessage(error, t('categories.actionFailed')));
    } finally {
      setIsSaving(false);
    }
  }

  function handleDelete() {
    if (!auth.accessToken || !selectedCategory || isDeleting) {
      return;
    }

    Alert.alert(t('common.delete'), t('categories.deleteConfirm'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('common.confirmDelete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsDeleting(true);
            setPageError(null);
            try {
              await apiClient.deleteExpenseCategory(
                auth.accessToken!,
                accountBookId,
                selectedCategory.id,
              );
              showToast(t('categories.deleted'), 'success');
              navigation.goBack();
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

  return (
    <ScreenShell hideHero title={t('categories.title')}>
      <PlaceholderCard
        title={selectedCategory ? t('categories.editTitle') : t('categories.createTitle')}
        description={
          selectedCategory
            ? t('categories.editDescription')
            : t('categories.createDescription')
        }
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
        {isLoading ? <InlineBanner message={t('categories.loading')} tone="info" /> : null}
        {pageError ? <InlineBanner message={pageError} tone="error" /> : null}

        {!canEdit && !isLoading ? (
          <InlineBanner message={t('categories.readonly')} tone="info" />
        ) : null}

        {!isLoading && canEdit ? (
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
                <ColorWell
                  colorHex={previewColor}
                  onColorChange={event => updateForm('color', event.nativeEvent.colorHex)}
                  style={styles.colorWell}
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
        ) : null}
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
  colorWell: {
    alignSelf: 'flex-start',
    height: 42,
    width: 62,
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
  colorDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
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
