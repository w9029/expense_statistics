import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '@/features/auth/auth-context';
import {useI18n} from '@/features/i18n/i18n-context';
import {AppTabsNavigator} from '@/navigation/tabs-navigator';
import {PublicNavigator} from '@/navigation/public-navigator';
import {AccountBookDetailScreen} from '@/screens/account-books/account-book-detail-screen';
import {
  MergedExpenseEditorPlaceholderScreen,
  NormalExpenseEditorPlaceholderScreen,
} from '@/screens/expenses/expense-editor-placeholder-screen';
import {InvitationScreen} from '@/screens/invitation/invitation-screen';
import {colors} from '@/theme/colors';
import type {RootStackParamList} from '@/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const auth = useAuth();
  const {t} = useI18n();

  if (auth.isInitializing) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{t('app.loading')}</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {auth.isAuthenticated ? (
        <>
          <Stack.Screen name="AppTabs" component={AppTabsNavigator} />
          <Stack.Screen name="Invitation" component={InvitationScreen} />
          <Stack.Screen
            name="NormalExpenseEditor"
            component={NormalExpenseEditorPlaceholderScreen}
          />
          <Stack.Screen
            name="MergedExpenseEditor"
            component={MergedExpenseEditorPlaceholderScreen}
          />
          <Stack.Screen
            name="AccountBookDetail"
            component={AccountBookDetailScreen}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="Public" component={PublicNavigator} />
          <Stack.Screen name="Invitation" component={InvitationScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 14,
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.muted,
    fontSize: 15,
  },
});
