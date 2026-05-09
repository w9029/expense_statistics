import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useI18n} from '@/features/i18n/i18n-context';
import {AccountBooksScreen} from '@/screens/account-books/account-books-screen';
import {ProfileScreen} from '@/screens/profile/profile-screen';
import {colors} from '@/theme/colors';
import type {AppTabParamList} from '@/navigation/types';

const Tab = createBottomTabNavigator<AppTabParamList>();

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
        name="AccountBooks"
        component={AccountBooksScreen}
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
