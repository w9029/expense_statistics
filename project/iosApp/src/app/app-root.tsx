import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppProviders} from '@/app/providers';
import {RootNavigator} from '@/navigation/root-navigator';

export function AppRoot() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppProviders>
        <RootNavigator />
      </AppProviders>
    </SafeAreaProvider>
  );
}
