import {useEffect} from 'react';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {InlineBanner} from '@/components/inline-banner';
import {PlaceholderCard} from '@/components/placeholder-card';
import {ScreenShell} from '@/components/screen-shell';
import {useBookSession} from '@/features/account-books/book-session-context';
import {useI18n} from '@/features/i18n/i18n-context';
import type {AppTabParamList, CategoriesStackParamList} from '@/navigation/types';
import {AccountBookDetailScreen} from '@/screens/account-books/account-book-detail-screen';
import {AnalyticsPlaceholderScreen} from '@/screens/account-books/analytics-placeholder-screen';
import {CategoryCreateScreen} from '@/screens/account-books/category-create-screen';
import {ExpenseCategoriesScreen} from '@/screens/account-books/expense-categories-screen';

const CategoriesStack = createNativeStackNavigator<CategoriesStackParamList>();

function resolveAccountBookId(
  routeBookId: string | undefined,
  activeBookId: string | null,
) {
  return routeBookId ?? activeBookId ?? null;
}

export function ExpensesTabScreen({route, navigation}: BottomTabScreenProps<AppTabParamList, 'ExpensesTab'>) {
  const {activeAccountBookId} = useBookSession();
  const {t} = useI18n();
  const accountBookId = resolveAccountBookId(route.params?.accountBookId, activeAccountBookId);

  useEffect(() => {
    if (accountBookId && route.params?.accountBookId !== accountBookId) {
      navigation.setParams({accountBookId});
    }
  }, [accountBookId, navigation, route.params?.accountBookId]);

  if (!accountBookId) {
    return (
      <ScreenShell title={t('nav.expenses')} description={t('accountBooks.description')}>
        <PlaceholderCard title={t('nav.expenses')}>
          <InlineBanner message={t('accountBooks.empty')} tone="info" />
        </PlaceholderCard>
      </ScreenShell>
    );
  }

  const screenRoute = {
    key: `ExpensesTab-${accountBookId}`,
    name: 'ExpensesTab' as const,
    params: {accountBookId},
  };

  return <AccountBookDetailScreen route={screenRoute as never} navigation={navigation as never} />;
}

export function CategoriesTabScreen({route, navigation}: BottomTabScreenProps<AppTabParamList, 'CategoriesTab'>) {
  const {activeAccountBookId} = useBookSession();
  const {t} = useI18n();
  const accountBookId = resolveAccountBookId(route.params?.accountBookId, activeAccountBookId);

  useEffect(() => {
    if (accountBookId && route.params?.accountBookId !== accountBookId) {
      navigation.setParams({accountBookId});
    }
  }, [accountBookId, navigation, route.params?.accountBookId]);

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
    <CategoriesStack.Navigator>
      <CategoriesStack.Screen
        name="CategoriesHome"
        component={ExpenseCategoriesScreen}
        initialParams={{accountBookId}}
        options={{headerShown: false}}
      />
      <CategoriesStack.Screen
        name="CategoryCreate"
        component={CategoryCreateScreen}
        initialParams={{accountBookId}}
        options={{headerShown: false}}
      />
    </CategoriesStack.Navigator>
  );
}

export function AnalyticsTabScreen({route, navigation}: BottomTabScreenProps<AppTabParamList, 'AnalyticsTab'>) {
  const {activeAccountBookId} = useBookSession();
  const {t} = useI18n();
  const accountBookId = resolveAccountBookId(route.params?.accountBookId, activeAccountBookId);

  useEffect(() => {
    if (accountBookId && route.params?.accountBookId !== accountBookId) {
      navigation.setParams({accountBookId});
    }
  }, [accountBookId, navigation, route.params?.accountBookId]);

  if (!accountBookId) {
    return (
      <ScreenShell title={t('nav.analytics')} description={t('accountBooks.description')}>
        <PlaceholderCard title={t('nav.analytics')}>
          <InlineBanner message={t('accountBooks.empty')} tone="info" />
        </PlaceholderCard>
      </ScreenShell>
    );
  }

  const screenRoute = {
    key: `AnalyticsTab-${accountBookId}`,
    name: 'AnalyticsTab' as const,
    params: {accountBookId},
  };

  return <AnalyticsPlaceholderScreen route={screenRoute as never} navigation={navigation as never} />;
}
