import {PropsWithChildren} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {AuthProvider} from '@/features/auth/auth-context';
import {I18nProvider} from '@/features/i18n/i18n-context';
import {ToastProvider} from '@/features/feedback/toast-context';

export function AppProviders({children}: PropsWithChildren) {
  return (
    <AuthProvider>
      <I18nProvider>
        <ToastProvider>
          <NavigationContainer>{children}</NavigationContainer>
        </ToastProvider>
      </I18nProvider>
    </AuthProvider>
  );
}
