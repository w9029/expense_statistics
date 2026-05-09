import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useI18n} from '@/features/i18n/i18n-context';
import {AccountBooksPlaceholderScreen} from '@/screens/account-books/account-books-placeholder-screen';
import {ProfilePlaceholderScreen} from '@/screens/profile/profile-placeholder-screen';
import type {AppTabParamList} from '@/navigation/types';

const Tab = createBottomTabNavigator<AppTabParamList>();

export function AppTabsNavigator() {
  const {t} = useI18n();

  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleAlign: 'center',
        tabBarActiveTintColor: '#17324d',
        tabBarInactiveTintColor: '#6f7f8f',
      }}>
      <Tab.Screen
        name="AccountBooks"
        component={AccountBooksPlaceholderScreen}
        options={{title: t('nav.books')}}
      />
      <Tab.Screen
        name="Profile"
        component={ProfilePlaceholderScreen}
        options={{title: t('nav.profile')}}
      />
    </Tab.Navigator>
  );
}
