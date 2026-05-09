import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '@/features/auth/auth-context';
import {useI18n} from '@/features/i18n/i18n-context';
import {AppTabsNavigator} from '@/navigation/tabs-navigator';
import {PublicNavigator} from '@/navigation/public-navigator';
import {AccountBookDetailPlaceholderScreen} from '@/screens/account-books/account-book-detail-placeholder-screen';
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
          <Stack.Screen
            name="AccountBookDetail"
            component={AccountBookDetailPlaceholderScreen}
          />
        </>
      ) : (
        <Stack.Screen name="Public" component={PublicNavigator} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: '#f3eee6',
    flex: 1,
    gap: 14,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#30465d',
    fontSize: 15,
  },
});
