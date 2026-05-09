import {useCallback, useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {AccountBookDetail, ExpenseCategory} from '@expense-statistics/domain';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ActionButton} from '@/components/action-button';
import {InlineBanner} from '@/components/inline-banner';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {useBookSession} from '@/features/account-books/book-session-context';
import {useAuth} from '@/features/auth/auth-context';
import {useI18n} from '@/features/i18n/i18n-context';
import {apiClient} from '@/lib/api';
import {getApiErrorMessage} from '@/lib/api-errors';
import type {CategoriesStackParamList} from '@/navigation/types';
import {colors} from '@/theme/colors';

type Props = NativeStackScreenProps<CategoriesStackParamList, 'CategoriesHome'>;

export function ExpenseCategoriesScreen({navigation, route}: Props) {
  const {accountBookId} = route.params;
  const auth = useAuth();
  const {setActiveAccountBookId} = useBookSession();
  const {t} = useI18n();
  const [detail, setDetail] = useState<AccountBookDetail | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const canEdit =
    detail?.my_role === 'owner' ||
    detail?.my_role === 'admin' ||
    detail?.my_role === 'editor';
  const normalCategories = categories.filter(category => !category.is_merge_category);
  const mergeCategories = categories.filter(category => category.is_merge_category);

  useEffect(() => {
    setActiveAccountBookId(accountBookId);
  }, [accountBookId, setActiveAccountBookId]);

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
      setPageError(getApiErrorMessage(error, t('categories.loadCategoriesFailed')));
    } finally {
      setIsLoading(false);
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
            {items.map(category => (
              <Pressable
                key={category.id}
                onPress={() =>
                  navigation.navigate('CategoryCreate', {
                    accountBookId,
                    categoryId: category.id,
                  })
                }
                style={styles.categoryRow}>
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
                    </View>
                  </View>
                  <Text style={styles.categoryDescription}>
                    {category.description ?? t('common.noDescription')}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <InlineBanner message={emptyText} tone="info" />
        )}
      </View>
    );
  }

  if (!accountBookId) {
    return (
      <ScreenShell title={t('nav.categories')} description={t('accountBooks.description')}>
        <PlaceholderCard title={t('nav.categories')}>
          <InlineBanner message={t('accountBooks.empty')} tone="info" />
        </PlaceholderCard>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell hideHero title={t('categories.title')}>
      <PlaceholderCard
        title={t('categories.title')}
        description={t('categories.subtitle')}>
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
            <ActionButton
              label={t('categories.add')}
              onPress={() => navigation.navigate('CategoryCreate', {accountBookId})}
              style={styles.shortAction}
              tone="secondary"
            />
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
  categoryDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
});
