import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Pressable, StyleSheet, View} from 'react-native';
import type {BottomTabBarButtonProps} from '@react-navigation/bottom-tabs';
import {useBookSession} from '@/features/account-books/book-session-context';
import {useI18n} from '@/features/i18n/i18n-context';
import {AccountBooksScreen} from '@/screens/account-books/account-books-screen';
import {
  AnalyticsTabScreen,
  CategoriesTabScreen,
  ExpensesTabScreen,
} from '@/screens/account-books/book-tab-screen';
import {ProfileScreen} from '@/screens/profile/profile-screen';
import {colors} from '@/theme/colors';
import type {
  AppTabParamList,
} from '@/navigation/types';

const Tab = createBottomTabNavigator<AppTabParamList>();

function DisabledTabButton({
  children,
  disabled,
  onPress,
  accessibilityState,
}: BottomTabBarButtonProps & {disabled?: boolean}) {
  return (
    <Pressable
      accessibilityState={{...accessibilityState, disabled}}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={styles.tabButton}>
      <View pointerEvents="none" style={disabled ? styles.tabButtonDisabled : undefined}>
        {children}
      </View>
    </Pressable>
  );
}

export function AppTabsNavigator() {
  const {t} = useI18n();
  const {activeAccountBookId} = useBookSession();
  const isBookSelected = Boolean(activeAccountBookId);

  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleAlign: 'center',
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}>
      <Tab.Screen
        name="AccountBooksTab"
        component={AccountBooksScreen}
        options={{title: t('nav.books')}}
      />
      <Tab.Screen
        name="ExpensesTab"
        component={ExpensesTabScreen}
        options={{
          title: t('nav.expenses'),
          tabBarButton: props => (
            <DisabledTabButton {...props} disabled={!isBookSelected} />
          ),
        }}
      />
      <Tab.Screen
        name="CategoriesTab"
        component={CategoriesTabScreen}
        options={{
          title: t('nav.categories'),
          tabBarButton: props => (
            <DisabledTabButton {...props} disabled={!isBookSelected} />
          ),
        }}
      />
      <Tab.Screen
        name="AnalyticsTab"
        component={AnalyticsTabScreen}
        options={{
          title: t('nav.analytics'),
          tabBarButton: props => (
            <DisabledTabButton {...props} disabled={!isBookSelected} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{title: t('nav.profile')}}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabButton: {
    flex: 1,
  },
  tabButtonDisabled: {
    opacity: 0.45,
  },
});
