import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useI18n} from '@/features/i18n/i18n-context';
import {AccountBookDetailScreen} from '@/screens/account-books/account-book-detail-screen';
import {AccountBooksScreen} from '@/screens/account-books/account-books-screen';
import {ExpenseCategoriesScreen} from '@/screens/account-books/expense-categories-screen';
import {AnalyticsPlaceholderScreen} from '@/screens/account-books/analytics-placeholder-screen';
import {ProfileScreen} from '@/screens/profile/profile-screen';
import {colors} from '@/theme/colors';
import type {
  AccountBooksStackParamList,
  AppTabParamList,
} from '@/navigation/types';

const Tab = createBottomTabNavigator<AppTabParamList>();
const AccountBooksStack = createNativeStackNavigator<AccountBooksStackParamList>();

function AccountBooksStackNavigator() {
  return (
    <AccountBooksStack.Navigator screenOptions={{headerShown: false}}>
      <AccountBooksStack.Screen
        name="AccountBooksHome"
        component={AccountBooksScreen}
      />
      <AccountBooksStack.Screen
        name="AccountBookDetail"
        component={AccountBookDetailScreen}
      />
      <AccountBooksStack.Screen
        name="ExpenseCategories"
        component={ExpenseCategoriesScreen}
      />
      <AccountBooksStack.Screen
        name="Analytics"
        component={AnalyticsPlaceholderScreen}
      />
    </AccountBooksStack.Navigator>
  );
}

export function AppTabsNavigator() {
  const {t} = useI18n();

  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleAlign: 'center',
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}>
      <Tab.Screen
        name="AccountBooksTab"
        component={AccountBooksStackNavigator}
        options={{title: t('nav.books')}}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{title: t('nav.profile')}}
      />
    </Tab.Navigator>
  );
}
